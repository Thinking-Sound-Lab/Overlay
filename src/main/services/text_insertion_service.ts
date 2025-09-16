// TextInsertionService.ts - Cross-platform text insertion via clipboard
import { exec } from "child_process";
import { promisify } from "util";
import { clipboard } from "electron";

const execAsync = promisify(exec);

// Import nut.js for Windows automation
let nutjs: any;
try {
  nutjs = require("@nut-tree-fork/nut-js");
} catch (error) {
  console.warn("[TextInsertion] nut.js not available:", error);
}

export interface TextInsertionOptions {
  delay?: number; // Delay before insertion in milliseconds
  preserveClipboard?: boolean; // Whether to preserve existing clipboard content
}

export class TextInsertionService {
  private platform: string;

  constructor() {
    this.platform = process.platform;
    console.log(`[TextInsertion] Initialized for platform: ${this.platform}`);
  }

  /**
   * Insert text using cross-platform clipboard method
   */
  async insertText(
    text: string,
    options: TextInsertionOptions = {}
  ): Promise<boolean> {
    const { delay = 100, preserveClipboard = true } = options;

    if (!text || text.trim().length === 0) {
      console.warn("[TextInsertion] No text provided for insertion");
      return false;
    }

    // Step 1: Convert literal \n strings to actual newlines
    let processedText = text;
    processedText = processedText
      .replace(/\\n/g, "\n") // Convert \n to actual newlines
      .replace(/\\t/g, "\t") // Convert \t to actual tabs
      .replace(/\\r/g, "\r"); // Convert \r to carriage returns

    console.log("[TextInsertion] Original text:", text);
    console.log("[TextInsertion] Processed text:", processedText);

    // Add delay before insertion
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Primary method: Clipboard insertion
    try {
      console.log("[TextInsertion] Attempting clipboard method");
      const clipboardSuccess = await this.insertTextViaClipboard(
        processedText,
        preserveClipboard,
        this.platform
      );
      if (clipboardSuccess) {
        console.log("[TextInsertion] Text inserted successfully via clipboard");
        return true;
      }
    } catch (error) {
      console.warn("[TextInsertion] Clipboard method failed:", error);
    }

    console.error("[TextInsertion] All text insertion methods failed");
    return false;
  }


