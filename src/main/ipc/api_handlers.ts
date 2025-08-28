import { ipcMain } from "electron";
import { ExternalAPIManager } from "../services/external_api_manager";
import { IPCResponse } from "../utils/ipc-handler";

// Re-export IPCResponse type for compatibility
export { IPCResponse } from "../utils/ipc-handler";

export class APIHandlers {
  private apiManager: ExternalAPIManager;

  constructor(apiManager: ExternalAPIManager) {
    this.apiManager = apiManager;
    this.setupHandlers();
  }

  private setupHandlers() {
    console.log("APIHandlers: Setting up IPC handlers...");

    // Authentication handlers
    ipcMain.handle("auth:signIn", this.handleSignIn.bind(this));
    console.log("APIHandlers: Registered auth:signIn handler");

    ipcMain.handle("auth:signUp", this.handleSignUp.bind(this));
    console.log("APIHandlers: Registered auth:signUp handler");

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
      "APIHandlers: Registered auth:deleteAccount and auth:completeOnboarding handlers"
    );

    // Database handlers
    ipcMain.handle("db:saveTranscript", this.handleSaveTranscript.bind(this));
    ipcMain.handle("db:getTranscripts", this.handleGetTranscripts.bind(this));
    ipcMain.handle(
      "db:saveUserSettings",
      this.handleSaveUserSettings.bind(this)
    );
    ipcMain.handle("db:getUserSettings", this.handleGetUserSettings.bind(this));
    ipcMain.handle("db:getUserStats", this.handleGetUserStats.bind(this));

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
  private async handleSignIn(
    event: any,
    credentials: { email: string; password: string }
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      if (!credentials?.email || !credentials?.password) {
        return this.createResponse(
          null,
          new Error("Email and password are required")
        );
      }

      const result = await this.apiManager.supabase.signIn(
        credentials.email,
        credentials.password
      );
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleSignUp(
    event: any,
    credentials: { email: string; password: string; name?: string }
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      if (!credentials?.email || !credentials?.password) {
        return this.createResponse(
          null,
          new Error("Email and password are required")
        );
      }

      const result = await this.apiManager.supabase.signUp(
        credentials.email,
        credentials.password,
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
      const result = await this.apiManager.supabase.signOut();
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
      const result = await this.apiManager.supabase.signInWithGoogle();

      if (result.data?.url) {
        console.log(
          "APIHandlers: Opening Google OAuth URL in external browser..."
        );
        // Import shell dynamically to open OAuth URL in browser
        const { shell } = require("electron");
        await shell.openExternal(result.data.url);

        // Return success indicating OAuth was initiated
        return this.createResponse({
          success: true,
          message:
            "Google OAuth initiated - please complete authentication in your browser",
        });
      } else {
        console.error("APIHandlers: No OAuth URL received from Supabase");
        return this.createResponse(
          null,
          new Error("Failed to initiate Google OAuth")
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
      const user = this.apiManager.supabase.getCurrentUser();
      return this.createResponse({ user });
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleDeleteAccount(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.apiManager.supabase.deleteAccount();
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
      const result = await this.apiManager.supabase.getUserProfile();
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
      const result = await this.apiManager.supabase.completeOnboarding();
      return this.createResponse(result);
    } catch (error) {
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
      const result = await this.apiManager.supabase.saveTranscript(transcript);
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetTranscripts(
    event: any,
    limit?: number
  ): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.apiManager.supabase.getTranscripts(limit);
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
      const result = await this.apiManager.supabase.saveUserSettings(settings);
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetUserSettings(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.apiManager.supabase.getUserSettings();
      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null, error);
    }
  }

  private async handleGetUserStats(event: any): Promise<IPCResponse> {
    if (!this.validateSender(event.sender)) {
      return this.createResponse(null, new Error("Unauthorized"));
    }

    try {
      const result = await this.apiManager.supabase.getUserStats();
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
      this.apiManager.analytics.track(data.event, data.properties);
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
      this.apiManager.analytics.identify(data.userId, data.properties);
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
      this.apiManager.analytics.trackUserSignUp(method);
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
      this.apiManager.analytics.trackUserSignIn(method);
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
      this.apiManager.analytics.trackUserSignOut();
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
      this.apiManager.analytics.trackRecordingStarted();
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
      this.apiManager.analytics.trackRecordingStopped(duration);
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
      this.apiManager.analytics.trackTranscriptionCompleted(
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
      this.apiManager.analytics.trackAppLaunched();
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
  }
}
