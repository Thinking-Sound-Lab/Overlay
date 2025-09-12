/**
 * Application-Specific Context Mode Prompts
 * Defines formatting instructions for specific applications
 */

export interface ApplicationPrompt {
  applicationId: string;
  displayName: string;
  description: string;
  icon: string;
  prompt: string;
  category: 'messaging' | 'notes' | 'email' | 'code' | 'documents' | 'browser' | 'other';
  priority: number; // Higher numbers get priority in conflicts
}

export const APPLICATION_PROMPTS: ApplicationPrompt[] = [
  // Messaging Applications
  {
    applicationId: 'slack',
    displayName: 'Slack',
    description: 'Team communication with threading and mentions',
    icon: 'slack',
    category: 'messaging',
    priority: 9,
    prompt: 'Format for Slack team communication. Use clear, professional yet friendly tone. Structure for threading if discussing complex topics. Use @mentions appropriately when referencing people. Keep messages concise but informative. Use bullet points for multiple items. Maintain team communication etiquette.'
  },
  {
    applicationId: 'discord',
    displayName: 'Discord',
    description: 'Gaming and community chat with casual tone',
    icon: 'discord',
    category: 'messaging',
    priority: 9,
    prompt: 'Format for Discord community chat. Use casual, friendly tone appropriate for gaming/community discussions. Feel free to use gaming terminology and internet slang when appropriate. Keep messages conversational and engaging. Use emojis to enhance expression when they fit naturally.'
  },
  {
    applicationId: 'whatsapp',
    displayName: 'WhatsApp',
    description: 'Personal messaging with casual, emoji-rich format',
    icon: 'whatsapp',
    category: 'messaging',
    priority: 9,
    prompt: 'Format for WhatsApp personal messaging. Use casual, friendly tone suitable for personal conversations. Embrace emojis and casual expression. Keep messages natural and conversational, as if speaking to friends or family. Use informal greetings and closings when appropriate.'
  },
  {
    applicationId: 'telegram',
    displayName: 'Telegram',
    description: 'Messaging with support for formatting and bots',
    icon: 'telegram',
    category: 'messaging',
    priority: 8,
    prompt: 'Format for Telegram messaging. Use clear, direct communication. Support both casual and professional contexts depending on the conversation. Utilize Telegram\'s formatting capabilities when beneficial (bold, italic, code). Keep messages well-structured and easy to read.'
  },
  {
    applicationId: 'teams',
    displayName: 'Microsoft Teams',
    description: 'Professional team collaboration and meetings',
    icon: 'teams',
    category: 'messaging',
    priority: 8,
    prompt: 'Format for Microsoft Teams professional communication. Use professional, clear tone suitable for workplace collaboration. Structure messages for team discussions, project updates, and meeting coordination. Use @mentions for team members appropriately. Keep communication professional but approachable.'
  },
  {
    applicationId: 'messages',
    displayName: 'Messages (iMessage)',
    description: 'Apple Messages with personal touch',
    icon: 'messages',
    category: 'messaging',
    priority: 7,
    prompt: 'Format for Apple Messages/iMessage. Use personal, casual tone suitable for friends and family. Embrace natural conversation flow with appropriate emoji usage. Keep messages personal and warm, suitable for close contacts and family members.'
  },

  // Note-Taking Applications
  {
    applicationId: 'notion',
    displayName: 'Notion',
    description: 'Structured knowledge management with blocks',
    icon: 'notion',
    category: 'notes',
    priority: 10,
    prompt: 'Format for Notion structured note-taking. Organize content with clear headers, bullet points, and block-based thinking. Use structured formatting suitable for databases, project planning, and knowledge management. Create content that works well with Notion\'s block system and linking capabilities.'
  },
  {
    applicationId: 'obsidian',
    displayName: 'Obsidian',
    description: 'Knowledge graph with markdown and linking',
    icon: 'obsidian',
    category: 'notes',
    priority: 10,
    prompt: 'Format for Obsidian knowledge management. Use markdown formatting with clear headers and bullet points. Consider [[linking]] opportunities between concepts. Structure content for knowledge graph building and future referencing. Use tags and connections to build comprehensive knowledge networks.'
  },
  {
    applicationId: 'logseq',
    displayName: 'Logseq',
    description: 'Block-based notes with daily journaling',
    icon: 'logseq',
    category: 'notes',
    priority: 9,
    prompt: 'Format for Logseq block-based note-taking. Structure content in logical blocks that can be referenced and linked. Use bullet points and indentation effectively. Consider daily journaling context and block-level organization. Format for easy future referencing and connecting.'
  },
  {
    applicationId: 'roam',
    displayName: 'Roam Research',
    description: 'Networked thought with bidirectional linking',
    icon: 'roam',
    category: 'notes',
    priority: 9,
    prompt: 'Format for Roam Research networked thinking. Structure content for bidirectional linking and graph database. Use [[page references]] and consider how content connects to existing knowledge. Format for research, idea development, and knowledge building with interconnected concepts.'
  },
  {
    applicationId: 'notes',
    displayName: 'Apple Notes',
    description: 'Simple, clean note-taking',
    icon: 'notes',
    category: 'notes',
    priority: 7,
    prompt: 'Format for Apple Notes simple note-taking. Use clean, organized structure with clear headers and bullet points. Keep formatting simple but effective. Structure content for easy reading and future reference in a straightforward note-taking context.'
  },
  {
    applicationId: 'evernote',
    displayName: 'Evernote',
    description: 'Document capture and organization',
    icon: 'evernote',
    category: 'notes',
    priority: 7,
    prompt: 'Format for Evernote document organization. Structure content with clear headers, tags, and organizational elements. Consider how content will be searched and categorized later. Use formatting that works well with Evernote\'s document capture and organization features.'
  },
  {
    applicationId: 'bear',
    displayName: 'Bear',
    description: 'Markdown-focused writing and notes',
    icon: 'bear',
    category: 'notes',
    priority: 8,
    prompt: 'Format for Bear markdown note-taking. Use markdown formatting with headers, bullet points, and clean structure. Consider tagging and organization for later retrieval. Structure content for both writing and note-taking contexts with beautiful, readable formatting.'
  },

  // Email Applications
  {
    applicationId: 'gmail',
    displayName: 'Gmail',
    description: 'Professional email communication',
    icon: 'gmail',
    category: 'email',
    priority: 9,
    prompt: 'Format for Gmail professional email communication. Use proper email structure with appropriate greetings and closings. Maintain professional tone while being clear and direct. Structure content with proper paragraphs and bullet points when needed. Consider email etiquette and professional communication standards.'
  },
  {
    applicationId: 'outlook',
    displayName: 'Microsoft Outlook',
    description: 'Corporate email and calendar management',
    icon: 'outlook',
    category: 'email',
    priority: 9,
    prompt: 'Format for Outlook corporate email communication. Use professional business tone with proper email structure. Include appropriate greetings, body paragraphs, and professional closings. Structure for corporate communication standards and business etiquette. Consider action items and clear communication objectives.'
  },
  {
    applicationId: 'mail',
    displayName: 'Apple Mail',
    description: 'Clean, personal and professional email',
    icon: 'mail',
    category: 'email',
    priority: 8,
    prompt: 'Format for Apple Mail communication. Use clean, professional formatting suitable for both personal and business contexts. Structure with proper email etiquette and clear, concise communication. Adapt tone based on context while maintaining professionalism.'
  },

  // Code Editor Applications
  {
    applicationId: 'vscode',
    displayName: 'Visual Studio Code',
    description: 'Code comments and documentation',
    icon: 'vscode',
    category: 'code',
    priority: 10,
    prompt: 'Format for VS Code development context. Create content suitable for code comments, documentation, commit messages, or technical notes. Use clear, concise technical language. Structure for code readability and developer understanding. Consider documentation standards and code commenting best practices.'
  },
  {
    applicationId: 'xcode',
    displayName: 'Xcode',
    description: 'iOS/macOS development documentation',
    icon: 'xcode',
    category: 'code',
    priority: 9,
    prompt: 'Format for Xcode iOS/macOS development. Create content suitable for Swift/Objective-C code comments, documentation, or development notes. Use technical precision appropriate for Apple development. Structure for code documentation and development workflow context.'
  },
  {
    applicationId: 'webstorm',
    displayName: 'WebStorm',
    description: 'Web development and JavaScript',
    icon: 'webstorm',
    category: 'code',
    priority: 9,
    prompt: 'Format for WebStorm web development context. Create content suitable for JavaScript/TypeScript comments, web development documentation, or technical notes. Use web development terminology and structure for frontend/backend development contexts.'
  },
  {
    applicationId: 'sublime',
    displayName: 'Sublime Text',
    description: 'Lightweight code editing and scripting',
    icon: 'sublime',
    category: 'code',
    priority: 8,
    prompt: 'Format for Sublime Text code editing. Create concise, technical content suitable for various programming languages. Use clear, minimal formatting appropriate for lightweight development and scripting contexts.'
  },

  // Document Applications
  {
    applicationId: 'word',
    displayName: 'Microsoft Word',
    description: 'Professional document writing',
    icon: 'word',
    category: 'documents',
    priority: 9,
    prompt: 'Format for Microsoft Word document creation. Use proper document structure with headers, paragraphs, and professional formatting. Consider document hierarchy and formal writing standards. Structure content suitable for reports, proposals, and professional documents.'
  },
  {
    applicationId: 'pages',
    displayName: 'Apple Pages',
    description: 'Document design and writing',
    icon: 'pages',
    category: 'documents',
    priority: 8,
    prompt: 'Format for Apple Pages document creation. Use clean, well-structured formatting suitable for both professional and creative documents. Consider visual layout and readability. Structure content with proper document flow and design-conscious formatting.'
  },
  {
    applicationId: 'docs',
    displayName: 'Google Docs',
    description: 'Collaborative document editing',
    icon: 'docs',
    category: 'documents',
    priority: 9,
    prompt: 'Format for Google Docs collaborative writing. Use clear, structured formatting suitable for team collaboration. Consider commenting and suggestion contexts. Structure content for shared editing and collaborative document development.'
  },

  // Browser Applications (context-specific)
  {
    applicationId: 'browser-github',
    displayName: 'GitHub (Browser)',
    description: 'Code repositories and collaboration',
    icon: 'github',
    category: 'browser',
    priority: 8,
    prompt: 'Format for GitHub repository context. Create content suitable for commit messages, pull request descriptions, issue reporting, or project documentation. Use technical precision and consider developer workflow and collaboration context.'
  },
  {
    applicationId: 'figma',
    displayName: 'Figma',
    description: 'Design collaboration and prototyping',
    icon: 'figma',
    category: 'browser',
    priority: 7,
    prompt: 'Format for Figma design collaboration. Create content suitable for design comments, feedback, component descriptions, or design documentation. Use clear, concise language focused on visual design and user experience considerations.'
  },
  {
    applicationId: 'browser-stackoverflow',
    displayName: 'Stack Overflow (Browser)',
    description: 'Technical Q&A and programming',
    icon: 'stackoverflow',
    category: 'browser',
    priority: 8,
    prompt: 'Format for Stack Overflow technical discussion. Create clear, precise technical content suitable for programming questions, answers, or comments. Use technical accuracy and consider developer community standards and helpful communication.'
  },
  {
    applicationId: 'browser-twitter',
    displayName: 'Twitter/X (Browser)',
    description: 'Social media and microblogging',
    icon: 'twitter',
    category: 'browser',
    priority: 7,
    prompt: 'Format for Twitter/X social media posting. Keep content concise and engaging, suitable for social media context. Consider character limits and social media best practices. Use appropriate tone for public social interaction.'
  },
  {
    applicationId: 'browser-linkedin',
    displayName: 'LinkedIn (Browser)',
    description: 'Professional networking',
    icon: 'linkedin',
    category: 'browser',
    priority: 8,
    prompt: 'Format for LinkedIn professional networking. Use professional, engaging tone suitable for business networking. Structure content for professional audience and career-focused communication. Consider industry standards and professional presentation.'
  },

  // Default fallback
  {
    applicationId: 'default',
    displayName: 'Default',
    description: 'General text formatting and cleanup',
    icon: 'document',
    category: 'other',
    priority: 1,
    prompt: 'Format text with proper grammar, punctuation, and capitalization. Fix spelling errors and improve readability while preserving the original meaning and intent. Use clear, professional formatting appropriate for general text content.'
  }
];

