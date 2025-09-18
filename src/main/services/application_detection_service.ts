/**
 * Application Detection Service
 * Unified service that combines application detection and context mapping
 * Replaces both ApplicationDetector and ApplicationContextService
 */

import { exec } from "child_process";
import { promisify } from "util";
import { ApplicationMappingsConfig } from '../config/application_mappings';
import { getApplicationPrompt, getDefaultApplicationPrompt } from '../../shared/config/application_prompts';
import { ApplicationContextType, ActiveApplicationInfo } from '../../shared/types/services';

const execAsync = promisify(exec);

export interface ApplicationContextMapping {
  applicationId: string;
  contextType: ApplicationContextType;
  confidence: number;
  displayName: string;
}

export class ApplicationDetectionService {
  private mappingsConfig: ApplicationMappingsConfig;
  private cachedApplicationContext: ApplicationContextMapping | null = null;

  constructor() {
    this.mappingsConfig = ApplicationMappingsConfig.getInstance();
  }

  async dispose(): Promise<void> {
    console.log("[ApplicationDetectionService] Disposing application detection service...");
    this.clearCache();
  }

  /**
   * Capture current application context in background (called on recording start)
   */
  public async captureCurrentContext(): Promise<void> {
    try {
      console.log("[ApplicationDetectionService] === STARTING BACKGROUND CAPTURE ===");

      const activeApp = await this.getActiveApplication();
      console.log("[ApplicationDetectionService] Active app detected:", {
        applicationName: activeApp?.applicationName,
        processName: activeApp?.processName,
        bundleId: activeApp?.bundleId,
        windowTitle: activeApp?.windowTitle?.substring(0, 100),
        contextType: activeApp?.contextType
      });

      if (!activeApp) {
        console.log("[ApplicationDetectionService] No active app detected, using default context");
        this.cachedApplicationContext = this.getDefaultApplicationContext();
        return;
      }

      const applicationId = this.detectApplicationId(activeApp);
      console.log("[ApplicationDetectionService] Application ID detected:", applicationId);

      const appPrompt = getApplicationPrompt(applicationId);
      const displayName = appPrompt?.displayName || "Unknown Application";
      console.log("[ApplicationDetectionService] Display name found:", displayName);

      const confidence = this.calculateConfidence(activeApp, applicationId);
      console.log("[ApplicationDetectionService] Confidence calculated:", confidence);

      this.cachedApplicationContext = {
        applicationId,
        contextType: activeApp.contextType,
        confidence,
        displayName,
      };

      console.log("[ApplicationDetectionService] === CACHE POPULATED SUCCESSFULLY ===", {
        applicationId: this.cachedApplicationContext.applicationId,
        displayName: this.cachedApplicationContext.displayName,
        confidence: this.cachedApplicationContext.confidence,
        contextType: this.cachedApplicationContext.contextType
      });
    } catch (error) {
      console.error('[ApplicationDetectionService] === ERROR IN BACKGROUND CAPTURE ===', error);
      this.cachedApplicationContext = this.getDefaultApplicationContext();
    }
  }

  /**
   * Get cached application context (fast retrieval for translation)
   */
  public getCachedApplicationContext(): ApplicationContextMapping | null {
    console.log("[ApplicationDetectionService] === RETRIEVING CACHED CONTEXT ===");
    console.log("[ApplicationDetectionService] Cache status:", {
      hasCache: !!this.cachedApplicationContext,
      applicationId: this.cachedApplicationContext?.applicationId,
      displayName: this.cachedApplicationContext?.displayName,
      confidence: this.cachedApplicationContext?.confidence,
      contextType: this.cachedApplicationContext?.contextType
    });

    return this.cachedApplicationContext;
  }

  /**
   * Clear cached application context (called on recording stop)
   */
  public clearCache(): void {
    console.log("[ApplicationDetectionService] Clearing application context cache");
    this.cachedApplicationContext = null;
  }

