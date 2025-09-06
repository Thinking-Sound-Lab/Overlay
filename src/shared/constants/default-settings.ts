/**
 * Default Settings Constants
 * Single source of truth for all default application settings
 * Used across main process, renderer, and services
 */

export const DEFAULT_SETTINGS = {
  // General section
  language: "en",

  // System section
  dictateSoundEffects: true,
  muteMusicWhileDictating: true,

  // Personalization section
  outputMode: "both",
  useAI: true,
  enableRealtimeMode: false,
  enableTranslation: false,
  targetLanguage: "en",

  // Modes section (CORRECTED DEFAULTS)
  selectedMode: "email", // Default to email mode for UI
  customPrompt: "", // For "custom" mode only
  enableAutoDetection: false, // Default OFF - no mode formatting applied

  // Per-mode prompts with meaningful defaults (shown when auto-detection is ON)
  notesPrompt:
    "Structure this as clear, organized notes with bullet points and proper formatting for easy reading and reference.",
  messagesPrompt:
    "Keep this casual and conversational, appropriate for messaging apps with natural, friendly tone.",
  emailsPrompt:
    "Format this as a professional email with proper greeting, well-structured body paragraphs, and appropriate closing.",
  codeCommentsPrompt:
    "Write this as clear technical documentation with proper explanations, examples, and professional coding standards.",
  meetingNotesPrompt:
    "Organize this as structured meeting minutes with agenda items, key discussion points, decisions made, and action items.",
  creativeWritingPrompt:
    "Express this with creative flair, vivid descriptions, engaging language, and artistic expression appropriate for creative writing.",

  // Data and Privacy section
  privacyMode: true,
} as const;

/**
 * Type-safe settings interface derived from constants
 */
export type DefaultSettingsType = typeof DEFAULT_SETTINGS;
