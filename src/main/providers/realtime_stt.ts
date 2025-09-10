// providers/realtime_stt.ts - Deepgram Realtime API integration for streaming STT
import {
  createClient,
  DeepgramClient,
  LiveTranscriptionEvents,
  LiveSchema,
  ListenLiveClient,
} from "@deepgram/sdk";
import { EventEmitter } from "events";

// Define TypeScript interfaces for Deepgram responses
interface DeepgramTranscriptAlternative {
  transcript: string;
  confidence: number;
}

interface DeepgramTranscriptChannel {
  alternatives: DeepgramTranscriptAlternative[];
}

interface DeepgramTranscriptResult {
  channel: DeepgramTranscriptChannel;
  is_final: boolean;
  speech_final?: boolean;
  type: string;
}

export interface RealtimeSTTCallback {
  onTranscriptDelta: (delta: string, isFinal: boolean) => void;
  onTranscriptComplete: (transcript: string, language: string) => void;
  onSpeechStarted: () => void;
  onSpeechStopped: () => void;
  onError: (error: Error) => void;
  onConnectionOpen: () => void;
  onConnectionClose: () => void;
}

export interface RealtimeConfig {
  language: string;
  apiKey: string;
  model?: string;
}

export class RealtimeSTTProvider extends EventEmitter {
  private deepgramClient: DeepgramClient;
  private connection: ListenLiveClient | null = null;
  private isConnected = false;
  private config: RealtimeConfig;
  private callback: RealtimeSTTCallback;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isRecordingActive = false;

  constructor(config: RealtimeConfig, callback: RealtimeSTTCallback) {
    super();

    // Validate required configuration
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new Error("Deepgram API key is required");
    }
    if (!config.language || config.language.trim() === "") {
      throw new Error("Language is required for Deepgram transcription");
    }

    this.config = {
      ...config,
      model: config.model || "nova-3",
    };
    this.callback = callback;

