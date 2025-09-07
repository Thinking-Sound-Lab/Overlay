/**
 * UI Model Types  
 * Interfaces for UI components and application state
 */


export interface Settings {
  // General section
  language: string;
  
  // System section  
  dictateSoundEffects: boolean;
  muteMusicWhileDictating: boolean;
  
  // Personalization section
  outputMode: "auto-insert" | "clipboard" | "both";
  useAI: boolean;
  enableRealtimeMode: boolean;
  enableTranslation: boolean;
  targetLanguage: string;
  
  // Modes section
  selectedMode: string;
  customPrompt: string;
  enableAutoDetection: boolean;
  
  // Per-mode prompts (remembers user customizations for each mode)
  notesPrompt: string;
  messagesPrompt: string;
  emailsPrompt: string;
  codeCommentsPrompt: string;
  meetingNotesPrompt: string;
  creativeWritingPrompt: string;
  
  // Data and Privacy section
  privacyMode: boolean;
}

export interface UserStats {
  totalWordCount: number;
  averageWPM: number;
  totalRecordings: number;
  streakDays: number;
}

export interface UITranscriptEntry {
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

export type ViewType = "home" | "dictionary" | "help" | "referral";