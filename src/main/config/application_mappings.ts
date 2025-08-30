/**
 * Application Mappings Configuration
 * Centralized configuration for application context mappings and formatting preferences
 */

import { ApplicationContextType } from "../../shared/types";

export interface ApplicationMapping {
  appName: string;
  contextType: ApplicationContextType;
  confidence: number; // 0-1, how confident we are about this mapping
  aliases: string[]; // Alternative names for the same app
  bundleIds?: string[]; // macOS bundle identifiers
  processNames?: string[]; // Windows process names
}

export interface ContextConfig {
  contextType: ApplicationContextType;
  displayName: string;
  description: string;
  icon: string; // Icon identifier for UI
  defaultEnabled: boolean;
  priority: number; // Higher numbers take precedence in conflicts
}

export class ApplicationMappingsConfig {
  private static instance: ApplicationMappingsConfig;
  private applicationMappings: ApplicationMapping[];
  private contextConfigs: Map<ApplicationContextType, ContextConfig>;
  private customMappings: Map<string, ApplicationContextType>;

  private constructor() {
    this.applicationMappings = [];
    this.contextConfigs = new Map();
    this.customMappings = new Map();
    this.initializeDefaultMappings();
    this.initializeContextConfigs();
  }

  public static getInstance(): ApplicationMappingsConfig {
    if (!ApplicationMappingsConfig.instance) {
      ApplicationMappingsConfig.instance = new ApplicationMappingsConfig();
    }
    return ApplicationMappingsConfig.instance;
  }

