/**
 * Context-Aware Formatting Engine
 * Applies application-specific formatting to transcribed text
 */

import {
  ApplicationContextType,
  ActiveApplicationInfo,
  FormattingResult,
} from "../../shared/types";

export interface FormattingOptions {
  enableContextFormatting: boolean;
  customRules: Map<ApplicationContextType, FormattingRule>;
  userOverrides: Map<string, ApplicationContextType>; // app name -> context type
}

export interface FormattingRule {
  contextType: ApplicationContextType;
  transformations: TextTransformation[];
  enabled: boolean;
}

export interface TextTransformation {
  name: string;
  description: string;
  enabled: boolean;
  transform: (text: string, context?: FormattingContext) => string;
}

export interface FormattingContext {
  applicationInfo: ActiveApplicationInfo;
  originalText: string;
  detectedLanguage?: string;
  timestamp: Date;
  userSettings?: any;
}

export class ContextFormatter {
  private static instance: ContextFormatter;
  private formattingRules: Map<ApplicationContextType, FormattingRule>;
  private options: FormattingOptions;

  private constructor() {
    this.formattingRules = new Map();
    this.options = {
      enableContextFormatting: true,
      customRules: new Map(),
      userOverrides: new Map(),
    };
    this.initializeDefaultRules();
  }

  public static getInstance(): ContextFormatter {
    if (!ContextFormatter.instance) {
      ContextFormatter.instance = new ContextFormatter();
    }
    return ContextFormatter.instance;
  }

  /**
   * Initialize default formatting rules for each application context
   */
  private initializeDefaultRules(): void {
    // Email formatting rules
    this.formattingRules.set(ApplicationContextType.EMAIL, {
      contextType: ApplicationContextType.EMAIL,
      enabled: true,
      transformations: [
        {
          name: "professional_tone",
          description: "Apply professional email tone and structure",
          enabled: true,
          transform: (text: string) => this.formatEmailText(text),
        },
        {
          name: "proper_greeting",
          description: "Add appropriate greeting if missing",
          enabled: true,
          transform: (text: string) => this.addEmailGreeting(text),
        },
        {
          name: "signature_spacing",
          description: "Add proper spacing before signature",
          enabled: true,
          transform: (text: string) => this.formatEmailSignature(text),
        },
      ],
    });

    // Notes formatting rules
    this.formattingRules.set(ApplicationContextType.NOTES, {
      contextType: ApplicationContextType.NOTES,
      enabled: true,
      transformations: [
        {
          name: "bullet_points",
          description: "Convert comma-separated items to bullet points",
          enabled: true,
          transform: (text: string) => this.formatAsBulletPoints(text),
        },
        {
          name: "numbered_lists",
          description: "Convert sequences to numbered lists",
          enabled: true,
          transform: (text: string) => this.formatAsNumberedList(text),
        },
        {
          name: "headers",
          description: "Format topic headings as markdown headers",
          enabled: true,
          transform: (text: string) => this.formatAsHeaders(text),
        },
        {
          name: "todo_items",
          description: "Convert action items to checkboxes",
          enabled: true,
          transform: (text: string) => this.formatAsTodoItems(text),
        },
      ],
    });

    // Code editor formatting rules
    this.formattingRules.set(ApplicationContextType.CODE_EDITOR, {
      contextType: ApplicationContextType.CODE_EDITOR,
      enabled: true,
      transformations: [
        {
          name: "comment_format",
          description: "Format as code comments",
          enabled: true,
          transform: (text: string) => this.formatAsCodeComment(text),
        },
        {
          name: "documentation",
          description: "Structure as function/class documentation",
          enabled: true,
          transform: (text: string) => this.formatAsDocumentation(text),
        },
      ],
    });

    // Messaging formatting rules
    this.formattingRules.set(ApplicationContextType.MESSAGING, {
      contextType: ApplicationContextType.MESSAGING,
      enabled: true,
      transformations: [
        {
          name: "casual_tone",
          description: "Apply casual, conversational tone",
          enabled: true,
          transform: (text: string) => this.formatForMessaging(text),
        },
        {
          name: "emoji_enhancement",
          description: "Add appropriate emojis for context",
          enabled: false, // Disabled by default, can be user-enabled
          transform: (text: string) => this.addContextualEmojis(text),
        },
        {
          name: "break_long_messages",
          description: "Break long messages into shorter chunks",
          enabled: true,
          transform: (text: string) => this.breakLongMessages(text),
        },
      ],
    });

    // Document formatting rules
    this.formattingRules.set(ApplicationContextType.DOCUMENT, {
      contextType: ApplicationContextType.DOCUMENT,
      enabled: true,
      transformations: [
        {
          name: "paragraph_structure",
          description: "Structure text into proper paragraphs",
          enabled: true,
          transform: (text: string) => this.formatAsParagraphs(text),
        },
        {
          name: "sentence_capitalization",
          description: "Ensure proper sentence capitalization",
          enabled: true,
          transform: (text: string) => this.capitalizeSentences(text),
        },
      ],
    });

    // Browser formatting rules (for forms, comments, etc.)
    this.formattingRules.set(ApplicationContextType.BROWSER, {
      contextType: ApplicationContextType.BROWSER,
      enabled: true,
      transformations: [
        {
          name: "web_friendly",
          description: "Format for web forms and text areas",
          enabled: true,
          transform: (text: string) => this.formatForWeb(text),
        },
      ],
    });

    // Terminal formatting rules
    this.formattingRules.set(ApplicationContextType.TERMINAL, {
      contextType: ApplicationContextType.TERMINAL,
      enabled: true,
      transformations: [
        {
          name: "command_structure",
          description: "Format as terminal commands or comments",
          enabled: true,
          transform: (text: string) => this.formatForTerminal(text),
        },
      ],
    });

    // Presentation formatting rules
    this.formattingRules.set(ApplicationContextType.PRESENTATION, {
      contextType: ApplicationContextType.PRESENTATION,
      enabled: true,
      transformations: [
        {
          name: "slide_points",
          description: "Format as presentation bullet points",
          enabled: true,
          transform: (text: string) => this.formatForPresentation(text),
        },
      ],
    });

    // Unknown/default formatting
    this.formattingRules.set(ApplicationContextType.UNKNOWN, {
      contextType: ApplicationContextType.UNKNOWN,
      enabled: true,
      transformations: [
        {
          name: "basic_cleanup",
          description: "Basic text cleanup and formatting",
          enabled: true,
          transform: (text: string) => this.applyBasicFormatting(text),
        },
      ],
    });
  }

