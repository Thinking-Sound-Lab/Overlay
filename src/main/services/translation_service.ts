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

export class TranslationService {
  private static instance: TranslationService;
  private applicationDetector: ApplicationDetector;
  private dataLoaderService: DataLoaderService | null = null;
  private textInsertionService: TextInsertionService;

  // Single language model configuration
  private readonly LANGUAGE_MODEL = "gpt-4.1";

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

  constructor(dataLoaderService?: DataLoaderService) {
    this.applicationDetector = ApplicationDetector.getInstance();
    this.dataLoaderService = dataLoaderService || null;
    this.textInsertionService = new TextInsertionService();
  }

  public static getInstance(
    dataLoaderService?: DataLoaderService
  ): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService(dataLoaderService);
    } else if (
      dataLoaderService &&
      !TranslationService.instance.dataLoaderService
    ) {
      TranslationService.instance.dataLoaderService = dataLoaderService;
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
    const sourceLanguage: string = settings.language;

    console.log("[Translation] Using settings from DataLoaderService:", {
      language: settings.language,
      targetLanguage: settings.targetLanguage,
      enableTranslation: settings.enableTranslation,
      useAI: settings.useAI,
    });

    console.log("[Translation] Processing transcript:", transcript);
    console.log("[Translation] Source language:", sourceLanguage);

    try {
      let processedText = transcript;

      // Optimized two-step process for better accuracy
      // Step 1: Translation (if needed) - focused on accuracy
      let translationResult: TranslationResult | null = null;
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

      // Step 2: Grammar correction and formatting (if AI enhancement is enabled)
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

      // Step 4: Calculate metrics
      const metrics = calculateSpeechMetrics(finalText, recordingDuration);
      console.log("[Translation] Metrics:", metrics);

      // Step 5: Insert text and fire callback after insertion completes
      this.insertTextNative(finalText, () => {
        if (onComplete) {
          // Build comprehensive metadata
          const wasTranslated =
            settings.enableTranslation &&
            settings.targetLanguage &&
            sourceLanguage !== settings.targetLanguage &&
            translationResult !== null;
          
          console.log("[Translation] Metadata build:", {
            enableTranslation: settings.enableTranslation,
            targetLanguage: settings.targetLanguage,
            sourceLanguage,
            languagesDiffer: sourceLanguage !== settings.targetLanguage,
            hasTranslationResult: translationResult !== null,
            wasTranslated
          });

          const translationMeta = wasTranslated
            ? {
                wasTranslated: true,
                originalText: transcript,
                sourceLanguage: sourceLanguage,
                targetLanguage: settings.targetLanguage,
                confidence: translationResult.confidence,
                wordCountRatio: translationResult.wordCountRatio,
                detectedLanguage: translationResult.detectedLanguage,
              }
            : { wasTranslated: false, detectedLanguage: sourceLanguage };

          const modeFormattingMeta = settings.enableAutoDetection
            ? {
                modeBasedFormattingApplied: true,
                selectedMode: settings.selectedMode,
                autoDetectionEnabled: settings.enableAutoDetection,
                customPromptUsed: !!settings.customPrompt?.trim(),
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
   * Optimized translation - focused purely on accurate translation
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

Text: "${text}"

Return ONLY the translation, nothing else.`;

      const response = await openai.chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
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
   * Optimized grammar correction with mode-based formatting
   */
  private async correctGrammarOptimized(
    text: string,
    language: string,
    settings: Settings
  ): Promise<string> {
    try {
      const languageNames = this.getLanguageNames();
      const languageName = languageNames[language] || language;

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
	  
	  ALLOWED CORRECTIONS:
	  - Fix spelling errors
	  - Correct grammar mistakes  
	  - Add necessary punctuation (periods, commas, capitalization)
	  - Convert emoji references to actual emojis (e.g., "fire emoji" → 🔥)
	  
	  EXAMPLES:
	  - Input: "how is weather today" → Output: "How is the weather today?"
	  - Input: "weather is good" → Output: "The weather is good."
	  - Input: "मौसम कैसा है" → Output: "मौसम कैसा है?" (fix punctuation, preserve question)

	  TEXT: "${text}"
	  
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
        messages: [{ role: "user", content: prompt }],
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

  /**
   * Unified AI text processing - handles translation, grammar correction, and formatting in a single call
   * @deprecated - Replaced with optimized two-step process for better accuracy
   */
  private async processTextUnified(
    text: string,
    sourceLanguage: string,
    settings: Settings
  ): Promise<{
    processedText: string;
    wasTranslated: boolean;
    confidence: number;
    wordCountRatio: number;
    detectedLanguage: string;
  }> {
    try {
      const needsTranslation =
        settings.enableTranslation &&
        settings.targetLanguage &&
        sourceLanguage !== settings.targetLanguage;

      const finalLanguage = needsTranslation
        ? settings.targetLanguage
        : sourceLanguage;
      const languageNames = this.getLanguageNames();
      const sourceName = languageNames[sourceLanguage] || sourceLanguage;
      const targetName = languageNames[finalLanguage] || finalLanguage;

      // Build comprehensive system prompt
      let systemPrompt = `You are an expert text processor that handles translation, grammar correction, and formatting simultaneously.

PROCESSING REQUIREMENTS:

1. LANGUAGE PROCESSING:
   - Source language: ${sourceName}
   - Target language: ${targetName}`;

      if (needsTranslation) {
        systemPrompt += `
   - TRANSLATE the text from ${sourceName} to ${targetName}
   - Preserve exact meaning and cultural context
   - Maintain similar word count (±20%)`;
      } else {
        systemPrompt += `
   - MAINTAIN the original ${sourceName} language
   - No translation needed`;
      }

      systemPrompt += `

2. GRAMMAR & SPELLING CORRECTION:
   - Fix all spelling errors
   - Correct grammar mistakes
   - Add proper punctuation and capitalization
   - Convert emoji references to actual emojis (e.g., "fire emoji" → 🔥)

3. PRESERVE ORIGINAL INTENT:
   - NEVER change the meaning or intent
   - If input is a question, output must remain a question
   - If input is a statement, output must remain a statement
   - NEVER add explanations or additional information`;

      // Add mode-based formatting instructions
      let formattingInstructions = "";
      let selectedMode = settings.selectedMode;

      if (settings.useAI && settings.enableAutoDetection) {
        try {
          const activeApp =
            await this.applicationDetector.getActiveApplication();
          const detectedMode =
            this.CONTEXT_TO_MODE_MAPPING[activeApp.contextType];
          if (detectedMode) {
            selectedMode = detectedMode;
            console.log(
              "[Translation] Auto-detected mode:",
              detectedMode,
              "for app:",
              activeApp.applicationName
            );
          }
        } catch (error) {
          console.warn(
            "[Translation] Auto-detection failed, using fallback mode:",
            selectedMode
          );
        }

        // Get the appropriate prompt
        let activePrompt = settings.customPrompt;
        if (selectedMode && selectedMode !== "custom") {
          const modePromptMap = {
            notes: settings.notesPrompt,
            messages: settings.messagesPrompt,
            emails: settings.emailsPrompt,
            code_comments: settings.codeCommentsPrompt,
            meeting_notes: settings.meetingNotesPrompt,
            creative_writing: settings.creativeWritingPrompt,
          };
          const modeSpecificPrompt =
            modePromptMap[selectedMode as keyof typeof modePromptMap];
          if (modeSpecificPrompt && modeSpecificPrompt.trim()) {
            activePrompt = modeSpecificPrompt;
          }
        }

        if (activePrompt && activePrompt.trim()) {
          formattingInstructions = `

4. ADDITIONAL FORMATTING:
${activePrompt}

IMPORTANT: Apply formatting instructions only AFTER translation and grammar correction. The original meaning must be preserved.`;
        }
      }

      const finalPrompt =
        systemPrompt +
        formattingInstructions +
        `

INPUT TEXT: "${text}"

OUTPUT: Return ONLY the processed text, nothing else.`;

      const response = await openai.chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [
          {
            role: "user",
            content: finalPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: Math.max(1000, this.countWords(text) * 3),
      });

      const processedText =
        response.choices[0]?.message?.content?.trim() || text;

      // Calculate metrics
      const originalWords = this.countWords(text);
      const processedWords = this.countWords(processedText);
      const wordCountRatio =
        originalWords === 0 ? 1.0 : processedWords / originalWords;
      const confidence =
        response.choices[0].finish_reason === "stop" ? 0.95 : 0.7;

      console.log("[Translation] Unified processing completed:", {
        original: text,
        processed: processedText,
        wasTranslated: needsTranslation,
        sourceLanguage: sourceName,
        targetLanguage: targetName,
        wordCountRatio,
        confidence,
        mode: selectedMode,
      });

      return {
        processedText,
        wasTranslated: needsTranslation,
        confidence,
        wordCountRatio,
        detectedLanguage: sourceLanguage,
      };
    } catch (error) {
      console.error("[Translation] Error in unified processing:", error);
      return {
        processedText: text,
        wasTranslated: false,
        confidence: 0.0,
        wordCountRatio: 1.0,
        detectedLanguage: sourceLanguage,
      };
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
      console.log("[Translation] Inserting text via native platform APIs:", text);
      
      const success = await this.textInsertionService.insertText(text, {
        delay: 100, // Small delay to ensure target application is ready
        preserveClipboard: true // Preserve user's clipboard content
      });
      
      if (success) {
        console.log("[Translation] Text inserted successfully via native APIs");
      } else {
        console.warn("[Translation] Text insertion failed via native APIs");
      }
      
      // Fire callback when text insertion is complete (success or failure)
      onComplete?.();
    } catch (error) {
      console.error("[Translation] Error inserting text with native APIs:", error);
      // Still fire callback even if there's an error
      onComplete?.();
    }
  }
}

export default TranslationService;