  /**
   * Get the currently active application information with OS-specific detection
   */
  public async getActiveApplication(): Promise<ActiveApplicationInfo | null> {
    try {
      if (process.platform === "darwin") {
        return await this.getActiveApplicationMacOS();
      } else if (process.platform === "win32") {
        return await this.getActiveApplicationWindows();
      } else {
        console.warn("[ApplicationDetectionService] Linux support not implemented");
        return null;
      }
    } catch (error) {
      console.error("[ApplicationDetectionService] Error detecting active application:", error);
      return null;
    }
  }

  /**
   * Get active application on macOS using AppleScript
   */
  private async getActiveApplicationMacOS(): Promise<ActiveApplicationInfo | null> {
    try {
      console.log("[ApplicationDetectionService] Running macOS detection...");

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
      console.log("[ApplicationDetectionService] AppleScript raw output:", stdout.trim());

      const parts = stdout.trim().split("|||");
      console.log("[ApplicationDetectionService] AppleScript parsed parts:", parts);

      if (parts.length >= 4) {
        const appName = parts[0];
        const processId = parseInt(parts[1]);
        const bundleId = parts[2];
        const windowTitle = parts[3];

        console.log("[ApplicationDetectionService] Extracted values:", {
          appName,
          processId,
          bundleId,
          windowTitle: windowTitle.substring(0, 100)
        });

        const contextType = this.determineContextType(appName, windowTitle, bundleId);
        console.log("[ApplicationDetectionService] Context type determined:", contextType);

        const result = {
          processName: appName.toLowerCase(),
          applicationName: appName,
          windowTitle,
          bundleId,
          processId,
          contextType
        };

        console.log("[ApplicationDetectionService] Final active app result:", {
          processName: result.processName,
          applicationName: result.applicationName,
          bundleId: result.bundleId,
          contextType: result.contextType
        });

        return result;
      }

      console.log("[ApplicationDetectionService] AppleScript parts insufficient:", parts.length);
      return null;
    } catch (error) {
      console.error("[ApplicationDetectionService] macOS detection failed:", error);
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
        const processName = parts[0];
        const processId = parseInt(parts[1]);
        const windowTitle = parts[2];

        return {
          processName: processName.toLowerCase(),
          applicationName: parts[0],
          windowTitle,
          processId,
          contextType: this.determineContextType(processName, windowTitle)
        };
      }

      return null;
    } catch (error) {
      console.error("[ApplicationDetectionService] Windows detection failed:", error);
      return null;
    }
  }

  /**
   * Determine context type using ApplicationMappingsConfig
   */
  private determineContextType(appName: string, windowTitle: string, bundleId?: string): ApplicationContextType {
    const bestMatch = this.mappingsConfig.findBestMatch(
      appName,
      appName.toLowerCase(),
      bundleId,
      windowTitle
    );

    if (bestMatch) {
      return bestMatch.contextType;
    }

    return ApplicationContextType.UNKNOWN;
  }


  /**
   * Get application context by application ID
   * This is used by TranslationService for direct lookups
   */
  public getApplicationContextById(applicationId: string): ApplicationContextMapping | null {
    const appPrompt = getApplicationPrompt(applicationId);
    if (!appPrompt) {
      return null;
    }

    let contextType = ApplicationContextType.UNKNOWN;
    const allMappings = this.mappingsConfig.getAllMappings();

    for (const mapping of allMappings) {
      const mappingId = this.convertToApplicationId(mapping.appName);
      if (mappingId === applicationId) {
        contextType = mapping.contextType;
        break;
      }
    }

    return {
      applicationId,
      contextType,
      confidence: 1.0,
      displayName: appPrompt.displayName,
    };
  }

  /**
   * Detect specific application ID from active application info
   */
  private detectApplicationId(activeApp: ActiveApplicationInfo): string {
    console.log("[ApplicationDetectionService] === DETECTING APPLICATION ID ===");

    const windowTitle = activeApp.windowTitle.toLowerCase();

    console.log("[ApplicationDetectionService] Input for ID detection:", {
      applicationName: activeApp.applicationName,
      processName: activeApp.processName,
      bundleId: activeApp.bundleId,
      windowTitle: windowTitle.substring(0, 100)
    });

    // Browser context detection
    if (this.isBrowserApp(activeApp.applicationName)) {
      console.log("[ApplicationDetectionService] Detected as browser app");
      const browserAppId = this.detectBrowserApplicationId(windowTitle);
      console.log("[ApplicationDetectionService] Browser app ID:", browserAppId);
      return browserAppId;
    }

    // Use ApplicationMappingsConfig for direct mapping
    console.log("[ApplicationDetectionService] Searching ApplicationMappingsConfig...");
    const bestMatch = this.mappingsConfig.findBestMatch(
      activeApp.applicationName,
      activeApp.processName,
      activeApp.bundleId,
      activeApp.windowTitle
    );

    console.log("[ApplicationDetectionService] ApplicationMappingsConfig result:", {
      found: !!bestMatch,
      appName: bestMatch?.appName,
      contextType: bestMatch?.contextType,
      confidence: bestMatch?.confidence
    });

    if (bestMatch) {
      const applicationId = this.convertToApplicationId(bestMatch.appName);
      console.log("[ApplicationDetectionService] Converted application ID:", {
        originalAppName: bestMatch.appName,
        convertedId: applicationId
      });
      return applicationId;
    }

    console.log("[ApplicationDetectionService] No match found, using default");
    return 'default';
  }

  /**
   * Check if the application is a browser
   */
  private isBrowserApp(appName: string): boolean {
    const browserNames = ['safari', 'google chrome', 'firefox', 'microsoft edge', 'arc', 'brave'];
    const cleanAppName = appName.toLowerCase();
    return browserNames.some(browser => cleanAppName.includes(browser));
  }

  /**
   * Detect browser-specific application ID
   */
  private detectBrowserApplicationId(windowTitle: string): string {
    const cleanTitle = windowTitle.toLowerCase().trim();

    if (cleanTitle.includes('gmail') || cleanTitle.includes('mail.google.com')) {
      return 'gmail';
    }

    if (cleanTitle.includes('github')) {
      return 'browser-github';
    }

    if (cleanTitle.includes('stackoverflow') || cleanTitle.includes('stack overflow')) {
      return 'browser-stackoverflow';
    }

    if (cleanTitle.includes('docs.google.com') || cleanTitle.includes('google docs')) {
      return 'docs';
    }

    if (cleanTitle.includes('slack')) {
      return 'slack';
    }

    if (cleanTitle.includes('notion')) {
      return 'notion';
    }

    return 'default';
  }

  /**
   * Convert application name to application ID format
   */
  private convertToApplicationId(appName: string): string {
    return appName.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^microsoft-/, '')
      .replace(/^apple-/, '')
      .replace(/^google-/, '');
  }

  /**
   * Calculate confidence score for the detected application
   */
  private calculateConfidence(activeApp: ActiveApplicationInfo, applicationId: string): number {
    let confidence = 0.5;

    if (activeApp.bundleId) {
      const bestMatch = this.mappingsConfig.findBestMatch(
        activeApp.applicationName,
        activeApp.processName,
        activeApp.bundleId,
        activeApp.windowTitle
      );
      if (bestMatch) {
        confidence = Math.min(bestMatch.confidence, 1.0);
      }
    }

    if (this.isBrowserApp(activeApp.applicationName) && applicationId.startsWith('browser-')) {
      confidence = 0.75;
    }

    if (applicationId === 'default') {
      confidence = 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get default application context
   */
  private getDefaultApplicationContext(): ApplicationContextMapping {
    const defaultPrompt = getDefaultApplicationPrompt();
    return {
      applicationId: 'default',
      contextType: ApplicationContextType.UNKNOWN,
      confidence: 0.1,
      displayName: defaultPrompt.displayName,
    };
  }
}