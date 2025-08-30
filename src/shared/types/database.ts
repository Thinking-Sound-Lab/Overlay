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
    // General section
    defaultMicrophone?: string;
    language?: string;
    
    // System section  
    dictateSoundEffects?: boolean;
    muteMusicWhileDictating?: boolean;
    
    // Personalization section
    outputMode?: "auto-insert" | "clipboard" | "both";
    useAI?: boolean;
    enableRealtimeMode?: boolean;
    enableTranslation?: boolean;
    targetLanguage?: string;
    enableContextFormatting?: boolean;
    
    // Data and Privacy section
    privacyMode?: boolean;
    
    // Legacy field (to be removed later)
    openaiApiKey?: string;
  };
  updated_at: string;
}