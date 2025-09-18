import { systemPreferences } from "electron";

export interface PermissionStatus {
  granted: boolean;
  error?: string;
}

export class PermissionsService {
  constructor() {}

  /**
   * Check if accessibility permissions are granted
   */
  public async checkAccessibilityPermission(): Promise<PermissionStatus> {
    try {
      if (process.platform === "darwin") {
        // macOS: Use Electron's built-in accessibility check
        const hasAccessibility =
          systemPreferences.isTrustedAccessibilityClient(false);
        return { granted: hasAccessibility };
      } else if (process.platform === "win32") {
        // Windows: No accessibility permissions required for SendInput API
        console.log(
          "[PermissionsService] Windows: No accessibility permission required for native text insertion"
        );
        return { granted: true };
      } else {
        return {
          granted: false,
          error: `Platform ${process.platform} is not supported. Please use macOS or Windows.`,
        };
      }
    } catch (error) {
      console.error(
        "[PermissionsService] Error checking accessibility permission:",
        error
      );
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
        const status = systemPreferences.getMediaAccessStatus("microphone");
        return {
          granted: status === "granted",
          error: status === "denied" ? "Microphone access denied" : undefined,
        };
      } else {
        return {
          granted: false,
          error: `Platform ${process.platform} is not supported. Please use macOS or Windows.`,
        };
      }
    } catch (error) {
      console.error(
        "[PermissionsService] Error checking microphone permission:",
        error
      );
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
        // Windows: No accessibility permission required for native text insertion
        console.log(
          "[PermissionsService] Windows: No accessibility permission required"
        );
        return { success: true };
      } else {
        console.error(
          `[PermissionsService] Platform ${process.platform} is not supported`
        );
        return { success: false };
      }
    } catch (error) {
      console.error(
        "[PermissionsService] Error requesting accessibility permission:",
        error
      );
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
        const granted = await systemPreferences.askForMediaAccess("microphone");
        return { success: granted };
      } else {
        console.error(
          `[PermissionsService] Platform ${process.platform} is not supported`
        );
        return { success: false };
      }
    } catch (error) {
      console.error(
        "[PermissionsService] Error requesting microphone permission:",
        error
      );
      return { success: false };
    }
  }
}
