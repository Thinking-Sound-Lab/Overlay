/**
 * Shared utilities for Settings components
 * Contains mode-related constants and helper functions
 */

import { ContextModesDraft } from './types';

// Default prompts for each mode (synchronized with backend MODE_TEMPLATES)
export const MODE_DEFAULT_PROMPTS = {
  notes: "Format as clear, organized notes with proper headings and bullet points where appropriate. Use a casual but structured tone suitable for personal or professional note-taking.",
  messages: "Format as conversational text, direct and friendly, suitable for messaging apps. Keep it concise and natural.",
  email: "Format as professional email content with proper structure. Include appropriate greetings and closings when the context suggests it's a complete email.",
  code_comments: "Format as concise, technical documentation suitable for code comments and technical notes. Use precise language and proper technical terminology.",
  meeting_notes: "Format as structured meeting notes with clear action items and key decisions highlighted. Use bullet points and clear headings to organize information.",
  creative_writing: "Format with expressive language, varied sentence structure, and engaging flow suitable for creative content. Enhance the natural rhythm and voice while maintaining clarity.",
} as const;

/**
 * Get default prompt for a specific mode
 */
export const getDefaultPromptForMode = (mode: string): string => {
  return MODE_DEFAULT_PROMPTS[mode as keyof typeof MODE_DEFAULT_PROMPTS] || "";
};

/**
 * Get the current prompt for a mode from the draft state
 */
export const getCurrentPromptForMode = (mode: string, contextModesDraft: ContextModesDraft): string => {
  const modePromptMap = {
    notes: contextModesDraft.notesPrompt,
    messages: contextModesDraft.messagesPrompt,
    email: contextModesDraft.emailsPrompt,
    code_comments: contextModesDraft.codeCommentsPrompt,
    meeting_notes: contextModesDraft.meetingNotesPrompt,
    creative_writing: contextModesDraft.creativeWritingPrompt,
    custom: contextModesDraft.customPrompt,
  };
  return modePromptMap[mode as keyof typeof modePromptMap] || getDefaultPromptForMode(mode);
};

/**
 * Get the prompt field name for a specific mode
 */
export const getPromptFieldForMode = (mode: string): string => {
  const fieldMap = {
    notes: "notesPrompt",
    messages: "messagesPrompt", 
    email: "emailsPrompt",
    code_comments: "codeCommentsPrompt",
    meeting_notes: "meetingNotesPrompt",
    creative_writing: "creativeWritingPrompt",
    custom: "customPrompt",
  };
  return fieldMap[mode as keyof typeof fieldMap] || "customPrompt";
};

/**
 * Initialize context modes draft with fallbacks to defaults
 */
export const initializeContextModesDraft = (settings: any): ContextModesDraft => {
  const draft = {
    enableAutoDetection: settings.enableAutoDetection,
    selectedMode: settings.selectedMode,
    customPrompt: settings.customPrompt || "",
    // Per-mode prompts (fallback to defaults if not set)
    notesPrompt: settings.notesPrompt || getDefaultPromptForMode("notes"),
    messagesPrompt: settings.messagesPrompt || getDefaultPromptForMode("messages"),
    emailsPrompt: settings.emailsPrompt || getDefaultPromptForMode("email"),
    codeCommentsPrompt: settings.codeCommentsPrompt || getDefaultPromptForMode("code_comments"),
    meetingNotesPrompt: settings.meetingNotesPrompt || getDefaultPromptForMode("meeting_notes"),
    creativeWritingPrompt: settings.creativeWritingPrompt || getDefaultPromptForMode("creative_writing"),
  };

  // If customPrompt is empty, load the prompt for the selected mode
  if (!draft.customPrompt && draft.selectedMode && draft.selectedMode !== "custom") {
    draft.customPrompt = getCurrentPromptForMode(draft.selectedMode, draft);
  }

  return draft;
};

/**
 * Check if there are unsaved changes in the context modes draft
 */
export const hasUnsavedContextChanges = (contextModesDraft: ContextModesDraft, settings: any): boolean => {
  return (
    contextModesDraft.customPrompt !== settings.customPrompt ||
    contextModesDraft.notesPrompt !== (settings.notesPrompt || getDefaultPromptForMode("notes")) ||
    contextModesDraft.messagesPrompt !== (settings.messagesPrompt || getDefaultPromptForMode("messages")) ||
    contextModesDraft.emailsPrompt !== (settings.emailsPrompt || getDefaultPromptForMode("email")) ||
    contextModesDraft.codeCommentsPrompt !== (settings.codeCommentsPrompt || getDefaultPromptForMode("code_comments")) ||
    contextModesDraft.meetingNotesPrompt !== (settings.meetingNotesPrompt || getDefaultPromptForMode("meeting_notes")) ||
    contextModesDraft.creativeWritingPrompt !== (settings.creativeWritingPrompt || getDefaultPromptForMode("creative_writing"))
  );
};