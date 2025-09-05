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
  wasTranslated?: boolean;
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

export interface ActiveApplicationInfo {
  processName: string;
  applicationName: string;
  windowTitle: string;
  bundleId?: string;
  processId: number;
  contextType: ApplicationContextType;
}

export enum ApplicationContextType {
  EMAIL = "email",
  NOTES = "notes",
  CODE_EDITOR = "code_editor",
  MESSAGING = "messaging",
  DOCUMENT = "document",
  BROWSER = "browser",
  TERMINAL = "terminal",
  PRESENTATION = "presentation",
  UNKNOWN = "unknown",
}

export interface FormattingResult {
  formattedText: string;
  originalText: string;
  contextType: ApplicationContextType;
  appliedTransformations: string[];
  confidence: number;
}