  /**
   * Format text based on application context
   */
  public formatText(
    text: string,
    applicationInfo: ActiveApplicationInfo,
    additionalContext?: any
  ): FormattingResult {
    if (!this.options.enableContextFormatting) {
      return {
        formattedText: text,
        originalText: text,
        contextType: ApplicationContextType.UNKNOWN,
        appliedTransformations: [],
        confidence: 1.0,
      };
    }

    // Check for user overrides
    const overrideContext = this.options.userOverrides.get(
      applicationInfo.applicationName.toLowerCase()
    );
    const contextType = overrideContext || applicationInfo.contextType;

    const formattingRule = this.formattingRules.get(contextType);
    if (!formattingRule || !formattingRule.enabled) {
      return {
        formattedText: text,
        originalText: text,
        contextType: contextType,
        appliedTransformations: [],
        confidence: 1.0,
      };
    }

    const context: FormattingContext = {
      applicationInfo,
      originalText: text,
      timestamp: new Date(),
      userSettings: additionalContext,
    };

    let formattedText = text;
    const appliedTransformations: string[] = [];

    // Apply each enabled transformation
    for (const transformation of formattingRule.transformations) {
      if (transformation.enabled) {
        try {
          formattedText = transformation.transform(formattedText, context);
          appliedTransformations.push(transformation.name);
        } catch (error) {
          console.error(
            `[ContextFormatter] Error applying transformation ${transformation.name}:`,
            error
          );
        }
      }
    }

    return {
      formattedText,
      originalText: text,
      contextType: contextType,
      appliedTransformations,
      confidence: this.calculateConfidence(contextType, applicationInfo),
    };
  }

  // Email formatting methods
  private formatEmailText(text: string): string {
    // Ensure professional tone and proper structure
    let formatted = text.trim();

    // Capitalize first letter
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    // Ensure proper punctuation
    if (formatted.length > 0 && !formatted.match(/[.!?]$/)) {
      formatted += ".";
    }

    return formatted;
  }

