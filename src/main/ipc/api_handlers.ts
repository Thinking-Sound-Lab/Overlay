import { ipcMain, shell, app } from "electron";
import { IPCResponse, Settings } from "../../shared/types";
import { MicrophoneService } from "../services/microphone_service";
import { DataLoaderService } from "../services/data_loader_service";
import { SupabaseService } from "../services/supabase_service";
import { AnalyticsService } from "../services/analytics_service";
import { WindowManager } from "../windows/window-manager";
import { PermissionsService } from "../services/permissions_service";
import { STTService } from "../services/stt_service";
import { AutoUpdateService } from "../services/auto_update_service";
import { AuthService } from "../services/auth_service";
import { filterSettingsByAccess } from "../../shared/utils/subscription-permissions";

export class APIHandlers {
  constructor(
    private supabaseService: SupabaseService,
    private analyticsService: AnalyticsService,
    private microphoneService: MicrophoneService,
    private dataLoaderService: DataLoaderService,
    private windowManager: WindowManager,
    private permissionsService: PermissionsService,
    private sttService: STTService,
    private autoUpdateService: AutoUpdateService,
    private authService: AuthService,
    private setHotkeyTestMode: (enabled: boolean) => void
  ) {}

  async initialize(): Promise<void> {
    console.log("[APIHandlers] Initializing API handlers...");
    this.setupHandlers();
  }

  async stop(): Promise<void> {
    console.log("[APIHandlers] Stopping API handlers...");
    // Remove IPC handlers
    this.removeAllHandlers();
  }

