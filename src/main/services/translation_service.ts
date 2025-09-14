// translation_service.ts - Translation service using OpenAI
import { openai } from "../providers/openai";
import {
  ApplicationContextType,
  Settings,
  SpeechMetrics,
} from "../../shared/types";
import TextInsertionService from "./text_insertion_service";
import { calculateSpeechMetrics } from "../helpers/speech_analytics";
import { ApplicationDetector } from "./application_detector";
import { ApplicationContextService } from "./application_context_service";
import { DataLoaderService } from "./data_loader_service";
import { DictionaryService } from "./dictionary_service";
import { getLanguageDisplayName } from "../../shared/constants/languages";
import {
  hasProAccess,
  canUseWords,
} from "../../shared/utils/subscription-permissions";
// robotjs removed - using TextInsertionService clipboard method for better Unicode support

export class TranslationService {
  private static instance: TranslationService;
  private applicationDetector: ApplicationDetector;
  private applicationContextService: ApplicationContextService;
  private dataLoaderService: DataLoaderService | null = null;
  private textInsertionService: TextInsertionService;

  // Single language model configuration
  private readonly LANGUAGE_MODEL = "deepseek-ai/DeepSeek-V3.1";

  // Legacy application context to mode mapping for backward compatibility
  private readonly LEGACY_CONTEXT_TO_MODE_MAPPING = {
    [ApplicationContextType.EMAIL]: "gmail", // Default to Gmail for email context
    [ApplicationContextType.NOTES]: "notion", // Default to Notion for notes context
    [ApplicationContextType.MESSAGING]: "slack", // Default to Slack for messaging context
    [ApplicationContextType.CODE_EDITOR]: "vscode", // Default to VS Code for code context
    [ApplicationContextType.DOCUMENT]: "docs", // Default to Google Docs for documents
    [ApplicationContextType.PRESENTATION]: "keynote", // Default to Keynote for presentations
    [ApplicationContextType.BROWSER]: "default", // Default for browser
    [ApplicationContextType.TERMINAL]: "terminal", // Terminal context
    [ApplicationContextType.UNKNOWN]: "default", // fallback
  };

  constructor(
    dataLoaderService?: DataLoaderService,
    dictionaryService?: DictionaryService
  ) {
    this.applicationDetector = ApplicationDetector.getInstance();
    this.applicationContextService = ApplicationContextService.getInstance();
    this.dataLoaderService = dataLoaderService || null;
    this.textInsertionService = new TextInsertionService(dictionaryService);
  }

