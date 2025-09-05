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

      // Configure live transcription options with proper typing
      const liveOptions: LiveSchema = {
        model: this.config.model,
        language: this.config.language,
        interim_results: true,
        punctuate: true,
        smart_format: true,
        endpointing: 100, // Increased from 100 to allow longer natural pauses
        vad_events: true, // Enable voice activity detection events for better speech tracking
        utterance_end_ms: 1000, // Time to wait for utterance end detection
        encoding: "linear16",
        sample_rate: 16000,
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
        }
      } else if (this.isRecordingActive) {
        console.log("[RealtimeSTT] Skipping KeepAlive - recording is active");
      }
    }, 4000); // Send every 4 seconds (within 3-5 second requirement)
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
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

    // Attempt reconnection if not intentionally closed
    if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnection();
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
      // Convert base64 string to ArrayBuffer for Deepgram
      const binaryString = atob(base64AudioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      this.connection.send(bytes.buffer);
    } catch (error) {
      console.error("[RealtimeSTT] Error sending audio chunk:", error);
      this.callback.onError(error as Error);
    }
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
      "[RealtimeSTT] Disconnecting and stopping all reconnection attempts..."
    );

    // Set disconnected state FIRST to prevent any further actions
    this.isConnected = false;
    this.isRecordingActive = false;

    // Then stop KeepAlive messages (state flags are now safe)
    this.stopKeepAlive();

    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset reconnection attempts to prevent further reconnections
    this.reconnectAttempts = this.maxReconnectAttempts;

    if (this.connection) {
      try {
        // Remove all event listeners to prevent any callbacks
        this.connection.removeAllListeners();
        this.connection.requestClose();
      } catch (error) {
        console.warn("[RealtimeSTT] Error during disconnect:", error);
      }
      this.connection = null;
    }

    console.log("[RealtimeSTT] Disconnection complete, reconnections disabled");
  }

  isReady(): boolean {
    return this.isConnected && this.connection !== null;
  }
}

export default RealtimeSTTProvider;
