// translation_service.ts - Translation service using OpenAI
import { openai } from "../providers/openai";
import {
  TranslationResult,
  ApplicationContextType,
  Settings,
  SpeechMetrics,
} from "../../shared/types";
import TextInsertionService from "./text_insertion_service";
import { calculateSpeechMetrics } from "../helpers/speech_analytics";
import { ApplicationDetector } from "./application_detector";
import { DataLoaderService } from "./data_loader_service";
import { DictionaryService } from "./dictionary_service";
import { getLanguageDisplayName } from "../../shared/constants/languages";
import { hasProAccess, canUseWords } from "../../shared/utils/subscription-permissions";
// robotjs removed - using TextInsertionService clipboard method for better Unicode support

export class TranslationService {
  private static instance: TranslationService;
  private applicationDetector: ApplicationDetector;
  private dataLoaderService: DataLoaderService | null = null;
  private textInsertionService: TextInsertionService;

  // Single language model configuration
  private readonly LANGUAGE_MODEL = "deepseek-ai/DeepSeek-V3.1";

  // Application context to mode mapping for auto-detection
  private readonly CONTEXT_TO_MODE_MAPPING = {
    [ApplicationContextType.EMAIL]: "email",
    [ApplicationContextType.NOTES]: "notes",
    [ApplicationContextType.MESSAGING]: "messages",
    [ApplicationContextType.CODE_EDITOR]: "code_comments",
    [ApplicationContextType.DOCUMENT]: "notes",
    [ApplicationContextType.PRESENTATION]: "meeting_notes",
    [ApplicationContextType.BROWSER]: "notes",
    [ApplicationContextType.TERMINAL]: "code_comments",
    [ApplicationContextType.UNKNOWN]: "notes", // fallback
  };

  constructor(dataLoaderService?: DataLoaderService, dictionaryService?: DictionaryService) {
    this.applicationDetector = ApplicationDetector.getInstance();
    this.dataLoaderService = dataLoaderService || null;
    this.textInsertionService = new TextInsertionService(dictionaryService);
  }

