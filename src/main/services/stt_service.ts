// STTService.ts - Main Process (Voice Model Only)
import { createWhisperSTT } from "../providers/openai";
import { STTClient } from "../providers/openai";
import RealtimeSTTProvider, {
  RealtimeConfig,
  RealtimeSTTCallback,
} from "../providers/realtime_stt";
import TranslationService from "./translation_service";
import { ContextFormattingSettings } from "../../shared/types";
import { AnalyticsService } from "./analytics_service";
import { ApplicationMappingsConfig } from "../config/application_mappings";

class STTService {
  private sttSession: STTClient;
  private realtimeProvider: RealtimeSTTProvider | null = null;
  private audioBuffer: string[] = [];
  private isRecording = false;
  private lastRecordingDuration = 0;
  private recordingStartTime = 0;
  private onMetricsUpdate?: (
    metrics: any,
    transcript?: string,
    translationMeta?: any
  ) => void;
  private translationService: TranslationService;
  private analyticsService?: AnalyticsService;
  private settings: any = {};
  private isRealtimeMode = false;
  private accumulatedTranscript = "";
  private streamingDeltas: string[] = [];

  constructor(
    onMetricsUpdate?: (
      metrics: any,
      transcript?: string,
      translationMeta?: any
    ) => void,
    analyticsService?: AnalyticsService
  ) {
    this.sttSession = null;
    this.realtimeProvider = null;
    this.onMetricsUpdate = onMetricsUpdate;
    this.translationService = TranslationService.getInstance();
    this.analyticsService = analyticsService;
  }

  updateSettings(settings: any) {
    this.settings = settings;
    console.log("[STT] Settings updated:", {
      enableTranslation: settings.enableTranslation,
      targetLanguage: settings.targetLanguage,
    });

    // Pass context formatting settings to Translation Service
    if (settings.contextFormatting) {
      this.translationService.updateContextFormattingSettings(
        settings.contextFormatting
      );
    }
  }

