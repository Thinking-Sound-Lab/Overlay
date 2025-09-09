import { systemPreferences, shell } from "electron";

export interface PermissionStatus {
  granted: boolean;
  error?: string;
}

export class PermissionsService {
  private static instance: PermissionsService;

  private constructor() {}

  public static getInstance(): PermissionsService {
    if (!PermissionsService.instance) {
      PermissionsService.instance = new PermissionsService();
    }
    return PermissionsService.instance;
  }

  /**
   * Check if accessibility permissions are granted
   */
  public async checkAccessibilityPermission(): Promise<PermissionStatus> {
    try {
      if (process.platform === "darwin") {
        // macOS: Use Electron's built-in accessibility check
        const hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false);
        return { granted: hasAccessibility };
      } else if (process.platform === "win32") {
        // Windows: Limited accessibility API support in Electron
        // For now, we assume granted (Windows doesn't have the same accessibility permission model)
        console.warn("[PermissionsService] Windows accessibility checking limited - assuming granted");
        return { granted: true };
      } else if (process.platform === "linux") {
        // Linux: No Electron API available, assume granted
        console.warn("[PermissionsService] Linux accessibility checking not available - assuming granted");
        return { granted: true };
      } else {
        return {
          granted: false,
          error: `Accessibility permission checking not supported on ${process.platform}`,
        };
      }
    } catch (error) {
      console.error("[PermissionsService] Error checking accessibility permission:", error);
      return {
        granted: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if microphone permissions are granted
   */
  public async checkMicrophonePermission(): Promise<PermissionStatus> {
    try {
      if (process.platform === "darwin" || process.platform === "win32") {
        // macOS and Windows: Use Electron's built-in media access check
        const status = systemPreferences.getMediaAccessStatus('microphone');
        return { 
          granted: status === 'granted',
          error: status === 'denied' ? 'Microphone access denied' : undefined
        };
      } else if (process.platform === "linux") {
        // Linux: No standardized permission system, assume granted if we can enumerate devices
        console.warn("[PermissionsService] Linux microphone permission checking limited - assuming granted");
        return { granted: true };
      } else {
        return {
          granted: false,
          error: `Microphone permission checking not supported on ${process.platform}`,
        };
      }
    } catch (error) {
      console.error("[PermissionsService] Error checking microphone permission:", error);
      return {
        granted: false,
        error: error.message,
      };
    }
  }

  /**
   * Request accessibility permissions
   */
  public async requestAccessibilityPermission(): Promise<{ success: boolean }> {
    try {
      if (process.platform === "darwin") {
        // macOS: Use Electron's built-in accessibility permission request
        // This will show the system dialog to grant accessibility permission
        const granted = systemPreferences.isTrustedAccessibilityClient(true);
        return { success: granted };
      } else if (process.platform === "win32") {
        // Windows: Open accessibility settings
        try {
          await shell.openExternal('ms-settings:easeofaccess-narrator');
          return { success: true };
        } catch (error) {
          console.error("[PermissionsService] Failed to open Windows accessibility settings:", error);
          return { success: false };
        }
      } else if (process.platform === "linux") {
        // Linux: Try to open accessibility settings (varies by desktop environment)
        try {
          // Try GNOME Settings first
          await shell.openExternal('gnome-control-center universal-access');
          return { success: true };
        } catch {
          console.warn('[PermissionsService] Could not open accessibility settings automatically on Linux');
          return { success: false };
        }
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error("[PermissionsService] Error requesting accessibility permission:", error);
      return { success: false };
    }
  }

  /**
   * Request microphone permissions
   */
  public async requestMicrophonePermission(): Promise<{ success: boolean }> {
    try {
      if (process.platform === "darwin" || process.platform === "win32") {
        // macOS and Windows: Use Electron's built-in media access request
        const granted = await systemPreferences.askForMediaAccess('microphone');
        return { success: granted };
      } else if (process.platform === "linux") {
        // Linux: No standardized permission request, return success
        console.warn("[PermissionsService] Linux microphone permission request not available");
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error("[PermissionsService] Error requesting microphone permission:", error);
      return { success: false };
    }
  }

}