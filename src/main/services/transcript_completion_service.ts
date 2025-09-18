import {
  SpeechMetrics,
  TranslationResult,
  DatabaseTranscriptEntry,
  UITranscriptEntry
} from "../../shared/types";
import { DataLoaderService } from "./data_loader_service";
import { AudioStorageService } from "./audio_storage_service";
import { WindowManager } from "../windows/window-manager";
import { TrayService } from "./tray_service";
import { AuthService } from "./auth_service";
import { countWords } from "../utils/text-utils";
import { v4 as uuidv4 } from "uuid";

/**
 * TranscriptCompletionService - Handles post-processing after transcript text insertion
 *
 * This service coordinates the complete transcript lifecycle after the translation/text
 * insertion is complete, including:
 * - Database storage (background)
 * - Audio file upload (background)
 * - UI updates (background)
 * - Statistics updates (background)
 *
 * NOTE: Window state updates (processing-complete, compact) are handled immediately
 * during text insertion in TranslationService for better UX.
 */
export class TranscriptCompletionService {
  constructor(
    private dataLoaderService: DataLoaderService,
    private audioStorageService: AudioStorageService,
    private windowManager: WindowManager,
    private trayService: TrayService,
    private authService: AuthService
  ) {}

  /**
   * Handle complete transcript processing as background task
   * This runs AFTER text insertion is complete and window state is already updated
   * @param metrics Speech metrics from STT processing
   * @param transcript Final processed transcript text
   * @param translationMeta Translation metadata from translation service
   */
  async handleCompletion(
    metrics: SpeechMetrics,
    transcript?: string,
    translationMeta?: any // Combined metadata from translation service
  ): Promise<void> {
    console.log("[TranscriptCompletion] Starting background processing:", {
      wordCount: metrics.wordCount,
      wpm: metrics.wordsPerMinute,
      hasTranscript: !!transcript,
      wasTranslated: !!translationMeta?.wasTranslated,
    });

    // Run as background task - don't block user experience
    setImmediate(async () => {
      await this.processInBackground(metrics, transcript, translationMeta);
    });
  }

  /**
   * Process transcript saving in background
   */
  private async processInBackground(
    metrics: SpeechMetrics,
    transcript?: string,
    translationMeta?: TranslationResult
  ): Promise<void> {
    // Handle transcript saving if provided and user is authenticated
    if (
      transcript &&
      transcript.trim() &&
      this.authService.isUserAuthenticated() &&
      this.dataLoaderService
    ) {
      const userId = this.dataLoaderService.getCacheInfo().userId;

      if (userId) {
        await this.processTranscriptSaving(
          userId,
          transcript,
          metrics,
          translationMeta
        );
      } else {
        console.warn("[TranscriptCompletion] Cannot save transcript: no user ID available");
      }
    } else if (
      transcript &&
      transcript.trim() &&
      !this.authService.isUserAuthenticated()
    ) {
      console.log(
        "[TranscriptCompletion] User not authenticated, transcript will not be saved to database"
      );
    }
  }

  /**
   * Process transcript saving with audio upload coordination
   */
  private async processTranscriptSaving(
    userId: string,
    transcript: string,
    metrics: SpeechMetrics,
    translationMeta?: TranslationResult
  ): Promise<void> {
    const transcriptData: Omit<DatabaseTranscriptEntry, "id" | "created_at"> = {
      user_id: userId,
      text: transcript.trim(),
      original_text: translationMeta?.originalText,
      language: translationMeta?.sourceLanguage || "en",
      target_language: translationMeta?.targetLanguage,
      was_translated: !!translationMeta?.wasTranslated,
      confidence: translationMeta?.confidence,
      word_count: metrics.wordCount,
      wpm: metrics.wordsPerMinute,
      audio_file_path: undefined,
      metadata: {
        detectedLanguage: translationMeta?.detectedLanguage,
        wordCountRatio: translationMeta?.wordCountRatio,
      },
    };

    try {
      // Save transcript to database
      const transcriptSaveResult = await this.dataLoaderService.addTranscript(transcriptData);

      if (transcriptSaveResult.success && transcriptSaveResult.transcriptId) {
        // Create UI transcript using database ID as source of truth
        const uiTranscript = this.createUITranscript(
          transcriptSaveResult.transcriptId,
          transcript,
          metrics,
          translationMeta
        );

        console.log("[TranscriptCompletion] Transcript saved to database successfully");

        // Process audio upload in parallel
        const finalAudioPath = await this.processAudioUpload(
          userId,
          transcriptSaveResult.transcriptId
        );

        // Create final UI transcript with complete data (including audio if successful)
        const finalUITranscript = {
          ...uiTranscript,
          audioFilePath: finalAudioPath,
        };

        // Update UI with complete transcript data
        this.updateUI(finalUITranscript);

        console.log(
          "[TranscriptCompletion] Background processing complete:",
          finalUITranscript.id,
          finalAudioPath ? "with audio" : "without audio"
        );
      } else {
        console.error(
          "[TranscriptCompletion] Failed to save transcript:",
          transcriptSaveResult.error
        );
      }

      // Update tray with latest stats
      this.updateTray();

      // Update word usage in background
      await this.updateWordUsage(transcript);
    } catch (error) {
      console.error(
        "[TranscriptCompletion] Error in background transcript processing:",
        error
      );
    }
  }

