/**
 * Database Model Types
 * Interfaces for database entities and operations
 */

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  created_at: string;
  subscription_tier: "free" | "pro";
}

export interface DatabaseTranscriptEntry {
  id: string;
  user_id: string;
  text: string;
  original_text?: string;
  language: string;
  target_language?: string;
  was_translated: boolean;
  confidence?: number;
  word_count: number;
  wpm: number;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface UserSettings {
  user_id: string;
  settings: {
    outputMode?: "auto-insert" | "clipboard" | "both";
    openaiApiKey?: string;
    useAI?: boolean;
    language?: string;
    enableTranslation?: boolean;
    targetLanguage?: string;
  };
  updated_at: string;
}