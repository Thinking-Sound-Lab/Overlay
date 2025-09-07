// TextInsertionService.ts - Cross-platform native text insertion
import { exec } from "child_process";
import { promisify } from "util";

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
   * Insert text using platform-specific native methods
   */
  async insertText(text: string, options: TextInsertionOptions = {}): Promise<boolean> {
    const { delay = 100, preserveClipboard = true } = options;

    if (!text || text.trim().length === 0) {
      console.warn("[TextInsertion] No text provided for insertion");
      return false;
    }

    // Convert literal \n strings to actual newlines
    const processedText = text
      .replace(/\\n/g, '\n')  // Convert \n to actual newlines
      .replace(/\\t/g, '\t')  // Convert \t to actual tabs
      .replace(/\\r/g, '\r'); // Convert \r to carriage returns

    console.log("[TextInsertion] Original text:", text);
    console.log("[TextInsertion] Processed text:", processedText);

    // Add delay before insertion
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      // Use clipboard method directly for better Unicode support
      console.log(`[TextInsertion] Using clipboard method for ${this.platform} (better Unicode support)`);
      return await this.insertTextViaClipboard(processedText, preserveClipboard, this.platform);
    } catch (error) {
      console.error("[TextInsertion] Failed to insert text via clipboard:", error);
      return false;
    }
  }

  /**
   * macOS text insertion using AppleScript
   */
  private async insertTextMacOS(text: string, preserveClipboard: boolean): Promise<boolean> {
    try {
      // For AppleScript, we need to handle each line separately to properly handle newlines
      const lines = text.split('\n');
      
      let appleScript = 'tell application "System Events"\n';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Escape quotes and backslashes for AppleScript
        const escapedLine = line
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');
        
        if (escapedLine.length > 0) {
          appleScript += `  keystroke "${escapedLine}"\n`;
        }
        
        // Add newline after each line except the last one
        if (i < lines.length - 1) {
          appleScript += '  key code 36\n'; // 36 is the keycode for Return/Enter
        }
      }
      
      appleScript += 'end tell';

      await execAsync(`osascript -e '${appleScript}'`);
      console.log("[TextInsertion] macOS: Text inserted successfully via AppleScript");
      return true;
    } catch (error) {
      console.error("[TextInsertion] macOS AppleScript failed:", error);
      
      // Fallback to clipboard method
      return await this.insertTextViaClipboard(text, preserveClipboard, 'darwin');
    }
  }

  /**
   * Windows text insertion using PowerShell
   */
  private async insertTextWindows(text: string, preserveClipboard: boolean): Promise<boolean> {
    try {
      // For Windows SendKeys, we need to handle newlines properly
      // SendKeys uses {ENTER} for newlines
      const lines = text.split('\n');
      
      let sendKeysText = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Escape special characters for PowerShell and SendKeys
        const escapedLine = line
          .replace(/'/g, "''")     // PowerShell single quote escape
          .replace(/`/g, "``")     // PowerShell backtick escape
          .replace(/\+/g, "{+}")   // SendKeys + escape
          .replace(/\^/g, "{^}")   // SendKeys ^ escape
          .replace(/%/g, "{%}")    // SendKeys % escape
          .replace(/~/g, "{~}")    // SendKeys ~ escape
          .replace(/\(/g, "{(}")   // SendKeys ( escape
          .replace(/\)/g, "{)}")   // SendKeys ) escape
          .replace(/\[/g, "{[}")   // SendKeys [ escape
          .replace(/\]/g, "{]}")   // SendKeys ] escape
          .replace(/\{/g, "{{}")   // SendKeys { escape
          .replace(/\}/g, "{}}")   // SendKeys } escape
      
        sendKeysText += escapedLine;
        
        // Add {ENTER} after each line except the last one
        if (i < lines.length - 1) {
          sendKeysText += '{ENTER}';
        }
      }

      const powershellScript = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.SendKeys]::SendWait('${sendKeysText}');
      `;

      await execAsync(`powershell -Command "${powershellScript}"`);
      console.log("[TextInsertion] Windows: Text inserted successfully via PowerShell SendKeys");
      return true;
    } catch (error) {
      console.error("[TextInsertion] Windows PowerShell failed:", error);
      
      // Fallback to clipboard method
      return await this.insertTextViaClipboard(text, preserveClipboard, 'win32');
    }
  }

  /**
   * Linux text insertion using xdotool
   */
  private async insertTextLinux(text: string, preserveClipboard: boolean): Promise<boolean> {
    try {
      // For Linux xdotool, we need to handle newlines properly
      // We'll type each line and then press Return
      const lines = text.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.length > 0) {
          // Escape quotes and backslashes for shell command
          const escapedLine = line
            .replace(/\\/g, '\\\\')  // Escape backslashes
            .replace(/"/g, '\\"')    // Escape quotes
            .replace(/'/g, "'\"'\"'"); // Escape single quotes for shell
          
          await execAsync(`xdotool type --delay 1 "${escapedLine}"`);
        }
        
        // Press Return after each line except the last one
        if (i < lines.length - 1) {
          await execAsync('xdotool key Return');
        }
      }
      
      console.log("[TextInsertion] Linux: Text inserted successfully via xdotool");
      return true;
    } catch (error) {
      console.error("[TextInsertion] Linux xdotool failed:", error);
      
      // Fallback to clipboard method
      return await this.insertTextViaClipboard(text, preserveClipboard, 'linux');
    }
  }

  /**
   * Fallback method using clipboard + paste for all platforms
   */
  private async insertTextViaClipboard(text: string, preserveClipboard: boolean, platform: string): Promise<boolean> {
    try {
      console.log(`[TextInsertion] Using clipboard fallback for ${platform}`);
      
      let originalClipboard = '';
      
      // Save original clipboard if requested
      if (preserveClipboard) {
        try {
          switch (platform) {
            case 'darwin':
              const { stdout: macClipboard } = await execAsync('pbpaste');
              originalClipboard = macClipboard;
              break;
            case 'win32':
              const { stdout: winClipboard } = await execAsync('powershell -Command "Get-Clipboard"');
              originalClipboard = winClipboard.trim();
              break;
            case 'linux':
              const { stdout: linuxClipboard } = await execAsync('xclip -selection clipboard -out');
              originalClipboard = linuxClipboard;
              break;
          }
        } catch (clipError) {
          console.warn("[TextInsertion] Could not read original clipboard:", clipError);
        }
      }

      // Set text to clipboard
      switch (platform) {
        case 'darwin':
          await execAsync(`echo "${text.replace(/"/g, '\\"')}" | pbcopy`);
          await execAsync('osascript -e "tell application \\"System Events\\" to keystroke \\"v\\" using command down"');
          break;
        case 'win32':
          await execAsync(`powershell -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'""`);
          await execAsync('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\\\"^v\\\")"');
          break;
        case 'linux':
          await execAsync(`echo "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard`);
          await execAsync('xdotool key ctrl+v');
          break;
      }

      // Restore original clipboard after delay
      if (preserveClipboard && originalClipboard) {
        setTimeout(async () => {
          try {
            switch (platform) {
              case 'darwin':
                await execAsync(`echo "${originalClipboard.replace(/"/g, '\\"')}" | pbcopy`);
                break;
              case 'win32':
                await execAsync(`powershell -Command "Set-Clipboard -Value '${originalClipboard.replace(/'/g, "''")}'""`);
                break;
              case 'linux':
                await execAsync(`echo "${originalClipboard.replace(/"/g, '\\"')}" | xclip -selection clipboard`);
                break;
            }
          } catch (restoreError) {
            console.warn("[TextInsertion] Could not restore original clipboard:", restoreError);
          }
        }, 1000);
      }

      console.log(`[TextInsertion] ${platform}: Text inserted successfully via clipboard fallback`);
      return true;
    } catch (error) {
      console.error(`[TextInsertion] Clipboard fallback failed for ${platform}:`, error);
      return false;
    }
  }

  /**
   * Check if text insertion is available on current platform
   */
  async isAvailable(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'darwin':
          // Check if we can run AppleScript
          await execAsync('osascript -e "return true"');
          return true;
        case 'win32':
          // Check if PowerShell is available
          await execAsync('powershell -Command "return $true"');
          return true;
        case 'linux':
          // Check if xdotool is available
          await execAsync('which xdotool');
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error("[TextInsertion] Platform check failed:", error);
      return false;
    }
  }

  /**
   * Get platform-specific setup instructions
   */
  getSetupInstructions(): string {
    switch (this.platform) {
      case 'darwin':
        return "macOS: Grant accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility";
      case 'win32':
        return "Windows: No additional setup required";
      case 'linux':
        return "Linux: Install xdotool and xclip packages: sudo apt-get install xdotool xclip";
      default:
        return "Platform not supported";
    }
  }
}

export default TextInsertionService;