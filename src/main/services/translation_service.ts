// translation_service.ts - Translation service using OpenAI
import { openai } from "../providers/openai";
import { Settings } from "../../shared/types";
import TextInsertionService from "./text_insertion_service";
import { calculateSpeechMetrics } from "../helpers/speech_analytics";
import { ApplicationDetectionService } from "./application_detection_service";
import { getApplicationPrompt } from "../../shared/config/application_prompts";
import { DataLoaderService } from "./data_loader_service";
import { WindowManager } from "../windows/window-manager";
import { TranscriptCompletionService } from "./transcript_completion_service";
import { getLanguageDisplayName } from "../../shared/constants/languages";
import {
  hasProAccess,
  canUseWords,
} from "../../shared/utils/subscription-permissions";
import { countWords } from "../utils/text-utils";
import { InformationMessage } from "../windows";
// robotjs removed - using TextInsertionService clipboard method for better Unicode support

export class TranslationService {
  // Single language model configuration
  private readonly LANGUAGE_MODEL = "deepseek-ai/DeepSeek-V3.1";
  private processingTimeout: NodeJS.Timeout | null = null;

  constructor(
    private dataLoaderService: DataLoaderService,
    private applicationDetectionService: ApplicationDetectionService,
    private textInsertionService: TextInsertionService,
    private windowManager: WindowManager,
    private transcriptCompletionService: TranscriptCompletionService
  ) {}

  /**
   * Clear processing timeout when processing completes successfully
   */
  private clearProcessingTimeout(): void {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }

  /**
   * Handle immediate actions after text insertion completes
   * This provides instant feedback to user while background processing continues
   */
  private handleTextInsertionComplete(): void {
    // Clear processing timeout - text insertion is the critical UX milestone
    this.clearProcessingTimeout();

    // Send processing-complete to recording window immediately
    if (
      this.windowManager.getRecordingWindow() &&
      !this.windowManager.getRecordingWindow().isDestroyed()
    ) {
      this.windowManager.sendToRecording("processing-complete");
      this.windowManager.compactRecordingWindow();
    }

    console.log("[Translation] Text insertion complete - window state updated");
  }

  /**
   * Handle processing timeout - recovery function for stuck processing states
   */
  private handleProcessingTimeout(): void {
    console.error(
      "[Translation] Processing timeout reached - forcing recovery"
    );

    // Clear timeout
    this.clearProcessingTimeout();

    // Send processing-complete to recording window to reset UI
    if (
      this.windowManager.getRecordingWindow() &&
      !this.windowManager.getRecordingWindow().isDestroyed()
    ) {
      this.windowManager.sendToRecording("processing-complete");
      this.windowManager.compactRecordingWindow();
    }

    // Show timeout message to user
    const message: InformationMessage = {
      type: "processing-error",
      title: "Processing Timeout",
      message: "Text processing took too long and was canceled",
      duration: 4000,
    };
    this.windowManager.showInformation(message);
  }

