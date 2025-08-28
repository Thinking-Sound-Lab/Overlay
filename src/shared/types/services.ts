/**
 * Service Types
 * Interfaces for service layer operations and APIs
 */

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
  confidence: number;
  wordCountRatio: number;
  semanticSimilarity?: number;
  detectedLanguage?: string;
}

export interface STTClient {
  processAudio: (audioData: string[]) => Promise<void>;
  close: () => void;
}

export interface AuthStateData {
  user: any | null;
  authenticated: boolean;
  profile: any | null;
  statistics: any | null;
  settings: any | null;
  recentTranscripts: any[] | null;
  error?: string;
}