  private setupHandlers() {
    console.log("APIHandlers: Setting up IPC handlers...");

    // Authentication handlers
    ipcMain.handle(
      "auth:signInWithMagicLink",
      this.handleSignInWithMagicLink.bind(this)
    );
    console.log("APIHandlers: Registered auth:signInWithMagicLink handler");

    ipcMain.handle(
      "auth:signUpWithMagicLink",
      this.handleSignUpWithMagicLink.bind(this)
    );
    console.log("APIHandlers: Registered auth:signUpWithMagicLink handler");

    ipcMain.handle(
      "auth:signInWithGoogle",
      this.handleSignInWithGoogle.bind(this)
    );
    console.log("APIHandlers: Registered auth:signInWithGoogle handler");

    ipcMain.handle("auth:signOut", this.handleSignOut.bind(this));
    console.log("APIHandlers: Registered auth:signOut handler");

    ipcMain.handle("auth:getCurrentUser", this.handleGetCurrentUser.bind(this));
    console.log("APIHandlers: Registered auth:getCurrentUser handler");

    ipcMain.handle("auth:deleteAccount", this.handleDeleteAccount.bind(this));
    ipcMain.handle("auth:getUserProfile", this.handleGetUserProfile.bind(this));
    ipcMain.handle(
      "auth:completeOnboarding",
      this.handleCompleteOnboarding.bind(this)
    );
    console.log(
      "APIHandlers: Registered auth handlers including deleteAccount and completeOnboarding"
    );

    // Database handlers
    ipcMain.handle("db:saveTranscript", this.handleSaveTranscript.bind(this));
    ipcMain.handle("db:getTranscripts", this.handleGetTranscripts.bind(this));
    ipcMain.handle("db:downloadAudio", this.handleDownloadAudio.bind(this));
    ipcMain.handle(
      "db:saveUserSettings",
      this.handleSaveUserSettings.bind(this)
    );
    ipcMain.handle("db:getUserSettings", this.handleGetUserSettings.bind(this));
    ipcMain.handle("db:getUserStats", this.handleGetUserStats.bind(this));

    // Dictionary handlers
    ipcMain.handle(
      "dictionary:getDictionaryEntries",
      this.handleGetDictionaryEntries.bind(this)
    );
    ipcMain.handle(
      "dictionary:addDictionaryEntry",
      this.handleAddDictionaryEntry.bind(this)
    );
    ipcMain.handle(
      "dictionary:updateDictionaryEntry",
      this.handleUpdateDictionaryEntry.bind(this)
    );
    ipcMain.handle(
      "dictionary:deleteDictionaryEntry",
      this.handleDeleteDictionaryEntry.bind(this)
    );

    // Pro feature handlers
    ipcMain.handle("pro:startTrial", this.handleStartProTrial.bind(this));
    ipcMain.handle(
      "pro:updateSubscription",
      this.handleUpdateSubscription.bind(this)
    );
    ipcMain.handle(
      "pro:getSubscriptionInfo",
      this.handleGetSubscriptionInfo.bind(this)
    );

    // Analytics handlers
    ipcMain.handle("analytics:track", this.handleTrackEvent.bind(this));
    ipcMain.handle("analytics:identify", this.handleIdentifyUser.bind(this));
    ipcMain.handle(
      "analytics:trackUserSignUp",
      this.handleTrackUserSignUp.bind(this)
    );
    ipcMain.handle(
      "analytics:trackUserSignIn",
      this.handleTrackUserSignIn.bind(this)
    );
    ipcMain.handle(
      "analytics:trackUserSignOut",
      this.handleTrackUserSignOut.bind(this)
    );
    ipcMain.handle(
      "analytics:trackRecordingStarted",
      this.handleTrackRecordingStarted.bind(this)
    );
    ipcMain.handle(
      "analytics:trackRecordingStopped",
      this.handleTrackRecordingStopped.bind(this)
    );
    ipcMain.handle(
      "analytics:trackTranscriptionCompleted",
      this.handleTrackTranscriptionCompleted.bind(this)
    );
    ipcMain.handle(
      "analytics:trackAppLaunched",
      this.handleTrackAppLaunched.bind(this)
    );

    // Microphone management handlers
    ipcMain.handle(
      "microphone:getDevices",
      this.handleGetMicrophoneDevices.bind(this)
    );
    // NOTE: testDevice handler removed - deprecated method that triggers unwanted microphone access
    ipcMain.handle(
      "microphone:validateDevice",
      this.handleValidateMicrophoneDevice.bind(this)
    );
    ipcMain.handle(
      "microphone:getConstraints",
      this.handleGetMicrophoneConstraints.bind(this)
    );
    ipcMain.handle(
      "microphone:getCurrentDeviceConstraints",
      this.handleGetCurrentDeviceConstraints.bind(this)
    );
    ipcMain.handle(
      "microphone:setCurrentDevice",
      this.handleSetCurrentDevice.bind(this)
    );
    ipcMain.handle(
      "microphone:requestPermissions",
      this.handleRequestMicrophonePermissions.bind(this)
    );
    ipcMain.handle(
      "microphone:checkPermissions",
      this.handleCheckMicrophonePermissions.bind(this)
    );

    // Recording and Audio handlers
    ipcMain.handle("audio-recorded", this.handleAudioRecorded.bind(this));
    ipcMain.handle(
      "start-processing-audio",
      this.handleStartProcessingAudio.bind(this)
    );
    ipcMain.handle("recording:start", this.handleRecordingStart.bind(this));
    ipcMain.handle("recording:stop", this.handleRecordingStop.bind(this));
    ipcMain.handle("recording:cancel", this.handleRecordingCancel.bind(this));

    // Window Management handlers
    ipcMain.handle(
      "expand-recording-window",
      this.handleExpandRecordingWindow.bind(this)
    );
    ipcMain.handle(
      "compact-recording-window",
      this.handleCompactRecordingWindow.bind(this)
    );
    ipcMain.handle(
      "show-recording-tooltip",
      this.handleShowRecordingTooltip.bind(this)
    );

    // System/App handlers
    ipcMain.handle(
      "open-external-link",
      this.handleOpenExternalLink.bind(this)
    );
    ipcMain.handle("get-app-version", this.handleGetAppVersion.bind(this));

    // Auto-updater handlers
    ipcMain.handle("check-for-updates", this.handleCheckForUpdates.bind(this));
    ipcMain.handle("download-update", this.handleDownloadUpdate.bind(this));
    ipcMain.handle("install-update", this.handleInstallUpdate.bind(this));

    // Permission handlers
    ipcMain.handle(
      "check-accessibility-permission",
      this.handleCheckAccessibilityPermission.bind(this)
    );
    ipcMain.handle(
      "check-microphone-permission",
      this.handleCheckMicrophonePermission.bind(this)
    );
    ipcMain.handle(
      "request-accessibility-permission",
      this.handleRequestAccessibilityPermission.bind(this)
    );
    ipcMain.handle(
      "request-microphone-permission",
      this.handleRequestMicrophonePermission.bind(this)
    );

    // Authentication/Flow handlers
    ipcMain.handle(
      "on-authentication-complete",
      this.handleAuthenticationComplete.bind(this)
    );
    ipcMain.handle(
      "renderer-ready-for-auth",
      this.handleRendererReadyForAuth.bind(this)
    );

    // Window control handlers
    ipcMain.handle("window:close", this.handleWindowClose.bind(this));
    ipcMain.handle("window:minimize", this.handleWindowMinimize.bind(this));
    ipcMain.handle("window:maximize", this.handleWindowMaximize.bind(this));
    ipcMain.handle(
      "window:get-maximized-state",
      this.handleGetMaximizedState.bind(this)
    );

    // Testing/Debug handlers
    ipcMain.handle("start-hotkey-test", this.handleStartHotkeyTest.bind(this));
    ipcMain.handle("end-hotkey-test", this.handleEndHotkeyTest.bind(this));

    console.log("APIHandlers: All IPC handlers registered");
  }

