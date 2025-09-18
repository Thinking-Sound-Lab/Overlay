import * as path from "path";
import { Tray, nativeImage, Menu, app, shell, dialog } from "electron";
import { WindowManager } from "../windows/window-manager";
import { DataLoaderService } from "./data_loader_service";
import { MicrophoneService } from "./microphone_service";
import { AutoUpdateService } from "./auto_update_service";
import {
  SUPPORTED_LANGUAGES,
  getLanguageDisplayName,
} from "../../shared/constants/languages";

export class TrayService {
  private tray: Tray | null = null;

  constructor(
    private windowManager: WindowManager,
    private dataLoaderService: DataLoaderService,
    private microphoneService: MicrophoneService,
    private autoUpdateService: AutoUpdateService
  ) {}

  public initialize(): void {
    const iconPath = path.join(__dirname, "../../assets/icon.png");

    // Create tray with proper icon sizing for primary display
    let trayIcon = nativeImage.createFromPath(iconPath);

    // Ensure proper icon size for different displays
    if (process.platform === "darwin") {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    } else if (process.platform === "win32") {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }

    this.tray = new Tray(trayIcon);
    this.updateMenu();
    this.tray.setToolTip("Overlay");
  }

  public async updateMenu(): Promise<void> {
    if (!this.tray) return;

    console.log("[Tray] Updating tray menu...");

    // Get dynamic microphone submenu
    const microphoneSubmenu = await this.buildMicrophoneSubmenu();

    // Get dynamic language submenu
    const languageSubmenu = this.buildLanguageSubmenu();

    const userStats = this.dataLoaderService.getUserStats();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open Overlay",
        click: () => {
          if (!this.windowManager.getMainWindow()) {
            this.windowManager.createMainWindow();
          } else if (
            this.windowManager.getMainWindow() &&
            !this.windowManager.getMainWindow().isVisible()
          ) {
            // Window exists but is hidden, just show it without reloading
            this.windowManager.getMainWindow().show();
            this.windowManager.getMainWindow().focus();

            if (process.platform === "darwin") {
              app.dock.show();
            }
          } else if (
            this.windowManager.getMainWindow() &&
            this.windowManager.getMainWindow().isVisible()
          ) {
            // Window is already visible, just focus it
            this.windowManager.getMainWindow().focus();
            if (process.platform === "darwin") {
              app.dock.show();
            }
          }
        },
      },
      { label: `Total Words: ${userStats.totalWordCount}`, enabled: false },
      {
        label: `Average WPM: ${userStats.averageWPM.toFixed(1)}`,
        enabled: false,
      },
      {
        label: `Total Recordings: ${userStats.totalRecordings}`,
        enabled: false,
      },
      {
        label: `Streak: ${userStats.streakDays} days`,
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Share Feedback",
        click: () => {
          shell.openExternal("https://github.com/anthropics/claude-code/issues");
        },
      },
      { type: "separator" },
      {
        label: "Select microphone",
        submenu: microphoneSubmenu,
      },
      {
        label: "Output Language",
        submenu: languageSubmenu,
      },
      { type: "separator" },
      {
        label: `Overlay Version: ${app.getVersion()} - Up to date`,
        click: () => {
          this.autoUpdateService.checkForUpdates();
        },
      },
      { type: "separator" },
      {
        label: "About Overlay",
        click: () => {
          dialog.showMessageBox({
            type: "info",
            title: "About Overlay",
            message: `Overlay v${app.getVersion()}`,
            detail: `A powerful voice-to-text application that helps you dictate text efficiently.

Platform: ${process.platform}
Electron: ${process.versions.electron}
Chrome: ${process.versions.chrome}
Node.js: ${process.versions.node}

© ${new Date().getFullYear()} Overlay. All rights reserved.`,
            buttons: ["OK"],
          });
        },
      },
      { label: "Quit Overlay", click: () => app.quit() },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private async buildMicrophoneSubmenu(): Promise<Electron.MenuItemConstructorOptions[]> {
    try {
      const devices = await this.microphoneService.getAvailableDevices();
      console.log(`[Tray] Available devices:`, devices);

      // Get current selected device from session state (no database)
      const currentDeviceId = this.microphoneService.getCurrentDeviceId();
      console.log(`[Tray] Current selected device: ${currentDeviceId}`);

      return devices.map((device: any) => ({
        label: device.label || `Unknown Device`,
        type: "radio" as const,
        checked: currentDeviceId === device.deviceId,
        click: async () => {
          try {
            const result = await this.microphoneService.setCurrentDeviceId(
              device.deviceId
            );
            if (result.success) {
              console.log(
                `[Tray] Microphone changed to: ${device.label} (${device.deviceId})`
              );
              // Notify recording window of device change
              if (this.windowManager) {
                this.windowManager.sendToRecording("microphone-device-changed", {
                  deviceId: device.deviceId,
                });
              }
              this.updateMenu(); // Refresh menu to show new selection
            } else {
              console.error(
                "[Tray] Failed to set microphone device:",
                result.error
              );
            }
          } catch (error) {
            console.error("[Tray] Error setting microphone device:", error);
          }
        },
      }));
    } catch (error) {
      console.error("[Tray] Failed to load microphones for menu:", error);
      // MicrophoneService already has fallback handling, so just return empty array
      return [];
    }
  }

  private buildLanguageSubmenu(): Electron.MenuItemConstructorOptions[] {
    try {
      // Get current target language from data loader service
      const currentSettings = this.dataLoaderService?.getUserSettings();
      const currentTargetLanguage = currentSettings?.targetLanguage || "en";
      console.log(`[Tray] Current target language: ${currentTargetLanguage}`);

      return SUPPORTED_LANGUAGES.map((language) => ({
        label: getLanguageDisplayName(language.code),
        type: "radio" as const,
        checked: currentTargetLanguage === language.code,
        click: async () => {
          try {
            if (this.dataLoaderService && this.dataLoaderService.getCurrentUser()) {
              // Get current settings first
              const currentSettings = this.dataLoaderService.getUserSettings();
              if (!currentSettings) {
                console.error(
                  "[Tray] Cannot update language - no current settings available"
                );
                return;
              }

              // Update only the targetLanguage field
              const updatedSettings = {
                ...currentSettings,
                targetLanguage: language.code,
              };

              const result =
                await this.dataLoaderService.updateUserSettings(updatedSettings);
              if (result.success) {
                console.log(
                  `[Tray] Language changed to: ${getLanguageDisplayName(language.code)} (${language.code})`
                );
                // Notify main window of language change
                if (this.windowManager) {
                  this.windowManager.sendToMain("language-changed", {
                    targetLanguage: language.code,
                  });
                }
                this.updateMenu(); // Refresh menu to show new selection
              } else {
                console.error(
                  "[Tray] Failed to update target language:",
                  result.error
                );
              }
            } else {
              console.warn(
                "[Tray] Cannot update language - user not authenticated or data service unavailable"
              );
            }
          } catch (error) {
            console.error("[Tray] Error updating target language:", error);
          }
        },
      }));
    } catch (error) {
      console.error("[Tray] Failed to build language submenu:", error);
      return [];
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  public isInitialized(): boolean {
    return this.tray !== null;
  }
}