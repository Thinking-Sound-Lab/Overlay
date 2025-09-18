import { BrowserWindow } from "electron";

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  kind: string;
  groupId: string;
  hasPermission?: boolean; // Whether device label is from permissions or generic
}

export class MicrophoneService {
  private availableDevices: MicrophoneDevice[] = [];
  private mainWindow: BrowserWindow | null = null;
  private currentDeviceId = "default";
  private deviceChangeCallbacks: Set<(deviceId: string) => void> = new Set();

  constructor() {
  }

  async stop(): Promise<void> {
    console.log("[MicrophoneService] Stopping microphone service...");
    // Clear callbacks and references
    this.deviceChangeCallbacks.clear();
  }

  async dispose(): Promise<void> {
    console.log("[MicrophoneService] Disposing microphone service...");
    // Clean up all resources
    this.deviceChangeCallbacks.clear();
    this.mainWindow = null;
    this.availableDevices = [];
  }

  public setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Get available audio input devices from the main window
   * This requires the renderer process to enumerate devices due to permissions
   */
  public async getAvailableDevices(): Promise<MicrophoneDevice[]> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn(
        "[MicrophoneService] Main window not available for device enumeration"
      );
      return this.getDefaultDeviceList();
    }

    try {
      // Request device enumeration from renderer process without permissions
      const devices = await this.mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            // Enumerate devices WITHOUT requesting permissions first
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices
              .filter(device => device.kind === 'audioinput')
              .map((device, index) => ({
                deviceId: device.deviceId,
                // Provide generic labels when no permissions (device.label will be empty)
                label: device.label || \`Microphone \${index + 1}\`,
                kind: device.kind,
                groupId: device.groupId || '',
                hasPermission: Boolean(device.label) // Track if we have permission-based label
              }));
            
            // Remove duplicates and clean up labels to avoid "Default - " duplicates
            const uniqueDevices = audioInputs.reduce((unique, device) => {
              // Clean label by removing "Default - " prefix
              const cleanLabel = device.label.replace(/^Default - /, '');
              
              // Check if we already have this device (by clean label)
              const isDuplicate = unique.some(existing => {
                const existingCleanLabel = existing.label.replace(/^Default - /, '');
                return existingCleanLabel === cleanLabel;
              });
              
              if (!isDuplicate) {
                // Add device with cleaned label
                unique.push({
                  ...device,
                  label: cleanLabel
                });
              } else {
                // If duplicate found, prefer the non-"Default - " version
                const existingIndex = unique.findIndex(existing => {
                  const existingCleanLabel = existing.label.replace(/^Default - /, '');
                  return existingCleanLabel === cleanLabel;
                });
                
                // If existing device has "Default - " but current doesn't, replace it
                if (existingIndex >= 0 && unique[existingIndex].label.startsWith('Default - ') && !device.label.startsWith('Default - ')) {
                  unique[existingIndex] = {
                    ...device,
                    label: cleanLabel
                  };
                }
              }
              
              return unique;
            }, []);
            
            return uniqueDevices;
          } catch (error) {
            console.error('Device enumeration failed:', error);
            return [];
          }
        })()
      `);

      if (devices && devices.length > 0) {
        this.availableDevices = devices;
        console.log(
          `[MicrophoneService] Found ${devices.length} audio input devices:`,
          devices.map((d: MicrophoneDevice) => d.label)
        );
        return devices;
      } else {
        console.log(
          "[MicrophoneService] No devices found, returning default list"
        );
        return this.getDefaultDeviceList();
      }
    } catch (error) {
      console.error("[MicrophoneService] Failed to enumerate devices:", error);
      return this.getDefaultDeviceList();
    }
  }

  /**
   * Get a fallback list when device enumeration fails
   */
  private getDefaultDeviceList(): MicrophoneDevice[] {
    return [
      {
        deviceId: "default",
        label: "Default Microphone",
        kind: "audioinput",
        groupId: "",
      },
    ];
  }

  /**
   * Find device by deviceId
   */
  public async findDeviceById(
    deviceId: string
  ): Promise<MicrophoneDevice | null> {
    const devices = await this.getAvailableDevices();
    return devices.find((device) => device.deviceId === deviceId) || null;
  }

  /**
   * Validate if a device ID is still available
   */
  public async isDeviceAvailable(deviceId: string): Promise<boolean> {
    if (deviceId === "default") {
      return true; // Default is always available
    }

    const devices = await this.getAvailableDevices();
    return devices.some((device) => device.deviceId === deviceId);
  }

  /**
   * Get device constraints for getUserMedia
   */
  public async getDeviceConstraints(
    deviceId: string
  ): Promise<MediaTrackConstraints> {
    const baseConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
      channelCount: 1,
    };

    console.log(
      `[MicrophoneService] Getting constraints for device: ${deviceId}`
    );

    // Check if device is available
    const isAvailable = await this.isDeviceAvailable(deviceId);
    console.log(
      `[MicrophoneService] Device ${deviceId} available: ${isAvailable}`
    );

    // If it's the default device or device doesn't exist, don't specify deviceId
    if (deviceId === "default" || !isAvailable) {
      console.log(
        `[MicrophoneService] Using default device (deviceId: ${deviceId})`
      );
      return baseConstraints;
    }

    // Use specific device
    const specificConstraints = {
      ...baseConstraints,
      deviceId: { exact: deviceId },
    };
    console.log(`[MicrophoneService] Using specific device: ${deviceId}`);
    console.log(
      `[MicrophoneService] Final constraints:`,
      JSON.stringify(specificConstraints, null, 2)
    );
    return specificConstraints;
  }

  /**
   * Get a pretty display name for a device
   */
  public static getDisplayName(device: MicrophoneDevice): string {
    if (device.deviceId === "default") {
      return "Default Microphone";
    }

    // Clean up common device name patterns
    let name = device.label;

    // Remove common prefixes/suffixes
    name = name.replace(/^(Default - |Microphone - |Mic - )/, "");
    name = name.replace(/ \(.*\)$/, ""); // Remove parenthetical info
    name = name.replace(/\s+/, " ").trim(); // Clean whitespace

    return name || "Unknown Microphone";
  }

  /**
   * Request microphone permissions and refresh device list with real labels
   * Only call this when actually needed (e.g., before recording)
   */
  public async requestPermissionsAndRefreshDevices(): Promise<{
    success: boolean;
    devices?: MicrophoneDevice[];
    error?: string;
  }> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return { success: false, error: "Main window not available" };
    }

    try {
      const result = await this.mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            // Request microphone permissions
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Stop the stream immediately - we only needed permission
            stream.getTracks().forEach(track => track.stop());
            
            // Now enumerate devices with real labels
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices
              .filter(device => device.kind === 'audioinput')
              .map(device => ({
                deviceId: device.deviceId,
                label: device.label || 'Unknown Microphone',
                kind: device.kind,
                groupId: device.groupId || '',
                hasPermission: true // We now have permissions
              }));
            
            return { success: true, devices: audioInputs };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })()
      `);

      if (result.success && result.devices) {
        // Update cached devices with permission-based labels
        this.availableDevices = result.devices;
        console.log(
          `[MicrophoneService] Permissions granted, refreshed ${result.devices.length} devices with real labels`
        );
        return { success: true, devices: result.devices };
      } else {
        return {
          success: false,
          error: result.error || "Failed to get permissions",
        };
      }
    } catch (error) {
      console.error(
        "[MicrophoneService] Failed to request permissions:",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if microphone permissions have been granted
   */
  public async checkPermissions(): Promise<boolean> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return false;
    }

    try {
      const hasPermission = await this.mainWindow.webContents
        .executeJavaScript(`
        (async () => {
          try {
            const permission = await navigator.permissions.query({ name: 'microphone' });
            return permission.state === 'granted';
          } catch (error) {
            // Fallback: try to enumerate and check if we have device labels
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            return audioInputs.length > 0 && audioInputs[0].label !== '';
          }
        })()
      `);

      return hasPermission;
    } catch (error) {
      console.error("[MicrophoneService] Failed to check permissions:", error);
      return false;
    }
  }

  /**
   * Get current selected device ID (session-only)
   */
  public getCurrentDeviceId(): string {
    return this.currentDeviceId;
  }

  /**
   * Set current device ID and notify listeners (session-only, no database)
   */
  public async setCurrentDeviceId(
    deviceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[MicrophoneService] Setting current device to: ${deviceId}`);

      // Validate device is available
      if (deviceId !== "default") {
        const isAvailable = await this.isDeviceAvailable(deviceId);
        if (!isAvailable) {
          return {
            success: false,
            error: `Device ${deviceId} is not available`,
          };
        }
      }

      // Update current device
      this.currentDeviceId = deviceId;
      console.log(`[MicrophoneService] Device updated to: ${deviceId}`);

      // Notify all listeners about the change
      this.deviceChangeCallbacks.forEach((callback) => {
        try {
          callback(deviceId);
        } catch (error) {
          console.error(
            "[MicrophoneService] Error in device change callback:",
            error
          );
        }
      });

      return { success: true };
    } catch (error) {
      console.error("[MicrophoneService] Failed to set device:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Initialize device selection on app start
   * Automatically selects the first available device
   */
  public async initializeDefaultDevice(): Promise<{
    success: boolean;
    deviceId?: string;
    error?: string;
  }> {
    try {
      console.log("[MicrophoneService] Initializing default device selection");

      const devices = await this.getAvailableDevices();

      if (devices.length > 0) {
        // Use first available device that's not generic
        const realDevice = devices.find(
          (d) => d.hasPermission && d.deviceId !== "default"
        );
        const selectedDeviceId = realDevice
          ? realDevice.deviceId
          : devices[0].deviceId;

        this.currentDeviceId = selectedDeviceId;
        console.log(
          `[MicrophoneService] Initialized with device: ${selectedDeviceId} (${devices.find((d) => d.deviceId === selectedDeviceId)?.label})`
        );

        return { success: true, deviceId: selectedDeviceId };
      } else {
        console.log("[MicrophoneService] No devices found, using default");
        this.currentDeviceId = "default";
        return { success: true, deviceId: "default" };
      }
    } catch (error) {
      console.error(
        "[MicrophoneService] Failed to initialize default device:",
        error
      );
      this.currentDeviceId = "default";
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Register callback for device changes
   */
  public onDeviceChange(callback: (deviceId: string) => void): () => void {
    this.deviceChangeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.deviceChangeCallbacks.delete(callback);
    };
  }

  /**
   * Get constraints for current selected device
   */
  public async getCurrentDeviceConstraints(): Promise<MediaTrackConstraints> {
    return await this.getDeviceConstraints(this.currentDeviceId);
  }
}

export default MicrophoneService;
