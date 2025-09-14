// STTService.ts - Main Process (Voice Model Only)
import { createWhisperSTT } from "../providers/openai";
import { STTClient } from "../providers/openai";
import RealtimeSTTProvider, {
  RealtimeConfig,
  RealtimeSTTCallback,
} from "../providers/realtime_stt";
import TranslationService from "./translation_service";
import { AnalyticsService } from "./analytics_service";
import { ApplicationMappingsConfig } from "../config/application_mappings";
import { DataLoaderService } from "./data_loader_service";
import { DictionaryService } from "./dictionary_service";
import { WindowManager } from "../windows/window-manager";
import { InformationMessage } from "../windows/types";
import { Settings, SpeechMetrics, TranslationResult } from "../../shared/types";
import {
  hasProAccess,
  canUseWords,
} from "../../shared/utils/subscription-permissions";

class STTService {
  private sttSession: STTClient;
  private realtimeProvider: RealtimeSTTProvider | null = null;
  private audioBuffer: string[] = [];
  private isRecording = false;
  private lastRecordingDuration = 0;
  private recordingStartTime = 0;
  private onMetricsUpdate?: (
    metrics: SpeechMetrics,
    transcript?: string,
    translationMeta?: TranslationResult
  ) => void;
  private translationService: TranslationService;
  private analyticsService?: AnalyticsService;
  private dataLoaderService: DataLoaderService;
  private dictionaryService?: DictionaryService;
  private accumulatedTranscript = "";
  private isProcessingTranscript = false;
  private windowManager: WindowManager | null = null;
  private finalizeTimeout: NodeJS.Timeout | null = null;

  constructor(
    dataLoaderService: DataLoaderService,
    onMetricsUpdate?: (
      metrics: SpeechMetrics,
      transcript?: string,
      translationMeta?: TranslationResult
    ) => void,
    analyticsService?: AnalyticsService,
    windowManager?: WindowManager,
    dictionaryService?: DictionaryService
  ) {
    this.sttSession = null;
    this.realtimeProvider = null;
    this.dataLoaderService = dataLoaderService;
    this.dictionaryService = dictionaryService;
    this.onMetricsUpdate = onMetricsUpdate;
    this.translationService = TranslationService.getInstance(
      dataLoaderService,
      dictionaryService
    );
    this.analyticsService = analyticsService;
    this.windowManager = windowManager || null;
  }

  /**
   * Get current language from DataLoaderService settings
   */
  private getCurrentLanguage(): string {
    const settings: Settings = this.dataLoaderService.getUserSettings();
    const language: string = settings.language;
    console.log("[STT] Using current language from settings:", language);
    return language;
  }

  /**
   * Check if realtime mode is enabled in user settings
   * CRITICAL: Only return true if user is authenticated AND has explicitly enabled realtime mode AND has Pro access
   */
  private isRealtimeModeEnabled(): boolean {
    // First check if user is authenticated
    const cacheInfo = this.dataLoaderService.getCacheInfo();
    if (!cacheInfo.hasUser || !cacheInfo.userId) {
      console.log("[STT] No authenticated user - realtime mode disabled");
      return false;
    }

    // Check Pro access for realtime mode
    const userData = this.dataLoaderService.getCurrentUser();
    if (!hasProAccess(userData, "realtime_mode")) {
      console.log("[STT] User does not have Pro access for realtime mode");
      return false;
    }

    // Check if we have valid user settings
    const settings: Settings = this.dataLoaderService.getUserSettings();
    if (!settings) {
      console.log("[STT] No user settings available - realtime mode disabled");
      return false;
    }

    const enabled: boolean = settings.enableRealtimeMode || false;
    console.log(
      `[STT] User authenticated (${cacheInfo.userId}), has Pro access, realtime mode enabled in settings: ${enabled}`
    );
    return enabled;
  }

