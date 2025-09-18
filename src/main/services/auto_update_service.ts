import { autoUpdater } from "electron-updater";
import { WindowManager } from "../windows/window-manager";
import { isProduction } from "../../shared/utils/environment";

export class AutoUpdateService {
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(private windowManager: WindowManager) {}

  public initialize(): void {
    if (this.initialized) {
      console.warn("[AutoUpdateService] Service already initialized");
      return;
    }

    console.log("[AutoUpdateService] Initializing autoupdate service...");

    // Configure autoUpdater
    this.configureAutoUpdater();

    // Set up event handlers
    this.setupEventHandlers();

    // Start automatic checks in production
    this.startAutomaticChecks();

    this.initialized = true;
    console.log("[AutoUpdateService] Autoupdate service initialized successfully");
  }

  private configureAutoUpdater(): void {
    // Bind method to maintain context
    autoUpdater.checkForUpdatesAndNotify =
      autoUpdater.checkForUpdatesAndNotify.bind(autoUpdater);

    // Don't auto-download, let user choose
    autoUpdater.autoDownload = false;

    // GitHub provider configuration for all platforms
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "Thinking-Sound-Lab",
      repo: "Overlay",
    });

    // Development configuration
    autoUpdater.forceDevUpdateConfig = process.env.NODE_ENV === "development";

    console.log("[AutoUpdateService] GitHub provider configuration:", {
      provider: "github",
      owner: "Thinking-Sound-Lab",
      repo: "Overlay",
      platform: process.platform,
    });
  }

  private setupEventHandlers(): void {
    autoUpdater.on("checking-for-update", () => {
      console.log("[AutoUpdateService] Checking for updates...");
    });

    autoUpdater.on("update-available", (info) => {
      console.log("[AutoUpdateService] Update available:", info.version);
      this.windowManager.sendToMain("update-available", {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on("update-not-available", () => {
      console.log("[AutoUpdateService] Update not available");
    });

    autoUpdater.on("error", (error) => {
      console.error("[AutoUpdateService] Error:", error);
    });

    autoUpdater.on("download-progress", (progress) => {
      console.log(`[AutoUpdateService] Download progress: ${progress.percent}%`);
      this.windowManager.sendToMain("update-download-progress", progress.percent);
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("[AutoUpdateService] Update downloaded:", info.version);
      this.windowManager.sendToMain("update-downloaded", {
        version: info.version,
      });
    });
  }

  private startAutomaticChecks(): void {
    if (!isProduction()) {
      console.log("[AutoUpdateService] Skipping automatic checks in development");
      return;
    }

    // Initial check after 1 second delay
    setTimeout(() => {
      this.checkForUpdates();

      // Schedule daily update checks
      this.updateCheckInterval = setInterval(
        () => {
          this.checkForUpdates();
        },
        24 * 60 * 60 * 1000
      ); // Check every 24 hours

      console.log("[AutoUpdateService] Scheduled daily update checks");
    }, 1000);
  }

  public async checkForUpdates(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("[AutoUpdateService] Manual update check triggered");
      await autoUpdater.checkForUpdatesAndNotify();
      return { success: true };
    } catch (error) {
      console.error("[AutoUpdateService] Check for updates failed:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("[AutoUpdateService] Starting update download");
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error("[AutoUpdateService] Download update failed:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public async installUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("[AutoUpdateService] Installing update and restarting");
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (error) {
      console.error("[AutoUpdateService] Install update failed:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public destroy(): void {
    console.log("[AutoUpdateService] Cleaning up autoupdate service...");

    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }

    // Remove all event listeners
    autoUpdater.removeAllListeners();

    this.initialized = false;
    console.log("[AutoUpdateService] Autoupdate service cleaned up");
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}