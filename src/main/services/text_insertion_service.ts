// TextInsertionService.ts - RobotJS primary with clipboard fallback
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
    
    // Configure robotjs settings
    robot.setKeyboardDelay(2);
  }

  /**
   * Insert text using robotjs as primary method with clipboard as fallback
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

    // Primary method: RobotJS typing
    try {
      console.log("[TextInsertion] Attempting RobotJS method (primary)");
      const robotSuccess = await this.insertTextViaRobot(processedText);
      if (robotSuccess) {
        console.log(
          "[TextInsertion] Text inserted successfully via RobotJS"
        );
        return true;
      }
    } catch (error) {
      console.warn("[TextInsertion] RobotJS method failed:", error);
    }

    // Fallback method: Clipboard insertion
    try {
      console.log("[TextInsertion] Attempting clipboard method (fallback)");
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
   * RobotJS text insertion method (primary)
   */
  private async insertTextViaRobot(text: string): Promise<boolean> {
    try {
      console.log("[TextInsertion] Using RobotJS for text insertion");

      // Type the text using robotjs
      robot.typeString(text);

      console.log("[TextInsertion] RobotJS: Text inserted successfully");
      return true;
    } catch (error) {
      console.error("[TextInsertion] RobotJS insertion failed:", error);
      return false;
    }
  }

  /**
   * Clipboard method for text insertion (fallback)
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
                "xclip -selection clipboard -o"
              );
              originalClipboard = linuxClipboard;
              break;
            default:
              throw new Error(
                `Unsupported platform for clipboard operations: ${this.platform}`
              );
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
            `powershell -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'")`
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
        default:
          throw new Error(`Unsupported platform: ${platform}`);
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
                  `powershell -Command "Set-Clipboard -Value '${originalClipboard.replace(/'/g, "''")}'")`
                );
                break;
              case "linux":
                await execAsync(
                  `echo "${originalClipboard.replace(/"/g, '\\"')}" | xclip -selection clipboard`
                );
                break;
              default:
                console.warn(
                  `Cannot restore clipboard on unsupported platform: ${platform}`
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
   * Check if text insertion is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if RobotJS is available
      if (robot && typeof robot.typeString === 'function') {
        console.log("[TextInsertion] RobotJS text insertion available");
        return true;
      }

      // Fallback to clipboard method availability
      console.log(
        "[TextInsertion] RobotJS not available, clipboard method available as fallback"
      );
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
        return "macOS: Grant accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility for optimal text insertion";
      case "win32":
        return "Windows: No additional setup required for text insertion";
      case "linux":
        return "Linux: Ensure xclip and xdotool are installed for clipboard method";
      default:
        return "Platform-specific setup instructions not available";
    }
  }

  /**
   * Check if RobotJS is available
   */
  isRobotAvailable(): boolean {
    try {
      return robot && typeof robot.typeString === 'function';
    } catch {
      return false;
    }
  }
}

export default TextInsertionService;