  async initialize(): Promise<void> {
    // Check authentication before initializing
    const cacheInfo = this.dataLoaderService.getCacheInfo();
    if (!cacheInfo.hasUser || !cacheInfo.userId) {
      console.log("[STT] No authenticated user - skipping STT initialization");
      this.closeSession(); // Ensure any existing connections are closed
      return;
    }

    console.log(
      `[STT] Initializing STT service for authenticated user: ${cacheInfo.userId}`
    );

    // Auto-select mode based on user settings
    if (this.isRealtimeModeEnabled()) {
      console.log(
        "[STT] User authenticated and realtime mode enabled - initializing realtime"
      );
      await this.initializeRealtime();
    } else {
      console.log(
        "[STT] User authenticated but realtime mode disabled - initializing regular"
      );
      await this.initializeRegular();
    }
  }

  private async initializeRegular(): Promise<void> {
    const language: string = this.getCurrentLanguage();

    const handleMessage = (message: any) => {
      if (message.type === "transcription.completed") {
        console.log("[STT] Final transcript:", message.transcript);
        this.processTranscript(message.transcript, message.language);
      }
    };

    this.sttSession = await createWhisperSTT({
      language: language,
      callback: {
        onmessage: handleMessage,
        onerror: (error) => {
          console.error("[STT] Error:", error);
          this.isRecording = false; // Reset recording state on error
        },
        onclose: () => console.log("[STT] Session closed"),
      },
    });
  }

  async initializeRealtime(): Promise<void> {
    const language: string = this.getCurrentLanguage();
    console.log(`[STT] Initializing realtime mode with language: ${language}`);

    const config: RealtimeConfig = {
      language: language,
      apiKey: process.env.DEEPGRAM_API_KEY || "",
      model: "nova-2",
    };

    const realtimeCallback: RealtimeSTTCallback = {
      onTranscriptDelta: (delta: string, isFinal: boolean) => {
        console.log(
          "[STT] Realtime transcript delta:",
          delta,
          "isFinal:",
          isFinal
        );
        // In transcription-only mode, we only process final results for insertion
        // Deltas are just accumulated for completeness
        this.processStreamingTranscript(delta, isFinal, language);
      },
      onFinalizeResponse: async (transcript: string, language: string) => {
        console.log("[STT] Immediate Finalize response received:", transcript);

        // Clear the error timeout since we got a response
        if (this.finalizeTimeout) {
          clearTimeout(this.finalizeTimeout);
          this.finalizeTimeout = null;
        }

        // Process transcript immediately when Finalize response is received
        if (transcript && transcript.trim() && !this.isProcessingTranscript) {
          console.log(
            "[STT] Processing transcript immediately from Finalize response:",
            transcript.length,
            "chars"
          );
          this.isProcessingTranscript = true;
          this.accumulatedTranscript =
            this.accumulatedTranscript + transcript.trim();

          try {
            await this.processTranscript(this.accumulatedTranscript, language);
            // Clear after successful processing
            this.accumulatedTranscript = "";
          } finally {
            this.isProcessingTranscript = false;
          }
        } else if (this.isProcessingTranscript) {
          console.log(
            "[STT] Transcript processing already in progress, skipping immediate processing"
          );
        } else {
          console.log("[STT] Empty transcript from Finalize response");

          // Handle empty transcript case
          if (this.windowManager) {
            const message: InformationMessage = {
              type: "empty-transcript",
              title: "Empty Transcript",
              message: "No speech was detected in the recording",
              duration: 3000,
            };
            this.windowManager.showInformation(message);
            this.windowManager.sendToRecording("processing-complete");
            this.windowManager.compactRecordingWindow();
          }
        }
      },
      onError: (error: Error) => {
        console.error("[STT] Realtime error:", error);
        this.handleRealtimeError(error);
      },
      onConnectionOpen: () => {
        console.log("[STT] Realtime connection opened");
      },
      onConnectionClose: () => {
        console.log("[STT] Realtime connection closed");
      },
    };

    this.realtimeProvider = new RealtimeSTTProvider(config, realtimeCallback);
    await this.realtimeProvider.connect();
  }

