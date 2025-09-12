/**
 * Application Context Service
 * Bridges the application detection system with application-specific prompts
 */

import { ApplicationDetector } from './application_detector';
import { ApplicationMappingsConfig } from '../config/application_mappings';
import { APPLICATION_PROMPTS, getApplicationPrompt, getDefaultApplicationPrompt } from '../../shared/config/application_prompts';
import { ApplicationContextType, ActiveApplicationInfo } from '../../shared/types/services';

export interface ApplicationContextMapping {
  applicationId: string;
  contextType: ApplicationContextType;
  confidence: number;
  prompt: string;
  displayName: string;
}

export class ApplicationContextService {
  private static instance: ApplicationContextService;
  private applicationDetector: ApplicationDetector;
  private mappingsConfig: ApplicationMappingsConfig;

  // Mapping from ApplicationContextType to application IDs
  private readonly CONTEXT_TO_APP_MAPPING: Record<ApplicationContextType, string[]> = {
    [ApplicationContextType.EMAIL]: ['gmail', 'outlook', 'mail'],
    [ApplicationContextType.MESSAGING]: ['slack', 'discord', 'whatsapp', 'telegram', 'teams', 'messages'],
    [ApplicationContextType.NOTES]: ['notion', 'obsidian', 'logseq', 'roam', 'notes', 'evernote', 'bear'],
    [ApplicationContextType.CODE_EDITOR]: ['vscode', 'xcode', 'webstorm', 'sublime'],
    [ApplicationContextType.DOCUMENT]: ['word', 'pages', 'docs'],
    [ApplicationContextType.BROWSER]: ['browser-github', 'browser-stackoverflow', 'browser-twitter', 'browser-linkedin'],
    [ApplicationContextType.TERMINAL]: ['terminal'],
    [ApplicationContextType.PRESENTATION]: ['keynote', 'powerpoint'],
    [ApplicationContextType.UNKNOWN]: ['default'],
  };

  // Specific application name to application ID mapping (NON-BROWSER APPS ONLY)
  private readonly APP_NAME_TO_ID_MAPPING: Record<string, string> = {
    // Email apps (native only, not browser-based)
    'microsoft outlook': 'outlook',
    'outlook': 'outlook',
    'mail': 'mail',
    'apple mail': 'mail',
    
    // Messaging apps
    'slack': 'slack',
    'discord': 'discord',
    'whatsapp': 'whatsapp',
    'telegram': 'telegram',
    'microsoft teams': 'teams',
    'teams': 'teams',
    'messages': 'messages',
    'imessage': 'messages',
    
    // Note-taking apps
    'notion': 'notion',
    'obsidian': 'obsidian',
    'logseq': 'logseq',
    'roam research': 'roam',
    'notes': 'notes',
    'apple notes': 'notes',
    'evernote': 'evernote',
    'bear': 'bear',
    
    // Code editors
    'visual studio code': 'vscode',
    'code': 'vscode',
    'vscode': 'vscode',
    'xcode': 'xcode',
    'webstorm': 'webstorm',
    'sublime text': 'sublime',
    'atom': 'vscode', // Map atom to vscode as fallback
    
    // Document apps
    'microsoft word': 'word',
    'word': 'word',
    'pages': 'pages',
    'apple pages': 'pages',
    'google docs': 'docs',
    
    // Terminal apps
    'terminal': 'terminal',
    'iterm2': 'terminal',
    'hyper': 'terminal',
    'kitty': 'terminal',
    'alacritty': 'terminal',
  };

  private constructor() {
    this.applicationDetector = ApplicationDetector.getInstance();
    this.mappingsConfig = ApplicationMappingsConfig.getInstance();
  }

  public static getInstance(): ApplicationContextService {
    if (!ApplicationContextService.instance) {
      ApplicationContextService.instance = new ApplicationContextService();
    }
    return ApplicationContextService.instance;
  }

  /**
   * Get the current application context with enhanced detection
   */
  public async getCurrentApplicationContext(): Promise<ApplicationContextMapping | null> {
    try {
      // Get active application info from the detector
      const activeApp = await this.applicationDetector.getActiveApplication();
      if (!activeApp) {
        return this.getDefaultApplicationContext();
      }

      // Try to find the best matching application ID
      const applicationId = this.detectApplicationId(activeApp);
      
      // Get the application prompt configuration
      const appPrompt = getApplicationPrompt(applicationId);
      if (!appPrompt) {
        return this.getDefaultApplicationContext();
      }

      return {
        applicationId,
        contextType: activeApp.contextType,
        confidence: this.calculateConfidence(activeApp, applicationId),
        prompt: appPrompt.prompt,
        displayName: appPrompt.displayName,
      };
    } catch (error) {
      console.error('[ApplicationContextService] Error getting application context:', error);
      return this.getDefaultApplicationContext();
    }
  }

