// providers/deepgram.ts - Deepgram Pre-recorded API integration for buffer-based STT
import {
  createClient,
  DeepgramClient,
  PrerecordedSchema,
  SyncPrerecordedResponse,
} from "@deepgram/sdk";
import { combineAudioChunks, addWavHeader } from "./openai";

export interface PrerecordedSTTCallback {
  onTranscriptResult: (transcript: string, confidence: number) => void;
  onError: (error: Error) => void;
}

export interface PrerecordedConfig {
  language: string;
  apiKey: string;
  model?: string;
}

export class PrerecordedSTTProvider {
  private deepgramClient: DeepgramClient;
  private config: PrerecordedConfig;
  private callback: PrerecordedSTTCallback;

  constructor(config: PrerecordedConfig, callback: PrerecordedSTTCallback) {
    // Validate required configuration
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new Error("Deepgram API key is required");
    }
    if (!config.language || config.language.trim() === "") {
      throw new Error("Language is required for Deepgram transcription");
    }

    this.config = {
      ...config,
      model: config.model || "nova-2",
    };
    this.callback = callback;

    // Initialize Deepgram client
    this.deepgramClient = createClient(this.config.apiKey);
    console.log("[PrerecordedSTT] Deepgram client initialized with model:", this.config.model);
  }

  /**
   * Process audio chunks using Deepgram's pre-recorded API
   */
  async processAudioChunks(audioChunks: string[]): Promise<void> {
    if (!audioChunks || audioChunks.length === 0) {
      throw new Error("No audio chunks provided for processing");
    }

    console.log("[PrerecordedSTT] Processing", audioChunks.length, "audio chunks");

    try {
      // Combine base64 audio chunks into a single buffer
      const combinedBuffer = combineAudioChunks(audioChunks);
      console.log("[PrerecordedSTT] Combined audio buffer size:", combinedBuffer.length, "bytes");

      // Add WAV header for proper audio format
      const wavBuffer = addWavHeader(combinedBuffer);
      console.log("[PrerecordedSTT] WAV buffer size:", wavBuffer.length, "bytes");

      // Configure pre-recorded transcription options
      const prerecordedOptions: PrerecordedSchema = {
        model: this.config.model,
        language: this.config.language,
        punctuate: true,
        smart_format: true,
        diarize: false, // Disable speaker diarization for faster processing
        utterances: false, // Disable utterance segmentation for faster processing
        encoding: "linear16",
        sample_rate: 16000,
        channels: 1,
      };

      console.log("[PrerecordedSTT] Sending audio to Deepgram pre-recorded API...");
      const startTime = Date.now();

      // Send audio buffer to Deepgram pre-recorded API
      const response = await this.deepgramClient.listen.prerecorded.transcribeFile(
        wavBuffer,
        prerecordedOptions
      );

      const processingTime = Date.now() - startTime;
      console.log("[PrerecordedSTT] Processing completed in", processingTime, "ms");

      // Process the response
      this.handlePrerecordedResponse(response.result);

    } catch (error) {
      console.error("[PrerecordedSTT] Error processing audio chunks:", error);
      this.callback.onError(error as Error);
    }
  }

  /**
   * Handle Deepgram pre-recorded API response
   */
  private handlePrerecordedResponse(response: SyncPrerecordedResponse): void {
    console.log("[PrerecordedSTT] Received response:", JSON.stringify(response, null, 2));

    try {
      // Extract transcript from response
      const results = response.results;
      if (!results || !results.channels || results.channels.length === 0) {
        throw new Error("No transcription results found in response");
      }

      const channel = results.channels[0];
      if (!channel.alternatives || channel.alternatives.length === 0) {
        throw new Error("No alternatives found in transcription results");
      }

      const alternative = channel.alternatives[0];
      const transcript = alternative.transcript;
      const confidence = alternative.confidence;

      console.log("[PrerecordedSTT] Transcript:", transcript);
      console.log("[PrerecordedSTT] Confidence:", confidence);

      if (!transcript || transcript.trim().length === 0) {
        throw new Error("Empty transcript received from Deepgram");
      }

      // Call the success callback with the transcript
      this.callback.onTranscriptResult(transcript.trim(), confidence);

    } catch (error) {
      console.error("[PrerecordedSTT] Error processing response:", error);
      this.callback.onError(error as Error);
    }
  }

  /**
   * Check if the provider is ready (always true for pre-recorded)
   */
  isReady(): boolean {
    return true;
  }

  /**
   * Get current configuration
   */
  getConfig(): PrerecordedConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (for language/model changes)
   */
  updateConfig(newConfig: Partial<PrerecordedConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    console.log("[PrerecordedSTT] Configuration updated:", this.config);
  }
}

export default PrerecordedSTTProvider;