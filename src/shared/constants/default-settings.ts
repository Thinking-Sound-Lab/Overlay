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
  enableRealtimeMode: true,
  enableTranslation: false,
  targetLanguage: "en",

  // Modes section
  selectedApplicationMode: "default", // Default application mode
  customPrompt: "", // For "custom" mode only
  enableAutoDetection: false, // Default OFF - no mode formatting applied

  // Application-specific prompts (populated with defaults)
  slackPrompt: "Format for Slack team communication. Use clear, professional yet friendly tone. Structure for threading if discussing complex topics. Use @mentions appropriately when referencing people. Keep messages concise but informative. Use bullet points for multiple items. Maintain team communication etiquette.",
  discordPrompt: "Format for Discord community chat. Use casual, friendly tone appropriate for gaming/community discussions. Feel free to use gaming terminology and internet slang when appropriate. Keep messages conversational and engaging. Use emojis to enhance expression when they fit naturally.",
  whatsappPrompt: "Format for WhatsApp personal messaging. Use casual, friendly tone suitable for personal conversations. Embrace emojis and casual expression. Keep messages natural and conversational, as if speaking to friends or family. Use informal greetings and closings when appropriate.",
  telegramPrompt: "Format for Telegram messaging. Use clear, direct communication. Support both casual and professional contexts depending on the conversation. Utilize Telegram's formatting capabilities when beneficial (bold, italic, code). Keep messages well-structured and easy to read.",
  teamsPrompt: "Format for Microsoft Teams professional communication. Use professional, clear tone suitable for workplace collaboration. Structure messages for team discussions, project updates, and meeting coordination. Use @mentions for team members appropriately. Keep communication professional but approachable.",
  messagesPrompt: "Format for Apple Messages/iMessage. Use personal, casual tone suitable for friends and family. Embrace natural conversation flow with appropriate emoji usage. Keep messages personal and warm, suitable for close contacts and family members.",
  notionPrompt: "Format for Notion structured note-taking. Organize content with clear headers, bullet points, and block-based thinking. Use structured formatting suitable for databases, project planning, and knowledge management. Create content that works well with Notion's block system and linking capabilities.",
  obsidianPrompt: "Format for Obsidian knowledge management. Use markdown formatting with clear headers and bullet points. Consider [[linking]] opportunities between concepts. Structure content for knowledge graph building and future referencing. Use tags and connections to build comprehensive knowledge networks.",
  logseqPrompt: "Format for Logseq block-based note-taking. Structure content in logical blocks that can be referenced and linked. Use bullet points and indentation effectively. Consider daily journaling context and block-level organization. Format for easy future referencing and connecting.",
  roamPrompt: "Format for Roam Research networked thinking. Structure content for bidirectional linking and graph database. Use [[page references]] and consider how content connects to existing knowledge. Format for research, idea development, and knowledge building with interconnected concepts.",
  notesPrompt: "Format for Apple Notes simple note-taking. Use clean, organized structure with clear headers and bullet points. Keep formatting simple but effective. Structure content for easy reading and future reference in a straightforward note-taking context.",
  evernotePrompt: "Format for Evernote document organization. Structure content with clear headers, tags, and organizational elements. Consider how content will be searched and categorized later. Use formatting that works well with Evernote's document capture and organization features.",
  bearPrompt: "Format for Bear markdown note-taking. Use markdown formatting with headers, bullet points, and clean structure. Consider tagging and organization for later retrieval. Structure content for both writing and note-taking contexts with beautiful, readable formatting.",
  gmailPrompt: "Format for Gmail professional email communication. Use proper email structure with appropriate greetings and closings. Maintain professional tone while being clear and direct. Structure content with proper paragraphs and bullet points when needed. Consider email etiquette and professional communication standards.",
  outlookPrompt: "Format for Outlook corporate email communication. Use professional business tone with proper email structure. Include appropriate greetings, body paragraphs, and professional closings. Structure for corporate communication standards and business etiquette. Consider action items and clear communication objectives.",
  mailPrompt: "Format for Apple Mail communication. Use clean, professional formatting suitable for both personal and business contexts. Structure with proper email etiquette and clear, concise communication. Adapt tone based on context while maintaining professionalism.",
  vscodePrompt: "Format for VS Code development context. Create content suitable for code comments, documentation, commit messages, or technical notes. Use clear, concise technical language. Structure for code readability and developer understanding. Consider documentation standards and code commenting best practices.",
  xcodePrompt: "Format for Xcode iOS/macOS development. Create content suitable for Swift/Objective-C code comments, documentation, or development notes. Use technical precision appropriate for Apple development. Structure for code documentation and development workflow context.",
  webstormPrompt: "Format for WebStorm web development context. Create content suitable for JavaScript/TypeScript comments, web development documentation, or technical notes. Use web development terminology and structure for frontend/backend development contexts.",
  sublimePrompt: "Format for Sublime Text code editing. Create concise, technical content suitable for various programming languages. Use clear, minimal formatting appropriate for lightweight development and scripting contexts.",
  wordPrompt: "Format for Microsoft Word document creation. Use proper document structure with headers, paragraphs, and professional formatting. Consider document hierarchy and formal writing standards. Structure content suitable for reports, proposals, and professional documents.",
  pagesPrompt: "Format for Apple Pages document creation. Use clean, well-structured formatting suitable for both professional and creative documents. Consider visual layout and readability. Structure content with proper document flow and design-conscious formatting.",
  docsPrompt: "Format for Google Docs collaborative writing. Use clear, structured formatting suitable for team collaboration. Consider commenting and suggestion contexts. Structure content for shared editing and collaborative document development.",
  browserGithubPrompt: "Format for GitHub repository context. Create content suitable for commit messages, pull request descriptions, issue reporting, or project documentation. Use technical precision and consider developer workflow and collaboration context.",
  figmaPrompt: "Format for Figma design collaboration. Create content suitable for design comments, feedback, component descriptions, or design documentation. Use clear, concise language focused on visual design and user experience considerations.",
  browserStackoverflowPrompt: "Format for Stack Overflow technical discussion. Create clear, precise technical content suitable for programming questions, answers, or comments. Use technical accuracy and consider developer community standards and helpful communication.",
  browserTwitterPrompt: "Format for Twitter/X social media posting. Keep content concise and engaging, suitable for social media context. Consider character limits and social media best practices. Use appropriate tone for public social interaction.",
  browserLinkedinPrompt: "Format for LinkedIn professional networking. Use professional, engaging tone suitable for business networking. Structure content for professional audience and career-focused communication. Consider industry standards and professional presentation.",


  // Data and Privacy section
  privacyMode: true,
} as const;

/**
 * Type-safe settings interface derived from constants
 */
export type DefaultSettingsType = typeof DEFAULT_SETTINGS;
