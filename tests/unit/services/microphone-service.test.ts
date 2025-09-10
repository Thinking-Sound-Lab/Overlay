// Unit tests for MicrophoneService
import MicrophoneService from "../../../src/main/services/microphone_service";

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

Object.defineProperty(global, "navigator", {
  value: {
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: mockEnumerateDevices,
    },
  },
  writable: true,
});

describe("MicrophoneService", () => {
  let microphoneService: MicrophoneService;
  let mockMainWindow: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a mock BrowserWindow
    mockMainWindow = {
      isDestroyed: jest.fn().mockReturnValue(false),
      webContents: {
        executeJavaScript: jest.fn(),
      },
    };

    // Get a fresh instance
    microphoneService = MicrophoneService.getInstance();

    // Reset singleton state and set main window
    (microphoneService as any).currentDeviceId = null;
    (microphoneService as any).availableDevices = [];
    (microphoneService as any).mainWindow = mockMainWindow;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getInstance", () => {
    it("should return the same instance (singleton)", () => {
      const instance1 = MicrophoneService.getInstance();
      const instance2 = MicrophoneService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("getAvailableDevices", () => {
    it("should return available audio input devices", async () => {
      const mockDevicesResult = [
        {
          deviceId: "device1",
          label: "Microphone 1",
          kind: "audioinput",
          groupId: "",
        },
        {
          deviceId: "device2",
          label: "Microphone 2",
          kind: "audioinput",
          groupId: "",
        },
      ];

      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );

      const result = await microphoneService.getAvailableDevices();

      expect(mockMainWindow.webContents.executeJavaScript).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          deviceId: "device1",
          label: "Microphone 1",
          kind: "audioinput",
        })
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          deviceId: "device2",
          label: "Microphone 2",
          kind: "audioinput",
        })
      );
    });

    it("should handle enumerate devices failure", async () => {
      const error = new Error("Permission denied");
      mockMainWindow.webContents.executeJavaScript.mockRejectedValue(error);

      const result = await microphoneService.getAvailableDevices();

      // Should return default device list when executeJavaScript fails
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          deviceId: "default",
          label: "Default Microphone",
        })
      );
    });

    it("should call executeJavaScript for each device enumeration request", async () => {
      const mockDevicesResult = [
        {
          deviceId: "device1",
          label: "Microphone 1",
          kind: "audioinput",
          groupId: "",
        },
      ];

      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );

      // Reset mock call count since other tests may have called it
      mockMainWindow.webContents.executeJavaScript.mockClear();

      // First call
      const result1 = await microphoneService.getAvailableDevices();
      // Second call
      const result2 = await microphoneService.getAvailableDevices();

      // Both calls should succeed and return the same data
      expect(result1).toEqual(result2);
      expect(result1[0]).toEqual(
        expect.objectContaining({
          deviceId: "device1",
          label: "Microphone 1",
        })
      );
      // Service calls executeJavaScript each time (no caching currently implemented)
      expect(
        mockMainWindow.webContents.executeJavaScript
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe("isDeviceAvailable", () => {
    beforeEach(async () => {
      const mockDevicesResult = [
        {
          deviceId: "available-device",
          label: "Available Microphone",
          kind: "audioinput",
          groupId: "",
        },
      ];
      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );

      // Populate the cache
      await microphoneService.getAvailableDevices();
    });

    it("should return true for available device", async () => {
      const result =
        await microphoneService.isDeviceAvailable("available-device");
      expect(result).toBe(true);
    });

    it("should return false for unavailable device", async () => {
      const result = await microphoneService.isDeviceAvailable(
        "non-existent-device"
      );
      expect(result).toBe(false);
    });

    it("should return false for empty device ID", async () => {
      const result = await microphoneService.isDeviceAvailable("");
      expect(result).toBe(false);
    });
  });

  describe("findDeviceById", () => {
    beforeEach(async () => {
      const mockDevicesResult = [
        {
          deviceId: "device1",
          label: "Microphone 1",
          kind: "audioinput",
          groupId: "",
        },
        {
          deviceId: "device2",
          label: "Microphone 2",
          kind: "audioinput",
          groupId: "",
        },
      ];
      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );

      // Populate the cache
      await microphoneService.getAvailableDevices();
    });

    it("should return device when found", async () => {
      const device = await microphoneService.findDeviceById("device1");

      expect(device).toEqual(
        expect.objectContaining({
          deviceId: "device1",
          label: "Microphone 1",
        })
      );
    });

    it("should return null when device not found", async () => {
      const device = await microphoneService.findDeviceById("non-existent");
      expect(device).toBe(null);
    });
  });

  describe("setCurrentDeviceId", () => {
    beforeEach(async () => {
      const mockDevicesResult = [
        {
          deviceId: "valid-device",
          label: "Valid Microphone",
          kind: "audioinput",
          groupId: "",
        },
      ];
      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );
      await microphoneService.getAvailableDevices();
    });

    it("should set device ID when device is available", async () => {
      const result = await microphoneService.setCurrentDeviceId("valid-device");

      expect(result.success).toBe(true);
      expect(microphoneService.getCurrentDeviceId()).toBe("valid-device");
    });

    it("should fail to set invalid device ID", async () => {
      const result =
        await microphoneService.setCurrentDeviceId("invalid-device");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not available");
      expect(microphoneService.getCurrentDeviceId()).toBe(null);
    });

    it("should fail to set empty device ID", async () => {
      const result = await microphoneService.setCurrentDeviceId("");

      expect(result.success).toBe(false);
      expect(result.error).toContain("is not available");
    });
  });

  describe("getCurrentDeviceId", () => {
    it("should return null initially", () => {
      expect(microphoneService.getCurrentDeviceId()).toBe(null);
    });

    it("should return current device ID after setting", async () => {
      const mockDevicesResult = [
        {
          deviceId: "test-device",
          label: "Test Microphone",
          kind: "audioinput",
          groupId: "",
        },
      ];
      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );
      await microphoneService.getAvailableDevices();

      await microphoneService.setCurrentDeviceId("test-device");

      expect(microphoneService.getCurrentDeviceId()).toBe("test-device");
    });
  });

  describe("getDeviceConstraints", () => {
    beforeEach(async () => {
      const mockDevicesResult = [
        {
          deviceId: "test-device",
          label: "Test Microphone",
          kind: "audioinput",
          groupId: "",
        },
      ];
      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );
      await microphoneService.getAvailableDevices();
    });

    it("should return constraints for valid device", async () => {
      const constraints =
        await microphoneService.getDeviceConstraints("test-device");

      expect(constraints).toEqual({
        deviceId: { exact: "test-device" },
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    });

    it("should return base constraints for invalid device", async () => {
      const constraints =
        await microphoneService.getDeviceConstraints("invalid-device");

      // Should return base constraints without deviceId for invalid device
      expect(constraints).toEqual({
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    });
  });

  describe("requestPermissionsAndRefreshDevices", () => {
    it("should request permissions and refresh device list", async () => {
      // Mock the executeJavaScript call to return success result with devices
      const mockDevicesArray = [
        {
          deviceId: "new-device",
          label: "New Microphone",
          kind: "audioinput",
          groupId: "",
          hasPermission: true,
        },
      ];
      const mockResult = { success: true, devices: mockDevicesArray };

      // Clear previous calls
      mockMainWindow.webContents.executeJavaScript.mockClear();

      // Mock to return success result with device list
      mockMainWindow.webContents.executeJavaScript.mockResolvedValueOnce(
        mockResult
      );

      const result =
        await microphoneService.requestPermissionsAndRefreshDevices();

      expect(result.success).toBe(true);
      expect(result.devices).toHaveLength(1);
      expect(result.devices?.[0]).toEqual(
        expect.objectContaining({
          deviceId: "new-device",
          label: "New Microphone",
        })
      );
    });

    it("should handle permission denied", async () => {
      const error = new Error("Permission denied");
      mockMainWindow.webContents.executeJavaScript.mockRejectedValue(error);

      const result =
        await microphoneService.requestPermissionsAndRefreshDevices();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    });
  });

  describe("checkPermissions", () => {
    it("should return true when permissions are granted", async () => {
      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(true);

      const hasPermissions = await microphoneService.checkPermissions();

      expect(hasPermissions).toBe(true);
      expect(mockMainWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it("should return false when permissions are denied", async () => {
      const error = new Error("Permission denied");
      mockMainWindow.webContents.executeJavaScript.mockRejectedValue(error);

      const hasPermissions = await microphoneService.checkPermissions();

      expect(hasPermissions).toBe(false);
    });
  });

  describe("initializeDefaultDevice", () => {
    it("should set first available device as default", async () => {
      const mockDevicesResult = [
        {
          deviceId: "first-device",
          label: "First Microphone",
          kind: "audioinput",
          groupId: "",
        },
        {
          deviceId: "second-device",
          label: "Second Microphone",
          kind: "audioinput",
          groupId: "",
        },
      ];
      mockMainWindow.webContents.executeJavaScript.mockResolvedValue(
        mockDevicesResult
      );

      await microphoneService.initializeDefaultDevice();

      expect(microphoneService.getCurrentDeviceId()).toBe("first-device");
    });

    it("should handle no devices available", async () => {
      // When no window is available, it should still set default device
      (microphoneService as any).mainWindow = null;

      await microphoneService.initializeDefaultDevice();

      // Should set the default device from the fallback list
      expect(microphoneService.getCurrentDeviceId()).toBe("default");
    });
  });
});
