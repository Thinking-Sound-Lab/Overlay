/**
 * UI Model Types
 * Interfaces for UI components and application state
 */

export interface Settings {
  // General section
  language: string;
  profession: string;

  // System section
  dictateSoundEffects: boolean;
  muteMusicWhileDictating: boolean;

  // Personalization section
  outputMode: "auto-insert" | "clipboard" | "both";
  useAI: boolean;
  enableTranslation: boolean;
  targetLanguage: string;

  // Modes section
  selectedApplicationMode: string;
  customPrompt: string;
  enableAutoDetection: boolean;

  // Application-specific prompts (remembers user customizations for each app)
  slackPrompt: string;
  discordPrompt: string;
  whatsappPrompt: string;
  telegramPrompt: string;
  teamsPrompt: string;
  messagesPrompt: string;
  notionPrompt: string;
  obsidianPrompt: string;
  logseqPrompt: string;
  roamPrompt: string;
  notesPrompt: string;
  evernotePrompt: string;
  bearPrompt: string;
  gmailPrompt: string;
  outlookPrompt: string;
  mailPrompt: string;
  vscodePrompt: string;
  xcodePrompt: string;
  webstormPrompt: string;
  sublimePrompt: string;
  wordPrompt: string;
  pagesPrompt: string;
  docsPrompt: string;
  browserGithubPrompt: string;
  figmaPrompt: string;
  browserStackoverflowPrompt: string;
  browserTwitterPrompt: string;
  browserLinkedinPrompt: string;

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
  audioFilePath?: string;
}

export interface Message {
  type: "success" | "error";
  text: string;
}

export type ViewType = "home" | "dictionary" | "help" | "referral";