  /**
   * Initialize default application mappings
   */
  private initializeDefaultMappings(): void {
    this.applicationMappings = [
      // Email Applications
      {
        appName: "Mail",
        contextType: ApplicationContextType.EMAIL,
        confidence: 0.95,
        aliases: ["apple mail", "mail.app"],
        bundleIds: ["com.apple.mail"],
        processNames: ["mail"]
      },
      {
        appName: "Microsoft Outlook",
        contextType: ApplicationContextType.EMAIL,
        confidence: 0.95,
        aliases: ["outlook", "outlook.exe"],
        bundleIds: ["com.microsoft.Outlook"],
        processNames: ["outlook", "microsoft outlook"]
      },
      {
        appName: "Thunderbird",
        contextType: ApplicationContextType.EMAIL,
        confidence: 0.95,
        aliases: ["mozilla thunderbird"],
        bundleIds: ["org.mozilla.thunderbird"],
        processNames: ["thunderbird"]
      },
      {
        appName: "Gmail",
        contextType: ApplicationContextType.EMAIL,
        confidence: 0.8, // Browser-based, lower confidence
        aliases: ["gmail.com"],
        processNames: ["chrome", "firefox", "safari", "edge"]
      },
      {
        appName: "Airmail",
        contextType: ApplicationContextType.EMAIL,
        confidence: 0.95,
        aliases: ["airmail 5"],
        bundleIds: ["it.bloop.airmail2"],
        processNames: ["airmail"]
      },
      {
        appName: "Spark",
        contextType: ApplicationContextType.EMAIL,
        confidence: 0.95,
        aliases: ["spark email", "spark mail"],
        bundleIds: ["com.readdle.smartemail-Mac"],
        processNames: ["spark"]
      },

      // Note-Taking Applications
      {
        appName: "Notes",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: ["apple notes", "notes.app"],
        bundleIds: ["com.apple.Notes"],
        processNames: ["notes"]
      },
      {
        appName: "Notion",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: ["notion.so"],
        bundleIds: ["notion.id"],
        processNames: ["notion"]
      },
      {
        appName: "Obsidian",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: ["obsidian.md"],
        bundleIds: ["md.obsidian"],
        processNames: ["obsidian"]
      },
      {
        appName: "Logseq",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: [],
        bundleIds: ["com.electron.logseq"],
        processNames: ["logseq"]
      },
      {
        appName: "Bear",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: ["bear notes"],
        bundleIds: ["net.shinyfrog.bear"],
        processNames: ["bear"]
      },
      {
        appName: "Joplin",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: [],
        bundleIds: ["net.cozic.joplin-desktop"],
        processNames: ["joplin"]
      },
      {
        appName: "Evernote",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: [],
        bundleIds: ["com.evernote.Evernote"],
        processNames: ["evernote"]
      },
      {
        appName: "OneNote",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: ["microsoft onenote"],
        bundleIds: ["com.microsoft.onenote.mac"],
        processNames: ["onenote"]
      },
      {
        appName: "Craft",
        contextType: ApplicationContextType.NOTES,
        confidence: 0.95,
        aliases: ["craft docs"],
        bundleIds: ["com.lukilabs.lukiapp"],
        processNames: ["craft"]
      },

      // Code Editors
      {
        appName: "Visual Studio Code",
        contextType: ApplicationContextType.CODE_EDITOR,
        confidence: 0.95,
        aliases: ["vscode", "code", "vs code"],
        bundleIds: ["com.microsoft.VSCode"],
        processNames: ["code"]
      },
      {
        appName: "Xcode",
        contextType: ApplicationContextType.CODE_EDITOR,
        confidence: 0.95,
        aliases: [],
        bundleIds: ["com.apple.dt.Xcode"],
        processNames: ["xcode"]
      },
      {
        appName: "Sublime Text",
        contextType: ApplicationContextType.CODE_EDITOR,
        confidence: 0.95,
        aliases: ["sublime"],
        bundleIds: ["com.sublimetext.4"],
        processNames: ["sublime_text"]
      },
      {
        appName: "Atom",
        contextType: ApplicationContextType.CODE_EDITOR,
        confidence: 0.95,
        aliases: ["atom editor"],
        bundleIds: ["com.github.atom"],
        processNames: ["atom"]
      },
      {
        appName: "WebStorm",
        contextType: ApplicationContextType.CODE_EDITOR,
        confidence: 0.95,
        aliases: ["jetbrains webstorm"],
        bundleIds: ["com.jetbrains.WebStorm"],
        processNames: ["webstorm"]
      },
      {
        appName: "IntelliJ IDEA",
        contextType: ApplicationContextType.CODE_EDITOR,
        confidence: 0.95,
        aliases: ["intellij", "idea"],
        bundleIds: ["com.jetbrains.intellij"],
        processNames: ["idea"]
      },

      // Messaging Applications
      {
        appName: "Messages",
        contextType: ApplicationContextType.MESSAGING,
        confidence: 0.95,
        aliases: ["apple messages", "imessage"],
        bundleIds: ["com.apple.MobileSMS"],
        processNames: ["messages"]
      },
      {
        appName: "Slack",
        contextType: ApplicationContextType.MESSAGING,
        confidence: 0.95,
        aliases: [],
        bundleIds: ["com.tinyspeck.slackmacgap"],
        processNames: ["slack"]
      },
      {
        appName: "Discord",
        contextType: ApplicationContextType.MESSAGING,
        confidence: 0.95,
        aliases: [],
        bundleIds: ["com.hnc.Discord"],
        processNames: ["discord"]
      },
      {
        appName: "Microsoft Teams",
        contextType: ApplicationContextType.MESSAGING,
        confidence: 0.95,
        aliases: ["teams"],
        bundleIds: ["com.microsoft.teams"],
        processNames: ["teams"]
      },
      {
        appName: "WhatsApp",
        contextType: ApplicationContextType.MESSAGING,
        confidence: 0.95,
        aliases: ["whatsapp desktop"],
        bundleIds: ["WhatsApp"],
        processNames: ["whatsapp"]
      },
      {
        appName: "Telegram",
        contextType: ApplicationContextType.MESSAGING,
        confidence: 0.95,
        aliases: ["telegram desktop"],
        bundleIds: ["ru.keepcoder.Telegram"],
        processNames: ["telegram"]
      },
      {
        appName: "Signal",
        contextType: ApplicationContextType.MESSAGING,
        confidence: 0.95,
        aliases: ["signal desktop"],
        bundleIds: ["org.whispersystems.signal-desktop"],
        processNames: ["signal"]
      },

      // Document Applications
      {
        appName: "Microsoft Word",
        contextType: ApplicationContextType.DOCUMENT,
        confidence: 0.95,
        aliases: ["word", "ms word"],
        bundleIds: ["com.microsoft.Word"],
        processNames: ["winword"]
      },
      {
        appName: "Pages",
        contextType: ApplicationContextType.DOCUMENT,
        confidence: 0.95,
        aliases: ["apple pages"],
        bundleIds: ["com.apple.iWork.Pages"],
        processNames: ["pages"]
      },
      {
        appName: "Google Docs",
        contextType: ApplicationContextType.DOCUMENT,
        confidence: 0.8,
        aliases: ["docs.google.com"],
        processNames: ["chrome", "firefox", "safari", "edge"]
      },
      {
        appName: "LibreOffice Writer",
        contextType: ApplicationContextType.DOCUMENT,
        confidence: 0.95,
        aliases: ["libreoffice", "writer"],
        bundleIds: ["org.libreoffice.script"],
        processNames: ["libreoffice"]
      },
      {
        appName: "TextEdit",
        contextType: ApplicationContextType.DOCUMENT,
        confidence: 0.9,
        aliases: ["text edit"],
        bundleIds: ["com.apple.TextEdit"],
        processNames: ["textedit"]
      },

      // Browser Applications
      {
        appName: "Safari",
        contextType: ApplicationContextType.BROWSER,
        confidence: 0.85,
        aliases: ["apple safari"],
        bundleIds: ["com.apple.Safari"],
        processNames: ["safari"]
      },
      {
        appName: "Google Chrome",
        contextType: ApplicationContextType.BROWSER,
        confidence: 0.85,
        aliases: ["chrome"],
        bundleIds: ["com.google.Chrome"],
        processNames: ["chrome"]
      },
      {
        appName: "Firefox",
        contextType: ApplicationContextType.BROWSER,
        confidence: 0.85,
        aliases: ["mozilla firefox"],
        bundleIds: ["org.mozilla.firefox"],
        processNames: ["firefox"]
      },
      {
        appName: "Microsoft Edge",
        contextType: ApplicationContextType.BROWSER,
        confidence: 0.85,
        aliases: ["edge"],
        bundleIds: ["com.microsoft.edgemac"],
        processNames: ["msedge"]
      },
      {
        appName: "Arc",
        contextType: ApplicationContextType.BROWSER,
        confidence: 0.85,
        aliases: ["arc browser"],
        bundleIds: ["company.thebrowser.Browser"],
        processNames: ["arc"]
      },

      // Terminal Applications
      {
        appName: "Terminal",
        contextType: ApplicationContextType.TERMINAL,
        confidence: 0.95,
        aliases: ["apple terminal", "terminal.app"],
        bundleIds: ["com.apple.Terminal"],
        processNames: ["terminal"]
      },
      {
        appName: "iTerm2",
        contextType: ApplicationContextType.TERMINAL,
        confidence: 0.95,
        aliases: ["iterm"],
        bundleIds: ["com.googlecode.iterm2"],
        processNames: ["iterm2"]
      },
      {
        appName: "Hyper",
        contextType: ApplicationContextType.TERMINAL,
        confidence: 0.95,
        aliases: ["hyper terminal"],
        bundleIds: ["co.zeit.hyper"],
        processNames: ["hyper"]
      },

      // Presentation Applications
      {
        appName: "Keynote",
        contextType: ApplicationContextType.PRESENTATION,
        confidence: 0.95,
        aliases: ["apple keynote"],
        bundleIds: ["com.apple.iWork.Keynote"],
        processNames: ["keynote"]
      },
      {
        appName: "Microsoft PowerPoint",
        contextType: ApplicationContextType.PRESENTATION,
        confidence: 0.95,
        aliases: ["powerpoint", "ppt"],
        bundleIds: ["com.microsoft.Powerpoint"],
        processNames: ["powerpnt"]
      },
      {
        appName: "Google Slides",
        contextType: ApplicationContextType.PRESENTATION,
        confidence: 0.8,
        aliases: ["slides.google.com"],
        processNames: ["chrome", "firefox", "safari", "edge"]
      }
    ];
  }