  private addEmailGreeting(text: string): string {
    const greetings = [
      "hi",
      "hello",
      "hey",
      "dear",
      "good morning",
      "good afternoon",
    ];
    const startsWithGreeting = greetings.some((greeting) =>
      text.toLowerCase().startsWith(greeting)
    );

    if (!startsWithGreeting && !text.toLowerCase().includes("@")) {
      // Don't add greeting if it's likely a reply or already has one
      return text;
    }

    return text;
  }

  private formatEmailSignature(text: string): string {
    // Add proper spacing before common signature words
    const signatureWords = [
      "best regards",
      "sincerely",
      "thanks",
      "thank you",
      "regards",
    ];

    for (const word of signatureWords) {
      if (text.toLowerCase().includes(word)) {
        return text.replace(
          new RegExp(word, "i"),
          `\n\n${word.charAt(0).toUpperCase() + word.slice(1)}`
        );
      }
    }

    return text;
  }

  // Notes formatting methods
  private formatAsBulletPoints(text: string): string {
    // Look for comma-separated items or "and" separated items
    if (text.includes(",") && text.split(",").length > 2) {
      const items = text.split(",").map((item) => item.trim());
      return items.map((item) => `• ${item}`).join("\n");
    }

    // Look for "and" separated items
    if (text.includes(" and ") && text.split(" and ").length > 2) {
      const items = text.split(" and ").map((item) => item.trim());
      return items.map((item) => `• ${item}`).join("\n");
    }

    return text;
  }

  private formatAsNumberedList(text: string): string {
    // Look for sequence indicators
    const sequenceWords = [
      "first",
      "second",
      "third",
      "then",
      "next",
      "finally",
      "step",
    ];
    const hasSequence = sequenceWords.some((word) =>
      text.toLowerCase().includes(word)
    );

    if (hasSequence) {
      // Simple implementation - split by common separators and number them
      const sentences = text.split(/[.!?]/).filter((s) => s.trim().length > 0);
      if (sentences.length > 1) {
        return sentences
          .map((sentence, index) => `${index + 1}. ${sentence.trim()}`)
          .join("\n");
      }
    }

    return text;
  }

  private formatAsHeaders(text: string): string {
    // Look for topic words that might be headers
    const headerWords = ["topic", "subject", "about", "regarding", "notes on"];

    for (const word of headerWords) {
      if (text.toLowerCase().includes(word)) {
        return `## ${text}`;
      }
    }

    // If text is short (likely a title/header)
    if (text.length < 50 && !text.includes(".")) {
      return `## ${text}`;
    }

    return text;
  }

  private formatAsTodoItems(text: string): string {
    // Look for action words
    const actionWords = [
      "need to",
      "should",
      "must",
      "remember to",
      "don't forget to",
      "todo",
    ];

    for (const word of actionWords) {
      if (text.toLowerCase().includes(word)) {
        return `- [ ] ${text}`;
      }
    }

    return text;
  }

  // Code formatting methods
  private formatAsCodeComment(text: string): string {
    // Format as a code comment
    return `// ${text}`;
  }

  private formatAsDocumentation(text: string): string {
    // Format as JSDoc-style documentation
    const lines = text.split(".").filter((line) => line.trim().length > 0);
    if (lines.length > 1) {
      return `/**\n * ${lines.join("\n * ")}\n */`;
    }
    return `/** ${text} */`;
  }

  // Messaging formatting methods
  private formatForMessaging(text: string): string {
    // Make text more casual and conversational
    let formatted = text.toLowerCase();

    // Remove overly formal language
    formatted = formatted.replace(/\bgood morning\b/g, "morning");
    formatted = formatted.replace(/\bgood afternoon\b/g, "afternoon");
    formatted = formatted.replace(/\bthank you very much\b/g, "thanks");

    // Capitalize first letter
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    return formatted;
  }

  private addContextualEmojis(text: string): string {
    const emojiMap: { [key: string]: string } = {
      thanks: " 🙏",
      "thank you": " 🙏",
      great: " 👍",
      awesome: " 🎉",
      good: " 👍",
      happy: " 😊",
      sad: " 😢",
      meeting: " 📅",
      done: " ✅",
      finished: " ✅",
      working: " 💪",
      coffee: " ☕",
      lunch: " 🍽️",
      food: " 🍽️",
    };

    let formatted = text;
    for (const [word, emoji] of Object.entries(emojiMap)) {
      if (text.toLowerCase().includes(word)) {
        formatted = formatted.replace(new RegExp(word, "i"), word + emoji);
        break; // Only add one emoji per message
      }
    }

    return formatted;
  }

