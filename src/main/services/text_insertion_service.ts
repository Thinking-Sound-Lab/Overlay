// TextInsertionService.ts - Cross-platform text insertion with clipboard primary and robotjs fallback
import { exec } from "child_process";
import { promisify } from "util";
import * as robot from "robotjs";

const execAsync = promisify(exec);

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
   * Insert text using clipboard as primary method with robotjs as fallback
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

    // Convert literal \n strings to actual newlines
    const processedText = text
      .replace(/\\n/g, "\n") // Convert \n to actual newlines
      .replace(/\\t/g, "\t") // Convert \t to actual tabs
      .replace(/\\r/g, "\r"); // Convert \r to carriage returns

    console.log("[TextInsertion] Original text:", text);
    console.log("[TextInsertion] Processed text:", processedText);

    // Add delay before insertion
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Primary method: Clipboard insertion (cross-platform, Unicode-safe)
    try {
      console.log("[TextInsertion] Attempting clipboard method (primary)");
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

    // Fallback method: RobotJS direct typing
    try {
      console.log("[TextInsertion] Attempting RobotJS method (fallback)");
      const robotSuccess = await this.insertTextViaRobot(processedText);
      if (robotSuccess) {
        console.log("[TextInsertion] Text inserted successfully via RobotJS");
        return true;
      }
    } catch (error) {
      console.error("[TextInsertion] RobotJS method failed:", error);
    }

    console.error("[TextInsertion] All text insertion methods failed");
    return false;
  }

  /**
   * RobotJS text insertion method (fallback)
   */
  private async insertTextViaRobot(text: string): Promise<boolean> {
    try {
      console.log("[TextInsertion] Using RobotJS for direct text typing");

      // Set typing delay for more reliable insertion
      robot.setKeyboardDelay(10);

      // Type the text directly
      robot.typeString(text);

      console.log("[TextInsertion] RobotJS: Text typed successfully");
      return true;
    } catch (error) {
      console.error("[TextInsertion] RobotJS typing failed:", error);
      return false;
    }
  }

  /**
   * Clipboard method for text insertion (primary)
   */
  private async insertTextViaClipboard(
    text: string,
    preserveClipboard: boolean,
    platform: string
  ): Promise<boolean> {
    try {
      console.log(`[TextInsertion] Using clipboard method for ${platform}`);

      let originalClipboard = "";

      // Save original clipboard if requested
      if (preserveClipboard) {
        try {
          switch (platform) {
            case "darwin":
              const { stdout: macClipboard } = await execAsync("pbpaste");
              originalClipboard = macClipboard;
              break;
            case "win32":
              const { stdout: winClipboard } = await execAsync(
                'powershell -Command "Get-Clipboard"'
              );
              originalClipboard = winClipboard.trim();
              break;
            case "linux":
              const { stdout: linuxClipboard } = await execAsync(
                "xclip -selection clipboard -out"
              );
              originalClipboard = linuxClipboard;
              break;
          }
        } catch (clipError) {
          console.warn(
            "[TextInsertion] Could not read original clipboard:",
            clipError
          );
        }
      }

      // Set text to clipboard
      switch (platform) {
        case "darwin":
          await execAsync(`echo "${text.replace(/"/g, '\\"')}" | pbcopy`);
          await execAsync(
            'osascript -e "tell application \\"System Events\\" to keystroke \\"v\\" using command down"'
          );
          break;
        case "win32":
          await execAsync(
            `powershell -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`
          );
          await execAsync(
            'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\\"^v\\")"'
          );
          break;
        case "linux":
          await execAsync(
            `echo "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard`
          );
          await execAsync("xdotool key ctrl+v");
          break;
      }

      // Restore original clipboard after delay
      if (preserveClipboard && originalClipboard) {
        setTimeout(async () => {
          try {
            switch (platform) {
              case "darwin":
                await execAsync(
                  `echo "${originalClipboard.replace(/"/g, '\\"')}" | pbcopy`
                );
                break;
              case "win32":
                await execAsync(
                  `powershell -Command "Set-Clipboard -Value '${originalClipboard.replace(/'/g, "''")}'"`
                );
                break;
              case "linux":
                await execAsync(
                  `echo "${originalClipboard.replace(/"/g, '\\"')}" | xclip -selection clipboard`
                );
                break;
            }
          } catch (restoreError) {
            console.warn(
              "[TextInsertion] Could not restore original clipboard:",
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
   * Check if text insertion is available (clipboard + robotjs always available)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Clipboard method should work on all platforms
      // RobotJS should also work as fallback
      console.log(
        "[TextInsertion] Text insertion available via clipboard + RobotJS"
      );
      return true;
    } catch (error) {
      console.error("[TextInsertion] Availability check failed:", error);
      return false;
    }
  }

  /**
   * Get setup instructions for clipboard + RobotJS text insertion
   */
  getSetupInstructions(): string {
    switch (this.platform) {
      case "darwin":
        return "macOS: Grant accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility for RobotJS fallback";
      case "win32":
        return "Windows: No additional setup required for clipboard method. RobotJS may require running as administrator for some applications.";
      case "linux":
        return "Linux: Install xclip package for clipboard support: sudo apt-get install xclip";
      default:
        return "Clipboard method should work on all platforms";
    }
  }
}

export default TextInsertionService;