  async initialize(language: string) {
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

  async initializeRealtime(language: string): Promise<void> {
    console.log(`[STT] Initializing realtime mode with language: ${language}`);

    const config: RealtimeConfig = {
      language: language,
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-4o-realtime-preview",
    };

    const realtimeCallback: RealtimeSTTCallback = {
      onTranscriptDelta: (delta: string, isFinal: boolean) => {
        console.log(
          "[STT] Realtime transcript delta:",
          delta,
          "isFinal:",
          isFinal
        );
        // Process streaming transcription
        this.processStreamingTranscript(delta, isFinal, language);
      },
      onTranscriptComplete: (transcript: string, language: string) => {
        console.log("[STT] Realtime transcript complete:", transcript);
        this.processTranscript(transcript, language);
      },
      onSpeechStarted: () => {
        console.log("[STT] Realtime speech started");
        this.isRecording = true;
        this.recordingStartTime = Date.now();

        // Clear previous accumulation
        this.accumulatedTranscript = "";
        this.streamingDeltas = [];

        if (this.analyticsService) {
          this.analyticsService.trackRecordingStarted();
        }
      },
      onSpeechStopped: () => {
        console.log("[STT] Realtime speech stopped");
        this.isRecording = false;

        const recordingDuration = (Date.now() - this.recordingStartTime) / 1000;
        this.lastRecordingDuration = recordingDuration;

        if (this.analyticsService) {
          this.analyticsService.trackRecordingStopped(recordingDuration);
        }
      },
      onError: (error: Error) => {
        console.error("[STT] Realtime error:", error);
        this.handleRealtimeError(error, language);
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
    this.isRealtimeMode = true;
  }

  async reinitialize(newLanguage: string) {
    console.log(`[STT] Reinitializing with language: ${newLanguage}`);
    console.log(`[STT] Current mode - isRealtimeMode: ${this.isRealtimeMode}`);

    const wasInRealtimeMode = this.isRealtimeMode;

    // Close existing sessions
    if (this.sttSession) {
      this.sttSession.close();
      this.sttSession = null;
    }

    if (this.realtimeProvider) {
      this.realtimeProvider.disconnect();
      this.realtimeProvider = null;
    }

    // Clear any audio buffer and reset state
    this.audioBuffer = [];
    this.isRecording = false;
    this.accumulatedTranscript = "";
    this.streamingDeltas = [];

    // Initialize with new language - preserve the mode
    if (wasInRealtimeMode) {
      console.log(`[STT] Reinitializing in realtime mode with language: ${newLanguage}`);
      await this.initializeRealtime(newLanguage);
    } else {
      console.log(`[STT] Reinitializing in regular mode with language: ${newLanguage}`);
      await this.initialize(newLanguage);
    }

    console.log(
      `[STT] Successfully reinitialized with language: ${newLanguage}, mode preserved: ${wasInRealtimeMode ? 'realtime' : 'regular'}`
    );
  }

  // This method will be called from your audio capture mechanism
  handleAudioChunk(audioData: string) {
    if (!this.isRecording) return;

    // Always buffer audio for fallback purposes, even in realtime mode
    this.audioBuffer.push(audioData);

    if (this.isRealtimeMode && this.realtimeProvider?.isReady()) {
      // Send audio chunk immediately to realtime provider
      this.realtimeProvider.sendStreamingAudioChunk(audioData);
      console.log(
        `[STT] Streaming audio chunk to realtime, buffer size: ${this.audioBuffer.length}`
      );
    } else {
      // Buffer for batch processing in regular mode
      console.log(
        `[STT] Buffering audio chunk, buffer size: ${this.audioBuffer.length}`
      );
    }
  }

  startDictation() {
    if (this.isRecording) return; // Already recording

    this.isRecording = true;
    this.audioBuffer = [];
    this.recordingStartTime = Date.now();

    console.log("[STT] Started dictation - speak now...");

    // Track recording started
    if (this.analyticsService) {
      this.analyticsService.trackRecordingStarted();
    }
  }

  async finalizeDictation() {
    if (this.audioBuffer.length === 0) {
      console.log("[STT] No audio chunks to process");
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
    if (this.analyticsService) {
      this.analyticsService.trackRecordingStopped(recordingDuration);
    }

    try {
      if (this.isRealtimeMode) {
        // In realtime mode, commit the audio buffer to trigger transcription
        console.log(
          "[STT] Realtime mode - committing audio buffer for transcription"
        );
        if (this.realtimeProvider?.isReady()) {
          this.realtimeProvider.commitAudio();
        }
        this.lastRecordingDuration = recordingDuration;
      } else {
        // In regular mode, send accumulated audio to Whisper
        if (this.sttSession) {
          await this.sttSession.processAudio(this.audioBuffer);
          this.lastRecordingDuration = recordingDuration;
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

  stopDictation() {
    if (!this.isRecording) return;

    console.log("[STT] Stopping dictation manually");

    this.isRecording = false;

    // Process remaining audio if any
    if (this.audioBuffer.length > 0) {
      this.finalizeDictation();
    }
  }

  async processTranscript(transcript: string, language: string) {
    if (!transcript || transcript.trim().length === 0) {
      console.log("[STT] Empty transcript received");
      return;
    }

    console.log("[STT] Raw transcript:", transcript);
    console.log("[STT] Source language:", language);

    try {
      // STT Service now only handles voice-to-text conversion
      // Pass the transcript and language to Translation Service for processing
      await this.translationService.processText(
        transcript,
        language,
        this.settings,
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
    console.log(
      "[STT] Processing streaming transcript delta:",
      delta,
      "isFinal:",
      isFinal
    );

    if (!delta) return;

    if (isFinal) {
      // For final transcripts, use the complete accumulated transcript, not just the delta
      // But if there's no accumulated transcript yet, use the delta as the final transcript
      if (this.accumulatedTranscript) {
        // We have accumulated deltas, use the complete accumulated transcript
        console.log("[STT] Using accumulated transcript from deltas");
      } else {
        // No deltas accumulated, use the final delta as the complete transcript
        console.log("[STT] Using final delta as complete transcript");
        this.accumulatedTranscript = delta;
      }

      console.log(
        "[STT] Final accumulated transcript:",
        this.accumulatedTranscript,
        "(from accumulated:",
        !!this.accumulatedTranscript,
        "or delta:",
        !!delta,
        ")"
      );

      // Calculate duration for realtime streaming metrics (current time - recording start time)
      const currentDuration = this.isRecording
        ? (Date.now() - this.recordingStartTime) / 1000
        : this.lastRecordingDuration || 0;

      console.log(
        "[STT] Calculated duration for streaming transcript:",
        currentDuration
      );

      // Process the complete transcript with correct duration
      await this.translationService.processText(
        this.accumulatedTranscript,
        language,
        this.settings,
        currentDuration,
        this.onMetricsUpdate
      );

      // Clear accumulated data for next utterance
      this.accumulatedTranscript = "";
      this.streamingDeltas = [];
    } else {
      // Accumulate streaming delta
      this.streamingDeltas.push(delta);
      this.accumulatedTranscript += delta;

      console.log(
        "[STT] Accumulated transcript so far:",
        this.accumulatedTranscript
      );

      // Emit intermediate results for real-time UI updates if callback exists
      //   if (this.onMetricsUpdate) {
      //     this.onMetricsUpdate(
      //       {
      //         type: "streaming_transcript",
      //         partialTranscript: this.accumulatedTranscript,
      //         delta: delta,
      //         isFinal: false,
      //         timestamp: Date.now(),
      //       },
      //       this.accumulatedTranscript
      //     );
      //   }
    }
  }

  /**
   * Update context formatting settings (delegated to Translation Service)
   */
  updateContextFormattingSettings(
    settings: Partial<ContextFormattingSettings>
  ) {
    this.translationService.updateContextFormattingSettings(settings);
  }

  /**
   * Get current context formatting settings (delegated to Translation Service)
   */
  public getContextFormattingSettings(): ContextFormattingSettings {
    // For backward compatibility, we'll need to get this from translation service
    // For now, return default settings
    return {
      enableContextFormatting: true,
      contextSettings: {},
      customAppMappings: {},
    };
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
    this.isRecording = false;

    // Close regular STT session
    this.sttSession?.close();
    this.sttSession = null;

    // Close realtime provider
    if (this.realtimeProvider) {
      this.realtimeProvider.disconnect();
      this.realtimeProvider = null;
    }

    this.audioBuffer = [];
    this.isRealtimeMode = false;

    console.log("[STT] Session closed, shortcuts unregistered");
  }

  // Getter for recording status (useful for UI indicators)
  get recordingStatus(): boolean {
    return this.isRecording;
  }

  // Mode management methods
  async enableRealtimeMode(language: string): Promise<void> {
    if (this.isRealtimeMode) {
      console.log("[STT] Already in realtime mode");
      return;
    }

    // Close existing regular session
    if (this.sttSession) {
      this.sttSession.close();
      this.sttSession = null;
    }

    // Initialize realtime mode
    await this.initializeRealtime(language);
    console.log("[STT] Realtime mode enabled");
  }

  async disableRealtimeMode(language: string): Promise<void> {
    if (!this.isRealtimeMode) {
      console.log("[STT] Already in regular mode");
      return;
    }

    // Close realtime provider
    if (this.realtimeProvider) {
      this.realtimeProvider.disconnect();
      this.realtimeProvider = null;
    }

    // Initialize regular STT mode
    await this.initialize(language);
    this.isRealtimeMode = false;
    console.log("[STT] Realtime mode disabled, switched to regular mode");
  }

  get isRealtime(): boolean {
    return this.isRealtimeMode;
  }

  get realtimeConnectionStatus(): boolean {
    return this.realtimeProvider?.isReady() || false;
  }

  get currentAccumulatedTranscript(): string {
    return this.accumulatedTranscript;
  }

  get streamingDeltaHistory(): string[] {
    return [...this.streamingDeltas];
  }

  clearStreamingTranscript(): void {
    this.accumulatedTranscript = "";
    this.streamingDeltas = [];
    console.log("[STT] Streaming transcript cleared");
  }

  /**
   * Update the language for real-time provider without full reinitialization
   * This provides a more graceful way to change languages in real-time mode
   */
  async updateRealtimeLanguage(newLanguage: string): Promise<void> {
    if (!this.isRealtimeMode) {
      console.log("[STT] Not in realtime mode, using regular reinitialize");
      await this.reinitialize(newLanguage);
      return;
    }

    console.log(`[STT] Updating realtime language to: ${newLanguage}`);
    
    // Stop any ongoing recording
    const wasRecording = this.isRecording;
    if (wasRecording) {
      this.isRecording = false;
      console.log("[STT] Stopped recording for language update");
    }

    try {
      // Close existing realtime provider
      if (this.realtimeProvider) {
        this.realtimeProvider.disconnect();
        this.realtimeProvider = null;
      }

      // Clear accumulated state
      this.accumulatedTranscript = "";
      this.streamingDeltas = [];
      this.audioBuffer = [];

      // Initialize with new language
      await this.initializeRealtime(newLanguage);
      
      console.log(`[STT] Successfully updated realtime language to: ${newLanguage}`);
    } catch (error) {
      console.error("[STT] Error updating realtime language:", error);
      
      // Fallback to regular reinitialize if realtime update fails
      console.log("[STT] Falling back to full reinitialize");
      await this.reinitialize(newLanguage);
      throw error;
    }
  }

  private async handleRealtimeError(
    error: Error,
    language: string
  ): Promise<void> {
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
        await this.initializeFallback(language);

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
      this.attemptRealtimeReconnection(language);
    }, 5000);
  }

  private async initializeFallback(language: string): Promise<void> {
    console.log("[STT] Initializing fallback STT session");

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

  private async attemptRealtimeReconnection(language: string): Promise<void> {
    if (!this.isRealtimeMode) return;

    console.log("[STT] Attempting realtime reconnection...");

    try {
      // Close existing provider if it exists
      if (this.realtimeProvider) {
        this.realtimeProvider.disconnect();
        this.realtimeProvider = null;
      }

      // Attempt to reinitialize realtime
      await this.initializeRealtime(language);
      console.log("[STT] Realtime reconnection successful");
    } catch (error) {
      console.error("[STT] Realtime reconnection failed:", error);
      console.log("[STT] Falling back to regular STT mode permanently");

      // Permanently fall back to regular mode
      this.isRealtimeMode = false;
      await this.initializeFallback(language);
    }
  }
}

export default STTService;