  public static getInstance(
    dataLoaderService?: DataLoaderService,
    dictionaryService?: DictionaryService
  ): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService(dataLoaderService, dictionaryService);
    } else if (
      dataLoaderService &&
      !TranslationService.instance.dataLoaderService
    ) {
      TranslationService.instance.dataLoaderService = dataLoaderService;
      // Update TextInsertionService with DictionaryService if provided
      if (dictionaryService) {
        TranslationService.instance.textInsertionService = new TextInsertionService(dictionaryService);
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
      wordsInTranscript: this.countWords(transcript)
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
      // Get auto-detected mode if enabled and user has Pro access
      let selectedMode = settings.selectedMode;
      if (settings.enableAutoDetection && canUseCustomModes) {
        try {
          const activeApp =
            await this.applicationDetector.getActiveApplication();
          const detectedMode =
            this.CONTEXT_TO_MODE_MAPPING[activeApp.contextType];
          if (detectedMode) {
            selectedMode = detectedMode;
            console.log("[Translation] Auto-detected mode:", detectedMode);
          }
        } catch (error) {
          void error; // Variable acknowledged for error handling
          console.warn(
            "[Translation] Auto-detection failed, using fallback mode:",
            selectedMode
          );
        }
      }

      // Get mode-specific prompt (only when auto-detection is enabled and user has Pro access)
      let modeSpecificPrompt: string | null = null;
      if (settings.enableAutoDetection && canUseCustomModes) {
        if (selectedMode === "custom") {
          modeSpecificPrompt = settings.customPrompt;
        } else if (selectedMode) {
          const modePromptMap = {
            notes: settings.notesPrompt,
            messages: settings.messagesPrompt,
            email: settings.emailsPrompt,
            code_comments: settings.codeCommentsPrompt,
            meeting_notes: settings.meetingNotesPrompt,
            creative_writing: settings.creativeWritingPrompt,
          };
          const promptForMode =
            modePromptMap[selectedMode as keyof typeof modePromptMap];
          console.log("[Translation] Mode-specific prompt:", promptForMode);

          if (promptForMode && promptForMode.trim()) {
            modeSpecificPrompt = promptForMode;
          }
        }
      } else {
        console.log(
          "[Translation] Auto-detection disabled, skipping mode-specific formatting"
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

      // Add mode-specific formatting if available
      if (modeSpecificPrompt && modeSpecificPrompt.trim()) {
        activePrompt += `

## CONTEXT-SPECIFIC FORMATTING (${selectedMode?.toUpperCase()} MODE):
${modeSpecificPrompt}

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

      const response = await openai.chat.completions.create({
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

      // Parse the response to extract only the final processed text
      //   finalText = this.extractFinalText(finalText);
      //   console.log("[Translation] Extracted final text:", finalText);

      // DEPRECATED: Old two-step translation process replaced with single LLM call
      // The following code was used for separate translation and grammar correction steps
      // Now using single unified prompt for better performance and consistency

      /* DEPRECATED - Old translation logic:
      if (
        settings.enableTranslation &&
        settings.targetLanguage &&
        sourceLanguage !== settings.targetLanguage
      ) {
        console.log(
          `[Translation] Translation enabled: ${sourceLanguage} -> ${settings.targetLanguage}`
        );
        translationResult = await this.translateTextOptimized(
          transcript,
          settings.targetLanguage,
          sourceLanguage
        );
        processedText = translationResult.translatedText;
        console.log("[Translation] Translated text:", processedText);
      } else {
        console.log(
          "[Translation] No translation needed, keeping original language"
        );
      }

      // DEPRECATED - Old grammar correction logic:
      const finalLanguage =
        settings.enableTranslation && settings.targetLanguage
          ? settings.targetLanguage
          : sourceLanguage;
      const finalText = settings.useAI
        ? await this.correctGrammarOptimized(
            processedText,
            finalLanguage,
            settings
          )
        : processedText;

      console.log("[Translation] Final text:", finalText);
      */

      // Step 4: Calculate metrics
      const metrics = calculateSpeechMetrics(finalText, recordingDuration);
      console.log("[Translation] Metrics:", metrics);

      // Step 4.5: Update word usage for non-Pro users
      const wordCount = this.countWords(finalText);
      if (userData && userData.subscription_tier === "free" && wordCount > 0) {
        try {
          await this.dataLoaderService.updateWordUsage(wordCount);
          console.log(`[Translation] Updated word usage: +${wordCount} words`);
        } catch (error) {
          console.error("[Translation] Failed to update word usage:", error);
        }
      }

      // Step 5: Insert text and fire callback after insertion completes
      this.insertTextNative(finalText, () => {
        if (onComplete) {
          // Build comprehensive metadata
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

          const modeFormattingMeta = settings.enableAutoDetection && canUseCustomModes
            ? {
                modeBasedFormattingApplied: !!modeSpecificPrompt,
                selectedMode: selectedMode,
                autoDetectionEnabled: settings.enableAutoDetection,
                customPromptUsed:
                  selectedMode === "custom" && !!settings.customPrompt?.trim(),
              }
            : { modeBasedFormattingApplied: false };

          const combinedMeta = {
            ...translationMeta,
            ...modeFormattingMeta,
          };

          onComplete(metrics, finalText, combinedMeta);
        }
      });
    } catch (error) {
      console.error("[Translation] Error in text processing pipeline:", error);
    }
  }

  /**
   * @deprecated Optimized translation - focused purely on accurate translation
   * This method is no longer used in the current implementation.
   * Translation is now handled by a single unified LLM prompt for better performance.
   */
  private async translateTextOptimized(
    text: string,
    targetLanguage: string,
    sourceLanguage: string
  ): Promise<TranslationResult> {
    try {
      if (!text.trim()) {
        throw new Error("Text cannot be empty");
      }

      const languageNames = this.getLanguageNames();
      const sourceName = languageNames[sourceLanguage] || sourceLanguage;
      const targetName = languageNames[targetLanguage] || targetLanguage;

      console.log(
        `[Translation] Translating from ${sourceName} to ${targetName}: "${text}"`
      );

      // Optimized translation prompt - pure focus on accuracy
      const prompt = `Translate this ${sourceName} text to ${targetName}. Preserve exact meaning and context.

CRITICAL RULES:
- Maintain 100% semantic accuracy
- Preserve cultural context and idioms appropriately
- Keep similar word count (±20%)
- For proper nouns, preserve original terms when appropriate
- Never change the text structure (question stays question, statement stays statement)

Return ONLY the translation, nothing else.`;

      const response = await openai.chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [
          { role: "user", content: text },
          { role: "system", content: prompt },
        ],
        temperature: 0.1, // Low temperature for consistency
        max_tokens: Math.max(200, this.countWords(text) * 3), // Optimized token limit
      });

      const translatedText =
        response.choices[0]?.message?.content?.trim() || text;

      // Calculate metrics
      const originalWords = this.countWords(text);
      const translatedWords = this.countWords(translatedText);
      const wordCountRatio =
        originalWords === 0 ? 1.0 : translatedWords / originalWords;
      const confidence =
        response.choices[0].finish_reason === "stop" ? 0.95 : 0.7;

      console.log(
        `[Translation] Result: "${translatedText}" (confidence: ${confidence}, ratio: ${wordCountRatio.toFixed(2)})`
      );

      return {
        translatedText,
        sourceLanguage,
        targetLanguage,
        originalText: text,
        confidence,
        wordCountRatio,
        detectedLanguage: sourceLanguage,
      };
    } catch (error) {
      console.error("[Translation] Error in optimized translation:", error);
      return {
        translatedText: text,
        sourceLanguage: sourceLanguage,
        targetLanguage,
        originalText: text,
        confidence: 0.0,
        wordCountRatio: 1.0,
        detectedLanguage: sourceLanguage,
      };
    }
  }

  /**
   * @deprecated Optimized grammar correction with mode-based formatting
   * This method is no longer used in the current implementation.
   * Grammar correction and formatting is now handled by a single unified LLM prompt.
   */
  private async correctGrammarOptimized(
    text: string,
    language: string,
    settings: Settings
  ): Promise<string> {
    try {
      const languageNames = this.getLanguageNames();
      const languageName = languageNames[language] || language;
      void languageName; // Variable acknowledged but not used in current implementation

      const grammerInstruction = this.getGrammarInstructions(language);

      // Build optimized prompt
      let prompt = `You are a grammar and spelling corrector. Your ONLY task is to fix spelling errors, grammar mistakes, and add proper punctuation. ${grammerInstruction}

	  CRITICAL RULES:
	  1. NEVER answer questions - if input is a question, output must remain a question
	  2. NEVER provide information or explanations  
	  3. NEVER change the meaning or intent of the text
	  4. NEVER add context or additional information
	  5. If input is a statement, output must remain a statement
	  6. If input is a question, output must remain a question
	  7. Read the input text carefully and understand the context and intent of the text and try to correct some of the words to make it more accurate
	  
	  ALLOWED CORRECTIONS:
	  - Fix spelling errors
	  - Correct grammar mistakes  
	  - Add necessary punctuation (periods, commas, capitalization)
	  - Convert emoji references to actual emojis (e.g., "fire emoji" → 🔥)
	  
	  EXAMPLES:
	  - Input: "how is weather today" → Output: "How is the weather today?"
	  - Input: "weather is good" → Output: "The weather is good."
	  - Input: "मौसम कैसा है" → Output: "मौसम कैसा है?" (fix punctuation, preserve question)
	  
	  Return ONLY the corrected text, nothing else.`;

      // Add mode-based formatting if enabled
      let selectedMode = settings.selectedMode;
      if (settings.enableAutoDetection) {
        try {
          const activeApp =
            await this.applicationDetector.getActiveApplication();
          const detectedMode =
            this.CONTEXT_TO_MODE_MAPPING[activeApp.contextType];
          if (detectedMode) {
            selectedMode = detectedMode;
            console.log("[Translation] Auto-detected mode:", detectedMode);
          }
        } catch (error) {
          void error; // Variable acknowledged for error handling
          console.warn(
            "[Translation] Auto-detection failed, using fallback mode:",
            selectedMode
          );
        }

        // Get mode-specific prompt
        let activePrompt = settings.customPrompt;
        if (selectedMode && selectedMode !== "custom") {
          const modePromptMap = {
            notes: settings.notesPrompt,
            messages: settings.messagesPrompt,
            email: settings.emailsPrompt,
            code_comments: settings.codeCommentsPrompt,
            meeting_notes: settings.meetingNotesPrompt,
            creative_writing: settings.creativeWritingPrompt,
          };
          const modeSpecificPrompt =
            modePromptMap[selectedMode as keyof typeof modePromptMap];
          console.log(
            "[Translation] Mode-specific prompt:",
            modeSpecificPrompt
          );

          if (modeSpecificPrompt && modeSpecificPrompt.trim()) {
            activePrompt = modeSpecificPrompt;
          }
        }

        if (activePrompt && activePrompt.trim()) {
          prompt += `\n\nADDITIONAL FORMATTING: ${activePrompt}
IMPORTANT: Apply formatting ONLY to statements, NOT to questions. Questions must remain as questions.`;
        }
      }

      const response = await openai.chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [
          { role: "user", content: text },
          { role: "system", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: Math.max(300, this.countWords(text) * 2), // Optimized token limit
      });

      const correctedText =
        response.choices[0]?.message?.content?.trim() || text;

      console.log("[Translation] Grammar correction applied:", {
        original: text,
        corrected: correctedText,
        mode: selectedMode,
      });

      return correctedText;
    } catch (error) {
      console.error(
        "[Translation] Error in optimized grammar correction:",
        error
      );
      return text;
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
        delay: 100, // Small delay to ensure target application is ready
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
