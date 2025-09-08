// API Client for renderer process - uses IPC to communicate with main process
// This replaces direct Supabase and PostHog usage in the renderer
import { IPCResponse } from "../../../shared/types";

export class APIClient {
  // Simple check if electronAPI is available - for error reporting only
  private static checkElectronAPI(): void {
    if (
      typeof window === "undefined" ||
      !window.electronAPI ||
      !window.electronAPI.auth ||
      !window.electronAPI.db
    ) {
      throw new Error(
        "Application not properly initialized. Please refresh the page."
      );
    }
  }

  // Authentication methods
  static async signInWithMagicLink(email: string): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.auth.signInWithMagicLink(email);
      return response;
    } catch (error) {
      console.error("APIClient: Magic link sign in error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send magic link",
      };
    }
  }

  static async signInWithGoogle(): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.auth.signInWithGoogle();
      return response;
    } catch (error) {
      console.error("APIClient: Sign in with Google error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to sign in with Google",
      };
    }
  }

  static async signUpWithMagicLink(
    email: string,
    name: string
  ): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.auth.signUpWithMagicLink(
        email,
        name
      );
      return response;
    } catch (error) {
      console.error("APIClient: Magic link sign up error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send magic link",
      };
    }
  }


  static async signOut(): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.auth.signOut();
      return response;
    } catch (error) {
      console.error("APIClient: Sign out error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sign out",
      };
    }
  }

  static async getCurrentUser(): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.auth.getCurrentUser();
      return response;
    } catch (error) {
      console.error("APIClient: Get current user error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get current user",
      };
    }
  }

  static async getUserProfile(): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.auth.getUserProfile();
      return response;
    } catch (error) {
      console.error("APIClient: Get user profile error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get user profile",
      };
    }
  }

  static async completeOnboarding(): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.auth.completeOnboarding();
      return response;
    } catch (error) {
      console.error("APIClient: Complete onboarding error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete onboarding",
      };
    }
  }

  // Database methods
  static async saveTranscript(transcript: any): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.db.saveTranscript(transcript);
      return response;
    } catch (error) {
      console.error("APIClient: Save transcript error:", error);
      return { success: false, error: "Failed to save transcript" };
    }
  }

  static async getTranscripts(
    limit?: number,
    offset?: number
  ): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.db.getTranscripts(
        limit,
        offset
      );
      return response;
    } catch (error) {
      console.error("APIClient: Get transcripts error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get transcripts",
      };
    }
  }

  static async saveUserSettings(settings: any): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.db.saveUserSettings(settings);
      return response;
    } catch (error) {
      console.error("APIClient: Save user settings error:", error);
      return { success: false, error: "Failed to save user settings" };
    }
  }

  static async getUserSettings(): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.db.getUserSettings();
      return response;
    } catch (error) {
      console.error("APIClient: Get user settings error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get user settings",
      };
    }
  }

  static async getUserStats(): Promise<IPCResponse> {
    try {
      APIClient.checkElectronAPI();
      const response = await window.electronAPI.db.getUserStats();
      return response;
    } catch (error) {
      console.error("APIClient: Get user stats error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get user stats",
      };
    }
  }

  // Analytics methods
  static async track(
    event: string,
    properties?: Record<string, any>
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        event,
        properties
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track event error:", error);
      return { success: false, error: "Failed to track event" };
    }
  }

  static async identify(
    userId: string,
    properties?: Record<string, any>
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.identify(
        userId,
        properties
      );
      return response;
    } catch (error) {
      console.error("APIClient: Identify user error:", error);
      return { success: false, error: "Failed to identify user" };
    }
  }

  static async trackUserSignUp(
    method?: "email" | "google" | "github"
  ): Promise<IPCResponse> {
    try {
      const response =
        await window.electronAPI.analytics.trackUserSignUp(method);
      return response;
    } catch (error) {
      console.error("APIClient: Track user sign up error:", error);
      return { success: false, error: "Failed to track user sign up" };
    }
  }

  static async trackUserSignIn(
    method?: "email" | "google" | "github"
  ): Promise<IPCResponse> {
    try {
      const response =
        await window.electronAPI.analytics.trackUserSignIn(method);
      return response;
    } catch (error) {
      console.error("APIClient: Track user sign in error:", error);
      return { success: false, error: "Failed to track user sign in" };
    }
  }

  static async trackUserSignOut(): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.trackUserSignOut();
      return response;
    } catch (error) {
      console.error("APIClient: Track user sign out error:", error);
      return { success: false, error: "Failed to track user sign out" };
    }
  }

  static async trackAppLaunched(): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.trackAppLaunched();
      return response;
    } catch (error) {
      console.error("APIClient: Track app launched error:", error);
      return { success: false, error: "Failed to track app launched" };
    }
  }

  static async trackRecordingStarted(): Promise<IPCResponse> {
    try {
      const response =
        await window.electronAPI.analytics.trackRecordingStarted();
      return response;
    } catch (error) {
      console.error("APIClient: Track recording started error:", error);
      return { success: false, error: "Failed to track recording started" };
    }
  }

  static async trackRecordingStopped(duration: number): Promise<IPCResponse> {
    try {
      const response =
        await window.electronAPI.analytics.trackRecordingStopped(duration);
      return response;
    } catch (error) {
      console.error("APIClient: Track recording stopped error:", error);
      return { success: false, error: "Failed to track recording stopped" };
    }
  }

  static async trackTranscriptionCompleted(data: {
    wordCount: number;
    wpm: number;
    wasTranslated: boolean;
  }): Promise<IPCResponse> {
    try {
      const response =
        await window.electronAPI.analytics.trackTranscriptionCompleted(data);
      return response;
    } catch (error) {
      console.error("APIClient: Track transcription completed error:", error);
      return {
        success: false,
        error: "Failed to track transcription completed",
      };
    }
  }

  // Additional analytics methods
  static async trackOnboardingStarted(): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "onboarding_started",
        {}
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track onboarding started error:", error);
      return { success: false, error: "Failed to track onboarding started" };
    }
  }

  static async trackOnboardingStepCompleted(
    step: "auth" | "permissions" | "guide"
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "onboarding_step_completed",
        { step }
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track onboarding step completed error:", error);
      return {
        success: false,
        error: "Failed to track onboarding step completed",
      };
    }
  }

  static async trackOnboardingCompleted(): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "onboarding_completed",
        {}
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track onboarding completed error:", error);
      return { success: false, error: "Failed to track onboarding completed" };
    }
  }

  static async trackPermissionGranted(
    permission: "microphone" | "accessibility"
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "permission_granted",
        { permission }
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track permission granted error:", error);
      return { success: false, error: "Failed to track permission granted" };
    }
  }

  static async trackPermissionDenied(
    permission: "microphone" | "accessibility"
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "permission_denied",
        { permission }
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track permission denied error:", error);
      return { success: false, error: "Failed to track permission denied" };
    }
  }

  static async trackSettingChanged(
    setting: string,
    value: any
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "setting_changed",
        { setting, value }
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track setting changed error:", error);
      return { success: false, error: "Failed to track setting changed" };
    }
  }

  static async trackFeatureUsed(
    feature: "ai_refinement" | "translation" | "clipboard_mode" | "auto_insert"
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "feature_used",
        { feature }
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track feature used error:", error);
      return { success: false, error: "Failed to track feature used" };
    }
  }

  static async trackError(
    error: string,
    context?: Record<string, any>
  ): Promise<IPCResponse> {
    try {
      const response = await window.electronAPI.analytics.track(
        "error_occurred",
        { error, ...context }
      );
      return response;
    } catch (error) {
      console.error("APIClient: Track error error:", error);
      return { success: false, error: "Failed to track error" };
    }
  }
}

