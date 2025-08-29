// STTService.ts - Main Process
import { createWhisperSTT, openai } from "../providers/openai";
import { STTClient } from "../providers/openai";
import * as robot from "robotjs";
import { calculateSpeechMetrics } from "../helpers/speech_analytics";
import TranslationService from "./translation_service";
import {
  TranslationResult,
  ApplicationContextType,
  ContextFormattingSettings,
  FormattingResult,
} from "../../shared/types";
import { AnalyticsService } from "./analytics_service";
import { ApplicationDetector } from "./application_detector";
import { ContextFormatter } from "./context_formatter";
import { ApplicationMappingsConfig } from "../config/application_mappings";

class STTService {
  private sttSession: STTClient;
  private audioBuffer: string[] = [];
  private isRecording = false;
  private lastRecordingDuration = 0;
  private recordingStartTime = 0;
  private onMetricsUpdate?: (
    metrics: any,
    transcript?: string,
    translationMeta?: any
  ) => void;
  private translationService: TranslationService;
  private analyticsService?: AnalyticsService;
  private settings: any = {};
  private applicationDetector: ApplicationDetector;
  private contextFormatter: ContextFormatter;
  private contextFormattingSettings: ContextFormattingSettings;

  constructor(
    onMetricsUpdate?: (
      metrics: any,
      transcript?: string,
      translationMeta?: any
    ) => void,
    analyticsService?: AnalyticsService
  ) {
    this.sttSession = null;
    this.onMetricsUpdate = onMetricsUpdate;
    this.translationService = TranslationService.getInstance();
    this.analyticsService = analyticsService;
    this.applicationDetector = ApplicationDetector.getInstance();
    this.contextFormatter = ContextFormatter.getInstance();

    // Initialize default context formatting settings
    this.contextFormattingSettings = {
      enableContextFormatting: true,
      contextSettings: {},
      customAppMappings: {},
    };
  }

  updateSettings(settings: any) {
    this.settings = settings;
    console.log("[STT] Settings updated:", {
      enableTranslation: settings.enableTranslation,
      targetLanguage: settings.targetLanguage,
    });

    // Update context formatting settings if provided
    if (settings.contextFormatting) {
      this.contextFormattingSettings = {
        ...this.contextFormattingSettings,
        ...settings.contextFormatting,
      };
      console.log(
        "[STT] Context formatting settings updated:",
        this.contextFormattingSettings
      );
    }
  }

  updateContextFormattingSettings(
    settings: Partial<ContextFormattingSettings>
  ) {
    this.contextFormattingSettings = {
      ...this.contextFormattingSettings,
      ...settings,
    };

    // Update the context formatter options
    this.contextFormatter.updateOptions({
      enableContextFormatting:
        this.contextFormattingSettings.enableContextFormatting,
      userOverrides: new Map(
        Object.entries(this.contextFormattingSettings.customAppMappings)
      ),
    });

    console.log(
      "[STT] Context formatting settings updated:",
      this.contextFormattingSettings
    );
  }

  async initialize(language = "en") {
    const handleMessage = (message: any) => {
      if (message.type === "transcription.completed") {
        console.log("[STT] Final transcript:", message.transcript);
        this.processTranscript(message.transcript, message.language);
      }
    };

    this.sttSession = await createWhisperSTT({
      language: language,
      callback: {
        onmessage: handleMessage,
        onerror: (error) => {
          console.error("[STT] Error:", error);
          this.isRecording = false; // Reset recording state on error
        },
        onclose: () => console.log("[STT] Session closed"),
      },
    });
  }

  async reinitialize(newLanguage: string) {
    console.log(`[STT] Reinitializing with language: ${newLanguage}`);

    // Close existing session if it exists
    if (this.sttSession) {
      this.sttSession.close();
      this.sttSession = null;
    }

    // Clear any audio buffer
    this.audioBuffer = [];
    this.isRecording = false;

    // Initialize with new language
    await this.initialize(newLanguage);

    console.log(
      `[STT] Successfully reinitialized with language: ${newLanguage}`
    );
  }

  // This method will be called from your audio capture mechanism
  handleAudioChunk(audioData: string) {
    if (!this.isRecording) return;

    this.audioBuffer.push(audioData);

    console.log(
      `[STT] Received audio chunk, buffer size: ${this.audioBuffer.length}`
    );
  }

  startDictation() {
    if (this.isRecording) return; // Already recording

    this.isRecording = true;
    this.audioBuffer = [];
    this.recordingStartTime = Date.now();

    console.log("[STT] Started dictation - speak now...");

    // Track recording started
    if (this.analyticsService) {
      this.analyticsService.trackRecordingStarted();
    }
  }

