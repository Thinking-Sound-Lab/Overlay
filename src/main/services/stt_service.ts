// STTService.ts - Main Process (Voice Model Only)
import { createWhisperSTT } from "../providers/openai";
import { STTClient } from "../providers/openai";
import TranslationService from "./translation_service";
import { ContextFormattingSettings } from "../../shared/types";
import { AnalyticsService } from "./analytics_service";
import { ApplicationMappingsConfig } from "../config/application_mappings";

class STTService {
  private sttSession: STTClient;
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

  constructor(
    onMetricsUpdate?: (
      metrics: any,
      transcript?: string,
      translationMeta?: any
    ) => void,
    analyticsService?: AnalyticsService
  ) {
    this.sttSession = null;
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

  async reinitialize(newLanguage: string) {
    console.log(`[STT] Reinitializing with language: ${newLanguage}`);

    // Close existing session if it exists
    if (this.sttSession) {
      this.sttSession.close();
      this.sttSession = null;
    }

    // Clear any audio buffer
    this.audioBuffer = [];
    this.isRecording = false;

    // Initialize with new language
    await this.initialize(newLanguage);

    console.log(
      `[STT] Successfully reinitialized with language: ${newLanguage}`
    );
  }

  // This method will be called from your audio capture mechanism
  handleAudioChunk(audioData: string) {
    if (!this.isRecording) return;

    this.audioBuffer.push(audioData);

    console.log(
      `[STT] Received audio chunk, buffer size: ${this.audioBuffer.length}`
    );
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
      // Send accumulated audio to Whisper
      await this.sttSession.processAudio(this.audioBuffer);

      // Store duration for metrics calculation
      this.lastRecordingDuration = recordingDuration;
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
      console.error("[STT] Error passing transcript to translation service:", error);
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

    this.sttSession?.close();
    this.sttSession = null;
    this.audioBuffer = [];

    console.log("[STT] Session closed, shortcuts unregistered");
  }

  // Getter for recording status (useful for UI indicators)
  get recordingStatus(): boolean {
    return this.isRecording;
  }
}

export default STTService;
