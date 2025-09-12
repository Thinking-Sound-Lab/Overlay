/**
 * Shared utilities for Settings components
 * Contains mode-related constants and helper functions
 */

import { ApplicationModesDraft } from './types';
import { APPLICATION_PROMPTS, getApplicationPrompt } from '../../../../shared/config/application_prompts';


// Application-specific default prompts
export const APPLICATION_DEFAULT_PROMPTS = APPLICATION_PROMPTS.reduce((acc, app) => {
  acc[app.applicationId] = app.prompt;
  return acc;
}, {} as Record<string, string>);


/**
 * Get default prompt for a specific application
 */
export const getDefaultPromptForApplication = (applicationId: string): string => {
  const appPrompt = getApplicationPrompt(applicationId);
  return appPrompt ? appPrompt.prompt : APPLICATION_DEFAULT_PROMPTS.default || "";
};


/**
 * Get the current prompt for an application from the draft state
 */
export const getCurrentPromptForApplication = (applicationId: string, draft: ApplicationModesDraft): string => {
  const appPromptMap = {
    slack: draft.slackPrompt,
    discord: draft.discordPrompt,
    whatsapp: draft.whatsappPrompt,
    telegram: draft.telegramPrompt,
    teams: draft.teamsPrompt,
    messages: draft.messagesPrompt,
    notion: draft.notionPrompt,
    obsidian: draft.obsidianPrompt,
    logseq: draft.logseqPrompt,
    roam: draft.roamPrompt,
    notes: draft.notesPrompt,
    evernote: draft.evernotePrompt,
    bear: draft.bearPrompt,
    gmail: draft.gmailPrompt,
    outlook: draft.outlookPrompt,
    mail: draft.mailPrompt,
    vscode: draft.vscodePrompt,
    xcode: draft.xcodePrompt,
    webstorm: draft.webstormPrompt,
    sublime: draft.sublimePrompt,
    word: draft.wordPrompt,
    pages: draft.pagesPrompt,
    docs: draft.docsPrompt,
    'browser-github': draft.browserGithubPrompt,
    'browser-stackoverflow': draft.browserStackoverflowPrompt,
    'browser-twitter': draft.browserTwitterPrompt,
    'browser-linkedin': draft.browserLinkedinPrompt,
    custom: draft.customPrompt,
  };
  return appPromptMap[applicationId as keyof typeof appPromptMap] || getDefaultPromptForApplication(applicationId);
};


/**
 * Get the prompt field name for a specific application
 */
export const getPromptFieldForApplication = (applicationId: string): string => {
  const fieldMap = {
    slack: "slackPrompt",
    discord: "discordPrompt",
    whatsapp: "whatsappPrompt",
    telegram: "telegramPrompt",
    teams: "teamsPrompt",
    messages: "messagesPrompt",
    notion: "notionPrompt",
    obsidian: "obsidianPrompt",
    logseq: "logseqPrompt",
    roam: "roamPrompt",
    notes: "notesPrompt",
    evernote: "evernotePrompt",
    bear: "bearPrompt",
    gmail: "gmailPrompt",
    outlook: "outlookPrompt",
    mail: "mailPrompt",
    vscode: "vscodePrompt",
    xcode: "xcodePrompt",
    webstorm: "webstormPrompt",
    sublime: "sublimePrompt",
    word: "wordPrompt",
    pages: "pagesPrompt",
    docs: "docsPrompt",
    'browser-github': "browserGithubPrompt",
    'browser-stackoverflow': "browserStackoverflowPrompt",
    'browser-twitter': "browserTwitterPrompt",
    'browser-linkedin': "browserLinkedinPrompt",
    custom: "customPrompt",
  };
  return fieldMap[applicationId as keyof typeof fieldMap] || "customPrompt";
};


/**
 * Initialize application modes draft with application-specific defaults
 */