  async finalizeDictation() {
    if (this.audioBuffer.length === 0) {
      console.log("[STT] No audio chunks to process");
      return;
    }

    this.isRecording = false;

    const recordingEndTime = Date.now();
    const recordingDuration =
      (recordingEndTime - this.recordingStartTime) / 1000;

    console.log("[STT] Processing", this.audioBuffer.length, "audio chunks");
    console.log(
      "[STT] Recording duration:",
      recordingDuration.toFixed(2),
      "seconds"
    );

    // Track recording stopped
    if (this.analyticsService) {
      this.analyticsService.trackRecordingStopped(recordingDuration);
    }

    try {
      // Send accumulated audio to Whisper
      await this.sttSession.processAudio(this.audioBuffer);

      // Store duration for metrics calculation
      this.lastRecordingDuration = recordingDuration;
    } catch (error) {
      console.error("[STT] Error processing audio:", error);
    }

    // Clear buffer
    this.audioBuffer = [];
  }

  stopDictation() {
    if (!this.isRecording) return;

    console.log("[STT] Stopping dictation manually");

    this.isRecording = false;

    // Process remaining audio if any
    if (this.audioBuffer.length > 0) {
      this.finalizeDictation();
    }
  }

  async processTranscript(transcript: string, language: string) {
    if (!transcript || transcript.trim().length === 0) {
      console.log("[STT] Empty transcript received");
      return;
    }

    console.log("[STT] Raw transcript:", transcript);
    console.log("[STT] Received language parameter:", language);

    try {
      let processedText = transcript;
      let detectedLanguage = language;

      // If language is "auto", use TranslationService to detect the actual language
      if (language === "auto") {
        console.log(
          "[STT] Auto-detection enabled, detecting language from transcript"
        );
        detectedLanguage =
          await this.translationService.enhancedLanguageDetection(transcript);
        console.log("[STT] Detected language:", detectedLanguage);
      }

      // Step 1: Translation (if enabled)
      let translationResult: TranslationResult | null = null;
      if (this.settings.enableTranslation && this.settings.targetLanguage) {
        const needsTranslation =
          detectedLanguage !== this.settings.targetLanguage;

        if (needsTranslation) {
          console.log(
            `[STT] Translation enabled: ${detectedLanguage} -> ${this.settings.targetLanguage}`
          );
          translationResult = await this.translationService.translateText(
            transcript,
            this.settings.targetLanguage,
            detectedLanguage
          );
          processedText = translationResult.translatedText;
          console.log("[STT] Translated text:", processedText);
          console.log(
            "[STT] Translation confidence:",
            translationResult.confidence
          );
          console.log(
            "[STT] Word count ratio:",
            translationResult.wordCountRatio
          );
        } else {
          console.log(
            "[STT] Text already in target language, skipping translation"
          );
        }
      }

      // Step 2: Grammar correction (only if AI enhancement is enabled)
      const finalLanguage =
        this.settings.enableTranslation && this.settings.targetLanguage
          ? this.settings.targetLanguage
          : detectedLanguage;

      const correctedText = this.settings.useAI
        ? await this.correctGrammar(processedText, finalLanguage)
        : processedText;
      console.log(
        "[STT] Grammar corrected text:",
        correctedText,
        this.settings.useAI ? "(AI enhanced)" : "(no AI enhancement)"
      );

      // Step 3: Apply context-aware formatting
      let finalText = correctedText;
      let formattingResult: FormattingResult | null = null;

      if (this.contextFormattingSettings.enableContextFormatting) {
        try {
          console.log(
            "[STT] Detecting active application for context formatting..."
          );
          const activeApp =
            await this.applicationDetector.getActiveApplication();

          if (activeApp) {
            console.log("[STT] Active application detected:", {
              name: activeApp.applicationName,
              contextType: activeApp.contextType,
              windowTitle: activeApp.windowTitle,
            });

            formattingResult = this.contextFormatter.formatText(
              correctedText,
              activeApp,
              {
                detectedLanguage: finalLanguage,
                settings: this.settings,
              }
            );

            finalText = formattingResult.formattedText;
            console.log("[STT] Context formatting applied:", {
              originalText: correctedText,
              formattedText: finalText,
              contextType: formattingResult.contextType,
              transformations: formattingResult.appliedTransformations,
              confidence: formattingResult.confidence,
            });
          } else {
            console.log(
              "[STT] Could not detect active application, using original text"
            );
          }
        } catch (error) {
          console.error("[STT] Error during context formatting:", error);
          // Fallback to original text if formatting fails
          finalText = correctedText;
        }
      } else {
        console.log("[STT] Context formatting disabled, using original text");
      }

      console.log("[STT] Final text:", finalText);

      // Step 4: Calculate metrics (use finalText for metrics)
      const metrics = calculateSpeechMetrics(
        finalText,
        this.lastRecordingDuration
      );
      console.log("[STT] Metrics:", metrics);

      // Step 5: Insert text and only fire metrics update after insertion completes
      this.insertTextWithRobot(finalText, () => {
        // Only fire metrics update callback AFTER text insertion is complete
        if (this.onMetricsUpdate) {
          // Include translation metadata if translation was used
          const transcriptData = finalText; // Use formatted text as the final transcript
          const wasTranslated =
            this.settings.enableTranslation &&
            this.settings.targetLanguage &&
            detectedLanguage !== this.settings.targetLanguage &&
            translationResult;

          // Build comprehensive metadata including formatting information
          const translationMeta = wasTranslated
            ? {
                wasTranslated: true,
                originalText: transcript,
                sourceLanguage: detectedLanguage,
                targetLanguage: this.settings.targetLanguage,
                confidence: translationResult.confidence,
                wordCountRatio: translationResult.wordCountRatio,
                detectedLanguage: translationResult.detectedLanguage,
              }
            : { wasTranslated: false, detectedLanguage };

          // Add context formatting metadata
          const contextFormattingMeta = formattingResult
            ? {
                contextFormattingApplied: true,
                contextType: formattingResult.contextType,
                appliedTransformations: formattingResult.appliedTransformations,
                formattingConfidence: formattingResult.confidence,
                preFormattingText: correctedText,
              }
            : { contextFormattingApplied: false };

          // Combine all metadata
          const combinedMeta = {
            ...translationMeta,
            ...contextFormattingMeta,
          };

          this.onMetricsUpdate(metrics, transcriptData, combinedMeta);

          // Track transcription completed via analytics
          if (this.analyticsService) {
            this.analyticsService.trackTranscriptionCompleted(
              metrics.wordCount,
              metrics.wordsPerMinute,
              !!wasTranslated
            );

            // Track translation usage if it occurred
            if (wasTranslated && translationResult) {
              this.analyticsService.track("translation_used", {
                source_language: detectedLanguage,
                target_language: this.settings.targetLanguage,
                confidence: translationResult.confidence,
                word_count_ratio: translationResult.wordCountRatio,
              });
            }

            // Track feature usage
            if (this.settings.useAI) {
              this.analyticsService.track("feature_used", {
                feature: "ai_refinement",
              });
            }

            // Track context formatting usage if it occurred
            if (formattingResult) {
              this.analyticsService.track("context_formatting_used", {
                context_type: formattingResult.contextType,
                applied_transformations:
                  formattingResult.appliedTransformations,
                formatting_confidence: formattingResult.confidence,
                text_length_before: correctedText.length,
                text_length_after: finalText.length,
              });
            }

            // Track context formatting feature enablement
            this.analyticsService.track("feature_used", {
              feature: "context_formatting",
              enabled: this.contextFormattingSettings.enableContextFormatting,
            });
          }
        }
      });
    } catch (error) {
      console.error("[STT] Error in post-processing:", error);

      // No fallback insertion - let user re-record if needed
      // This prevents duplicate text insertion and "Object has been destroyed" errors
    }
  }