  // Helper to validate sender and create response
  private validateSender(sender: any): boolean {
    // Basic sender validation - you can enhance this based on your security needs
    return sender && sender.getURL && typeof sender.getURL === "function";
  }

  private createResponse<T>(data?: T, error?: any): IPCResponse<T> {
    if (error) {
      const errorMessage =
        error?.message || error?.toString() || "Unknown error";
      console.error("IPC Handler Error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
    return {
      success: true,
      data,
    };
  }

  // Authentication handlers
  private async handleSignInWithMagicLink(
    event: any,
    credentials: { email: string }
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      if (!credentials?.email) {
        return this.createResponse(null, new Error("Email is required"));
      }

      const result = await this.authService.signInWithMagicLink(
        credentials.email
      );
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleSignUpWithMagicLink(
    event: any,
    credentials: { email: string; name: string }
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      if (!credentials?.email || !credentials?.name) {
        return this.createResponse(
          null,
          new Error("Email and name are required for signup")
        );
      }

      const result = await this.authService.signUpWithMagicLink(
        credentials.email,
        credentials.name
      );
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleSignOut(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.authService.signOut();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleSignInWithGoogle(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      console.log("APIHandlers: Handling Google sign-in request...");
      const result = await this.authService.signInWithGoogle();

      if (result.success && result.data?.url) {
        console.log(
          "APIHandlers: Opening Google OAuth URL in external browser..."
        );
        // Import shell dynamically to open OAuth URL in browser
        const { shell } = await import("electron");
        await shell.openExternal(result.data.url);

        // Return success indicating OAuth was initiated
        return this.createResponse({
          success: true,
          message:
            "Google OAuth initiated - please complete authentication in your browser",
        });
      } else {
        console.error("APIHandlers: No OAuth URL received from AuthService");
        return this.createResponse(
          null,
          new Error(result.error || "Failed to initiate Google OAuth")
        );
      }
    } catch (error) {
      console.error("APIHandlers: Google sign-in error:", error);
      return this.createResponse(null, error);
    }
  }

  private async handleGetCurrentUser(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const user = this.authService.getCurrentSession();
      return this.createResponse({ data: { user } });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleDeleteAccount(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.authService.deleteAccount();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetUserProfile(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = this.authService.getUserProfile();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleCompleteOnboarding(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.authService.completeOnboarding();
      if (result.success) {
        console.log(
          "[APIHandlers] Onboarding completed successfully via AuthService"
        );

        // Show recording window now that onboarding is completed
        console.log(
          "[APIHandlers] Showing recording window after onboarding completion"
        );
        this.windowManager.showRecordingWindow();

        return this.createResponse({ success: true });
      } else {
        console.error(
          "[APIHandlers] Failed to complete onboarding:",
          result.error
        );
        return this.createResponse(
          null,
          new Error(result.error || "Failed to complete onboarding")
        );
      }
    } catch (error) {
      console.error("[APIHandlers] Error in handleCompleteOnboarding:", error);
      return this.createResponse(null, error);
    }
  }

  // Database handlers
  private async handleSaveTranscript(
    event: any,
    transcript: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.supabaseService.saveTranscript(transcript);
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetTranscripts(
    event: any,
    limit?: number,
    offset?: number
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.dataLoaderService.getTranscripts(limit, offset);
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleDownloadAudio(
    event: any,
    audioFilePath: string
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    if (!audioFilePath) {
      return this.createResponse(
        null,
        new Error("Audio file path is required")
      );
    }

    try {
      const result = await this.dataLoaderService.downloadAudio(audioFilePath);
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleSaveUserSettings(
    event: any,
    settings: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      // Get user data for Pro access validation
      const userData = this.dataLoaderService.getCurrentUser();

      // Filter settings to remove Pro features user doesn't have access to
      const validatedSettings = filterSettingsByAccess(userData, settings);

      // Log any settings that were filtered out
      const filteredKeys = Object.keys(settings).filter(
        (key) => settings[key] !== validatedSettings[key]
      );
      if (filteredKeys.length > 0) {
        console.warn(
          "[API] Filtered Pro settings user doesn't have access to:",
          filteredKeys
        );
      }

      // Use DataLoaderService for DB-first settings update with validated settings
      const result = await this.dataLoaderService.updateUserSettings(
        validatedSettings as Settings
      );
      if (result.success) {
        return this.createResponse({ success: true });
      } else {
        throw new Error(result.error || "Failed to save settings");
      }
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetUserSettings(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      // Use DataLoaderService to get cached settings instead of direct database query
      // This ensures consistency with main process settings
      const settings = this.dataLoaderService.getUserSettings();
      console.log(
        `[API] Full settings object:`,
        JSON.stringify(settings, null, 2)
      );
      console.log(`[API] Returning user settings to renderer`);
      // Match the same response format as SupabaseService.getUserSettings()
      const response = this.createResponse({ data: settings, error: null });
      console.log(
        `[API] Final API response:`,
        JSON.stringify(response, null, 2)
      );
      return response;
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetUserStats(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.supabaseService.getUserStats();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Analytics handlers
  private async handleTrackEvent(
    event: any,
    data: { event: string; properties?: Record<string, any> }
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.track(data.event, data.properties);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleIdentifyUser(
    event: any,
    data: { userId: string; properties?: Record<string, any> }
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.identify(data.userId, data.properties);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleTrackUserSignUp(
    event: any,
    method: "email" | "google" | "github" = "email"
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.trackUserSignUp(method);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleTrackUserSignIn(
    event: any,
    method: "email" | "google" | "github" = "email"
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.trackUserSignIn(method);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleTrackUserSignOut(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.trackUserSignOut();
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleTrackRecordingStarted(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.trackRecordingStarted();
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleTrackRecordingStopped(
    event: any,
    duration: number
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.trackRecordingStopped(duration);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleTrackTranscriptionCompleted(
    event: any,
    data: { wordCount: number; wpm: number; wasTranslated: boolean }
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.trackTranscriptionCompleted(
        data.wordCount,
        data.wpm,
        data.wasTranslated
      );
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleTrackAppLaunched(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      this.analyticsService.trackAppLaunched();
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Microphone handlers
  private async handleGetMicrophoneDevices(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, "Unauthorized sender");
    }

    try {
      const devices = await this.microphoneService.getAvailableDevices();
      return this.createResponse({ devices });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // NOTE: handleTestMicrophoneDevice removed - deprecated method that triggers unwanted microphone access

  private async handleValidateMicrophoneDevice(
    event: any,
    deviceId: string
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, "Unauthorized sender");
    }

    try {
      const isAvailable =
        await this.microphoneService.isDeviceAvailable(deviceId);
      const device = isAvailable
        ? await this.microphoneService.findDeviceById(deviceId)
        : null;

      return this.createResponse({
        deviceId,
        isAvailable,
        device,
      });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetMicrophoneConstraints(
    event: any,
    deviceId: string
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, "Unauthorized sender");
    }

    try {
      console.log(
        `[API] Getting microphone constraints for device ID: ${deviceId}`
      );
      const constraints =
        await this.microphoneService.getDeviceConstraints(deviceId);
      console.log(`[API] Constraints for device ID: ${deviceId}:`, constraints);

      return this.createResponse({
        deviceId,
        constraints,
      });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetCurrentDeviceConstraints(
    event: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, "Unauthorized sender");
    }

    try {
      console.log(`[API] Getting constraints for current selected device`);
      const currentDeviceId = this.microphoneService.getCurrentDeviceId();
      const constraints =
        await this.microphoneService.getCurrentDeviceConstraints();

      console.log(
        `[API] Current device: ${currentDeviceId}, constraints loaded`
      );
      return this.createResponse({
        deviceId: currentDeviceId,
        constraints,
      });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleSetCurrentDevice(
    event: any,
    deviceId: string
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, "Unauthorized sender");
    }

    try {
      console.log(`[API] Setting current device to: ${deviceId}`);
      const result = await this.microphoneService.setCurrentDeviceId(deviceId);

      if (result.success) {
        // Notify recording window of device change
        if (this.windowManager) {
          this.windowManager.sendToRecording("microphone-device-changed", {
            deviceId: deviceId,
          });
        }

        console.log(`[API] Device set successfully to: ${deviceId}`);
        return this.createResponse({ success: true, deviceId });
      } else {
        return this.createResponse(
          null,
          result.error || "Failed to set device"
        );
      }
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleRequestMicrophonePermissions(
    event: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, "Unauthorized sender");
    }

    try {
      const result =
        await this.microphoneService.requestPermissionsAndRefreshDevices();

      if (result.success) {
        return this.createResponse({
          devices: result.devices || [],
          message: "Microphone permissions granted and device list refreshed",
        });
      } else {
        return this.createResponse(
          null,
          result.error || "Failed to get microphone permissions"
        );
      }
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleCheckMicrophonePermissions(
    event: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, "Unauthorized sender");
    }

    try {
      const hasPermissions = await this.microphoneService.checkPermissions();
      return this.createResponse({ hasPermissions });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Dictionary handlers
  private async handleGetDictionaryEntries(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.dataLoaderService.getDictionaryEntries();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleAddDictionaryEntry(
    event: any,
    key: string,
    value: string
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.dataLoaderService.addDictionaryEntry(
        key,
        value
      );
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleUpdateDictionaryEntry(
    event: any,
    id: string,
    key: string,
    value: string
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.dataLoaderService.updateDictionaryEntry(
        id,
        key,
        value
      );
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleDeleteDictionaryEntry(
    event: any,
    id: string
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.dataLoaderService.deleteDictionaryEntry(id);
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Pro feature handlers
  private async handleStartProTrial(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.dataLoaderService.startProTrial();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleUpdateSubscription(
    event: any,
    tier: "free" | "pro_trial" | "pro"
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.dataLoaderService.updateSubscriptionTier(tier);
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetSubscriptionInfo(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.supabaseService.getUserSubscriptionInfo();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Recording and Audio handlers
  private handleAudioRecorded(
    event: any,
    audioData: { data: string; mimeType: string }
  ): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      console.log(
        "[APIHandlers] Received audio chunk:",
        audioData.data.length,
        "bytes"
      );
      if (this.sttService.isRecording()) {
        this.sttService.receiveAudioData(audioData.data);
      }
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleStartProcessingAudio(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      await this.sttService.startProcessing();
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleRecordingStart(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      await this.sttService.startRecording();
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleRecordingStop(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      await this.sttService.stopRecording();
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleRecordingCancel(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      await this.sttService.cancelRecording();
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Window Management handlers
  private handleExpandRecordingWindow(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      if (
        this.windowManager.getRecordingWindow() &&
        !this.windowManager.getRecordingWindow().isDestroyed()
      ) {
        this.windowManager.expandRecordingWindow();
      }
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private handleCompactRecordingWindow(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      if (
        this.windowManager.getRecordingWindow() &&
        !this.windowManager.getRecordingWindow().isDestroyed()
      ) {
        this.windowManager.compactRecordingWindow();
      }
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private handleShowRecordingTooltip(
    event: any,
    type: string,
    message: string
  ): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const tooltipMessage = {
        type: type as any,
        title: "",
        message,
        duration: 500,
      };
      this.windowManager.showInformation(tooltipMessage);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // System/App handlers
  private handleOpenExternalLink(event: any, url: string): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      shell.openExternal(url);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private handleGetAppVersion(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      return this.createResponse({ version: app.getVersion() });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Auto-updater handlers
  private async handleCheckForUpdates(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    const result = await this.autoUpdateService.checkForUpdates();
    if (result.success) {
      return this.createResponse({ success: true });
    } else {
      return this.createResponse(null, new Error(result.error));
    }
  }

  private async handleDownloadUpdate(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    const result = await this.autoUpdateService.downloadUpdate();
    if (result.success) {
      return this.createResponse({ success: true });
    } else {
      return this.createResponse(null, new Error(result.error));
    }
  }

  private async handleInstallUpdate(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    const result = await this.autoUpdateService.installUpdate();
    if (result.success) {
      return this.createResponse({ success: true });
    } else {
      return this.createResponse(null, new Error(result.error));
    }
  }

  // Permission handlers
  private async handleCheckAccessibilityPermission(
    event: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result =
        await this.permissionsService.checkAccessibilityPermission();
      return this.createResponse({ granted: result.granted });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleCheckMicrophonePermission(
    event: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.permissionsService.checkMicrophonePermission();
      return this.createResponse({ granted: result.granted });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleRequestAccessibilityPermission(
    event: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result =
        await this.permissionsService.requestAccessibilityPermission();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleRequestMicrophonePermission(
    event: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result =
        await this.permissionsService.requestMicrophonePermission();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Authentication/Flow handlers (only the ones actually used)
  private async handleAuthenticationComplete(
    event: any,
    user: any
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      if (!user) {
        return this.createResponse(null, new Error("No user data provided"));
      }
      // Just return success - main authentication handling is done elsewhere
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleRendererReadyForAuth(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      // Signal AuthService that renderer is ready
      this.authService.setRendererReady(true);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Window control handlers
  private handleWindowClose(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private handleWindowMinimize(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
      }
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private handleWindowMaximize(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
          return this.createResponse({ success: true, action: "unmaximized" });
        } else {
          mainWindow.maximize();
          return this.createResponse({ success: true, action: "maximized" });
        }
      }
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private handleGetMaximizedState(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        return this.createResponse({ isMaximized: mainWindow.isMaximized() });
      }
      return this.createResponse({ isMaximized: false });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Testing/Debug handlers (only the ones actually used)
  private handleStartHotkeyTest(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      console.log("[APIHandlers] Starting hotkey test mode");
      this.setHotkeyTestMode(true);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private handleEndHotkeyTest(event: any): IPCResponse {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      console.log("[APIHandlers] Ending hotkey test mode");
      this.setHotkeyTestMode(false);
      return this.createResponse({ success: true });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  // Cleanup method
  removeAllHandlers() {
    console.log("APIHandlers: Removing all IPC handlers...");
    ipcMain.removeAllListeners("auth:signIn");
    ipcMain.removeAllListeners("auth:signUp");
    ipcMain.removeAllListeners("auth:signInWithGoogle");
    ipcMain.removeAllListeners("auth:signOut");
    ipcMain.removeAllListeners("auth:getCurrentUser");
    ipcMain.removeAllListeners("auth:deleteAccount");
    ipcMain.removeAllListeners("auth:getUserProfile");
    ipcMain.removeAllListeners("auth:completeOnboarding");
    ipcMain.removeAllListeners("db:saveTranscript");
    ipcMain.removeAllListeners("db:getTranscripts");
    ipcMain.removeAllListeners("db:downloadAudio");
    ipcMain.removeAllListeners("db:saveUserSettings");
    ipcMain.removeAllListeners("db:getUserSettings");
    ipcMain.removeAllListeners("db:getUserStats");
    ipcMain.removeAllListeners("analytics:track");
    ipcMain.removeAllListeners("analytics:identify");
    ipcMain.removeAllListeners("analytics:trackUserSignUp");
    ipcMain.removeAllListeners("analytics:trackUserSignIn");
    ipcMain.removeAllListeners("analytics:trackUserSignOut");
    ipcMain.removeAllListeners("analytics:trackRecordingStarted");
    ipcMain.removeAllListeners("analytics:trackRecordingStopped");
    ipcMain.removeAllListeners("analytics:trackTranscriptionCompleted");
    ipcMain.removeAllListeners("analytics:trackAppLaunched");
    ipcMain.removeAllListeners("microphone:getDevices");
    // NOTE: testDevice listener removed - deprecated method
    ipcMain.removeAllListeners("microphone:validateDevice");
    ipcMain.removeAllListeners("microphone:getConstraints");
    ipcMain.removeAllListeners("microphone:getCurrentDeviceConstraints");
    ipcMain.removeAllListeners("microphone:setCurrentDevice");
    ipcMain.removeAllListeners("microphone:requestPermissions");
    ipcMain.removeAllListeners("microphone:checkPermissions");
    ipcMain.removeAllListeners("dictionary:getDictionaryEntries");
    ipcMain.removeAllListeners("dictionary:addDictionaryEntry");
    ipcMain.removeAllListeners("dictionary:updateDictionaryEntry");
    ipcMain.removeAllListeners("dictionary:deleteDictionaryEntry");
    ipcMain.removeAllListeners("pro:startTrial");
    ipcMain.removeAllListeners("pro:updateSubscription");
    ipcMain.removeAllListeners("pro:getSubscriptionInfo");

    // Remove new handlers
    ipcMain.removeAllListeners("audio-recorded");
    ipcMain.removeAllListeners("start-processing-audio");
    ipcMain.removeAllListeners("recording:start");
    ipcMain.removeAllListeners("recording:stop");
    ipcMain.removeAllListeners("recording:cancel");
    ipcMain.removeAllListeners("expand-recording-window");
    ipcMain.removeAllListeners("compact-recording-window");
    ipcMain.removeAllListeners("show-recording-tooltip");
    ipcMain.removeAllListeners("open-external-link");
    ipcMain.removeAllListeners("get-app-version");
    ipcMain.removeAllListeners("check-for-updates");
    ipcMain.removeAllListeners("download-update");
    ipcMain.removeAllListeners("install-update");
    ipcMain.removeAllListeners("check-accessibility-permission");
    ipcMain.removeAllListeners("check-microphone-permission");
    ipcMain.removeAllListeners("request-accessibility-permission");
    ipcMain.removeAllListeners("request-microphone-permission");
    ipcMain.removeAllListeners("on-authentication-complete");
    ipcMain.removeAllListeners("renderer-ready-for-auth");
    ipcMain.removeAllListeners("window:close");
    ipcMain.removeAllListeners("window:minimize");
    ipcMain.removeAllListeners("window:maximize");
    ipcMain.removeAllListeners("window:get-maximized-state");
    ipcMain.removeAllListeners("start-hotkey-test");
    ipcMain.removeAllListeners("end-hotkey-test");
  }
}