  async reinitialize(): Promise<void> {
    console.log("[STT] Reinitialize requested - checking authentication first");

    // Check authentication before reinitializing
    const cacheInfo = this.dataLoaderService.getCacheInfo();
    if (!cacheInfo.hasUser || !cacheInfo.userId) {
      console.log(
        "[STT] No authenticated user - cleaning up and skipping STT reinitialize"
      );

      // Clean up any existing connections since user is not authenticated
      this.closeSession();
      this.resetRuntimeData();
      return;
    }

    const newLanguage: string = this.getCurrentLanguage();
    const isRealtimeEnabled: boolean = this.isRealtimeModeEnabled();

    console.log(
      `[STT] Reinitializing for authenticated user ${cacheInfo.userId} with language: ${newLanguage}, realtime: ${isRealtimeEnabled}`
    );

    // Close existing sessions first
    if (this.sttSession) {
      this.sttSession.close();
      this.sttSession = null;
    }

    if (this.realtimeProvider) {
      console.log(
        "[STT] Cleaning up existing realtime provider and stopping all reconnections"
      );
      this.realtimeProvider.disconnect();
      this.realtimeProvider = null;

      // Add a small delay to ensure complete cleanup before proceeding
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Clear any audio buffer and reset state
    this.audioBuffer = [];
    this.isRecording = false;
    this.accumulatedTranscript = "";
    this.isProcessingTranscript = false;

    // Initialize based on current settings (this will also check authentication again)
    await this.initialize();

    console.log(
      `[STT] Successfully reinitialized with language: ${newLanguage}, mode: ${isRealtimeEnabled ? "realtime" : "regular"}`
    );
  }

  // This method will be called from your audio capture mechanism
  handleAudioChunk(audioData: string) {
    // CRITICAL: Check authentication before processing any audio
    const cacheInfo = this.dataLoaderService.getCacheInfo();
    if (!cacheInfo.hasUser || !cacheInfo.userId) {
      console.warn("[STT] User not authenticated - ignoring audio chunk");
      return;
    }

    if (!this.isRecording) return;

    // Always buffer audio for fallback purposes, even in realtime mode
    this.audioBuffer.push(audioData);

    if (this.isRealtimeModeEnabled() && this.realtimeProvider?.isReady()) {
      // Send audio chunk immediately to realtime provider
      this.realtimeProvider.sendAudioChunk(audioData);
      console.log(
        `[STT] Streaming audio chunk to realtime for user ${cacheInfo.userId}, buffer size: ${this.audioBuffer.length}`
      );
    } else {
      // Buffer for batch processing in regular mode
      console.log(
        `[STT] Buffering audio chunk for user ${cacheInfo.userId}, buffer size: ${this.audioBuffer.length}`
      );
    }
  }

  startDictation() {
    // CRITICAL: Check authentication before starting dictation
    const cacheInfo = this.dataLoaderService.getCacheInfo();
    if (!cacheInfo.hasUser || !cacheInfo.userId) {
      console.warn("[STT] User not authenticated - cannot start dictation");
      return;
    }

    // Check word usage limits for free users
    const userData = this.dataLoaderService.getCurrentUser();
    const wordUsage = canUseWords(userData, 50); // Estimate 50 words for average transcript
    if (!wordUsage.allowed) {
      console.warn(
        "[STT] User has exceeded monthly word limit - cannot start dictation"
      );

      // Show information window about limit reached
      if (this.windowManager) {
        const message: InformationMessage = {
          type: "word-limit-reached",
          title: "Monthly Limit Reached",
          message: `You've used all ${wordUsage.limit} words this month. Upgrade to Pro for unlimited access.`,
          duration: 5000,
        };
        this.windowManager.showInformation(message);
      }
      return;
    }

    if (this.isRecording) return; // Already recording

    console.log(
      `[STT] Starting dictation for authenticated user: ${cacheInfo.userId}`
    );

    this.isRecording = true;
    this.audioBuffer = [];
    this.recordingStartTime = Date.now();

    // Clear accumulated transcript for new manual recording session
    this.accumulatedTranscript = "";
    this.isProcessingTranscript = false;
    console.log("[STT] Started new dictation session - cleared accumulation");

    console.log("[STT] Started dictation - speak now...");

    // Track recording started
    if (this.analyticsService && process.env.NODE_ENV === "production") {
      this.analyticsService.trackRecordingStarted();
    }
  }

  async finalizeDictation() {
    if (this.audioBuffer.length === 0) {
      console.log("[STT] No audio chunks to process");

      // Notify information window about silent recording
      if (this.windowManager) {
        const message: InformationMessage = {
          type: "silent-recording",
          title: "Silent Recording",
          message: "No audio was detected during recording",
          duration: 3000,
        };
        this.windowManager.showInformation(message);
      }

      // Send processing-complete to recording window to reset UI
      if (this.windowManager) {
        this.windowManager.sendToRecording("processing-complete");
      }

      return;
    }

    this.isRecording = false;

    const recordingEndTime = Date.now();
    const recordingDuration =
      (recordingEndTime - this.recordingStartTime) / 1000;

    console.log("[STT] Processing", this.audioBuffer.length, "audio chunks");
    console.log(
      "[STT] Recording duration:",
      recordingDuration.toFixed(2),
      "seconds"
    );

    // Track recording stopped
    if (this.analyticsService && process.env.NODE_ENV === "production") {
      this.analyticsService.trackRecordingStopped(recordingDuration);
    }

    try {
      // Set recording duration BEFORE processing transcript so metrics calculation is correct
      this.lastRecordingDuration = recordingDuration;

      if (this.isRealtimeModeEnabled()) {
        // In realtime mode, send Finalize message and wait for response
        console.log("[STT] Realtime mode - sending Finalize message");

        if (this.realtimeProvider) {
          this.realtimeProvider.commitAudio();
        }

        // Set timeout to handle case where onFinalizeResponse never gets called
        this.finalizeTimeout = setTimeout(() => {
          console.log("[STT] Finalize timeout - no response from Deepgram");

          // Show "transcript not found" error and reset UI
          if (this.windowManager) {
            const message: InformationMessage = {
              type: "empty-transcript",
              title: "Transcript Not Found",
              message: "Unable to process the recording. Please try again.",
              duration: 3000,
            };
            this.windowManager.showInformation(message);
            this.windowManager.sendToRecording("processing-complete");
            this.windowManager.compactRecordingWindow();
          }

          // Reset state
          this.isProcessingTranscript = false;
          this.finalizeTimeout = null;
        }, 2000); // 2 second timeout for error case
      } else {
        // In regular mode, send accumulated audio to Whisper
        if (this.sttSession) {
          await this.sttSession.processAudio(this.audioBuffer);
        } else {
          console.error("[STT] No STT session available for processing audio");
        }
      }
    } catch (error) {
      console.error("[STT] Error processing audio:", error);
    }

    // Clear buffer
    this.audioBuffer = [];
  }

  stopDictation(shouldProcess = true) {
    if (!this.isRecording) return;

    console.log(
      `[STT] Stopping dictation manually (shouldProcess: ${shouldProcess})`
    );

    this.isRecording = false;

    if (shouldProcess && this.audioBuffer.length > 0) {
      // Normal stop: process remaining audio
      this.finalizeDictation();
    } else {
      // Cancel: clear buffers without processing
      console.log(
        "[STT] Canceling recording - clearing buffers without processing"
      );
      this.audioBuffer = [];
      this.accumulatedTranscript = "";

      // Disconnect realtime provider to stop any pending processing
      //   if (this.realtimeProvider && this.isRealtimeModeEnabled()) {
      //     console.log("[STT] Disconnecting realtime provider to prevent transcript processing");
      //     this.realtimeProvider.disconnect();
      //   }

      // Send processing-complete to reset UI
      //   this.windowManager.sendToRecording("processing-complete");
    }
  }

  async processTranscript(transcript: string, language: string) {
    if (!transcript || transcript.trim().length === 0) {
      console.log("[STT] Empty transcript received");

      // Notify information window about empty transcript
      if (this.windowManager) {
        const message: InformationMessage = {
          type: "empty-transcript",
          title: "Empty Transcript",
          message: "No text could be transcribed from the audio",
          duration: 3000,
        };
        this.windowManager.showInformation(message);
      }

      // Send processing-complete to recording window to reset UI
      if (this.windowManager) {
        this.windowManager.sendToRecording("processing-complete");
        this.windowManager.compactRecordingWindow();
      }

      return;
    }

    console.log("[STT] Raw transcript:", transcript);
    console.log("[STT] Source language:", language);
    console.log("[STT] Last recording duration:", this.lastRecordingDuration);

    try {
      // STT Service now only handles voice-to-text conversion
      // Pass the transcript to Translation Service for processing
      await this.translationService.processText(
        transcript,
        this.lastRecordingDuration,
        this.onMetricsUpdate
      );
    } catch (error) {
      console.error(
        "[STT] Error passing transcript to translation service:",
        error
      );
    }
  }

  async processStreamingTranscript(
    delta: string,
    isFinal: boolean,
    language: string
  ) {
    void language; // Unused parameter required by method signature
    console.log(
      "[STT] Processing streaming transcript delta:",
      delta,
      "isFinal:",
      isFinal
    );

    if (!delta) return;

    if (isFinal) {
      if (
        this.accumulatedTranscript &&
        this.accumulatedTranscript.trim().length > 0
      ) {
        this.accumulatedTranscript += " " + delta.trim();
      } else {
        this.accumulatedTranscript = delta.trim();
      }
    }
  }

  /**
   * Get available context types and their configurations
   */
  public getAvailableContextTypes() {
    return ApplicationMappingsConfig.getInstance().getAllContextConfigs();
  }

  /**
   * Get application mappings for debugging/configuration
   */
  public getApplicationMappings() {
    return ApplicationMappingsConfig.getInstance().getAllMappings();
  }

  // Method to be called when audio chunks are received from your audio capture
  receiveAudioData(base64AudioChunk: string) {
    this.handleAudioChunk(base64AudioChunk);
  }

  closeSession() {
    console.log("[STT] Closing STT session and cleaning up all connections...");

    this.isRecording = false;

    // Clear finalize timeout
    if (this.finalizeTimeout) {
      clearTimeout(this.finalizeTimeout);
      this.finalizeTimeout = null;
    }

    // Close regular STT session
    if (this.sttSession) {
      try {
        this.sttSession.close();
      } catch (error) {
        console.warn("[STT] Error closing regular STT session:", error);
      }
      this.sttSession = null;
    }

    // Close realtime provider with explicit cleanup
    if (this.realtimeProvider) {
      console.log(
        "[STT] Disconnecting realtime provider and stopping all reconnection attempts"
      );
      try {
        this.realtimeProvider.disconnect();
      } catch (error) {
        console.warn("[STT] Error disconnecting realtime provider:", error);
      }
      this.realtimeProvider = null;
    }

    // Clear audio buffer
    this.audioBuffer = [];

    console.log("[STT] Session closed and all connections cleaned up");
  }

  // Getter for recording status (useful for UI indicators)
  get recordingStatus(): boolean {
    return this.isRecording;
  }

  get isRealtime(): boolean {
    return this.isRealtimeModeEnabled();
  }

  get realtimeConnectionStatus(): boolean {
    return this.realtimeProvider?.isReady() || false;
  }

  get currentAccumulatedTranscript(): string {
    return this.accumulatedTranscript;
  }

  clearStreamingTranscript(): void {
    this.accumulatedTranscript = "";
    console.log("[STT] Streaming transcript cleared");
  }

  private async handleRealtimeError(error: Error): Promise<void> {
    console.error(
      "[STT] Realtime error occurred, attempting fallback:",
      error.message
    );

    // Stop recording to prevent data loss
    const wasRecording = this.isRecording;
    this.isRecording = false;

    // If we have accumulated audio and were recording, process it with fallback
    if (wasRecording && this.audioBuffer.length > 0) {
      console.log("[STT] Processing buffered audio with fallback method");

      try {
        // Initialize regular STT for fallback
        await this.initializeFallback();

        // Process the buffered audio
        if (this.sttSession) {
          await this.sttSession.processAudio(this.audioBuffer);
        }
      } catch (fallbackError) {
        console.error("[STT] Fallback processing also failed:", fallbackError);
      }
    }

    // Try to reconnect realtime after a delay
    setTimeout(() => {
      this.attemptRealtimeReconnection();
    }, 5000);
  }

  private async initializeFallback(): Promise<void> {
    const language: string = this.getCurrentLanguage();
    console.log(
      "[STT] Initializing fallback STT session with language:",
      language
    );

    const handleMessage = (message: any) => {
      if (message.type === "transcription.completed") {
        console.log("[STT] Fallback transcript:", message.transcript);
        this.processTranscript(message.transcript, message.language);
      }
    };

    this.sttSession = await createWhisperSTT({
      language: language,
      callback: {
        onmessage: handleMessage,
        onerror: (error) => {
          console.error("[STT] Fallback error:", error);
        },
        onclose: () => console.log("[STT] Fallback session closed"),
      },
    });
  }

  private async attemptRealtimeReconnection(): Promise<void> {
    // CRITICAL: Check authentication first - never attempt to reconnect for unauthenticated users
    const cacheInfo = this.dataLoaderService.getCacheInfo();
    if (!cacheInfo.hasUser || !cacheInfo.userId) {
      console.log(
        "[STT] User not authenticated - aborting realtime reconnection attempt"
      );
      return;
    }

    if (!this.isRealtimeModeEnabled()) {
      console.log(
        "[STT] Realtime mode not enabled - aborting reconnection attempt"
      );
      return;
    }

    console.log(
      `[STT] Attempting realtime reconnection for authenticated user: ${cacheInfo.userId}`
    );

    try {
      // Close existing provider if it exists
      if (this.realtimeProvider) {
        this.realtimeProvider.disconnect();
        this.realtimeProvider = null;
      }

      // Attempt to reinitialize realtime
      await this.initializeRealtime();
      console.log("[STT] Realtime reconnection successful");
    } catch (error) {
      console.error("[STT] Realtime reconnection failed:", error);
      console.log("[STT] Falling back to regular STT mode permanently");

      // Permanently fall back to regular mode
      await this.initializeFallback();
    }
  }

  /**
   * Reset STTService runtime data (for cache clearing and logout)
   * This is called when user signs out to ensure complete cleanup
   */
  public resetRuntimeData(): void {
    console.log(
      "[STT] Resetting STT runtime data and stopping all connections..."
    );

    // Reset all runtime state
    this.audioBuffer = [];
    this.accumulatedTranscript = "";
    this.isRecording = false;
    this.isProcessingTranscript = false;
    this.lastRecordingDuration = 0;
    this.recordingStartTime = 0;

    // Clear finalize timeout
    if (this.finalizeTimeout) {
      clearTimeout(this.finalizeTimeout);
      this.finalizeTimeout = null;
    }

    // Close any active connections with explicit cleanup
    if (this.realtimeProvider) {
      console.log(
        "[STT] Disconnecting realtime provider during runtime data reset"
      );
      try {
        this.realtimeProvider.disconnect();
      } catch (error) {
        console.warn(
          "[STT] Error disconnecting realtime provider during reset:",
          error
        );
      }
      this.realtimeProvider = null;
    }

    // Close regular STT session
    if (this.sttSession) {
      try {
        this.sttSession.close();
      } catch (error) {
        console.warn("[STT] Error closing STT session during reset:", error);
      }
      this.sttSession = null;
    }

    console.log("[STT] Runtime data reset completed - all connections closed");
  }

  /**
   * Disable STT service completely for unauthenticated users
   * This ensures no realtime connections or audio processing occurs
   */
  public disableForUnauthenticatedUser(): void {
    console.log(
      "[STT] Disabling STT service for unauthenticated user - stopping all operations"
    );

    // First close all sessions
    this.closeSession();

    // Then reset all runtime data
    this.resetRuntimeData();

    console.log(
      "[STT] STT service disabled - no further operations will be performed until user authenticates"
    );
  }
}

export default STTService;
