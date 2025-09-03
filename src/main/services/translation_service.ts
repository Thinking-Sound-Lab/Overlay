// translation_service.ts - Translation service using OpenAI
import { openai } from "../providers/openai";
import { TranslationResult, ApplicationContextType, Settings, SpeechMetrics } from "../../shared/types";
import * as robot from "robotjs";
import { calculateSpeechMetrics } from "../helpers/speech_analytics";
import { ApplicationDetector } from "./application_detector";
import { DataLoaderService } from "./data_loader_service";

export class TranslationService {
  private static instance: TranslationService;
  private applicationDetector: ApplicationDetector;
  private dataLoaderService: DataLoaderService | null = null;

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
  }

  public static getInstance(dataLoaderService?: DataLoaderService): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService(dataLoaderService);
    } else if (dataLoaderService && !TranslationService.instance.dataLoaderService) {
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
    onComplete?: (metrics: SpeechMetrics, finalText: string, metadata: any) => void
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
      useAI: settings.useAI
    });

    console.log("[Translation] Processing transcript:", transcript);
    console.log("[Translation] Source language:", sourceLanguage);

    try {
      let processedText = transcript;

      // Step 1: Translation (if enabled and needed)
      let translationResult: TranslationResult | null = null;
      if (settings.enableTranslation && settings.targetLanguage) {
        const needsTranslation = sourceLanguage !== settings.targetLanguage;

        if (needsTranslation) {
          console.log(
            `[Translation] Translation enabled: ${sourceLanguage} -> ${settings.targetLanguage}`
          );
          translationResult = await this.translateText(
            transcript,
            settings.targetLanguage,
            sourceLanguage
          );
          processedText = translationResult.translatedText;
          console.log("[Translation] Translated text:", processedText);
        } else {
          console.log(
            "[Translation] Text already in target language, skipping translation"
          );
        }
      }

      // Step 2: Grammar correction and mode-based formatting (if AI enhancement is enabled)
      const finalLanguage =
        settings.enableTranslation && settings.targetLanguage
          ? settings.targetLanguage
          : sourceLanguage;

      const correctedText = settings.useAI
        ? await this.correctGrammarWithMode(
            processedText,
            finalLanguage,
            settings
          )
        : processedText;
      console.log(
        "[Translation] Grammar corrected text:",
        correctedText,
        settings.useAI ? "(AI enhanced)" : "(no AI enhancement)"
      );

      // Use corrected text as final output
      const finalText = correctedText;

      console.log("[Translation] Final text:", finalText);

      // Step 4: Calculate metrics
      const metrics = calculateSpeechMetrics(finalText, recordingDuration);
      console.log("[Translation] Metrics:", metrics);

      // Step 5: Insert text and fire callback after insertion completes
      this.insertTextWithRobot(finalText, () => {
        if (onComplete) {
          // Build comprehensive metadata
          const wasTranslated =
            settings.enableTranslation &&
            settings.targetLanguage &&
            sourceLanguage !== settings.targetLanguage &&
            translationResult;

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

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string
  ): Promise<TranslationResult> {
    try {
      if (!text.trim()) {
        throw new Error("Text cannot be empty");
      }

      if (!sourceLanguage) {
        throw new Error("Source language must be provided");
      }

      console.log(
        `[Translation] Translating text from ${sourceLanguage} to ${targetLanguage}`
      );
      console.log(`[Translation] Original text: "${text}"`);

      // Use the predetermined source language from user settings
      const detectedSourceLanguage = sourceLanguage;
      console.log(
        `[Translation] Using predetermined source language: ${detectedSourceLanguage}`
      );

      // Check if translation is actually needed
      if (detectedSourceLanguage === targetLanguage) {
        console.log(
          `[Translation] Source and target language are the same, skipping translation`
        );
        return {
          translatedText: text,
          sourceLanguage: detectedSourceLanguage,
          targetLanguage,
          originalText: text,
          confidence: 1.0,
          wordCountRatio: 1.0,
          detectedLanguage: detectedSourceLanguage,
        };
      }

      // Perform semantic-aware translation
      const translationResult = await this.performSemanticTranslation(
        text,
        detectedSourceLanguage,
        targetLanguage
      );

      console.log("Translation result:", translationResult);

      // Validate and potentially correct the translation
      const validatedResult = await this.validateTranslation(
        text,
        translationResult,
        detectedSourceLanguage,
        targetLanguage
      );

      console.log(
        `[Translation] Final result: "${validatedResult.translatedText}"`
      );
      console.log(`[Translation] Confidence: ${validatedResult.confidence}`);
      console.log(
        `[Translation] Word count ratio: ${validatedResult.wordCountRatio}`
      );

      return validatedResult;
    } catch (error) {
      console.error("[Translation] Error translating text:", error);
      return {
        translatedText: text,
        sourceLanguage: sourceLanguage || "en",
        targetLanguage,
        originalText: text,
        confidence: 0.0,
        wordCountRatio: 1.0,
        detectedLanguage: sourceLanguage || "en",
      };
    }
  }

  private async performSemanticTranslation(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<{ translatedText: string; confidence: number }> {
    try {
      const languageNames = this.getLanguageNames();
      const sourceName = languageNames[sourceLanguage] || sourceLanguage;
      const targetName = languageNames[targetLanguage] || targetLanguage;
      const originalWordCount = this.countWords(text);

      const systemPrompt = `You are an expert translator specializing in ${sourceName} to ${targetName} translation with perfect semantic preservation.

CRITICAL REQUIREMENTS:
1. PRESERVE EXACT MEANING: Maintain 100% semantic equivalence
2. CULTURAL ADAPTATION: Adapt idioms and cultural references appropriately
3. WORD COUNT CONTROL: Keep translation length similar to original (±20%)
4. NATURAL FLUENCY: Produce natural, fluent ${targetName} text
5. CONTEXT AWARENESS: Consider the full context and implied meanings
6. TECHNICAL ACCURACY: Preserve specialized terms and technical vocabulary

ORIGINAL TEXT ANALYSIS:
- Source language: ${sourceName}
- Target language: ${targetName}  
- Original word count: ~${originalWordCount} words
- Context: General communication/dictation

TRANSLATION STRATEGY:
- For technical terms: Preserve meaning over literal translation
- For idioms: Find equivalent expressions in ${targetName}
- For cultural references: Adapt to ${targetName} cultural context when necessary
- Maintain similar text length and structure

OUTPUT FORMAT: Return only the translated text, nothing else.`;

      const response = await openai.chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: Math.max(1000, originalWordCount * 3), // Dynamic token limit
        temperature: 0.2, // Low temperature for consistency
      });

      const translatedText =
        response.choices[0].message.content?.trim() || text;

      // Calculate confidence based on response completeness
      const confidence =
        response.choices[0].finish_reason === "stop" ? 0.95 : 0.7;

      return { translatedText, confidence };
    } catch (error) {
      console.error("[Translation] Error in semantic translation:", error);
      return { translatedText: text, confidence: 0.0 };
    }
  }

  private async validateTranslation(
    originalText: string,
    translation: { translatedText: string; confidence: number },
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    const originalWords = this.countWords(originalText);
    const translatedWords = this.countWords(translation.translatedText);

    console.log(
      `[Translation] Word count analysis: Original="${originalText}" (${originalWords} words) -> Translated="${translation.translatedText}" (${translatedWords} words)`
    );

    // Prevent division by zero - if original has no words, set ratio to 1.0
    const wordCountRatio =
      originalWords === 0 ? 1.0 : translatedWords / originalWords;

    console.log(
      `[Translation] Word count ratio: ${wordCountRatio} ${originalWords === 0 ? "(division by zero prevented)" : ""}`
    );

    // Log word count deviation but don't attempt AI correction
    if (originalWords > 0 && (wordCountRatio < 0.5 || wordCountRatio > 2.0)) {
      console.warn(
        `[Translation] Word count change detected: ${originalWords} -> ${translatedWords} (ratio: ${wordCountRatio.toFixed(2)}) - accepting translation as-is`
      );
    }

    return {
      translatedText: translation.translatedText,
      sourceLanguage,
      targetLanguage,
      originalText,
      confidence: translation.confidence,
      wordCountRatio,
      detectedLanguage: sourceLanguage,
    };
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
   * Grammar correction with optional mode-based formatting using language model
   */
  private async correctGrammarWithMode(
    text: string,
    language: string,
    settings: Settings
  ): Promise<string> {
    try {
      const systemPrompt = this.getGrammarInstructions(language);

      // Build the formatting prompt based on mode settings
      let formattingPrompt = "";
      let selectedMode = settings.selectedMode;

      if (settings.enableAutoDetection) {
        try {
          // Auto-detect application and map to appropriate mode
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
          } else {
            console.log(
              "[Translation] Using fallback mode:",
              selectedMode,
              "for unrecognized context:",
              activeApp.contextType
            );
          }
        } catch (error) {
          console.warn(
            "[Translation] Auto-detection failed, using fallback mode:",
            selectedMode,
            error
          );
        }

        // Get the appropriate prompt based on selected mode or use customPrompt
        let activePrompt = settings.customPrompt;

        // If not custom mode, use the per-mode prompt if available
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

        // Use the determined active prompt
        if (activePrompt && activePrompt.trim()) {
          formattingPrompt = `\n\nADDITIONAL FORMATTING INSTRUCTIONS:\n${activePrompt}`;
        }
      }

      const prompt = `You are a grammar and spelling corrector. Your ONLY task is to fix spelling errors, grammar mistakes, and add proper punctuation. ${systemPrompt}

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
- Convert emoji references to actual emojis (e.g., "fire emoji" → 🔥)${formattingPrompt}

IMPORTANT: Apply formatting instructions only AFTER ensuring grammar and spelling are correct. The original meaning and intent must be preserved.

Text to process: "${text}"

Return ONLY the corrected and formatted text, nothing else.`;

      const completion = await openai.chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const correctedText = completion.choices[0]?.message?.content?.trim();

      if (!correctedText) {
        console.warn("[Translation] Empty response from grammar correction");
        return text;
      }

      console.log("[Translation] Grammar and formatting applied:", {
        original: text,
        corrected: correctedText,
        mode: selectedMode,
        autoDetected:
          settings.enableAutoDetection &&
          selectedMode !== settings.selectedMode,
        customPromptUsed: !!settings.customPrompt?.trim(),
      });

      return correctedText;
    } catch (error) {
      console.error(
        "[Translation] Error in grammar correction with mode:",
        error
      );
      return text;
    }
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
   * Insert text using robotjs
   */
  private insertTextWithRobot(text: string, onComplete?: () => void) {
    try {
      // Small delay to ensure the target application is ready
      setTimeout(() => {
        robot.typeString(text);
        console.log("[Translation] Text inserted via robotjs:", text);
        // Fire callback when text insertion is complete
        onComplete?.();
      }, 100);
    } catch (error) {
      console.error("[Translation] Error inserting text with robotjs:", error);
      // Still fire callback even if there's an error
      onComplete?.();
    }
  }
}

export default TranslationService;
