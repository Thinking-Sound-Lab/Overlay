import { PostHog } from "posthog-node";

export class AnalyticsService {
  private posthog: PostHog | null = null;
  private currentUserId: string | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Import centralized config
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { config } = require("../../../config/environment");

      console.log("AnalyticsService: Initializing with config:", {
        hasKey: !!config.posthogKey,
        keyLength: config.posthogKey?.length,
        host: config.posthogHost,
      });

      if (config.posthogKey && config.posthogKey !== "your-posthog-key") {
        this.posthog = new PostHog(config.posthogKey, {
          host: config.posthogHost,
          flushAt: 20, // Batch events for better performance
          flushInterval: 10000, // Flush every 10 seconds
        });

        this.isInitialized = true;
        console.log(
          "AnalyticsService: Successfully initialized PostHog Node.js client"
        );
      } else {
        console.warn(
          "AnalyticsService: PostHog key not configured, analytics disabled"
        );
      }
    } catch (error) {
      console.error("AnalyticsService: Failed to initialize:", error);
    }
  }

  // Set current user for analytics
  identify(userId: string, properties?: Record<string, any>) {
    if (!this.posthog || !this.isInitialized) return;

    this.currentUserId = userId;

    try {
      this.posthog.identify({
        distinctId: userId,
        properties: {
          ...properties,
          source: "main_process",
          platform: process.platform,
          electronVersion: process.versions.electron,
          nodeVersion: process.versions.node,
        },
      });
      console.log("AnalyticsService: User identified:", userId);
    } catch (error) {
      console.error("AnalyticsService: Identify error:", error);
    }
  }

  // Track event
  track(event: string, properties?: Record<string, any>, userId?: string) {
    if (!this.posthog || !this.isInitialized) return;

    const distinctId = userId || this.currentUserId;
    if (!distinctId) {
      console.warn(
        "AnalyticsService: No user ID available for tracking event:",
        event
      );
      return;
    }

    try {
      this.posthog.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          source: "main_process",
          timestamp: new Date().toISOString(),
          platform: process.platform,
          electronVersion: process.versions.electron,
        },
      });
      console.log("AnalyticsService: Event tracked:", event);
    } catch (error) {
      console.error("AnalyticsService: Track error:", error);
    }
  }

  // Authentication events
  trackUserSignUp(method: "email" | "google" | "github" = "email") {
    this.track("user_signed_up", { method });
  }

  trackUserSignIn(method: "email" | "google" | "github" = "email") {
    this.track("user_signed_in", { method });
  }

  trackUserSignOut() {
    this.track("user_signed_out");
    // Clear user ID on sign out
    this.currentUserId = null;
  }

  // Onboarding events
  trackOnboardingStarted() {
    this.track("onboarding_started");
  }

  trackOnboardingStepCompleted(step: "auth" | "permissions" | "guide") {
    this.track("onboarding_step_completed", { step });
  }

  trackOnboardingCompleted() {
    this.track("onboarding_completed");
  }

  // Permission events
  trackPermissionGranted(permission: "microphone" | "accessibility") {
    this.track("permission_granted", { permission });
  }

  trackPermissionDenied(permission: "microphone" | "accessibility") {
    this.track("permission_denied", { permission });
  }

  // Recording events
  trackRecordingStarted() {
    this.track("recording_started");
  }

  trackRecordingStopped(duration: number) {
    this.track("recording_stopped", { duration_seconds: duration });
  }

  trackTranscriptionCompleted(
    wordCount: number,
    wpm: number,
    wasTranslated: boolean
  ) {
    this.track("transcription_completed", {
      word_count: wordCount,
      wpm,
      was_translated: wasTranslated,
    });
  }

  // Translation events
  trackTranslationUsed(
    sourceLanguage: string,
    targetLanguage: string,
    confidence: number
  ) {
    this.track("translation_used", {
      source_language: sourceLanguage,
      target_language: targetLanguage,
      confidence,
    });
  }

  // Settings events
  trackSettingChanged(setting: string, value: any) {
    this.track("setting_changed", { setting, value });
  }

  // Feature usage
  trackFeatureUsed(
    feature: "ai_refinement" | "translation" | "clipboard_mode" | "auto_insert"
  ) {
    this.track("feature_used", { feature });
  }

  // Error events
  trackError(error: string, context?: Record<string, any>) {
    this.track("error_occurred", { error, ...context });
  }

  // App events
  trackAppLaunched() {
    this.track("app_launched");
  }

  trackAppClosed() {
    this.track("app_closed");
  }

  // Subscription events
  trackSubscriptionUpgrade(tier: "pro") {
    this.track("subscription_upgraded", { tier });
  }

  trackSubscriptionCancelled() {
    this.track("subscription_cancelled");
  }

  // Flush events before shutdown
  async shutdown() {
    if (this.posthog && this.isInitialized) {
      try {
        await this.posthog.shutdown();
        console.log("AnalyticsService: Successfully shut down");
      } catch (error) {
        console.error("AnalyticsService: Shutdown error:", error);
      }
    }
  }
}
