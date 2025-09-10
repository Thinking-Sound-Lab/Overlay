// Test utilities and helpers
import { IPCResponse } from '../../src/shared/types';

/**
 * Creates a mock IPC response
 */
export function createMockIPCResponse<T>(data?: T, error?: string): IPCResponse<T> {
  if (error) {
    return {
      success: false,
      error,
    };
  }
  
  return {
    success: true,
    data,
  };
}

/**
 * Creates a mock user object for testing
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock transcript data for testing
 */
export function createMockTranscript(overrides: Record<string, any> = {}) {
  return {
    id: 'test-transcript-id',
    user_id: 'test-user-id',
    text: 'This is a test transcript',
    original_text: null as string | null,
    language: 'en',
    target_language: null as string | null,
    was_translated: false,
    confidence: 0.95,
    word_count: 5,
    wpm: 150,
    metadata: {
      localId: Date.now().toString(),
    },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock settings object for testing
 */
export function createMockSettings(overrides = {}) {
  return {
    enableRealtimeMode: true,
    selectedLanguage: 'en',
    targetLanguage: 'auto',
    enableTranslation: false,
    enableAIEnhancement: false,
    selectedMicrophoneId: 'default',
    globalShortcut: 'option+space',
    enableAnalytics: true,
    theme: 'system',
    ...overrides,
  };
}

/**
 * Creates mock audio device for testing
 */
export function createMockAudioDevice(overrides = {}) {
  return {
    deviceId: 'mock-device-id',
    kind: 'audioinput' as MediaDeviceKind,
    label: 'Mock Microphone',
    groupId: 'mock-group-id',
    ...overrides,
  };
}

/**
 * Creates mock speech metrics for testing
 */
export function createMockSpeechMetrics(overrides = {}) {
  return {
    wordCount: 25,
    wordsPerMinute: 150,
    speakingDuration: 10000, // 10 seconds
    pauseDuration: 2000, // 2 seconds
    ...overrides,
  };
}

/**
 * Waits for a specified amount of time
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock EventTarget for testing event-based functionality
 */
export class MockEventTarget extends EventTarget {
  private listeners = new Map<string, EventListenerOrEventListenerObject[]>();

  addEventListener(
    type: string, 
    callback: EventListenerOrEventListenerObject | null, 
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!callback) return;
    
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  removeEventListener(
    type: string, 
    callback: EventListenerOrEventListenerObject | null, 
    options?: boolean | EventListenerOptions
  ): void {
    if (!callback) return;
    
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        if (typeof listener === 'function') {
          listener(event);
        } else if (listener && typeof listener.handleEvent === 'function') {
          listener.handleEvent(event);
        }
      });
    }
    return true;
  }
}

/**
 * Mock implementation of MediaStream for testing
 */
export class MockMediaStream {
  private tracks: MediaStreamTrack[] = [];
  
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks;
  }
  
  getTracks(): MediaStreamTrack[] {
    return [...this.tracks];
  }
  
  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track);
  }
  
  removeTrack(track: MediaStreamTrack): void {
    const index = this.tracks.indexOf(track);
    if (index > -1) {
      this.tracks.splice(index, 1);
    }
  }
}

/**
 * Mock implementation of MediaStreamTrack for testing
 */
export class MockMediaStreamTrack implements MediaStreamTrack {
  kind = 'audio';
  label = 'Mock Audio Track';
  enabled = true;
  readyState: MediaStreamTrackState = 'live';
  id = 'mock-track-id';
  contentHint = '';
  muted = false;
  onended: ((this: MediaStreamTrack, ev: Event) => any) | null = null;
  onmute: ((this: MediaStreamTrack, ev: Event) => any) | null = null;
  onunmute: ((this: MediaStreamTrack, ev: Event) => any) | null = null;
  
  stop(): void {
    this.readyState = 'ended';
  }
  
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean { return true; }
  
  clone(): MediaStreamTrack {
    return new MockMediaStreamTrack();
  }
  
  getConstraints(): MediaTrackConstraints {
    return {};
  }
  
  getCapabilities(): MediaTrackCapabilities {
    return {};
  }
  
  getSettings(): MediaTrackSettings {
    return {
      deviceId: 'mock-device',
      groupId: 'mock-group',
    };
  }
  
  applyConstraints(constraints?: MediaTrackConstraints): Promise<void> {
    return Promise.resolve();
  }
}