  /**
   * Update word usage for free tier users
   */
  private async updateWordUsage(finalText: string): Promise<void> {
    const userData = this.dataLoaderService.getCurrentUser();
    const wordCount = countWords(finalText);

    if (userData && userData.subscription_tier === "free" && wordCount > 0) {
      try {
        // This runs in background - no need to block transcript processing
        await this.dataLoaderService.updateWordUsage(wordCount);
        console.log(
          `[TranscriptCompletion] Background: Updated word usage: +${wordCount} words`
        );
      } catch (error) {
        console.error(
          "[TranscriptCompletion] Background: Failed to update word usage:",
          error
        );
      }
    }
  }


  /**
   * Create UI transcript object from database result
   */
  private createUITranscript(
    transcriptId: string,
    transcript: string,
    metrics: SpeechMetrics,
    translationMeta?: TranslationResult
  ): UITranscriptEntry {
    return {
      id: transcriptId,
      text: transcript.trim(),
      timestamp: new Date(),
      wordCount: metrics.wordCount,
      wpm: metrics.wordsPerMinute,
      originalText: translationMeta?.originalText,
      sourceLanguage: translationMeta?.sourceLanguage,
      targetLanguage: translationMeta?.targetLanguage,
      wasTranslated: translationMeta?.wasTranslated,
      confidence: translationMeta?.confidence,
      detectedLanguage: translationMeta?.detectedLanguage,
      wordCountRatio: translationMeta?.wordCountRatio,
      audioFilePath: undefined as string | undefined,
    };
  }

  /**
   * Process audio upload and return the final audio path
   */
  private async processAudioUpload(
    userId: string,
    transcriptId: string
  ): Promise<string | undefined> {
    const cacheInfo = this.dataLoaderService.getCacheInfo();

    if (cacheInfo.userId && this.audioStorageService) {
      console.log("[TranscriptCompletion] Starting audio upload in background");
      try {
        // Generate UUID for audio file
        const audioTranscriptId = uuidv4();

        const uploadResult = await this.audioStorageService.uploadStoredAudio(
          cacheInfo.userId,
          audioTranscriptId
        );

        if (uploadResult.success && uploadResult.audioFilePath) {
          console.log(
            "[TranscriptCompletion] Audio upload successful:",
            uploadResult.audioFilePath
          );

          // Update database with audio path
          const updateResult = await this.dataLoaderService.updateTranscriptAudioPath(
            transcriptId,
            uploadResult.audioFilePath
          );

          if (updateResult.success) {
            console.log(
              "[TranscriptCompletion] Database updated with audio path successfully"
            );
            return uploadResult.audioFilePath;
          } else {
            console.error(
              "[TranscriptCompletion] Failed to update database with audio path:",
              updateResult.error
            );
            // Continue without audio path
          }
        } else {
          console.log(
            "[TranscriptCompletion] Audio upload failed, transcript will be saved without audio:",
            uploadResult.error
          );
          // Continue without audio path
        }
      } catch (error) {
        console.error("[TranscriptCompletion] Audio upload failed:", error);
        // Continue without audio path
      }
    } else {
      console.log(
        "[TranscriptCompletion] No audio service available, transcript will be saved without audio"
      );
    }

    return undefined;
  }

  /**
   * Update UI with transcript data in background
   */
  private updateUI(uiTranscript: UITranscriptEntry): void {
    try {
      if (
        this.windowManager.getMainWindow() &&
        !this.windowManager.getMainWindow().isDestroyed()
      ) {
        // Send transcript update
        this.windowManager.sendToMain("transcript-updated", uiTranscript);

        // Fetch and send updated stats
        const currentStats = this.dataLoaderService.getUserStats();
        this.windowManager.sendToMain("statistics-updated", currentStats);
      }
    } catch (error) {
      console.error("[TranscriptCompletion] Error in UI update:", error);
    }
  }

  /**
   * Update tray menu
   */
  private updateTray(): void {
    try {
      this.trayService.updateMenu();
    } catch (error) {
      console.error("[TranscriptCompletion] Error updating tray menu:", error);
    }
  }
}