  private async correctGrammar(
    text: string,
    language: string
  ): Promise<string> {
    try {
      const systemPrompt = this.getGrammerInstructions(language);

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
- Convert emoji references to actual emojis (e.g., "fire emoji" → 🔥)

EXAMPLES:
- Input: "how is weather today" → Output: "How is the weather today?"
- Input: "weather is good" → Output: "The weather is good."
- Input: "मौसम कैसा है" → Output: "मौसम कैसा है?" (fix punctuation, preserve question)

Return ONLY the corrected text, nothing else.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: prompt,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      return response.choices[0].message.content?.trim() || text;
    } catch (error) {
      console.error("[STT] Grammar correction failed:", error);
      return text; // Return original text if correction fails
    }
  }

  /**
   * Get current context formatting settings
   */
  public getContextFormattingSettings(): ContextFormattingSettings {
    return { ...this.contextFormattingSettings };
  }

  /**
   * Get available context types and their configurations
   */
  public getAvailableContextTypes() {
    return ApplicationMappingsConfig.getInstance().getAllContextConfigs();
  }

  /**
   * Get application mappings for debugging/configuration
   */
  public getApplicationMappings() {
    return ApplicationMappingsConfig.getInstance().getAllMappings();
  }

  private getGrammerInstructions(language: string): string {
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

  private insertTextWithRobot(text: string, onComplete?: () => void) {
    try {
      // Small delay to ensure the target application is ready
      setTimeout(() => {
        robot.typeString(text);
        console.log("[STT] Text inserted via robotjs:", text);
        // Fire callback when text insertion is complete
        onComplete?.();
      }, 100);
    } catch (error) {
      console.error("[STT] Error inserting text with robotjs:", error);
      // Still fire callback even if there's an error
      onComplete?.();
    }
  }

  // Method to be called when audio chunks are received from your audio capture
  receiveAudioData(base64AudioChunk: string) {
    this.handleAudioChunk(base64AudioChunk);
  }

  closeSession() {
    this.isRecording = false;

    this.sttSession?.close();
    this.sttSession = null;
    this.audioBuffer = [];

    console.log("[STT] Session closed, shortcuts unregistered");
  }

  // Getter for recording status (useful for UI indicators)
  get recordingStatus(): boolean {
    return this.isRecording;
  }
}

export default STTService;
