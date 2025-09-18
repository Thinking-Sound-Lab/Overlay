// STTService.ts - Speech-to-Text Service (Pre-recorded STT)
// REAL-TIME STT COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
// import RealtimeSTTProvider, {
//   RealtimeConfig,
//   RealtimeSTTCallback,
// } from "../providers/realtime_stt";
import PrerecordedSTTProvider, {
  PrerecordedConfig,
  PrerecordedSTTCallback,
} from "../providers/deepgram";
import { TranslationService } from "./translation_service";
import { AnalyticsService } from "./analytics_service";
import { ApplicationDetectionService } from "./application_detection_service";
import { ApplicationMappingsConfig } from "../config/application_mappings";
import { DataLoaderService } from "./data_loader_service";
import { WindowManager } from "../windows/window-manager";
import { InformationMessage } from "../windows/types";
import { Settings } from "../../shared/types";
import {
  hasProAccess,
  canUseWords,
} from "../../shared/utils/subscription-permissions";
import {
  getDeepgramModelForProfession,
  requiresProAccess,
  isLanguageProfessionSupported,
} from "../../shared/constants/professions";
import { AudioStorageService } from "./audio_storage_service";
import { SystemAudioManager } from "./system_audio_manager";

class STTService {
  // REAL-TIME PROVIDER COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
  // private realtimeProvider: RealtimeSTTProvider | null = null;
  private prerecordedProvider: PrerecordedSTTProvider | null = null;
  private audioBuffer: string[] = [];
  private recordingState = false;
  private lastRecordingDuration = 0;
  private recordingStartTime = 0;
  private accumulatedTranscript = "";
  private isProcessingTranscript = false;
  private finalizeTimeout: NodeJS.Timeout | null = null;

  constructor(
    private dataLoaderService: DataLoaderService,
    private audioStorageService: AudioStorageService,
    private translationService: TranslationService,
    private analyticsService: AnalyticsService,
    private windowManager: WindowManager,
    private systemAudioManager: SystemAudioManager,
    private applicationDetectionService: ApplicationDetectionService
  ) {
    // REAL-TIME PROVIDER COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
    // this.realtimeProvider = null;
    this.prerecordedProvider = null;
  }

