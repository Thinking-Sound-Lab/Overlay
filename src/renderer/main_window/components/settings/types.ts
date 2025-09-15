/**
 * Shared types and interfaces for Settings components
 */

import { Settings } from "../../../../shared/types";
import { UserRecord } from "../../../../shared/types/database";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SettingsComponentProps {
  settings: Settings;
  updateSetting: (
    key: keyof Settings,
    value: string | boolean
  ) => Promise<void>;
  setError: (error: string) => void;
}

export interface ApplicationModesDraft {
  enableAutoDetection: boolean;
  selectedApplicationMode: string;
  customPrompt: string;
  
  // Application-specific prompts
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
  browserStackoverflowPrompt: string;
  browserTwitterPrompt: string;
  browserLinkedinPrompt: string;
  
}


// ModesSettings will manage its own state, so we only need the base props
export type ModesSettingsProps = SettingsComponentProps;

export interface AccountSettingsProps extends SettingsComponentProps {
  user: UserRecord | null;
  onOpenChange: (open: boolean) => void;
}

export type SettingsSection =
  | "general"
  | "system"
  | "personalization"
  | "modes"
  | "account"
  | "billing"
  | "privacy";