  /**
   * Initialize context type configurations
   */
  private initializeContextConfigs(): void {
    this.contextConfigs.set(ApplicationContextType.EMAIL, {
      contextType: ApplicationContextType.EMAIL,
      displayName: "Email",
      description: "Professional email formatting with proper greetings and structure",
      icon: "mail",
      defaultEnabled: true,
      priority: 8
    });

    this.contextConfigs.set(ApplicationContextType.NOTES, {
      contextType: ApplicationContextType.NOTES,
      displayName: "Notes & Documentation",
      description: "Structured formatting with bullet points, headers, and lists",
      icon: "note",
      defaultEnabled: true,
      priority: 9
    });

    this.contextConfigs.set(ApplicationContextType.CODE_EDITOR, {
      contextType: ApplicationContextType.CODE_EDITOR,
      displayName: "Code Editor",
      description: "Format as code comments and documentation",
      icon: "code",
      defaultEnabled: true,
      priority: 10
    });

    this.contextConfigs.set(ApplicationContextType.MESSAGING, {
      contextType: ApplicationContextType.MESSAGING,
      displayName: "Messaging & Chat",
      description: "Casual tone with optional emoji enhancement",
      icon: "message",
      defaultEnabled: true,
      priority: 7
    });

    this.contextConfigs.set(ApplicationContextType.DOCUMENT, {
      contextType: ApplicationContextType.DOCUMENT,
      displayName: "Documents",
      description: "Structured paragraphs with proper capitalization",
      icon: "document",
      defaultEnabled: true,
      priority: 6
    });

    this.contextConfigs.set(ApplicationContextType.BROWSER, {
      contextType: ApplicationContextType.BROWSER,
      displayName: "Web Browser",
      description: "Clean formatting for web forms and text areas",
      icon: "browser",
      defaultEnabled: true,
      priority: 4
    });

    this.contextConfigs.set(ApplicationContextType.TERMINAL, {
      contextType: ApplicationContextType.TERMINAL,
      displayName: "Terminal",
      description: "Format as commands or comments",
      icon: "terminal",
      defaultEnabled: true,
      priority: 5
    });

    this.contextConfigs.set(ApplicationContextType.PRESENTATION, {
      contextType: ApplicationContextType.PRESENTATION,
      displayName: "Presentations",
      description: "Bullet point formatting for slides",
      icon: "presentation",
      defaultEnabled: true,
      priority: 6
    });

    this.contextConfigs.set(ApplicationContextType.UNKNOWN, {
      contextType: ApplicationContextType.UNKNOWN,
      displayName: "Unknown",
      description: "Basic text cleanup and formatting",
      icon: "unknown",
      defaultEnabled: true,
      priority: 1
    });
  }

