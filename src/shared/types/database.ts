/**
 * Database Model Types
 * Interfaces for database entities and operations
 */

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  created_at: string;
  subscription_tier: "free" | "pro_trial" | "pro";
  onboarding_completed: boolean;
  trial_started_at?: string; // For pro_trial users
  words_used_this_month?: number; // For tracking free tier usage
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
    defaultMicrophone?: string; // DEPRECATED: Use session-only MicrophoneService instead
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

    // Modes section
    selectedMode?: string;
    customPrompt?: string; // For "custom" mode only
    enableAutoDetection?: boolean;

    // Per-mode prompts (remembers user customizations for each mode)
    notesPrompt?: string;
    messagesPrompt?: string;
    emailsPrompt?: string;
    codeCommentsPrompt?: string;
    meetingNotesPrompt?: string;
    creativeWritingPrompt?: string;

    // Data and Privacy section
    privacyMode?: boolean;
  };
  updated_at: string;
}

export interface DictionaryEntry {
  id: string;
  user_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}