  private breakLongMessages(text: string): string {
    if (text.length < 200) return text;

    // Break long messages at sentence boundaries
    const sentences = text.split(/[.!?]/).filter((s) => s.trim().length > 0);
    if (sentences.length > 1) {
      const midpoint = Math.ceil(sentences.length / 2);
      const firstHalf = sentences.slice(0, midpoint).join(". ");
      const secondHalf = sentences.slice(midpoint).join(". ");
      return `${firstHalf}.\n\n${secondHalf}.`;
    }

    return text;
  }

  // Document formatting methods
  private formatAsParagraphs(text: string): string {
    // Split long text into paragraphs at logical break points
    if (text.length < 200) return text;

    const sentences = text.split(/[.!?]/).filter((s) => s.trim().length > 0);
    if (sentences.length > 3) {
      const paragraphs: string[] = [];
      for (let i = 0; i < sentences.length; i += 3) {
        const paragraph = sentences.slice(i, i + 3).join(". ") + ".";
        paragraphs.push(paragraph);
      }
      return paragraphs.join("\n\n");
    }

    return text;
  }

  private capitalizeSentences(text: string): string {
    return text.replace(/(^|\. )([a-z])/g, (match, prefix, letter) => {
      return prefix + letter.toUpperCase();
    });
  }

  // Other formatting methods
  private formatForWeb(text: string): string {
    // Format for web forms - remove extra whitespace, ensure single line for short text
    return text.trim().replace(/\s+/g, " ");
  }

  private formatForTerminal(text: string): string {
    // Format for terminal - could be a command or comment
    if (text.length < 50 && !text.includes(" ")) {
      // Likely a command
      return text.toLowerCase();
    }
    // Likely a comment
    return ` ${text}`;
  }

  private formatForPresentation(text: string): string {
    // Format as presentation bullet points
    const sentences = text.split(/[.!?]/).filter((s) => s.trim().length > 0);
    if (sentences.length > 1) {
      return sentences.map((sentence) => `• ${sentence.trim()}`).join("\n");
    }
    return `• ${text}`;
  }

  private applyBasicFormatting(text: string): string {
    // Basic cleanup and formatting
    let formatted = text.trim();

    // Capitalize first letter
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    // Remove extra whitespace
    formatted = formatted.replace(/\s+/g, " ");

    return formatted;
  }

  /**
   * Calculate confidence score for the formatting
   */
  private calculateConfidence(
    contextType: ApplicationContextType,
    applicationInfo: ActiveApplicationInfo
  ): number {
    if (contextType === ApplicationContextType.UNKNOWN) {
      return 0.5;
    }

    // Higher confidence if we detected the context from bundle ID or direct mapping
    if (applicationInfo.bundleId) {
      return 0.9;
    }

    return 0.8;
  }

  /**
   * Update formatting options
   */
  public updateOptions(options: Partial<FormattingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current formatting options
   */
  public getOptions(): FormattingOptions {
    return { ...this.options };
  }

  /**
   * Enable/disable formatting for a specific context type
   */
  public toggleContextFormatting(
    contextType: ApplicationContextType,
    enabled: boolean
  ): void {
    const rule = this.formattingRules.get(contextType);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Enable/disable a specific transformation
   */
  public toggleTransformation(
    contextType: ApplicationContextType,
    transformationName: string,
    enabled: boolean
  ): void {
    const rule = this.formattingRules.get(contextType);
    if (rule) {
      const transformation = rule.transformations.find(
        (t) => t.name === transformationName
      );
      if (transformation) {
        transformation.enabled = enabled;
      }
    }
  }

  /**
   * Get all formatting rules
   */
  public getFormattingRules(): Map<ApplicationContextType, FormattingRule> {
    return new Map(this.formattingRules);
  }

  /**
   * Add user override for specific application
   */
  public addUserOverride(
    applicationName: string,
    contextType: ApplicationContextType
  ): void {
    this.options.userOverrides.set(applicationName.toLowerCase(), contextType);
  }

  /**
   * Remove user override
   */
  public removeUserOverride(applicationName: string): void {
    this.options.userOverrides.delete(applicationName.toLowerCase());
  }
}