  /**
   * Detect specific application ID from active application info
   */
  private detectApplicationId(activeApp: ActiveApplicationInfo): string {
    const appName = activeApp.applicationName.toLowerCase();
    const processName = activeApp.processName.toLowerCase();
    const windowTitle = activeApp.windowTitle.toLowerCase();

    console.log('[ApplicationContextService] Detection input:', {
      appName,
      processName, 
      windowTitle: windowTitle.substring(0, 100) + (windowTitle.length > 100 ? '...' : ''),
      contextType: activeApp.contextType
    });

    // PRIORITY 1: Browser context detection (highest priority for browser apps)
    if (this.isBrowserApp(activeApp)) {
      const browserContext = this.detectBrowserContext(windowTitle);
      console.log('[ApplicationContextService] Browser detected, context:', browserContext);
      return browserContext;
    }

    // PRIORITY 2: Direct native application name mapping
    if (this.APP_NAME_TO_ID_MAPPING[appName]) {
      const directMatch = this.APP_NAME_TO_ID_MAPPING[appName];
      console.log('[ApplicationContextService] Direct app name match:', directMatch);
      return directMatch;
    }

    if (this.APP_NAME_TO_ID_MAPPING[processName]) {
      const processMatch = this.APP_NAME_TO_ID_MAPPING[processName];
      console.log('[ApplicationContextService] Process name match:', processMatch);
      return processMatch;
    }

    // PRIORITY 3: Context-based fallback mapping
    const contextApps = this.CONTEXT_TO_APP_MAPPING[activeApp.contextType];
    if (contextApps && contextApps.length > 0) {
      const contextFallback = contextApps[0];
      console.log('[ApplicationContextService] Context fallback:', contextFallback);
      return contextFallback;
    }

    console.log('[ApplicationContextService] No match found, using default');
    return 'default';
  }

  /**
   * Check if the application is a browser
   */
  private isBrowserApp(activeApp: ActiveApplicationInfo): boolean {
    const browserNames = ['safari', 'google chrome', 'firefox', 'microsoft edge', 'arc', 'brave'];
    const appName = activeApp.applicationName.toLowerCase();
    return browserNames.some(browser => appName.includes(browser));
  }

  /**
   * Detect browser context based on window title/URL with enhanced parsing
   */
  private detectBrowserContext(windowTitle: string): string {
    console.log('[ApplicationContextService] Analyzing browser context for title:', windowTitle.substring(0, 150));

    // Clean the window title for better matching
    const cleanTitle = windowTitle.toLowerCase().trim();

    // Define detection patterns with priority order
    const detectionPatterns = [
      // Gmail - highest priority email detection
      {
        patterns: ['gmail', 'mail.google.com', 'inbox - ', ' - gmail', 'compose - gmail'],
        appId: 'gmail',
        description: 'Gmail email'
      },
      
      // GitHub - code repository detection  
      {
        patterns: ['github.com', 'github', ' - github', 'pull request', 'issues · ', 'repository'],
        appId: 'browser-github', 
        description: 'GitHub repository'
      },

      // Stack Overflow - programming Q&A
      {
        patterns: ['stack overflow', 'stackoverflow.com', 'stackoverflow', ' - stack overflow'],
        appId: 'browser-stackoverflow',
        description: 'Stack Overflow'
      },

      // Google Docs - document editing
      {
        patterns: ['docs.google.com', 'google docs', ' - google docs', 'document - google docs'],
        appId: 'docs',
        description: 'Google Docs'
      },

      // Slack - team communication (web version)
      {
        patterns: ['slack.com', '.slack.com', ' | slack', ' - slack'],
        appId: 'slack',
        description: 'Slack workspace'
      },

      // Notion - note-taking (web version)
      {
        patterns: ['notion.so', 'notion.com', ' - notion', '| notion'],
        appId: 'notion',
        description: 'Notion workspace'
      },

      // LinkedIn - professional networking
      {
        patterns: ['linkedin.com', 'linkedin', ' | linkedin', ' - linkedin'],
        appId: 'browser-linkedin',
        description: 'LinkedIn'
      },

      // Twitter/X - social media
      {
        patterns: ['twitter.com', 'x.com', '/ x', ' / twitter', ' on x', ' - x'],
        appId: 'browser-twitter',
        description: 'Twitter/X'
      },

      // WhatsApp Web - messaging
      {
        patterns: ['web.whatsapp.com', 'whatsapp web'],
        appId: 'whatsapp',
        description: 'WhatsApp Web'
      },

      // Discord - community chat (web version)
      {
        patterns: ['discord.com', 'discord', ' - discord'],
        appId: 'discord',
        description: 'Discord'
      },

      // Figma - design tool
      {
        patterns: ['figma.com', ' – figma', ' - figma'],
        appId: 'figma',
        description: 'Figma design'
      }
    ];

    // Check each pattern in priority order
    for (const detection of detectionPatterns) {
      for (const pattern of detection.patterns) {
        if (cleanTitle.includes(pattern)) {
          console.log(`[ApplicationContextService] Browser context match: "${pattern}" → ${detection.appId} (${detection.description})`);
          return detection.appId;
        }
      }
    }

    // Enhanced fallback detection for common web app patterns
    if (cleanTitle.includes('.com') || cleanTitle.includes('.org') || cleanTitle.includes('http')) {
      // Check for general productivity apps
      if (cleanTitle.includes('doc') || cleanTitle.includes('edit') || cleanTitle.includes('write')) {
        console.log('[ApplicationContextService] Browser context fallback: document editing → docs');
        return 'docs';
      }
      
      if (cleanTitle.includes('mail') || cleanTitle.includes('inbox') || cleanTitle.includes('@')) {
        console.log('[ApplicationContextService] Browser context fallback: email detected → gmail');
        return 'gmail';
      }

      if (cleanTitle.includes('chat') || cleanTitle.includes('message') || cleanTitle.includes('conversation')) {
        console.log('[ApplicationContextService] Browser context fallback: messaging detected → slack');
        return 'slack';
      }
    }

    console.log('[ApplicationContextService] No specific browser context detected, using default');
    return 'default';
  }

