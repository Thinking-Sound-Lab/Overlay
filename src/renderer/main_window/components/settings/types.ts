/**
 * Shared types and interfaces for Settings components
 */

import { Settings } from "../../../../shared/types";
import { UserRecord } from "../../../../shared/types/database";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SettingsComponentProps {
  settings: Settings;
  updateSetting: (
    key: keyof Settings,
    value: string | boolean
  ) => Promise<void>;
  setError: (error: string) => void;
}

export interface ContextModesDraft {
  enableAutoDetection: boolean;
  selectedMode: string;
  customPrompt: string;
  notesPrompt: string;
  messagesPrompt: string;
  emailsPrompt: string;
  codeCommentsPrompt: string;
  meetingNotesPrompt: string;
  creativeWritingPrompt: string;
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