  private async cleanup(): Promise<void> {
    // REAL-TIME PROVIDER CLEANUP COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
    // if (this.realtimeProvider) {
    //   this.realtimeProvider.disconnect();
    //   this.realtimeProvider = null;
    // }
    this.prerecordedProvider = null;
    if (this.finalizeTimeout) {
      clearTimeout(this.finalizeTimeout);
      this.finalizeTimeout = null;
    }
    this.audioBuffer = [];
    this.accumulatedTranscript = "";
    this.recordingState = false;
    this.isProcessingTranscript = false;
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
   * Get current profession from DataLoaderService settings
   */
  private getCurrentProfession(): string {
    const settings: Settings = this.dataLoaderService.getUserSettings();
    const profession: string = settings.profession || "general";
    console.log("[STT] Using current profession from settings:", profession);
    return profession;
  }

  /**
   * Check if user is authenticated (pre-recorded STT is the current supported mode)
   * Returns true only if user is authenticated
   */
  private isPrerecordedModeEnabled(): boolean {
    // Check if user is authenticated
    const cacheInfo = this.dataLoaderService.getCacheInfo();
    if (!cacheInfo.hasUser || !cacheInfo.userId) {
      console.log("[STT] No authenticated user - STT disabled");
      return false;
    }

    // Pre-recorded STT is the current supported mode for all authenticated users
    console.log(
      `[STT] User authenticated (${cacheInfo.userId}) - pre-recorded STT enabled`
    );
    return true;
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

    // Pre-recorded STT is the current supported mode - initialize pre-recorded provider
    console.log("[STT] User authenticated - initializing pre-recorded STT");
    await this.initializePrerecorded();
  }

  // REAL-TIME INITIALIZATION COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
  // async initializeRealtime(): Promise<void> { ... }

  async initializePrerecorded(): Promise<void> {
    const language: string = this.getCurrentLanguage();
    const profession: string = this.getCurrentProfession();

    // Check if user has access to profession-specific models and language compatibility
    const userData = this.dataLoaderService.getCurrentUser();
    let selectedModel: string;
    let effectiveProfession = profession;

    // Check language compatibility first
    if (!isLanguageProfessionSupported(language, profession)) {
      console.log(
        `[STT] Profession ${profession} requires English but language is ${language}, falling back to general`
      );
      effectiveProfession = "general";
    }

    // Get model for effective profession
    selectedModel = getDeepgramModelForProfession(
      effectiveProfession,
      language
    );

    // Check Pro access for specialized models
    if (
      requiresProAccess(effectiveProfession) &&
      !hasProAccess(userData, "profession_models")
    ) {
      console.log(
        `[STT] User lacks Pro access for profession model ${selectedModel}, falling back to nova-2`
      );
      selectedModel = "nova-2";
    }

    console.log(
      `[STT] Initializing pre-recorded mode with language: ${language}, profession: ${profession}, model: ${selectedModel}`
    );

    const config: PrerecordedConfig = {
      language: language,
      apiKey: process.env.DEEPGRAM_API_KEY || "",
      model: selectedModel,
    };

    const prerecordedCallback: PrerecordedSTTCallback = {
      onTranscriptResult: async (transcript: string, confidence: number) => {
        console.log("[STT] Pre-recorded transcript received:", transcript);
        console.log("[STT] Confidence:", confidence);

        // Clear the error timeout since we got a response
        if (this.finalizeTimeout) {
          clearTimeout(this.finalizeTimeout);
          this.finalizeTimeout = null;
        }

        // Process transcript when pre-recorded response is received
        if (!this.isProcessingTranscript) {
          console.log(
            "[STT] Processing transcript from pre-recorded response:",
            transcript.length,
            "chars"
          );
          this.isProcessingTranscript = true;

          try {
            await this.processTranscript(transcript, language);
          } finally {
            this.isProcessingTranscript = false;
          }
        } else {
          console.log(
            "[STT] Transcript processing already in progress, skipping"
          );
        }
      },
      onError: (error: Error) => {
        console.error("[STT] Pre-recorded error:", error);
        this.handlePrerecordedError(error);
      },
    };

    this.prerecordedProvider = new PrerecordedSTTProvider(
      config,
      prerecordedCallback
    );
    console.log("[STT] Pre-recorded STT provider initialized");
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

    console.log(
      `[STT] Reinitializing for authenticated user ${cacheInfo.userId} with language: ${newLanguage} (pre-recorded mode)`
    );

    // Close existing sessions first
    // REAL-TIME PROVIDER CLEANUP COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
    // if (this.realtimeProvider) {
    //   console.log(
    //     "[STT] Cleaning up existing realtime provider and stopping all reconnections"
    //   );
    //   this.realtimeProvider.disconnect();
    //   this.realtimeProvider = null;
    //
    //   // Add a small delay to ensure complete cleanup before proceeding
    //   await new Promise((resolve) => setTimeout(resolve, 200));
    // }
    if (this.prerecordedProvider) {
      console.log("[STT] Cleaning up existing pre-recorded provider");
      this.prerecordedProvider = null;
    }

    // Clear any audio buffer and reset state
    this.audioBuffer = [];
    this.recordingState = false;
    this.accumulatedTranscript = "";
    this.isProcessingTranscript = false;

    // Initialize based on current settings (this will also check authentication again)
    await this.initialize();

    console.log(
      `[STT] Successfully reinitialized with language: ${newLanguage} (pre-recorded mode)`
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

    if (!this.recordingState) return;

    // Buffer audio for pre-recorded processing (no real-time streaming)
    this.audioBuffer.push(audioData);
    console.log(
      `[STT] Buffering audio chunk for pre-recorded processing for user ${cacheInfo.userId}, buffer size: ${this.audioBuffer.length}`
    );
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

    if (this.recordingState) return; // Already recording

    console.log(
      `[STT] Starting dictation for authenticated user: ${cacheInfo.userId}`
    );

    this.recordingState = true;
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

    this.recordingState = false;

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

      // Store audio temporarily in AudioStorageService for later upload
      if (this.audioStorageService && this.audioBuffer.length > 0) {
        this.audioStorageService.storeTempAudio(this.audioBuffer);
      }

      // Pre-recorded mode - process buffered audio chunks
      console.log("[STT] Pre-recorded mode - processing buffered audio");

      if (this.prerecordedProvider && this.audioBuffer.length > 0) {
        await this.prerecordedProvider.processAudioChunks(this.audioBuffer);
      }

      // Set timeout to handle case where pre-recorded response never arrives
      //   this.finalizeTimeout = setTimeout(async () => {
      //     console.log("[STT] Pre-recorded timeout - no response from Deepgram");

      //     if (
      //       this.accumulatedTranscript &&
      //       this.accumulatedTranscript.trim().length > 0
      //     ) {
      //       try {
      //         await this.processTranscript(
      //           this.accumulatedTranscript,
      //           "auto-detected"
      //         );
      //       } finally {
      //         this.isProcessingTranscript = false;
      //         this.finalizeTimeout = null;
      //         this.recordingState = false;
      //       }

      //       return;
      //     }

      //     // Show "transcript not found" error and reset UI
      //     if (this.windowManager) {
      //       const message: InformationMessage = {
      //         type: "empty-transcript",
      //         title: "Transcript Not Found",
      //         message: "Unable to process the recording. Please try again.",
      //         duration: 3000,
      //       };
      //       this.windowManager.showInformation(message);
      //       this.windowManager.sendToRecording("processing-complete");
      //       this.windowManager.compactRecordingWindow();
      //     }

      //     // Reset state
      //     this.isProcessingTranscript = false;
      //     this.finalizeTimeout = null;
      //   }, 10000); // 10 second timeout for pre-recorded processing
    } catch (error) {
      console.error("[STT] Error processing audio:", error);
    }

    // Clear buffer
    this.audioBuffer = [];
  }

  stopDictation(shouldProcess = true) {
    if (!this.recordingState) return;

    console.log(
      `[STT] Stopping dictation manually (shouldProcess: ${shouldProcess})`
    );

    this.recordingState = false;
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
        this.lastRecordingDuration
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

    this.recordingState = false;

    // Clear finalize timeout
    if (this.finalizeTimeout) {
      clearTimeout(this.finalizeTimeout);
      this.finalizeTimeout = null;
    }

    // Pre-recorded STT is the current mode - no regular STT session to close

    // Close pre-recorded provider with explicit cleanup
    // REAL-TIME PROVIDER CLEANUP COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
    // if (this.realtimeProvider) {
    //   console.log(
    //     "[STT] Disconnecting realtime provider and stopping all reconnection attempts"
    //   );
    //   try {
    //     this.realtimeProvider.disconnect();
    //   } catch (error) {
    //     console.warn("[STT] Error disconnecting realtime provider:", error);
    //   }
    //   this.realtimeProvider = null;
    // }
    if (this.prerecordedProvider) {
      console.log("[STT] Cleaning up pre-recorded provider");
      this.prerecordedProvider = null;
    }

    // Clear audio buffer
    this.audioBuffer = [];

    console.log("[STT] Session closed and all connections cleaned up");
  }

  // Getter for recording status (useful for UI indicators)
  get recordingStatus(): boolean {
    return this.recordingState;
  }

  // Public recording state methods
  public isRecording(): boolean {
    return this.recordingState;
  }

  public isProcessing(): boolean {
    return this.isProcessingTranscript;
  }

  public async startRecording(): Promise<void> {
    // Don't allow recording if already recording or processing
    if (this.recordingState || this.isProcessingTranscript) return;

    // Capture application context in background for efficient translation
    await this.applicationDetectionService.captureCurrentContext();

    // Mute system audio during recording
    if (this.systemAudioManager) {
      await this.systemAudioManager.muteSystemAudio();
    }

    // Expand recording window
    if (this.windowManager.getRecordingWindow()) {
      this.windowManager.expandRecordingWindow();
    }

    // Send recording started signal
    this.windowManager.sendToRecording("recording-started");

    this.startDictation();
    console.log("[STTService] Recording session started");
  }

  public async stopRecording(): Promise<void> {
    if (!this.recordingState) return;

    // Send recording stopped signal
    this.windowManager.sendToRecording("recording-stopped");

    // Stop recording but don't process yet - wait for renderer to request processing
    this.stopDictation(false);

    // Restore system audio after recording
    if (this.systemAudioManager) {
      await this.systemAudioManager.restoreSystemAudio();
    }
  }

  /**
   * Start processing the recorded audio - called from IPC handler when renderer is ready
   */
  public async startProcessing(): Promise<void> {
    if (this.isProcessingTranscript) {
      console.log("[STTService] Already processing, skipping");
      return;
    }

    try {
      // Start the finalization process - timeout now handled by Translation Service
      await this.finalizeDictation();
      console.log("[STTService] Audio processing completed successfully");
    } catch (error) {
      console.error("[STTService] Error during audio processing:", error);
      throw error;
    }
  }

  public async cancelRecording(): Promise<void> {
    if (!this.recordingState) return;

    this.stopDictation(false);

    // Reset window state
    if (this.windowManager.getRecordingWindow()) {
      this.windowManager.compactRecordingWindow();
      this.windowManager.sendToRecording("processing-complete");
    }

    // Restore system audio after canceling
    if (this.systemAudioManager) {
      await this.systemAudioManager.restoreSystemAudio();
    }
  }

  get isRealtime(): boolean {
    // Return false since we're using pre-recorded mode
    return false;
  }

  get realtimeConnectionStatus(): boolean {
    // Return true if pre-recorded provider is ready
    return this.prerecordedProvider?.isReady() || false;
  }

  get currentAccumulatedTranscript(): string {
    return this.accumulatedTranscript;
  }

  clearStreamingTranscript(): void {
    this.accumulatedTranscript = "";
    console.log("[STT] Streaming transcript cleared");
  }

  // REAL-TIME ERROR HANDLER COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
  private async handleRealtimeError(error: Error): Promise<void> {
    console.error(
      "[STT] Realtime error occurred, attempting fallback:",
      error.message
    );

    // Stop recording to prevent data loss
    const wasRecording = this.recordingState;
    this.recordingState = false;

    // If we have accumulated audio and were recording, process it with fallback
    if (wasRecording && this.audioBuffer.length > 0) {
      console.log("[STT] Processing buffered audio with fallback method");

      try {
        // No fallback processing available - real-time STT is the only mode
        console.error(
          "[STT] Cannot process buffered audio - no fallback method available"
        );
      } catch (fallbackError) {
        console.error("[STT] Fallback processing also failed:", fallbackError);
      }
    }

    // REAL-TIME RECONNECTION COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
    // Try to reconnect realtime after a delay
    // setTimeout(() => {
    //   this.attemptRealtimeReconnection();
    // }, 5000);
  }

  private async handlePrerecordedError(error: Error): Promise<void> {
    console.error("[STT] Pre-recorded error occurred:", error.message);

    // Clear the processing flag
    this.isProcessingTranscript = false;

    // Clear finalize timeout
    if (this.finalizeTimeout) {
      clearTimeout(this.finalizeTimeout);
      this.finalizeTimeout = null;
    }

    // Show error message to user
    if (this.windowManager) {
      const message: InformationMessage = {
        type: "processing-error",
        title: "Transcription Error",
        message: "Unable to process the recording. Please try again.",
        duration: 5000,
      };
      this.windowManager.showInformation(message);
      this.windowManager.sendToRecording("processing-complete");
      this.windowManager.compactRecordingWindow();
    }

    // Reset recording state
    this.recordingState = false;
  }

  // REAL-TIME RECONNECTION COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
  // private async attemptRealtimeReconnection(): Promise<void> {
  //   // CRITICAL: Check authentication first - never attempt to reconnect for unauthenticated users
  //   const cacheInfo = this.dataLoaderService.getCacheInfo();
  //   if (!cacheInfo.hasUser || !cacheInfo.userId) {
  //     console.log(
  //       "[STT] User not authenticated - aborting realtime reconnection attempt"
  //     );
  //     return;
  //   }
  //
  //   // Real-time mode is always enabled for authenticated users
  //   // No need to check isRealtimeModeEnabled() since we already checked authentication above
  //
  //   console.log(
  //     `[STT] Attempting realtime reconnection for authenticated user: ${cacheInfo.userId}`
  //   );
  //
  //   try {
  //     // Close existing provider if it exists
  //     if (this.realtimeProvider) {
  //       this.realtimeProvider.disconnect();
  //       this.realtimeProvider = null;
  //     }
  //
  //     // Attempt to reinitialize realtime
  //     await this.initializeRealtime();
  //     console.log("[STT] Realtime reconnection successful");
  //   } catch (error) {
  //     console.error("[STT] Realtime reconnection failed:", error);
  //     console.log(
  //       "[STT] Real-time reconnection failed - no fallback available"
  //     );
  //
  //     // No fallback mode available - real-time STT is the only supported mode
  //     console.error(
  //       "[STT] Cannot fall back to regular STT - real-time mode is required"
  //     );
  //   }
  // }

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
    this.recordingState = false;
    this.isProcessingTranscript = false;
    this.lastRecordingDuration = 0;
    this.recordingStartTime = 0;

    // Clear finalize timeout
    if (this.finalizeTimeout) {
      clearTimeout(this.finalizeTimeout);
      this.finalizeTimeout = null;
    }

    // Close any active connections with explicit cleanup
    // REAL-TIME PROVIDER CLEANUP COMMENTED OUT FOR PRE-RECORDED EXPERIMENT
    // if (this.realtimeProvider) {
    //   console.log(
    //     "[STT] Disconnecting realtime provider during runtime data reset"
    //   );
    //   try {
    //     this.realtimeProvider.disconnect();
    //   } catch (error) {
    //     console.warn(
    //       "[STT] Error disconnecting realtime provider during reset:",
    //       error
    //     );
    //   }
    //   this.realtimeProvider = null;
    // }
    if (this.prerecordedProvider) {
      console.log(
        "[STT] Cleaning up pre-recorded provider during runtime data reset"
      );
      this.prerecordedProvider = null;
    }

    // Pre-recorded STT is the current mode - no regular STT session to close

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

export { STTService };
