// providers/realtime_stt.ts - OpenAI Realtime API integration for streaming STT
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface RealtimeSTTCallback {
  onTranscriptDelta: (delta: string) => void;
  onTranscriptComplete: (transcript: string, language: string) => void;
  onError: (error: Error) => void;
  onConnectionOpen: () => void;
  onConnectionClose: () => void;
}

export interface RealtimeConfig {
  language: string;
  apiKey: string;
  model?: string;
  voice?: string;
}

export class RealtimeSTTProvider extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private currentTranscript = '';
  private sessionId: string | null = null;
  private config: RealtimeConfig;
  private callback: RealtimeSTTCallback;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: RealtimeConfig, callback: RealtimeSTTCallback) {
    super();
    this.config = {
      ...config,
      model: config.model || 'gpt-4o-realtime-preview',
      voice: config.voice || 'alloy'
    };
    this.callback = callback;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      console.log('[RealtimeSTT] Already connected');
      return;
    }

    try {
      console.log('[RealtimeSTT] Establishing WebSocket connection...');
      
      // Create WebSocket connection to OpenAI Realtime API
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${this.config.model}`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', this.handleConnectionOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('error', this.handleError.bind(this));
      this.ws.on('close', this.handleConnectionClose.bind(this));

      // Wait for connection to be established
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws!.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.error('[RealtimeSTT] Connection error:', error);
      throw error;
    }
  }

  private handleConnectionOpen(): void {
    console.log('[RealtimeSTT] WebSocket connection established');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Initialize session
    this.initializeSession();
    this.callback.onConnectionOpen();
  }

  private initializeSession(): void {
    console.log('[RealtimeSTT] Initializing session...');
    
    // Send session configuration
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful assistant for speech transcription.',
        voice: this.config.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        }
      }
    };

    this.sendMessage(sessionConfig);
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      console.log('[RealtimeSTT] Received event:', message.type);
      
      switch (message.type) {
        case 'session.created':
          this.sessionId = message.session.id;
          console.log('[RealtimeSTT] Session created:', this.sessionId);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          console.log('[RealtimeSTT] Input transcription completed:', message.transcript);
          this.currentTranscript = message.transcript;
          this.callback.onTranscriptComplete(message.transcript, this.config.language);
          break;

        case 'input_audio_buffer.speech_started':
          console.log('[RealtimeSTT] Speech started');
          this.currentTranscript = '';
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('[RealtimeSTT] Speech stopped');
          break;

        case 'conversation.item.input_audio_transcription.failed':
          console.error('[RealtimeSTT] Transcription failed:', message.error);
          this.callback.onError(new Error(`Transcription failed: ${message.error?.message || 'Unknown error'}`));
          break;

        case 'error':
          console.error('[RealtimeSTT] API error:', message.error);
          this.callback.onError(new Error(`API error: ${message.error?.message || 'Unknown error'}`));
          break;

        default:
          // Log other events for debugging
          if (message.type.includes('transcript') || message.type.includes('audio')) {
            console.log('[RealtimeSTT] Audio/transcript event:', message.type);
          }
          break;
      }
    } catch (error) {
      console.error('[RealtimeSTT] Error parsing message:', error);
      this.callback.onError(error as Error);
    }
  }

  private handleError(error: Error): void {
    console.error('[RealtimeSTT] WebSocket error:', error);
    this.callback.onError(error);
  }

  private handleConnectionClose(code: number, reason: Buffer): void {
    console.log(`[RealtimeSTT] Connection closed: ${code} ${reason.toString()}`);
    this.isConnected = false;
    this.ws = null;
    this.callback.onConnectionClose();

    // Attempt reconnection if not intentionally closed
    if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000); // Exponential backoff
    
    console.log(`[RealtimeSTT] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[RealtimeSTT] Reconnection failed:', error);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.callback.onError(new Error('Max reconnection attempts reached'));
        }
      });
    }, delay);
  }

  sendAudioChunk(audioData: Buffer): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeSTT] Cannot send audio: not connected');
      return;
    }

    try {
      // Convert audio data to base64 for transmission
      const base64Audio = audioData.toString('base64');
      
      const audioMessage = {
        type: 'input_audio_buffer.append',
        audio: base64Audio
      };

      this.sendMessage(audioMessage);
    } catch (error) {
      console.error('[RealtimeSTT] Error sending audio chunk:', error);
      this.callback.onError(error as Error);
    }
  }

  commitAudio(): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeSTT] Cannot commit audio: not connected');
      return;
    }

    // Signal end of audio input to trigger transcription
    const commitMessage = {
      type: 'input_audio_buffer.commit'
    };

    this.sendMessage(commitMessage);
    console.log('[RealtimeSTT] Audio committed for transcription');
  }

  clearAudioBuffer(): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeSTT] Cannot clear buffer: not connected');
      return;
    }

    const clearMessage = {
      type: 'input_audio_buffer.clear'
    };

    this.sendMessage(clearMessage);
    console.log('[RealtimeSTT] Audio buffer cleared');
  }

  private sendMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeSTT] Cannot send message: WebSocket not ready');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[RealtimeSTT] Error sending message:', error);
      this.callback.onError(error as Error);
    }
  }

  disconnect(): void {
    console.log('[RealtimeSTT] Disconnecting...');
    
    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionId = null;
    this.currentTranscript = '';
  }

  isReady(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  getCurrentTranscript(): string {
    return this.currentTranscript;
  }
}

export default RealtimeSTTProvider;