  /**
   * Find the best matching application mapping for a given application
   */
  public findBestMatch(
    appName: string,
    processName?: string,
    bundleId?: string,
    windowTitle?: string
  ): ApplicationMapping | null {
    const candidates: { mapping: ApplicationMapping; score: number }[] = [];

    for (const mapping of this.applicationMappings) {
      let score = 0;

      // Exact bundle ID match (highest priority)
      if (bundleId && mapping.bundleIds?.includes(bundleId)) {
        score += 100;
      }

      // Exact app name match
      if (appName.toLowerCase() === mapping.appName.toLowerCase()) {
        score += 50;
      }

      // Alias match
      for (const alias of mapping.aliases) {
        if (appName.toLowerCase() === alias.toLowerCase()) {
          score += 40;
          break;
        }
      }

      // Process name match
      if (processName && mapping.processNames) {
        for (const procName of mapping.processNames) {
          if (processName.toLowerCase().includes(procName.toLowerCase())) {
            score += 30;
            break;
          }
        }
      }

      // Partial app name match
      if (appName.toLowerCase().includes(mapping.appName.toLowerCase()) ||
          mapping.appName.toLowerCase().includes(appName.toLowerCase())) {
        score += 20;
      }

      // Window title context clues
      if (windowTitle) {
        if (mapping.contextType === ApplicationContextType.EMAIL && 
            (windowTitle.toLowerCase().includes("gmail") || 
             windowTitle.toLowerCase().includes("compose") ||
             windowTitle.includes("@"))) {
          score += 15;
        }
        
        if (mapping.contextType === ApplicationContextType.CODE_EDITOR &&
            (windowTitle.includes(".js") || windowTitle.includes(".ts") || 
             windowTitle.includes(".py") || windowTitle.includes(".java"))) {
          score += 15;
        }
      }

      if (score > 0) {
        candidates.push({ mapping, score });
      }
    }

    // Sort by score and return the best match
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].mapping : null;
  }

  /**
   * Get context configuration
   */
  public getContextConfig(contextType: ApplicationContextType): ContextConfig | null {
    return this.contextConfigs.get(contextType) || null;
  }

  /**
   * Get all context configurations
   */
  public getAllContextConfigs(): ContextConfig[] {
    return Array.from(this.contextConfigs.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all application mappings
   */
  public getAllMappings(): ApplicationMapping[] {
    return [...this.applicationMappings];
  }

  /**
   * Add custom application mapping
   */
  public addCustomMapping(appName: string, contextType: ApplicationContextType): void {
    this.customMappings.set(appName.toLowerCase(), contextType);
  }

  /**
   * Remove custom mapping
   */
  public removeCustomMapping(appName: string): void {
    this.customMappings.delete(appName.toLowerCase());
  }

  /**
   * Get custom mapping for application
   */
  public getCustomMapping(appName: string): ApplicationContextType | null {
    return this.customMappings.get(appName.toLowerCase()) || null;
  }

  /**
   * Get all custom mappings
   */
  public getAllCustomMappings(): Map<string, ApplicationContextType> {
    return new Map(this.customMappings);
  }

  /**
   * Export configuration for backup/sync
   */
  public exportConfig(): {
    customMappings: { [key: string]: ApplicationContextType };
    contextSettings: { [key: string]: any };
  } {
    const customMappingsObj: { [key: string]: ApplicationContextType } = {};
    this.customMappings.forEach((value, key) => {
      customMappingsObj[key] = value;
    });

    return {
      customMappings: customMappingsObj,
      contextSettings: {} // Will be extended when we add more context settings
    };
  }

  /**
   * Import configuration from backup/sync
   */
  public importConfig(config: {
    customMappings?: { [key: string]: ApplicationContextType };
    contextSettings?: { [key: string]: any };
  }): void {
    if (config.customMappings) {
      this.customMappings.clear();
      Object.entries(config.customMappings).forEach(([key, value]) => {
        this.customMappings.set(key, value);
      });
    }

    // Handle contextSettings when we add more settings
  }
}