  /**
   * Calculate confidence score for the detected application
   */
  private calculateConfidence(activeApp: ActiveApplicationInfo, applicationId: string): number {
    let confidence = 0.5; // Base confidence

    const appName = activeApp.applicationName.toLowerCase();
    const processName = activeApp.processName.toLowerCase();

    // High confidence for exact matches
    if (this.APP_NAME_TO_ID_MAPPING[appName] === applicationId) {
      confidence = 0.95;
    } else if (this.APP_NAME_TO_ID_MAPPING[processName] === applicationId) {
      confidence = 0.9;
    }

    // Medium confidence for browser-based apps
    if (this.isBrowserApp(activeApp) && applicationId.startsWith('browser-')) {
      confidence = 0.75;
    }

    // Lower confidence for context-based fallbacks
    if (applicationId === 'default') {
      confidence = 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get default application context
   */
  private getDefaultApplicationContext(): ApplicationContextMapping {
    const defaultPrompt = getDefaultApplicationPrompt();
    return {
      applicationId: 'default',
      contextType: ApplicationContextType.UNKNOWN,
      confidence: 0.1,
      prompt: defaultPrompt.prompt,
      displayName: defaultPrompt.displayName,
    };
  }

  /**
   * Get application context by application ID
   */
  public getApplicationContextById(applicationId: string): ApplicationContextMapping | null {
    const appPrompt = getApplicationPrompt(applicationId);
    if (!appPrompt) {
      return null;
    }

    // Find the context type for this application
    let contextType = ApplicationContextType.UNKNOWN;
    for (const [context, apps] of Object.entries(this.CONTEXT_TO_APP_MAPPING)) {
      if (apps.includes(applicationId)) {
        contextType = context as ApplicationContextType;
        break;
      }
    }

    return {
      applicationId,
      contextType,
      confidence: 1.0, // Max confidence for direct ID lookup
      prompt: appPrompt.prompt,
      displayName: appPrompt.displayName,
    };
  }

  /**
   * Get all available application contexts
   */
  public getAllApplicationContexts(): ApplicationContextMapping[] {
    return APPLICATION_PROMPTS.map(app => {
      let contextType = ApplicationContextType.UNKNOWN;
      for (const [context, apps] of Object.entries(this.CONTEXT_TO_APP_MAPPING)) {
        if (apps.includes(app.applicationId)) {
          contextType = context as ApplicationContextType;
          break;
        }
      }

      return {
        applicationId: app.applicationId,
        contextType,
        confidence: 1.0,
        prompt: app.prompt,
        displayName: app.displayName,
      };
    });
  }
}