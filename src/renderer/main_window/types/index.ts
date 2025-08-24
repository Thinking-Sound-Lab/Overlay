export interface Settings {
  outputMode: "auto-insert" | "clipboard" | "both";
  useAI: boolean;
  language: string;
  enableTranslation: boolean;
  targetLanguage: string;
}

export interface UserStats {
  totalWordCount: number;
  averageWPM: number;
  totalRecordings: number;
  streakDays: number;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  wordCount: number;
  wpm: number;
  originalText?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  wasTranslated?: boolean;
  confidence?: number;
  wordCountRatio?: number;
  detectedLanguage?: string;
}

export interface Message {
  type: "success" | "error";
  text: string;
}

export type ViewType = "home" | "dictionary" | "help" | "referral" | "settings" | "profile";