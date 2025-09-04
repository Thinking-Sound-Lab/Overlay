import { spawn } from "child_process";

/**
 * SystemAudioManager - Controls system-wide audio during recording
 * Supports Windows and macOS platforms
 */
export class SystemAudioManager {
  private originalVolume = 50; // Default fallback volume
  private isMuted = false;
  private platform: string = process.platform;

  constructor() {
    console.log(`[AudioManager] Initialized for platform: ${this.platform}`);
  }

  /**
   * Mute system audio and store original volume for restoration
   */
  async muteSystemAudio(): Promise<void> {
    if (this.isMuted) {
      console.log("[AudioManager] Already muted, skipping");
      return;
    }

    try {
      console.log("[AudioManager] Muting system audio...");
      
      // Get current volume before muting
      await this.getCurrentVolume();
      
      // Mute based on platform
      if (this.platform === "darwin") {
        await this.muteMacOS();
      } else if (this.platform === "win32") {
        await this.muteWindows();
      } else {
        console.log("[AudioManager] Unsupported platform, skipping mute");
        return;
      }

      this.isMuted = true;
      console.log(`[AudioManager] System audio muted (original volume: ${this.originalVolume})`);
    } catch (error) {
      console.warn("[AudioManager] Failed to mute system audio:", error.message);
      // Don't throw - recording should continue even if muting fails
    }
  }

  /**
   * Restore system audio to original volume
   */
  async restoreSystemAudio(): Promise<void> {
    if (!this.isMuted) {
      console.log("[AudioManager] Not muted, skipping restore");
      return;
    }

    try {
      console.log(`[AudioManager] Restoring system audio to volume: ${this.originalVolume}`);
      
      if (this.platform === "darwin") {
        await this.restoreMacOS();
      } else if (this.platform === "win32") {
        await this.restoreWindows();
      } else {
        console.log("[AudioManager] Unsupported platform, skipping restore");
        return;
      }

      this.isMuted = false;
      console.log("[AudioManager] System audio restored");
    } catch (error) {
      console.warn("[AudioManager] Failed to restore system audio:", error.message);
      // Always reset muted flag even if restore fails
      this.isMuted = false;
    }
  }

  /**
   * Get current system volume level
   */
  private async getCurrentVolume(): Promise<void> {
    try {
      if (this.platform === "darwin") {
        const command = `osascript -e "output volume of (get volume settings)"`;
        const result = await this.executeCommand(command);
        this.originalVolume = parseInt(result.trim()) || 50;
      } else if (this.platform === "win32") {
        // For Windows, we'll use a reasonable default since getting exact volume is complex
        // The main goal is muting anyway
        this.originalVolume = 50;
      }
    } catch (error) {
      console.warn("[AudioManager] Failed to get current volume:", error.message);
      this.originalVolume = 50; // Fallback volume
    }
  }

  /**
   * Mute audio on macOS using AppleScript
   */
  private async muteMacOS(): Promise<void> {
    const command = `osascript -e "set volume output volume 0"`;
    await this.executeCommand(command);
  }

  /**
   * Restore audio on macOS using AppleScript
   */
  private async restoreMacOS(): Promise<void> {
    const command = `osascript -e "set volume output volume ${this.originalVolume}"`;
    await this.executeCommand(command);
  }

  /**
   * Mute audio on Windows using PowerShell
   */
  private async muteWindows(): Promise<void> {
    // Use Windows Volume Mixer API via PowerShell
    const command = `powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Audio { [DllImport(\\"user32.dll\\")] public static extern IntPtr SendMessageW(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam); public static void Mute() { SendMessageW(new IntPtr(0xFFFF), 0x319, new IntPtr(0x80000), new IntPtr(0x20000)); } }'; [Audio]::Mute()"`;
    
    try {
      await this.executeCommand(command);
    } catch (error) {
      // Fallback: Use simpler mute command
      console.log("[AudioManager] Trying fallback Windows mute method...");
      const fallbackCommand = `powershell -Command "(New-Object -comObject WScript.Shell).SendKeys([char]173)"`;
      await this.executeCommand(fallbackCommand);
    }
  }

  /**
   * Restore audio on Windows using PowerShell
   */
  private async restoreWindows(): Promise<void> {
    // For Windows, we'll unmute and set a reasonable volume
    // First unmute if muted
    const unmuteCommand = `powershell -Command "(New-Object -comObject WScript.Shell).SendKeys([char]173)"`;
    
    try {
      await this.executeCommand(unmuteCommand);
      
      // Small delay to ensure unmute takes effect
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Set volume to a reasonable level (around 50%)
      // This sends volume up keys to reach approximately 50% from 0
      const volumeCommand = `powershell -Command "for($i=1; $i -le 25; $i++) { (New-Object -comObject WScript.Shell).SendKeys([char]175); Start-Sleep -Milliseconds 50 }"`;
      await this.executeCommand(volumeCommand);
    } catch (error) {
      console.warn("[AudioManager] Windows restore failed, trying simple unmute:", error.message);
      // Just unmute, don't worry about volume level
      await this.executeCommand(unmuteCommand);
    }
  }

  /**
   * Execute a system command with timeout
   */
  private executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { 
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // 5-second timeout
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, 5000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
}