    // Initialize Deepgram client with proper typing
    this.deepgramClient = createClient(this.config.apiKey);
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.connection) {
      console.log("[RealtimeSTT] Already connected");
      return;
    }

    try {
      console.log(
        "[RealtimeSTT] Establishing Deepgram WebSocket connection..."
      );

      // Configure live transcription options optimized for short sentences
      const liveOptions: LiveSchema = {
        model: this.config.model,
        language: this.config.language,
        interim_results: true,
        punctuate: true,
        smart_format: true,
        endpointing: 300, // Increased to better handle short sentences
        vad_events: true, // Enable voice activity detection events
        utterance_end_ms: 1000, // Reduced for faster processing of short sentences
        encoding: "linear16",
        sample_rate: 16000,
        channels: 1,
      };

      // Create live transcription connection
      this.connection = this.deepgramClient.listen.live(liveOptions);

      // Set up event handlers with proper types
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        this.handleConnectionOpen();
      });

      this.connection.on(
        LiveTranscriptionEvents.Transcript,
        (data: DeepgramTranscriptResult) => {
          this.handleTranscriptResult(data);
        }
      );

      this.connection.on(LiveTranscriptionEvents.Error, (error: Error) => {
        this.handleError(error);
      });

      this.connection.on(
        LiveTranscriptionEvents.Close,
        (event: { code?: number; reason?: string }) => {
          this.handleConnectionClose(event.code || 1000, event.reason || "");
        }
      );

      // Connection is established when Open event fires
      return Promise.resolve();
    } catch (error) {
      console.error("[RealtimeSTT] Connection error:", error);
      throw error;
    }
  }

  private handleConnectionOpen(): void {
    console.log("[RealtimeSTT] Deepgram WebSocket connection established");
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.startKeepAlive();
    this.callback.onConnectionOpen();
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      // Defensive check: Don't send if explicitly disconnected
      if (!this.isConnected || !this.connection) {
        console.log("[RealtimeSTT] Skipping KeepAlive - disconnected");
        this.stopKeepAlive(); // Stop the interval if we're disconnected
        return;
      }

      if (this.connection && this.isConnected && !this.isRecordingActive) {
        try {
          this.connection.send(JSON.stringify({ type: "KeepAlive" }));
          console.log(
            "[RealtimeSTT] Sent KeepAlive message (recording inactive)"
          );
        } catch (error) {
          console.error("[RealtimeSTT] Failed to send KeepAlive:", error);
          // Stop keep-alive on send errors to prevent spam
          this.stopKeepAlive();
        }
      } else if (this.isRecordingActive) {
        console.log("[RealtimeSTT] Skipping KeepAlive - recording is active");
      }
    }, 8000); // Send every 8 seconds (within 10 second requirement)
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log("[RealtimeSTT] KeepAlive interval stopped");
    }
  }

  private handleTranscriptResult(data: DeepgramTranscriptResult): void {
    console.log("[RealtimeSTT] Received transcript result:", data);

    if (data.channel?.alternatives?.length > 0) {
      const alternative = data.channel.alternatives[0];
      const transcript = alternative.transcript;
      const isFinal = data.is_final || false;
      const fromFinalize = (data as any).from_finalize || false;

      if (transcript && transcript.trim()) {
        if (fromFinalize) {
          console.log(
            "[RealtimeSTT] Final transcript from Finalize message:",
            transcript
          );
          this.callback.onTranscriptDelta(transcript, true);
        } else if (isFinal) {
          console.log(
            "[RealtimeSTT] Final transcript (speech segment):",
            transcript
          );
          // Don't process individual segments - wait for Finalize message
          this.callback.onTranscriptDelta(transcript, true);
        } else {
          console.log("[RealtimeSTT] Interim transcript:", transcript);
          //   this.callback.onTranscriptDelta(transcript, false);
        }
      }
    }

    // Note: Deepgram's speech_final indicates end of speech segment, not start/stop events
    // Speech start/stop detection should be handled by the service layer if needed
  }

  private handleError(error: Error): void {
    console.error("[RealtimeSTT] WebSocket error:", error);
    this.callback.onError(error);
  }

  private handleConnectionClose(code: number, reason: string): void {
    console.log(`[RealtimeSTT] Connection closed: ${code} ${reason}`);
    this.isConnected = false;
    this.connection = null;
    this.isRecordingActive = false; // Reset recording state on connection close
    this.callback.onConnectionClose();

    // Only attempt reconnection if not intentionally closed AND not already at max attempts
    // This prevents reconnection after explicit disconnect() calls
    if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts && this.reconnectTimer === null) {
      console.log(`[RealtimeSTT] Unintentional connection close (${code}), attempting reconnection`);
      this.attemptReconnection();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[RealtimeSTT] Max reconnection attempts reached (${this.maxReconnectAttempts}), no further attempts`);
    } else {
      console.log(`[RealtimeSTT] Connection intentionally closed or already disconnecting, no reconnection attempted`);
    }
  }

  private attemptReconnection(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      10000
    ); // Exponential backoff

    console.log(
      `[RealtimeSTT] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error("[RealtimeSTT] Reconnection failed:", error);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.callback.onError(new Error("Max reconnection attempts reached"));
        }
      });
    }, delay);
  }

  sendAudioChunk(base64AudioData: string): void {
    if (!this.isConnected || !this.connection) {
      console.warn("[RealtimeSTT] Cannot send audio: not connected");
      return;
    }

    // Set recording active when first audio chunk is sent
    if (!this.isRecordingActive) {
      this.isRecordingActive = true;
      console.log("[RealtimeSTT] Recording started - disabling KeepAlive");
    }

    try {
      // Convert base64 string to ArrayBuffer and apply gain amplification
      const binaryString = atob(base64AudioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Apply audio gain amplification for better recognition of quiet speech
      const amplifiedBytes = this.amplifyAudioGain(bytes);

      this.connection.send(amplifiedBytes.buffer);
    } catch (error) {
      console.error("[RealtimeSTT] Error sending audio chunk:", error);
      this.callback.onError(error as Error);
    }
  }

  private amplifyAudioGain(audioBytes: Uint8Array, gainFactor = 2.0): Uint8Array {
    // Convert bytes to 16-bit signed integers for audio processing
    const samples = new Int16Array(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength / 2);
    const amplifiedSamples = new Int16Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      // Apply gain with clipping to prevent distortion
      let amplifiedSample = samples[i] * gainFactor;
      
      // Clip to prevent overflow (16-bit signed range: -32768 to 32767)
      if (amplifiedSample > 32767) {
        amplifiedSample = 32767;
      } else if (amplifiedSample < -32768) {
        amplifiedSample = -32768;
      }
      
      amplifiedSamples[i] = Math.round(amplifiedSample);
    }

    // Convert back to Uint8Array
    return new Uint8Array(amplifiedSamples.buffer);
  }

  commitAudio(): void {
    if (!this.isConnected || !this.connection) {
      console.warn("[RealtimeSTT] Cannot commit audio: not connected");
      return;
    }

    console.log(
      "[RealtimeSTT] Sending Finalize message to process remaining audio"
    );

    // Send Finalize message to force processing of all buffered audio
    try {
      const finalizeMessage = { type: "Finalize" };
      this.connection.send(JSON.stringify(finalizeMessage));
      console.log("[RealtimeSTT] Finalize message sent successfully");
    } catch (error) {
      console.error("[RealtimeSTT] Error sending Finalize message:", error);
      this.callback.onError(error as Error);
    }

    console.log(
      "[RealtimeSTT] Recording stopped - re-enabling KeepAlive for next session"
    );

    // Mark recording as inactive to re-enable KeepAlive messages
    this.isRecordingActive = false;

    // Don't close connection - Deepgram processes audio in real-time automatically
    // Just stop sending audio chunks, but keep WebSocket connection open
    // This allows reuse for subsequent recordings without reconnection overhead
  }

  disconnect(): void {
    console.log(
      "[RealtimeSTT] Explicit disconnect requested - stopping all connections and reconnection attempts..."
    );

    // Set disconnected state FIRST to prevent any further actions
    this.isConnected = false;
    this.isRecordingActive = false;

    // Stop KeepAlive messages immediately with state flags set
    this.stopKeepAlive();

    // Clear reconnection timer immediately and set to marker value
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    // Set timer to a marker value to prevent reconnection attempts
    this.reconnectTimer = setTimeout(() => {}, 0); // This will prevent reconnection attempts
    
    // Set reconnection attempts to max to prevent further reconnections
    this.reconnectAttempts = this.maxReconnectAttempts;

    // Close connection with proper cleanup
    if (this.connection) {
      try {
        console.log("[RealtimeSTT] Removing event listeners and closing WebSocket connection");
        // Remove all event listeners to prevent any callbacks
        this.connection.removeAllListeners();
        this.connection.requestClose();
      } catch (error) {
        console.warn("[RealtimeSTT] Error during connection cleanup:", error);
      }
      this.connection = null;
    }

    // Clear the timer marker after a brief delay
    setTimeout(() => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      console.log(
        "[RealtimeSTT] Disconnection complete - all connections closed and reconnections permanently disabled"
      );
    }, 200);
  }

  isReady(): boolean {
    return this.isConnected && this.connection !== null;
  }
}

export default RealtimeSTTProvider;