  /**
   * Main text processing pipeline - handles complete language model processing
   * @param transcript Raw transcript from STT service
   * @param recordingDuration Duration of the recording for metrics
   */
  async processText(
    transcript: string,
    recordingDuration: number
  ): Promise<void> {
    if (!transcript || transcript.trim().length === 0) {
      console.log("[Translation] Empty transcript received");
      return;
    }

    // Set up processing timeout (30 seconds) - moved from STT Service
    this.processingTimeout = setTimeout(() => {
      this.handleProcessingTimeout();
    }, 30000);

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
    const wordUsage = canUseWords(userData, countWords(transcript));

    console.log("[Translation] Pro access check:", {
      canUseAI,
      canTranslate,
      canUseCustomModes,
      wordUsage: wordUsage.allowed,
      wordsInTranscript: countWords(transcript),
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
      // Get cached application context once and use for both app mode and prompt
      let selectedApplicationMode =
        settings.selectedApplicationMode || "default";
      let applicationSpecificPrompt: string | null = null;

      if (settings.enableAutoDetection && canUseCustomModes) {
        if (selectedApplicationMode === "custom") {
          applicationSpecificPrompt = settings.customPrompt;
        } else {
          try {
            const cachedContext =
              this.applicationDetectionService.getCachedApplicationContext();
            if (cachedContext && cachedContext.confidence > 0.3) {
              selectedApplicationMode = cachedContext.applicationId;

              // Resolve prompt live from settings or static config
              applicationSpecificPrompt = this.resolveApplicationPrompt(
                selectedApplicationMode,
                settings
              );

              console.log("[Translation] Using cached application context:", {
                applicationId: cachedContext.applicationId,
                displayName: cachedContext.displayName,
                confidence: cachedContext.confidence,
                promptResolved: !!applicationSpecificPrompt,
              });
            } else {
              console.log(
                "[Translation] No cached context or low confidence, using fallback application:",
                selectedApplicationMode
              );
            }
          } catch (error) {
            console.warn(
              "[Translation] Error retrieving cached application context, using fallback:",
              selectedApplicationMode,
              error
            );
          }
        }
      } else {
        console.log(
          "[Translation] Auto-detection disabled, skipping application-specific formatting"
        );
      }

      // Build optimized prompt with correct priority order
      let activePrompt = `You are an expert transcript post-processor. Process the following transcript in this specific order:

## STEP 1 - PRIMARY PROCESSING (MANDATORY):
${settings.language !== settings.targetLanguage && settings.enableTranslation && canTranslate ? `- First: Translate from ${getLanguageDisplayName(settings.language)} to ${getLanguageDisplayName(settings.targetLanguage)}` : "- Keep original language"}
- Fix spelling errors and typos
- Correct grammar mistakes contextually based on intended meaning
- Add proper punctuation and capitalization
- Convert emoji words to actual emojis (e.g., "fire emoji" → "🔥", "heart emoji" → "❤️")
- Restructure and clean up the text to make it more sensible by removing/changing repeated words or phrases
- Understand the transcript context and correct words to make them contextually appropriate
- Keep it simple and clean

## STEP 2 - APPLICATION FORMATTING (SECONDARY):`;

      // Add application-specific formatting if available
      if (applicationSpecificPrompt && applicationSpecificPrompt.trim()) {
        activePrompt += `
After completing Step 1, apply this application-specific formatting for ${selectedApplicationMode?.toUpperCase()}:

${applicationSpecificPrompt}

**Important**: Apply this formatting ONLY after completing Step 1 cleanup. Questions must remain questions.`;
      } else {
        activePrompt += `
No specific application formatting detected. Use general professional formatting.`;
      }

      activePrompt += `

## PRESERVATION RULES (ALWAYS MAINTAIN):
- Original meaning and intent
- Question format (questions stay as questions)
- Statement format (statements stay as statements)
- Technical terms and proper nouns
- Numbers and dates exactly as spoken

## STRICT LIMITATIONS:
- Never answer questions - only fix their grammar/punctuation
- Never add information not in the original
- Never change the core message or tone
- Never convert statements to questions or vice versa

`;

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
## OUTPUT FORMAT (IMPORTANT):
Return ONLY the processed text. No explanations.
`;

      const response = await openai().chat.completions.create({
        model: this.LANGUAGE_MODEL,
        messages: [
          { role: "user", content: transcript },
          { role: "system", content: activePrompt },
        ],
        temperature: 0.2,
        max_tokens: Math.max(300, countWords(transcript) * 2), // Optimized token limit
      });

      console.log(
        "[Translation] Raw response:",
        response.choices[0].message.content
      );

      // Parse the text response with error handling
      let finalText = "";
      finalText = response.choices[0].message.content || "";

      // Apply dictionary replacements
      try {
        const textWithReplacements =
          this.applyDictionaryReplacements(finalText);
        if (textWithReplacements !== finalText) {
          console.log("[Translation] Dictionary replacements applied");
          console.log("[Translation] Before replacements:", finalText);
          console.log(
            "[Translation] After replacements:",
            textWithReplacements
          );
          finalText = textWithReplacements;
        }
      } catch (error) {
        console.warn(
          "[Translation] Dictionary replacement failed, using original text:",
          error
        );
      }

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
              countWords(transcript) === 0
                ? 1.0
                : countWords(finalText) / countWords(transcript),
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
              modeBasedFormattingApplied: false,
            };

      const combinedMeta = {
        ...translationMeta,
        ...applicationFormattingMeta,
      };

      // PRIORITY: Insert text immediately with minimal delay
      await this.insertTextNative(finalText);

      // IMMEDIATE: Handle window state and clear timeout after text insertion
      this.handleTextInsertionComplete();

      this.applicationDetectionService.clearCache();

      // BACKGROUND: Start transcript completion processing (includes word usage updates)
      this.transcriptCompletionService.handleCompletion(
        metrics,
        finalText,
        combinedMeta
      );
    } catch (error) {
      console.error("[Translation] Error in text processing pipeline:", error);
    }
  }

  /**
   * Apply dictionary replacements to text
   * Gets dictionary entries from DataLoaderService and applies replacements locally
   */
  private applyDictionaryReplacements(text: string): string {
    try {
      console.log("[TranslationService] Applying dictionary replacements");

      // Get dictionary entries from DataLoaderService (synchronous cache operation)
      const dictionaryEntries = this.dataLoaderService.getDictionaryEntries();

      if (!dictionaryEntries || dictionaryEntries.length === 0) {
        console.log("[TranslationService] No dictionary entries available");
        return text; // No replacements needed
      }

      let processedText = text;

      // Apply each dictionary replacement
      // Sort by key length (descending) to handle longer keys first
      const sortedEntries = [...dictionaryEntries].sort(
        (a, b) => b.key.length - a.key.length
      );

      for (const entry of sortedEntries) {
        // Case-insensitive replacement, but preserve original case of the replacement value
        const regex = new RegExp(`\\b${entry.key}\\b`, "gi");
        processedText = processedText.replace(regex, entry.value);
      }

      if (processedText !== text) {
        console.log(
          `[TranslationService] Applied ${sortedEntries.length} dictionary entries`
        );
      }

      return processedText;
    } catch (error) {
      console.error(
        "[TranslationService] Error applying dictionary replacements:",
        error
      );
      // Return original text if replacement fails
      return text;
    }
  }

  /**
   * Insert text using native platform APIs
   */
  private async insertTextNative(text: string): Promise<void> {
    try {
      console.log(
        "[Translation] Inserting text via clipboard method (better Unicode support):",
        text
      );

      // Use TextInsertionService which will use clipboard method for better Unicode support
      const success = await this.textInsertionService.insertText(text, {
        delay: 0, // Reduced delay for faster insertion
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
    } catch (error) {
      console.error(
        "[Translation] Error inserting text with native APIs:",
        error
      );
    }
  }

  /**
   * Resolve application prompt from user settings with fallback to static config
   */
  private resolveApplicationPrompt(
    applicationId: string,
    settings: Settings
  ): string | null {
    console.log(
      "[Translation] Resolving prompt for applicationId:",
      applicationId
    );

    // Check if user has a custom prompt for this application in settings
    // This will respect user customizations
    const settingsPromptMap: Record<string, string | undefined> = {
      gmail: settings.gmailPrompt,
      outlook: settings.outlookPrompt,
      mail: settings.mailPrompt,
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
      vscode: settings.vscodePrompt,
      xcode: settings.xcodePrompt,
      webstorm: settings.webstormPrompt,
      sublime: settings.sublimePrompt,
      word: settings.wordPrompt,
      pages: settings.pagesPrompt,
      docs: settings.docsPrompt,
      figma: settings.figmaPrompt,
      "browser-github": settings.browserGithubPrompt,
      "browser-stackoverflow": settings.browserStackoverflowPrompt,
      "browser-twitter": settings.browserTwitterPrompt,
      "browser-linkedin": settings.browserLinkedinPrompt,
    };

    // First priority: User custom prompt from settings
    const userPrompt = settingsPromptMap[applicationId];
    if (userPrompt && userPrompt.trim()) {
      console.log("[Translation] Using user custom prompt for", applicationId);
      return userPrompt;
    }

    // Second priority: Static application prompt from config
    const staticPrompt = getApplicationPrompt(applicationId);
    if (staticPrompt && staticPrompt.prompt) {
      console.log("[Translation] Using static prompt for", applicationId);
      return staticPrompt.prompt;
    }

    console.log("[Translation] No prompt found for", applicationId);
    return null;
  }
}

export default TranslationService;
