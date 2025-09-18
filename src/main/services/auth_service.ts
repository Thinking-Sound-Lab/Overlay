import { User } from "@supabase/auth-js/dist/module";
import { SupabaseService } from "./supabase_service";
import { AuthStateEventData, DataLoaderService } from "./data_loader_service";
import { WindowManager } from "../windows/window-manager";
import { AnalyticsService } from "./analytics_service";
import { STTService } from "./stt_service";
import type {
  UserRecord,
} from "../../shared/types";

// interface AuthStateEventData {
//   user: UserRecord | null;
//   authenticated: boolean;
//   statistics: UserStats | null;
//   settings: Settings | null;
//   recentTranscripts: UITranscriptEntry[];
//   totalTranscriptCount?: number;
// }

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: UserRecord;
  data?: any;
}

export class AuthService {
  private initialized = false;
  private rendererReady = false;
  private isAuthenticated = false;

  constructor(
    private supabaseService: SupabaseService,
    private dataLoaderService: DataLoaderService,
    private windowManager: WindowManager,
    private analyticsService: AnalyticsService,
    private sttService?: STTService
  ) {}

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn("[AuthService] Service already initialized");
      return;
    }

    console.log("[AuthService] Initializing authentication service...");

    // Set up auth state change callback
    this.supabaseService.setAuthStateChangeCallback(async (user) => {
      if (this.rendererReady) {
        // Normal flow - renderer is ready to handle auth events
        console.log(
          "[AuthService] Auth state change detected, renderer is ready"
        );
        if (user) {
          await this.handleAuthenticationSuccess(user, "Auth State Change");
        } else {
          this.handleAuthenticationFailure(
            "User signed out",
            "Auth State Change"
          );
        }
      } else {
        // Renderer not ready yet - only handle logout (cleanup), defer login events
        if (!user) {
          this.handleAuthenticationFailure(
            "User signed out",
            "Auth State Change - Early"
          );
        }
        // For login events, wait for renderer to signal ready and check auth state then
        console.log(
          "[AuthService] Auth state change detected but renderer not ready, deferring login event"
        );
      }
    });

    this.initialized = true;
    console.log(
      "[AuthService] Authentication service initialized successfully"
    );
  }

  public setRendererReady(ready: boolean): void {
    this.rendererReady = ready;

    if (ready) {
      this.supabaseService.initialize();
    }
    console.log(`[AuthService] Renderer ready state set to: ${ready}`);
  }

  // ============ Core Authentication Operations ============

  public async signInWithMagicLink(email: string): Promise<AuthResult> {
    try {
      console.log(`[AuthService] Signing in with magic link: ${email}`);
      const result = await this.supabaseService.signInWithMagicLink(email);

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("[AuthService] Magic link sign in failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async signUpWithMagicLink(
    email: string,
    name: string
  ): Promise<AuthResult> {
    try {
      console.log(`[AuthService] Signing up with magic link: ${email}`);
      const result = await this.supabaseService.signUpWithMagicLink(
        email,
        name
      );

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("[AuthService] Magic link sign up failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async signInWithGoogle(): Promise<AuthResult> {
    try {
      console.log("[AuthService] Signing in with Google");
      const result = await this.supabaseService.signInWithGoogle();

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      // Return the result with URL for APIHandlers to handle browser opening
      return { success: true, data: result.data };
    } catch (error) {
      console.error("[AuthService] Google sign in failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async signOut(): Promise<AuthResult> {
    try {
      console.log("[AuthService] Signing out user");
      const result = await this.supabaseService.signOut();

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      // Auth state change callback will handle cleanup
      return { success: true };
    } catch (error) {
      console.error("[AuthService] Sign out failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async deleteAccount(): Promise<AuthResult> {
    try {
      console.log("[AuthService] Deleting user account");
      // TODO: Change this to DB first with Data Loader Service
      const result = await this.supabaseService.deleteAccount();

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("[AuthService] Account deletion failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============ State Management ============

  public isUserAuthenticated(): boolean {
    return this.isAuthenticated && !!this.supabaseService.getCurrentUser();
  }

  public getCurrentSession() {
    return this.supabaseService.getCurrentSession();
  }

  public logAuthStatus(context?: string): void {
    const prefix = context ? `[${context}]` : "[AuthService]";
    if (!this.isUserAuthenticated()) {
      console.log(`${prefix} User not authenticated`);
    }
  }

  // ============ OAuth Callback Handling ============

  public async handleOAuthCallback(url: string): Promise<void> {
    try {
      console.log("[AuthService] Processing OAuth callback:", url);

      const urlObj = new URL(url);

      // Extract OAuth parameters from hash fragment (implicit flow)
      if (!urlObj.hash) {
        console.error(
          "[AuthService] OAuth callback missing hash fragment with tokens"
        );
        this.sendUnauthenticatedStateToRenderer(
          "OAuth callback missing required token data",
          "OAuth Error - Missing Hash"
        );
        return;
      }

      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const error = hashParams.get("error");
      const errorDescription = hashParams.get("error_description");

      if (error) {
        console.error("[AuthService] OAuth error:", {
          error,
          errorDescription,
        });
        const errorMessage = `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`;
        this.handleAuthenticationFailure(errorMessage, "OAuth Error");
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const expiresIn = hashParams.get("expires_in");

      console.log("[AuthService] OAuth tokens received:", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiresIn: expiresIn,
      });

      if (!accessToken || !refreshToken) {
        console.error("[AuthService] OAuth callback missing required tokens");
        this.sendUnauthenticatedStateToRenderer(
          "OAuth callback missing access_token or refresh_token",
          "OAuth Error - Missing Tokens"
        );
        return;
      }

      try {
        const { data, error } = await this.supabaseService.setSessionWithTokens(
          accessToken,
          refreshToken
        );

        if (error) {
          console.error(
            "[AuthService] Error creating session with tokens:",
            error
          );
          this.sendUnauthenticatedStateToRenderer(
            `Authentication failed: ${error.message}`,
            "OAuth Error - Session Creation"
          );
          return;
        }

        if (data?.user) {
          await this.handleAuthenticationSuccess(data.user, "OAuth Success");

          // Show and focus main window after successful OAuth
          const mainWindow = this.windowManager.getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          console.error(
            "[AuthService] Session created but no user data received"
          );
          this.sendUnauthenticatedStateToRenderer(
            "Authentication completed but no user session received",
            "OAuth Error - No User Data"
          );
        }
      } catch (tokenError) {
        console.error(
          "[AuthService] Exception during token session creation:",
          tokenError
        );
        this.sendUnauthenticatedStateToRenderer(
          `Token authentication failed: ${tokenError.message}`,
          "OAuth Error - Token Exception"
        );
      }
    } catch (error) {
      console.error("[AuthService] Error handling OAuth callback:", error);
      this.sendUnauthenticatedStateToRenderer(
        "Unexpected error during OAuth processing",
        "OAuth Error - Unexpected"
      );
    }
  }

  // ============ Authentication Event Handlers ============

  public async handleAuthenticationSuccess(
    user: User,
    source: string
  ): Promise<void> {
    if (!user?.id) {
      console.error(
        `[AuthService] Authentication success handler called without valid user (${source})`
      );
      this.sendUnauthenticatedStateToRenderer("Invalid user data", source);
      return;
    }

    console.log(
      `[AuthService] Handling authentication success for ${user.email} (${source})`
    );

    try {
      // Update auth state immediately
      this.isAuthenticated = true;

      // Send loading state using existing pattern
      this.windowManager.sendToMain("loading-state-changed", {
        isLoading: true,
        message: "Loading user data...",
        source,
      });

      // Load user data through DataLoaderService (database-first approach)
      const userData = await this.dataLoaderService.loadUserData(user.id);

      if (userData) {
        // Update analytics identification
        if (this.analyticsService && userData.user) {
          await this.analyticsService.identify(userData.user.id);
        }

        // Send complete auth state to renderer
        await this.sendAuthStateToRenderer(userData, source);

        this.windowManager.createRecordingWindow();
        this.windowManager.createInformationWindow();

        console.log(
          `[AuthService] Authentication success completed for ${user.email} (${source})`
        );
      } else {
        throw new Error("DataLoaderService returned no data");
      }
    } catch (error) {
      console.error(
        `[AuthService] Error during authentication success handling (${source}):`,
        error
      );
      this.sendUnauthenticatedStateToRenderer(
        `Failed to load user data: ${error.message}`,
        source
      );
    }
  }

  public handleAuthenticationFailure(error?: string, source = "Unknown"): void {
    console.log(
      `[AuthService] Handling authentication failure (${source}):`,
      error || "No error provided"
    );

    // Update auth state
    this.isAuthenticated = false;

    // Disable STT service for unauthenticated users
    if (this.sttService) {
      console.log(
        "[AuthService] Disabling STT service during logout - stopping all connections and realtime mode..."
      );
      this.sttService.disableForUnauthenticatedUser();
    }

    // Close recording window if open
    const recordingWindow = this.windowManager.getRecordingWindow();
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      console.log("[AuthService] Closing recording window due to logout");
      recordingWindow.close();
    }

    // Clear all user data through DataLoaderService (database-first approach)
    this.dataLoaderService?.clearUserData();

    // Send unauthenticated state using existing pattern
    this.sendUnauthenticatedStateToRenderer(error, source);
  }

  // ============ Renderer Communication ============

  private async sendAuthStateToRenderer(
    userData: AuthStateEventData,
    source = "Unknown"
  ): Promise<void> {
    const mainWindow = this.windowManager.getMainWindow();
    if (!mainWindow || !userData) {
      console.warn(
        `[AuthService] Cannot send auth state - missing window or userData (source: ${source})`
      );
      return;
    }

    try {
      const eventData: AuthStateEventData = {
        user: userData.user,
        authenticated: userData.authenticated,
        statistics: userData.statistics,
        settings: userData.settings,
        recentTranscripts: userData.recentTranscripts || [],
        totalTranscriptCount: userData.totalTranscriptCount,
        dictionaryEntries: userData.dictionaryEntries || [],
      };

      console.log(`[AuthService] Auth state sent to renderer (${source}):`, {
        authenticated: eventData.authenticated,
        hasUser: !!eventData.user,
        hasStats: !!eventData.statistics,
        hasSettings: !!eventData.settings,
        transcriptCount: eventData.recentTranscripts.length,
        totalTranscriptCount: eventData.totalTranscriptCount,
        dictionaryEntriesCount: eventData.dictionaryEntries.length,
      });

      // Send loading completion along with auth state using existing pattern
      this.windowManager.sendToMain("loading-state-changed", {
        isLoading: false,
        message: "",
        source,
      });

      this.windowManager.sendToMain("auth-state-changed", eventData);
    } catch (error) {
      console.error(
        `[AuthService] Error sending auth state to renderer (${source}):`,
        error
      );
    }
  }

  private sendUnauthenticatedStateToRenderer(
    error?: string,
    source = "Unknown"
  ): void {
    const mainWindow = this.windowManager.getMainWindow();
    if (!mainWindow) {
      console.warn(
        `[AuthService] Cannot send unauthenticated state - missing window (source: ${source})`
      );
      return;
    }

    try {
      const eventData: AuthStateEventData = {
        user: null,
        authenticated: false,
        statistics: null,
        settings: null,
        recentTranscripts: [],
        totalTranscriptCount: undefined,
        dictionaryEntries: [],
      };

      console.log(
        `[AuthService] Unauthenticated state sent to renderer (${source}):`,
        { error }
      );

      // Send loading completion along with unauthenticated state using existing pattern
      this.windowManager.sendToMain("loading-state-changed", {
        isLoading: false,
        message: "",
        source,
      });

      this.windowManager.sendToMain("auth-state-changed", eventData);
    } catch (sendError) {
      console.error(
        `[AuthService] Error sending unauthenticated state (${source}):`,
        sendError
      );
    }
  }

  // ============ User Profile Operations ============

  public getUserProfile(): {
    success: boolean;
    data?: UserRecord;
    error?: string;
  } {
    try {
      const result = this.dataLoaderService.getCurrentUser();
      if (!result) {
        return { success: false, error: "User not found" };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error("[AuthService] Get user profile failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async completeOnboarding(): Promise<AuthResult> {
    try {
      const result = await this.dataLoaderService.completeOnboarding();
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (error) {
      console.error("[AuthService] Complete onboarding failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============ Lifecycle Management ============

  public async destroy(): Promise<void> {
    console.log("[AuthService] Cleaning up authentication service...");

    // Clear auth state
    this.isAuthenticated = false;

    this.initialized = false;
    this.rendererReady = false;

    console.log("[AuthService] Authentication service cleaned up");
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}
