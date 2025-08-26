// translation_service.ts - Translation service using OpenAI
import { openai } from "../providers/openai";

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
  confidence: number;
  wordCountRatio: number;
  semanticSimilarity?: number;
  detectedLanguage?: string;
}

export class TranslationService {
  private static instance: TranslationService;

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult> {
    try {
      if (!text.trim()) {
        throw new Error("Text cannot be empty");
      }

      console.log(
        `[Translation] Translating text from ${sourceLanguage || "auto"} to ${targetLanguage}`
      );
      console.log(`[Translation] Original text: "${text}"`);

      // Step 1: Enhanced language detection if source not provided
      let detectedSourceLanguage = sourceLanguage;
      if (!sourceLanguage || sourceLanguage === "auto") {
        detectedSourceLanguage = await this.enhancedLanguageDetection(text);
        console.log(
          `[Translation] Enhanced detection result: ${detectedSourceLanguage}`
        );
      }

      // Step 2: Check if translation is actually needed
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

      // Step 3: Perform semantic-aware translation
      const translationResult = await this.performSemanticTranslation(
        text,
        detectedSourceLanguage,
        targetLanguage
      );

      // Step 4: Validate and potentially correct the translation
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
        sourceLanguage: sourceLanguage || "auto",
        targetLanguage,
        originalText: text,
        confidence: 0.0,
        wordCountRatio: 1.0,
        detectedLanguage: sourceLanguage || "unknown",
      };
    }
  }

  private async enhancedLanguageDetection(text: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert language detection system. Analyze the given text and provide the most accurate language identification.

INSTRUCTIONS:
1. Return only the ISO 639-1 language code (2 letters)
2. Consider context, grammar, and vocabulary patterns
3. For mixed languages, identify the dominant language
4. Be confident in your detection - avoid 'auto' or 'unknown'
5. Common codes: en=English, es=Spanish, fr=French, de=German, hi=Hindi, ur=Urdu, ta=Tamil, etc.

IMPORTANT: Return only the 2-letter code, nothing else.`,
          },
          {
            role: "user",
            content: `Detect the language of this text: "${text}"`,
          },
        ],
        max_tokens: 10,
        temperature: 0.1,
      });

      const detectedLanguage =
        response.choices[0].message.content?.trim().toLowerCase() || "en";

      // Validate the detected language code
      if (
        detectedLanguage.length === 2 &&
        /^[a-z]{2}$/.test(detectedLanguage)
      ) {
        return detectedLanguage;
      }

      console.warn(
        `[Translation] Invalid language code detected: ${detectedLanguage}, defaulting to 'en'`
      );
      return "en";
    } catch (error) {
      console.error(
        "[Translation] Error in enhanced language detection:",
        error
      );
      return "en"; // Default fallback
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
        model: "gpt-4o",
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

    // Check if word count deviation is excessive (>50% change) and we have meaningful text
    if (originalWords > 0 && (wordCountRatio < 0.5 || wordCountRatio > 2.0)) {
      console.warn(
        `[Translation] Excessive word count change: ${originalWords} -> ${translatedWords} (ratio: ${wordCountRatio.toFixed(2)})`
      );

      // Attempt word count correction
      const correctedTranslation = await this.correctWordCount(
        originalText,
        translation.translatedText,
        sourceLanguage,
        targetLanguage,
        originalWords
      );

      // Calculate corrected word count ratio, preventing division by zero
      const correctedWords = this.countWords(correctedTranslation.text);
      const correctedRatio =
        originalWords === 0 ? 1.0 : correctedWords / originalWords;

      return {
        translatedText: correctedTranslation.text,
        sourceLanguage,
        targetLanguage,
        originalText,
        confidence: Math.min(
          translation.confidence,
          correctedTranslation.confidence
        ),
        wordCountRatio: correctedRatio,
        detectedLanguage: sourceLanguage,
      };
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

  private async correctWordCount(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    targetWordCount: number
  ): Promise<{ text: string; confidence: number }> {
    try {
      const languageNames = this.getLanguageNames();
      const sourceName = languageNames[sourceLanguage] || sourceLanguage;
      const targetName = languageNames[targetLanguage] || targetLanguage;

      const systemPrompt = `You are a translation editor specializing in length normalization while preserving meaning.

TASK: Adjust this ${targetName} translation to match the original ${sourceName} text length more closely.

REQUIREMENTS:
1. Target word count: ~${targetWordCount} words (±3 words acceptable)
2. Preserve 100% of the original meaning
3. Maintain natural ${targetName} fluency
4. Keep all important information
5. Remove only redundancy, never core content

ORIGINAL TEXT (${sourceName}): "${originalText}"
CURRENT TRANSLATION (${targetName}): "${translatedText}"
CURRENT WORD COUNT: ${this.countWords(translatedText)} words
TARGET WORD COUNT: ~${targetWordCount} words

OUTPUT: Return only the adjusted translation, nothing else.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content:
              "Please adjust the translation to match the target word count while preserving all meaning.",
          },
        ],
        max_tokens: Math.max(500, targetWordCount * 2),
        temperature: 0.1,
      });

      const correctedText =
        response.choices[0].message.content?.trim() || translatedText;
      const confidence =
        response.choices[0].finish_reason === "stop" ? 0.8 : 0.6;

      return { text: correctedText, confidence };
    } catch (error) {
      console.error("[Translation] Error in word count correction:", error);
      return { text: translatedText, confidence: 0.5 };
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

  async detectLanguage(text: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a language detection expert. Analyze the given text and return only the ISO 639-1 language code (2 letters) of the detected language. Examples: 'en' for English, 'es' for Spanish, 'fr' for French, etc. Return only the code, nothing else.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 10,
        temperature: 0.1,
      });

      const detectedLanguage =
        response.choices[0].message.content?.trim().toLowerCase() || "en";
      console.log(`[Translation] Detected language: ${detectedLanguage}`);
      return detectedLanguage;
    } catch (error) {
      console.error("[Translation] Error detecting language:", error);
      return "en"; // Default to English
    }
  }
}

export default TranslationService;