export const initializeApplicationModesDraft = (settings: any): ApplicationModesDraft => {
  const draft = {
    enableAutoDetection: settings.enableAutoDetection,
    selectedApplicationMode: settings.selectedApplicationMode || "default",
    customPrompt: settings.customPrompt || "",
    
    // Application-specific prompts with fallbacks
    slackPrompt: settings.slackPrompt || getDefaultPromptForApplication("slack"),
    discordPrompt: settings.discordPrompt || getDefaultPromptForApplication("discord"),
    whatsappPrompt: settings.whatsappPrompt || getDefaultPromptForApplication("whatsapp"),
    telegramPrompt: settings.telegramPrompt || getDefaultPromptForApplication("telegram"),
    teamsPrompt: settings.teamsPrompt || getDefaultPromptForApplication("teams"),
    messagesPrompt: settings.messagesPrompt || getDefaultPromptForApplication("messages"),
    notionPrompt: settings.notionPrompt || getDefaultPromptForApplication("notion"),
    obsidianPrompt: settings.obsidianPrompt || getDefaultPromptForApplication("obsidian"),
    logseqPrompt: settings.logseqPrompt || getDefaultPromptForApplication("logseq"),
    roamPrompt: settings.roamPrompt || getDefaultPromptForApplication("roam"),
    notesPrompt: settings.notesPrompt || getDefaultPromptForApplication("notes"),
    evernotePrompt: settings.evernotePrompt || getDefaultPromptForApplication("evernote"),
    bearPrompt: settings.bearPrompt || getDefaultPromptForApplication("bear"),
    gmailPrompt: settings.gmailPrompt || getDefaultPromptForApplication("gmail"),
    outlookPrompt: settings.outlookPrompt || getDefaultPromptForApplication("outlook"),
    mailPrompt: settings.mailPrompt || getDefaultPromptForApplication("mail"),
    vscodePrompt: settings.vscodePrompt || getDefaultPromptForApplication("vscode"),
    xcodePrompt: settings.xcodePrompt || getDefaultPromptForApplication("xcode"),
    webstormPrompt: settings.webstormPrompt || getDefaultPromptForApplication("webstorm"),
    sublimePrompt: settings.sublimePrompt || getDefaultPromptForApplication("sublime"),
    wordPrompt: settings.wordPrompt || getDefaultPromptForApplication("word"),
    pagesPrompt: settings.pagesPrompt || getDefaultPromptForApplication("pages"),
    docsPrompt: settings.docsPrompt || getDefaultPromptForApplication("docs"),
    browserGithubPrompt: settings.browserGithubPrompt || getDefaultPromptForApplication("browser-github"),
    browserStackoverflowPrompt: settings.browserStackoverflowPrompt || getDefaultPromptForApplication("browser-stackoverflow"),
    browserTwitterPrompt: settings.browserTwitterPrompt || getDefaultPromptForApplication("browser-twitter"),
    browserLinkedinPrompt: settings.browserLinkedinPrompt || getDefaultPromptForApplication("browser-linkedin"),
  };

  // If customPrompt is empty, load the prompt for the selected application
  if (!draft.customPrompt && draft.selectedApplicationMode && draft.selectedApplicationMode !== "custom") {
    draft.customPrompt = getCurrentPromptForApplication(draft.selectedApplicationMode, draft);
  }

  return draft;
};


/**
 * Check if there are unsaved changes in the application modes draft
 */
export const hasUnsavedApplicationChanges = (draft: ApplicationModesDraft, settings: any): boolean => {
  return (
    draft.customPrompt !== settings.customPrompt ||
    draft.selectedApplicationMode !== settings.selectedApplicationMode ||
    
    // Application-specific prompt changes
    draft.slackPrompt !== (settings.slackPrompt || getDefaultPromptForApplication("slack")) ||
    draft.discordPrompt !== (settings.discordPrompt || getDefaultPromptForApplication("discord")) ||
    draft.whatsappPrompt !== (settings.whatsappPrompt || getDefaultPromptForApplication("whatsapp")) ||
    draft.telegramPrompt !== (settings.telegramPrompt || getDefaultPromptForApplication("telegram")) ||
    draft.teamsPrompt !== (settings.teamsPrompt || getDefaultPromptForApplication("teams")) ||
    draft.messagesPrompt !== (settings.messagesPrompt || getDefaultPromptForApplication("messages")) ||
    draft.notionPrompt !== (settings.notionPrompt || getDefaultPromptForApplication("notion")) ||
    draft.obsidianPrompt !== (settings.obsidianPrompt || getDefaultPromptForApplication("obsidian")) ||
    draft.logseqPrompt !== (settings.logseqPrompt || getDefaultPromptForApplication("logseq")) ||
    draft.roamPrompt !== (settings.roamPrompt || getDefaultPromptForApplication("roam")) ||
    draft.notesPrompt !== (settings.notesPrompt || getDefaultPromptForApplication("notes")) ||
    draft.evernotePrompt !== (settings.evernotePrompt || getDefaultPromptForApplication("evernote")) ||
    draft.bearPrompt !== (settings.bearPrompt || getDefaultPromptForApplication("bear")) ||
    draft.gmailPrompt !== (settings.gmailPrompt || getDefaultPromptForApplication("gmail")) ||
    draft.outlookPrompt !== (settings.outlookPrompt || getDefaultPromptForApplication("outlook")) ||
    draft.mailPrompt !== (settings.mailPrompt || getDefaultPromptForApplication("mail")) ||
    draft.vscodePrompt !== (settings.vscodePrompt || getDefaultPromptForApplication("vscode")) ||
    draft.xcodePrompt !== (settings.xcodePrompt || getDefaultPromptForApplication("xcode")) ||
    draft.webstormPrompt !== (settings.webstormPrompt || getDefaultPromptForApplication("webstorm")) ||
    draft.sublimePrompt !== (settings.sublimePrompt || getDefaultPromptForApplication("sublime")) ||
    draft.wordPrompt !== (settings.wordPrompt || getDefaultPromptForApplication("word")) ||
    draft.pagesPrompt !== (settings.pagesPrompt || getDefaultPromptForApplication("pages")) ||
    draft.docsPrompt !== (settings.docsPrompt || getDefaultPromptForApplication("docs")) ||
    draft.browserGithubPrompt !== (settings.browserGithubPrompt || getDefaultPromptForApplication("browser-github")) ||
    draft.browserStackoverflowPrompt !== (settings.browserStackoverflowPrompt || getDefaultPromptForApplication("browser-stackoverflow")) ||
    draft.browserTwitterPrompt !== (settings.browserTwitterPrompt || getDefaultPromptForApplication("browser-twitter")) ||
    draft.browserLinkedinPrompt !== (settings.browserLinkedinPrompt || getDefaultPromptForApplication("browser-linkedin"))
    
  );
};