  /**
   * Clipboard method for text insertion
   */
  private async insertTextViaClipboard(
    text: string,
    preserveClipboard: boolean,
    platform: string
  ): Promise<boolean> {
    try {
      console.log(`[TextInsertion] Using clipboard method for ${platform}`);

      let originalClipboard = "";

      // Save original clipboard if requested using Electron clipboard API
      if (preserveClipboard) {
        try {
          originalClipboard = clipboard.readText();
          console.log(
            "[TextInsertion] Original clipboard saved via Electron API"
          );
        } catch (clipError) {
          console.warn(
            "[TextInsertion] Could not read original clipboard via Electron API:",
            clipError
          );
        }
      }

      // Set text to clipboard using Electron API (cross-platform)
      try {
        clipboard.writeText(text);
        console.log(
          "[TextInsertion] Text written to clipboard via Electron API"
        );
      } catch (clipboardError) {
        console.error(
          "[TextInsertion] Failed to write to clipboard via Electron API:",
          clipboardError
        );
        throw clipboardError;
      }

      // Trigger paste action (platform-specific automation)
      try {
        switch (platform) {
          case "darwin": {
            // Try nut.js first, fallback to AppleScript
            let macOSSuccess = false;
            if (nutjs && nutjs.keyboard) {
              try {
                await nutjs.keyboard.pressKey(nutjs.Key.LeftCmd, nutjs.Key.V);
                macOSSuccess = true;
                console.log("[TextInsertion] macOS: nut.js automation successful");
              } catch (nutjsError) {
                console.warn("[TextInsertion] macOS: nut.js failed, falling back to AppleScript:", nutjsError);
              }
            }
            
            if (!macOSSuccess) {
              await execAsync(
                'osascript -e "tell application \\"System Events\\" to keystroke \\"v\\" using command down"'
              );
              console.log("[TextInsertion] macOS: AppleScript automation successful");
            }
            break;
          }
          case "win32":
            // Use nut.js for Windows automation with proper key release
            if (nutjs && nutjs.keyboard) {
              try {
                // Press Ctrl+V
                await nutjs.keyboard.pressKey(nutjs.Key.LeftControl, nutjs.Key.V);
                
                // Small delay to ensure paste operation completes
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Explicitly release the keys to prevent them from getting stuck
                await nutjs.keyboard.releaseKey(nutjs.Key.LeftControl, nutjs.Key.V);
                
                console.log("[TextInsertion] Windows: Keys pressed and released successfully");
              } catch (keyError) {
                // Ensure keys are released even if paste operation fails
                try {
                  await nutjs.keyboard.releaseKey(nutjs.Key.LeftControl, nutjs.Key.V);
                  console.log("[TextInsertion] Windows: Keys released after error");
                } catch (releaseError) {
                  console.warn("[TextInsertion] Windows: Failed to release keys after error:", releaseError);
                }
                throw keyError;
              }
            } else {
              throw new Error("nut.js not available for Windows automation");
            }
            break;
          case "linux":
            await execAsync("xdotool key ctrl+v");
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }
        console.log(
          `[TextInsertion] Paste automation completed successfully on ${platform}`
        );
      } catch (pasteError) {
        // Enhanced error handling for automation failures
        if (platform === "win32") {
          console.warn(
            "[TextInsertion] Windows paste automation failed with nut.js:",
            pasteError
          );
          console.log(
            "[TextInsertion] Text is available in clipboard - user can paste manually with Ctrl+V or Shift+Insert"
          );

          // General automation failure - clipboard still works
          throw new Error(
            "Automated paste failed with nut.js. Text copied to clipboard - please paste manually with Ctrl+V."
          );
        } else {
          // Non-Windows platforms - re-throw original error
          throw pasteError;
        }
      }

      // Restore original clipboard after delay using Electron API
      if (preserveClipboard && originalClipboard) {
        setTimeout(() => {
          try {
            clipboard.writeText(originalClipboard);
            console.log(
              "[TextInsertion] Original clipboard restored via Electron API"
            );
          } catch (restoreError) {
            console.warn(
              "[TextInsertion] Could not restore original clipboard via Electron API:",
              restoreError
            );
          }
        }, 1000);
      }

      console.log(
        `[TextInsertion] ${platform}: Text inserted successfully via clipboard`
      );
      return true;
    } catch (error) {
      console.error(
        `[TextInsertion] Clipboard method failed for ${platform}:`,
        error
      );
      return false;
    }
  }

  /**
   * Check if text insertion is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Clipboard method is always available with Electron
      console.log("[TextInsertion] Clipboard text insertion available");
      return true;
    } catch (error) {
      console.error("[TextInsertion] Availability check failed:", error);
      return false;
    }
  }

  /**
   * Get setup instructions for text insertion
   */
  getSetupInstructions(): string {
    switch (this.platform) {
      case "darwin":
        return "macOS: Uses nut.js automation with AppleScript fallback. Grant accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility for optimal text insertion";
      case "win32":
        return "Windows: Text will be copied to clipboard automatically and pasted using nut.js automation. If automated paste fails, use Ctrl+V or Shift+Insert to paste manually";
      case "linux":
        return "Linux: Ensure xclip and xdotool are installed for clipboard method";
      default:
        return "Platform-specific setup instructions not available";
    }
  }

  /**
   * Check if cross-platform text insertion is available
   */
  isTextInsertionAvailable(): boolean {
    // Clipboard method is always available with Electron
    return true;
  }
}

export default TextInsertionService;
