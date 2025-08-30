/**
 * Application Detection Service
 * Detects the currently active application and provides context information
 */

import { exec } from "child_process";
import { promisify } from "util";
import { ActiveApplicationInfo, ApplicationContextType } from "../../shared/types";

const execAsync = promisify(exec);

export class ApplicationDetector {
  private static instance: ApplicationDetector;
  private applicationMappings: Map<string, ApplicationContextType>;
  
  private constructor() {
    this.applicationMappings = new Map();
    this.initializeDefaultMappings();
  }

  public static getInstance(): ApplicationDetector {
    if (!ApplicationDetector.instance) {
      ApplicationDetector.instance = new ApplicationDetector();
    }
    return ApplicationDetector.instance;
  }

  /**
   * Initialize default application mappings
   */
  private initializeDefaultMappings(): void {
    // Email applications
    this.applicationMappings.set("mail", ApplicationContextType.EMAIL);
    this.applicationMappings.set("microsoft outlook", ApplicationContextType.EMAIL);
    this.applicationMappings.set("thunderbird", ApplicationContextType.EMAIL);
    this.applicationMappings.set("gmail", ApplicationContextType.EMAIL);
    this.applicationMappings.set("airmail", ApplicationContextType.EMAIL);
    this.applicationMappings.set("spark", ApplicationContextType.EMAIL);

    // Note-taking applications
    this.applicationMappings.set("notes", ApplicationContextType.NOTES);
    this.applicationMappings.set("notion", ApplicationContextType.NOTES);
    this.applicationMappings.set("obsidian", ApplicationContextType.NOTES);
    this.applicationMappings.set("logseq", ApplicationContextType.NOTES);
    this.applicationMappings.set("roam research", ApplicationContextType.NOTES);
    this.applicationMappings.set("bear", ApplicationContextType.NOTES);
    this.applicationMappings.set("joplin", ApplicationContextType.NOTES);
    this.applicationMappings.set("evernote", ApplicationContextType.NOTES);
    this.applicationMappings.set("onenote", ApplicationContextType.NOTES);
    this.applicationMappings.set("craft", ApplicationContextType.NOTES);

    // Code editors
    this.applicationMappings.set("visual studio code", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("code", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("xcode", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("sublime text", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("atom", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("webstorm", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("intellij idea", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("vim", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("neovim", ApplicationContextType.CODE_EDITOR);
    this.applicationMappings.set("emacs", ApplicationContextType.CODE_EDITOR);

    // Messaging applications
    this.applicationMappings.set("messages", ApplicationContextType.MESSAGING);
    this.applicationMappings.set("slack", ApplicationContextType.MESSAGING);
    this.applicationMappings.set("discord", ApplicationContextType.MESSAGING);
    this.applicationMappings.set("microsoft teams", ApplicationContextType.MESSAGING);
    this.applicationMappings.set("whatsapp", ApplicationContextType.MESSAGING);
    this.applicationMappings.set("telegram", ApplicationContextType.MESSAGING);
    this.applicationMappings.set("signal", ApplicationContextType.MESSAGING);
    this.applicationMappings.set("skype", ApplicationContextType.MESSAGING);

    // Document applications
    this.applicationMappings.set("microsoft word", ApplicationContextType.DOCUMENT);
    this.applicationMappings.set("pages", ApplicationContextType.DOCUMENT);
    this.applicationMappings.set("google docs", ApplicationContextType.DOCUMENT);
    this.applicationMappings.set("libreoffice writer", ApplicationContextType.DOCUMENT);
    this.applicationMappings.set("textedit", ApplicationContextType.DOCUMENT);

    // Browsers
    this.applicationMappings.set("safari", ApplicationContextType.BROWSER);
    this.applicationMappings.set("google chrome", ApplicationContextType.BROWSER);
    this.applicationMappings.set("firefox", ApplicationContextType.BROWSER);
    this.applicationMappings.set("microsoft edge", ApplicationContextType.BROWSER);
    this.applicationMappings.set("arc", ApplicationContextType.BROWSER);
    this.applicationMappings.set("brave", ApplicationContextType.BROWSER);

    // Terminal applications
    this.applicationMappings.set("terminal", ApplicationContextType.TERMINAL);
    this.applicationMappings.set("iterm2", ApplicationContextType.TERMINAL);
    this.applicationMappings.set("hyper", ApplicationContextType.TERMINAL);
    this.applicationMappings.set("kitty", ApplicationContextType.TERMINAL);
    this.applicationMappings.set("alacritty", ApplicationContextType.TERMINAL);

    // Presentation applications
    this.applicationMappings.set("keynote", ApplicationContextType.PRESENTATION);
    this.applicationMappings.set("microsoft powerpoint", ApplicationContextType.PRESENTATION);
    this.applicationMappings.set("google slides", ApplicationContextType.PRESENTATION);
  }

  /**
   * Get the currently active application information
   */
  public async getActiveApplication(): Promise<ActiveApplicationInfo | null> {
    try {
      if (process.platform === "darwin") {
        return await this.getActiveApplicationMacOS();
      } else if (process.platform === "win32") {
        return await this.getActiveApplicationWindows();
      } else {
        console.warn("[ApplicationDetector] Linux support not implemented");
        return null;
      }
    } catch (error) {
      console.error("[ApplicationDetector] Error detecting active application:", error);
      return null;
    }
  }

  /**
   * Get active application on macOS using AppleScript
   */
  private async getActiveApplicationMacOS(): Promise<ActiveApplicationInfo | null> {
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp
          set appPID to unix id of frontApp
          set bundleID to bundle identifier of frontApp
          
          tell frontApp
            if exists window 1 then
              set windowTitle to name of window 1
            else
              set windowTitle to ""
            end if
          end tell
          
          return appName & "|||" & appPID & "|||" & bundleID & "|||" & windowTitle
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script}'`);
      const parts = stdout.trim().split("|||");
      
      if (parts.length >= 4) {
        const appName = parts[0].toLowerCase();
        const processId = parseInt(parts[1]);
        const bundleId = parts[2];
        const windowTitle = parts[3];

        return {
          processName: appName,
          applicationName: parts[0],
          windowTitle,
          bundleId,
          processId,
          contextType: this.determineContextType(appName, windowTitle, bundleId)
        };
      }
      
      return null;
    } catch (error) {
      console.error("[ApplicationDetector] macOS detection failed:", error);
      return null;
    }
  }

  /**
   * Get active application on Windows using PowerShell
   */
  private async getActiveApplicationWindows(): Promise<ActiveApplicationInfo | null> {
    try {
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Text;
          public class WindowAPI {
            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();
            
            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
            
            [DllImport("user32.dll", SetLastError = true)]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
          }
"@

        $hwnd = [WindowAPI]::GetForegroundWindow()
        $title = New-Object System.Text.StringBuilder 256
        [WindowAPI]::GetWindowText($hwnd, $title, $title.Capacity)
        
        $processId = 0
        [WindowAPI]::GetWindowThreadProcessId($hwnd, [ref]$processId)
        
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
          Write-Output "$($process.ProcessName)|||$($processId)|||$($title.ToString())"
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      const parts = stdout.trim().split("|||");

      if (parts.length >= 3) {
        const processName = parts[0].toLowerCase();
        const processId = parseInt(parts[1]);
        const windowTitle = parts[2];

        return {
          processName,
          applicationName: parts[0],
          windowTitle,
          processId,
          contextType: this.determineContextType(processName, windowTitle)
        };
      }

      return null;
    } catch (error) {
      console.error("[ApplicationDetector] Windows detection failed:", error);
      return null;
    }
  }

  /**
   * Determine the context type based on application name and window title
   */
  private determineContextType(appName: string, windowTitle: string, bundleId?: string): ApplicationContextType {
    // First check direct application name mapping
    const directMapping = this.applicationMappings.get(appName);
    if (directMapping) {
      return directMapping;
    }

    // Check bundle ID for macOS (more reliable)
    if (bundleId) {
      const contextFromBundleId = this.getContextFromBundleId(bundleId);
      if (contextFromBundleId !== ApplicationContextType.UNKNOWN) {
        return contextFromBundleId;
      }
    }

    // Check window title for additional context
    const contextFromTitle = this.getContextFromWindowTitle(windowTitle);
    if (contextFromTitle !== ApplicationContextType.UNKNOWN) {
      return contextFromTitle;
    }

    // Check partial application name matches
    for (const [mappedApp, contextType] of this.applicationMappings.entries()) {
      if (appName.includes(mappedApp) || mappedApp.includes(appName)) {
        return contextType;
      }
    }

    return ApplicationContextType.UNKNOWN;
  }

  /**
   * Get context type from macOS bundle ID
   */
  private getContextFromBundleId(bundleId: string): ApplicationContextType {
    const bundleIdMappings: { [key: string]: ApplicationContextType } = {
      "com.apple.mail": ApplicationContextType.EMAIL,
      "com.microsoft.Outlook": ApplicationContextType.EMAIL,
      "com.apple.Notes": ApplicationContextType.NOTES,
      "notion.id": ApplicationContextType.NOTES,
      "md.obsidian": ApplicationContextType.NOTES,
      "com.microsoft.VSCode": ApplicationContextType.CODE_EDITOR,
      "com.apple.dt.Xcode": ApplicationContextType.CODE_EDITOR,
      "com.tinyspeck.slackmacgap": ApplicationContextType.MESSAGING,
      "com.hnc.Discord": ApplicationContextType.MESSAGING,
      "com.apple.iChat": ApplicationContextType.MESSAGING,
      "com.microsoft.teams": ApplicationContextType.MESSAGING,
      "com.microsoft.Word": ApplicationContextType.DOCUMENT,
      "com.apple.iWork.Pages": ApplicationContextType.DOCUMENT,
      "com.apple.Safari": ApplicationContextType.BROWSER,
      "com.google.Chrome": ApplicationContextType.BROWSER,
      "org.mozilla.firefox": ApplicationContextType.BROWSER,
      "com.apple.Terminal": ApplicationContextType.TERMINAL,
      "com.googlecode.iterm2": ApplicationContextType.TERMINAL,
      "com.apple.iWork.Keynote": ApplicationContextType.PRESENTATION,
      "com.microsoft.Powerpoint": ApplicationContextType.PRESENTATION,
    };

    return bundleIdMappings[bundleId] || ApplicationContextType.UNKNOWN;
  }

  /**
   * Get context type from window title
   */
  private getContextFromWindowTitle(windowTitle: string): ApplicationContextType {
    const title = windowTitle.toLowerCase();

    // Email patterns
    if (title.includes("gmail") || title.includes("inbox") || title.includes("compose") || title.includes("@")) {
      return ApplicationContextType.EMAIL;
    }

    // Code editor patterns
    if (title.includes(".js") || title.includes(".ts") || title.includes(".py") || 
        title.includes(".java") || title.includes(".cpp") || title.includes(".html") ||
        title.includes("code") || title.includes("editor")) {
      return ApplicationContextType.CODE_EDITOR;
    }

    // Document patterns
    if (title.includes(".docx") || title.includes(".doc") || title.includes("document")) {
      return ApplicationContextType.DOCUMENT;
    }

    // Notes patterns
    if (title.includes("note") || title.includes("journal") || title.includes("markdown")) {
      return ApplicationContextType.NOTES;
    }

    return ApplicationContextType.UNKNOWN;
  }

  /**
   * Add custom application mapping
   */
  public addApplicationMapping(appName: string, contextType: ApplicationContextType): void {
    this.applicationMappings.set(appName.toLowerCase(), contextType);
  }

  /**
   * Remove application mapping
   */
  public removeApplicationMapping(appName: string): void {
    this.applicationMappings.delete(appName.toLowerCase());
  }

  /**
   * Get all application mappings
   */
  public getApplicationMappings(): Map<string, ApplicationContextType> {
    return new Map(this.applicationMappings);
  }
}