// Convenience exports that match the old API structure
export const auth = {
  signUpWithMagicLink: APIClient.signUpWithMagicLink,
  signInWithMagicLink: APIClient.signInWithMagicLink,
  signOut: APIClient.signOut,
  getCurrentUser: APIClient.getCurrentUser,
  getUserProfile: APIClient.getUserProfile,
  signInWithGoogle: APIClient.signInWithGoogle,
  completeOnboarding: APIClient.completeOnboarding,
};

export const db = {
  saveTranscript: APIClient.saveTranscript,
  getTranscripts: APIClient.getTranscripts,
  saveUserSettings: APIClient.saveUserSettings,
  getUserSettings: APIClient.getUserSettings,
  getUserStats: APIClient.getUserStats,
};

export const analytics = {
  track: APIClient.track,
  identify: APIClient.identify,
  trackUserSignUp: APIClient.trackUserSignUp,
  trackUserSignIn: APIClient.trackUserSignIn,
  trackUserSignOut: APIClient.trackUserSignOut,
  trackAppLaunched: APIClient.trackAppLaunched,
  trackRecordingStarted: APIClient.trackRecordingStarted,
  trackRecordingStopped: APIClient.trackRecordingStopped,
  trackTranscriptionCompleted: APIClient.trackTranscriptionCompleted,
  trackOnboardingStarted: APIClient.trackOnboardingStarted,
  trackOnboardingStepCompleted: APIClient.trackOnboardingStepCompleted,
  trackOnboardingCompleted: APIClient.trackOnboardingCompleted,
  trackPermissionGranted: APIClient.trackPermissionGranted,
  trackPermissionDenied: APIClient.trackPermissionDenied,
  trackSettingChanged: APIClient.trackSettingChanged,
  trackFeatureUsed: APIClient.trackFeatureUsed,
  trackError: APIClient.trackError,
};
