// STTService.ts - Main Process
import { createWhisperSTT, openai } from "../providers/openai";
import { STTClient } from "../providers/openai";
import * as robot from "robotjs";
import { calculateSpeechMetrics } from "../helpers/speech_analytics";
import TranslationService from "./translation_service";
import { AnalyticsService } from "./analytics_service";

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
  }

  updateSettings(settings: any) {
    this.settings = settings;
    console.log("[STT] Settings updated:", {
      enableTranslation: settings.enableTranslation,
      targetLanguage: settings.targetLanguage,
    });
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
    console.log("[STT] Detected language:", language);

    try {
      let processedText = transcript;

      // Step 1: Translation (if enabled)
      let translationResult = null;
      if (this.settings.enableTranslation && this.settings.targetLanguage) {
        const needsTranslation = language !== this.settings.targetLanguage;

        if (needsTranslation) {
          console.log(
            `[STT] Translation enabled: ${language} -> ${this.settings.targetLanguage}`
          );
          translationResult = await this.translationService.translateText(
            transcript,
            this.settings.targetLanguage,
            language
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

      // Step 2: Grammar correction (using target language if translated)
      const finalLanguage =
        this.settings.enableTranslation && this.settings.targetLanguage
          ? this.settings.targetLanguage
          : language;

      const correctedText = await this.correctGrammar(
        processedText,
        finalLanguage
      );
      console.log("[STT] Corrected text:", correctedText);

      // Step 3: Insert text using robotjs
      this.insertTextWithRobot(correctedText);

      // Step 4: Calculate metrics
      const metrics = calculateSpeechMetrics(
        correctedText,
        this.lastRecordingDuration
      );
      console.log("[STT] Metrics:", metrics);

      if (this.onMetricsUpdate) {
        // Include translation metadata if translation was used
        const transcriptData = correctedText;
        const wasTranslated =
          this.settings.enableTranslation &&
          this.settings.targetLanguage &&
          language !== this.settings.targetLanguage &&
          translationResult;
        const translationMeta = wasTranslated
          ? {
              wasTranslated: true,
              originalText: transcript,
              sourceLanguage: language,
              targetLanguage: this.settings.targetLanguage,
              confidence: translationResult.confidence,
              wordCountRatio: translationResult.wordCountRatio,
              detectedLanguage: translationResult.detectedLanguage,
            }
          : { wasTranslated: false };

        this.onMetricsUpdate(metrics, transcriptData, translationMeta);

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
              source_language: language,
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
        }
      }
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

      const prompt = `Your are a helpful assistant. Your task is to correct any spelling discrepancies in the transcribed text. Fix grammar and punctuation in the dictated text. ${systemPrompt}. Only add necessary punctuation such as periods, commas, and capitalization, and use only the context provided. DO NOT add any additional context or information or change the meaning of the text. 
	 Convert any emoji references to actual emojis. 

	 <rules>
	 - Replace "fire emoji" with 🔥
	 - Keep the original meaning of the text
	 </rules>

	  `;

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

  private insertTextWithRobot(text: string) {
    try {
      // Small delay to ensure the target application is ready
      setTimeout(() => {
        robot.typeString(text);
        console.log("[STT] Text inserted via robotjs:", text);
      }, 100);
    } catch (error) {
      console.error("[STT] Error inserting text with robotjs:", error);
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