/**
 * Get application prompt by application ID
 */
export function getApplicationPrompt(applicationId: string): ApplicationPrompt | null {
  return APPLICATION_PROMPTS.find(prompt => prompt.applicationId === applicationId) || null;
}

/**
 * Get all application prompts for a specific category
 */
export function getApplicationPromptsByCategory(category: ApplicationPrompt['category']): ApplicationPrompt[] {
  return APPLICATION_PROMPTS.filter(prompt => prompt.category === category)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Get all application prompts sorted by priority
 */
export function getAllApplicationPrompts(): ApplicationPrompt[] {
  return [...APPLICATION_PROMPTS].sort((a, b) => b.priority - a.priority);
}

/**
 * Get default prompt for fallback scenarios
 */
export function getDefaultApplicationPrompt(): ApplicationPrompt {
  return APPLICATION_PROMPTS.find(prompt => prompt.applicationId === 'default') || APPLICATION_PROMPTS[APPLICATION_PROMPTS.length - 1];
}

/**
 * Get default prompt for a specific application (alias for easier usage)
 */
export function getDefaultPromptForApplication(applicationId: string): string {
  const appPrompt = getApplicationPrompt(applicationId);
  return appPrompt ? appPrompt.prompt : getDefaultApplicationPrompt().prompt;
}