  public static getInstance(
    dataLoaderService?: DataLoaderService,
    dictionaryService?: DictionaryService
  ): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService(
        dataLoaderService,
        dictionaryService
      );
    } else if (
      dataLoaderService &&
      !TranslationService.instance.dataLoaderService
    ) {
      TranslationService.instance.dataLoaderService = dataLoaderService;
      // Update TextInsertionService with DictionaryService if provided
      if (dictionaryService) {
        TranslationService.instance.textInsertionService =
          new TextInsertionService(dictionaryService);
      }
    }
    return TranslationService.instance;
  }

  /**
   * Main text processing pipeline - handles complete language model processing
   * @param transcript Raw transcript from STT service
   * @param recordingDuration Duration of the recording for metrics
   * @param onComplete Callback when processing and insertion is complete
   */
  async processText(
    transcript: string,
    recordingDuration: number,
    onComplete?: (
      metrics: SpeechMetrics,
      finalText: string,
      metadata: any
    ) => void
  ): Promise<void> {
    if (!transcript || transcript.trim().length === 0) {
      console.log("[Translation] Empty transcript received");
      return;
    }

    // Get current settings from DataLoaderService
    if (!this.dataLoaderService) {
      console.error("[Translation] DataLoaderService not available");
      return;
    }

    const settings: Settings = this.dataLoaderService.getUserSettings();
    const userData = this.dataLoaderService.getCurrentUser();
    const sourceLanguage: string = settings.language;

    // Check Pro access for features
    const canUseAI = hasProAccess(userData, "ai_enhancement");
    const canTranslate = hasProAccess(userData, "translation");
    const canUseCustomModes = hasProAccess(userData, "custom_modes");
    const wordUsage = canUseWords(userData, this.countWords(transcript));

    console.log("[Translation] Pro access check:", {
      canUseAI,
      canTranslate,
      canUseCustomModes,
      wordUsage: wordUsage.allowed,
      wordsInTranscript: this.countWords(transcript),
    });

    // Stop processing if word limit exceeded
    if (!wordUsage.allowed) {
      console.warn("[Translation] Word limit exceeded, skipping processing");
      return;
    }

    console.log("[Translation] Using settings from DataLoaderService:", {
      language: settings.language,
      targetLanguage: settings.targetLanguage,
      enableTranslation: settings.enableTranslation && canTranslate,
      useAI: settings.useAI && canUseAI,
    });

    console.log("[Translation] Processing transcript:", transcript);
    console.log("[Translation] Source language:", sourceLanguage);

    try {
      // Get auto-detected application mode if enabled and user has Pro access
      let selectedApplicationMode = settings.selectedApplicationMode || "default";
      if (settings.enableAutoDetection && canUseCustomModes) {
        try {
          const applicationContext = await this.applicationContextService.getCurrentApplicationContext();
          if (applicationContext && applicationContext.confidence > 0.3) {
            selectedApplicationMode = applicationContext.applicationId;
            console.log("[Translation] Auto-detected application:", {
              applicationId: applicationContext.applicationId,
              displayName: applicationContext.displayName,
              confidence: applicationContext.confidence
            });
          } else {
            console.log("[Translation] Low confidence detection, using fallback application:", selectedApplicationMode);
          }
        } catch (error) {
          console.warn(
            "[Translation] Application auto-detection failed, using fallback:",
            selectedApplicationMode,
            error
          );
        }
      }

      // Get application-specific prompt (only when auto-detection is enabled and user has Pro access)
      let applicationSpecificPrompt: string | null = null;
      if (settings.enableAutoDetection && canUseCustomModes) {
        if (selectedApplicationMode === "custom") {
          applicationSpecificPrompt = settings.customPrompt;
        } else if (selectedApplicationMode) {
          const applicationPromptMap = {
            slack: settings.slackPrompt,
            discord: settings.discordPrompt,
            whatsapp: settings.whatsappPrompt,
            telegram: settings.telegramPrompt,
            teams: settings.teamsPrompt,
            messages: settings.messagesPrompt,
            notion: settings.notionPrompt,
            obsidian: settings.obsidianPrompt,
            logseq: settings.logseqPrompt,
            roam: settings.roamPrompt,
            notes: settings.notesPrompt,
            evernote: settings.evernotePrompt,
            bear: settings.bearPrompt,
            gmail: settings.gmailPrompt,
            outlook: settings.outlookPrompt,
            mail: settings.mailPrompt,
            vscode: settings.vscodePrompt,
            xcode: settings.xcodePrompt,
            webstorm: settings.webstormPrompt,
            sublime: settings.sublimePrompt,
            word: settings.wordPrompt,
            pages: settings.pagesPrompt,
            docs: settings.docsPrompt,
            'browser-github': settings.browserGithubPrompt,
            'browser-stackoverflow': settings.browserStackoverflowPrompt,
            'browser-twitter': settings.browserTwitterPrompt,
            'browser-linkedin': settings.browserLinkedinPrompt,
          };
          const promptForApplication =
            applicationPromptMap[selectedApplicationMode as keyof typeof applicationPromptMap];
          console.log("[Translation] Application-specific prompt for", selectedApplicationMode, ":", promptForApplication);

          if (promptForApplication && promptForApplication.trim()) {
            applicationSpecificPrompt = promptForApplication;
          } else {
            // Fallback to getting default prompt from application context service
            const appContext = this.applicationContextService.getApplicationContextById(selectedApplicationMode);
            if (appContext) {
              applicationSpecificPrompt = appContext.prompt;
              console.log("[Translation] Using default prompt for", selectedApplicationMode);
            }
          }
        }
      } else {
        console.log(
          "[Translation] Auto-detection disabled, skipping application-specific formatting"
        );
      }

      // Build optimized prompt for better LLM performance
      let activePrompt = `You are a transcript post-processor. Process the following text according to these instructions:

## WHAT TO CHANGE:
${settings.language !== settings.targetLanguage && settings.enableTranslation && canTranslate ? `- Translate from ${getLanguageDisplayName(settings.language)} to ${getLanguageDisplayName(settings.targetLanguage)}` : "- Keep original language"}
- Fix spelling errors and typos
- Correct grammar mistakes
- Add proper punctuation and capitalization
- Convert emoji words to actual emojis (e.g., "fire emoji" → "🔥", "heart emoji" → "❤️")
- Convert it to clean and proper text which convey the same meaning
- Convert or restructure the text to make it more sensible 
- Change the words in the text from the context of whole sentence which seems illogical

## WHAT TO PRESERVE:
- Original meaning and intent
- Question format (questions stay as questions)
- Statement format (statements stay as statements)
- Technical terms and proper nouns
- Numbers and dates exactly as spoken

## WHAT NOT TO CHANGE:
- Never answer questions - only fix their grammar/punctuation
- Never add information not in the original
- Never change the core message or tone
- Never convert statements to questions or vice versa

## OUTPUT FORMAT:
Return ONLY the processed text. No explanations, no additional comments.`;

      // Add application-specific formatting if available
      if (applicationSpecificPrompt && applicationSpecificPrompt.trim()) {
        activePrompt += `

## APPLICATION-SPECIFIC FORMATTING (${selectedApplicationMode?.toUpperCase()} MODE):
${applicationSpecificPrompt}

Note: Apply above formatting ONLY to statements. Questions must remain questions with proper punctuation.`;
      }

      activePrompt += `

## EXAMPLES:
Input: "how is weather today"
Output: "How is the weather today?"

Input: "weather is good fire emoji"
Output: "The weather is good. 🔥"

Input: "send email to john about meeting tomorrow"
Output: "Send email to John about meeting tomorrow."

Input: "umm, I will be there at 5, sorry no 6."
Output: "I will be there at 6."

---

Text to process: "${transcript}"
`;

      const response = await openai().chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [
          {
            role: "user",
            content: activePrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: Math.max(300, this.countWords(transcript) * 2), // Optimized token limit
      });

      const finalText = response.choices[0].message.content;
      console.log("[Translation] Raw LLM response:", finalText);

      // Calculate metrics and build metadata (can be done in parallel)
      const metrics = calculateSpeechMetrics(finalText, recordingDuration);
      console.log("[Translation] Metrics:", metrics);

      // Build comprehensive metadata immediately
      const wasTranslated =
        settings.enableTranslation &&
        canTranslate &&
        settings.targetLanguage &&
        sourceLanguage !== settings.targetLanguage;

      console.log("[Translation] Metadata build:", {
        enableTranslation: settings.enableTranslation,
        canTranslate,
        targetLanguage: settings.targetLanguage,
        sourceLanguage,
        languagesDiffer: sourceLanguage !== settings.targetLanguage,
        wasTranslated,
      });

      const translationMeta = wasTranslated
        ? {
            wasTranslated: true,
            originalText: transcript,
            sourceLanguage: sourceLanguage,
            targetLanguage: settings.targetLanguage,
            confidence: 0.9, // High confidence for unified LLM approach
            wordCountRatio:
              this.countWords(transcript) === 0
                ? 1.0
                : this.countWords(finalText) / this.countWords(transcript),
            detectedLanguage: sourceLanguage,
          }
        : { wasTranslated: false, detectedLanguage: sourceLanguage };

      const applicationFormattingMeta =
        settings.enableAutoDetection && canUseCustomModes
          ? {
              applicationBasedFormattingApplied: !!applicationSpecificPrompt,
              selectedApplicationMode: selectedApplicationMode,
              autoDetectionEnabled: settings.enableAutoDetection,
              customPromptUsed:
                selectedApplicationMode === "custom" &&
                !!settings.customPrompt?.trim(),
              // Application-based formatting applied
              modeBasedFormattingApplied: !!applicationSpecificPrompt,
            }
          : { 
              applicationBasedFormattingApplied: false,
              modeBasedFormattingApplied: false 
            };

      const combinedMeta = {
        ...translationMeta,
        ...applicationFormattingMeta,
      };

      // PRIORITY: Insert text immediately with minimal delay
      this.insertTextNative(finalText, () => {
        // Fire callback immediately after text insertion
        if (onComplete) {
          onComplete(metrics, finalText, combinedMeta);
        }
      });

      // PARALLEL: Run background operations concurrently (don't await)
      this.runBackgroundOperations(userData, finalText).catch(error => {
        console.error("[Translation] Background operations failed:", error);
      });
    } catch (error) {
      console.error("[Translation] Error in text processing pipeline:", error);
    }
  }

  /**
   * Run background operations in parallel (word usage updates, etc.)
   */
  private async runBackgroundOperations(
    userData: any,
    finalText: string
  ): Promise<void> {
    const wordCount = this.countWords(finalText);
    
    if (userData && userData.subscription_tier === "free" && wordCount > 0) {
      try {
        // This runs in background - no need to block text insertion
        await this.dataLoaderService.updateWordUsage(wordCount);
        console.log(`[Translation] Background: Updated word usage: +${wordCount} words`);
      } catch (error) {
        console.error("[Translation] Background: Failed to update word usage:", error);
      }
    }
  }

  private countWords(text: string): number {
    // Handle null, undefined, or empty strings
    if (!text || typeof text !== "string" || !text.trim()) {
      return 0;
    }

    try {
      // Handle different languages appropriately
      const cleanText = text
        .trim()
        .replace(
          /[^\w\s\u00C0-\u024F\u1E00-\u1EFF\u0100-\u017F\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
          " "
        );

      // For CJK characters, count each character as a word
      const cjkRegex = /[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/g;
      const cjkMatches = cleanText.match(cjkRegex);
      const cjkCount = cjkMatches ? cjkMatches.length : 0;

      // For other languages, split by spaces
      const nonCjkText = cleanText.replace(cjkRegex, " ");
      const wordMatches = nonCjkText.match(/\S+/g);
      const wordCount = wordMatches ? wordMatches.length : 0;

      const totalWords = cjkCount + wordCount;

      // Ensure we never return negative numbers or NaN
      return isNaN(totalWords) || totalWords < 0 ? 0 : totalWords;
    } catch (error) {
      console.error("[Translation] Error counting words:", error);
      return 0; // Fallback to 0 on any error
    }
  }

  private getLanguageNames(): Record<string, string> {
    return {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ru: "Russian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      hi: "Hindi",
      ur: "Urdu",
      ta: "Tamil",
      te: "Telugu",
      bn: "Bengali",
      gu: "Gujarati",
      kn: "Kannada",
      ml: "Malayalam",
      pa: "Punjabi",
      ar: "Arabic",
      he: "Hebrew",
      th: "Thai",
      vi: "Vietnamese",
      nl: "Dutch",
      sv: "Swedish",
      no: "Norwegian",
      da: "Danish",
      fi: "Finnish",
      pl: "Polish",
      cs: "Czech",
      hu: "Hungarian",
      ro: "Romanian",
      bg: "Bulgarian",
      hr: "Croatian",
      sk: "Slovak",
      sl: "Slovenian",
      et: "Estonian",
      lv: "Latvian",
      lt: "Lithuanian",
      mt: "Maltese",
      cy: "Welsh",
      ga: "Irish",
      is: "Icelandic",
      mk: "Macedonian",
      sq: "Albanian",
      sr: "Serbian",
      bs: "Bosnian",
      me: "Montenegrin",
      tr: "Turkish",
      fa: "Persian",
      sw: "Swahili",
      zu: "Zulu",
      af: "Afrikaans",
      am: "Amharic",
      az: "Azerbaijani",
      be: "Belarusian",
      ca: "Catalan",
      eu: "Basque",
      gl: "Galician",
      ka: "Georgian",
      hy: "Armenian",
      id: "Indonesian",
      ms: "Malay",
      tl: "Filipino",
      mn: "Mongolian",
      ne: "Nepali",
      si: "Sinhala",
      my: "Myanmar",
      km: "Khmer",
      lo: "Lao",
      kk: "Kazakh",
      ky: "Kyrgyz",
      tg: "Tajik",
      tk: "Turkmen",
      uz: "Uzbek",
    };
  }

  /**
   * Get grammar instructions for specific language
   */
  private getGrammarInstructions(language: string): string {
    const instructions: Record<string, string> = {
      hi: "The text is in Hindi. Maintain proper Devanagari script and Hindi grammar rules.",
      ur: "The text is in Urdu. Maintain proper Urdu script and grammar rules.",
      en: "The text is in English. Use proper English grammar and punctuation.",
      es: "The text is in Spanish. Maintain proper Spanish script and grammar rules.",
      fr: "The text is in French. Maintain proper French script and grammar rules.",
      ta: "The text is in Tamil. Maintain proper Tamil script and grammar rules.",
      te: "The text is in Telugu. Maintain proper Telugu script and grammar rules.",
      bn: "The text is in Bengali. Maintain proper Bengali script and grammar rules.",
      gu: "The text is in Gujarati. Maintain proper Gujarati script and grammar rules.",
      kn: "The text is in Kannada. Maintain proper Kannada script and grammar rules.",
      ml: "The text is in Malayalam. Maintain proper Malayalam script and grammar rules.",
      pa: "The text is in Punjabi. Maintain proper Punjabi script and grammar rules.",
    };

    return (
      instructions[language] || "Maintain the original language of the text."
    );
  }

  /**
   * Insert text using native platform APIs
   */
  private async insertTextNative(text: string, onComplete?: () => void) {
    try {
      console.log(
        "[Translation] Inserting text via clipboard method (better Unicode support):",
        text
      );

      // Use TextInsertionService which will use clipboard method for better Unicode support
      const success = await this.textInsertionService.insertText(text, {
        delay: 50, // Reduced delay for faster insertion
        preserveClipboard: true, // Preserve user's clipboard content
      });

      if (success) {
        console.log(
          "[Translation] Text inserted successfully via clipboard method"
        );
      } else {
        console.warn(
          "[Translation] Text insertion failed via clipboard method"
        );
      }

      // Fire callback when text insertion is complete (success or failure)
      onComplete?.();
    } catch (error) {
      console.error(
        "[Translation] Error inserting text with native APIs:",
        error
      );
      // Still fire callback even if there's an error
      onComplete?.();
    }
  }
}

export default TranslationService;
