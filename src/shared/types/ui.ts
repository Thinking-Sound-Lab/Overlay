/**
 * UI Model Types  
 * Interfaces for UI components and application state
 */

import { ContextFormattingSettings } from "./services";

export interface Settings {
  // General section
  defaultMicrophone: string;
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
  enableContextFormatting: boolean;
  
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