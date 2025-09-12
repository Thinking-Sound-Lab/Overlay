import * as path from "path";
import {
  app,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  shell,
  dialog,
} from "electron";
import { autoUpdater } from "electron-updater";

// Handle Squirrel events on Windows (must be early in the main process)
if (process.platform === "win32") {
  const squirrelStartup = require("electron-squirrel-startup");
  if (squirrelStartup) {
    console.log("[Squirrel] Squirrel event detected, quitting...");
    app.quit();
  }
}
import STTService from "./services/stt_service";
import {
  Settings,
  DatabaseTranscriptEntry,
  SpeechMetrics,
  TranslationResult,
} from "../shared/types";
import { WindowManager } from "./windows/window-manager";
import { ExternalAPIManager } from "./services/external_api_manager";
import { APIHandlers } from "./ipc/api_handlers";
import { AuthUtils } from "./utils/auth";
import { SystemAudioManager } from "./services/system_audio_manager";
import { DataLoaderService } from "./services/data_loader_service";
import { DictionaryService } from "./services/dictionary_service";
import {
  SUPPORTED_LANGUAGES,
  getLanguageDisplayName,
} from "../shared/constants/languages";
import MicrophoneService from "./services/microphone_service";
import { PermissionsService } from "./services/permissions_service";
// Webpack entry points
// declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
// declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
// declare const RECORDING_WINDOW_WEBPACK_ENTRY: string;
// declare const RECORDING_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
// declare const INFORMATION_WINDOW_WEBPACK_ENTRY: string;
// declare const INFORMATION_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let windowManager: WindowManager;
let tray: Tray | null = null;
let isRecording = false;
let isProcessing = false;
let hoverTimeout: NodeJS.Timeout | null = null;
let processingTimeout: NodeJS.Timeout | null = null;

// Hotkey test mode for onboarding
let isHotkeyTestMode = false;

// Renderer readiness tracking for auth state synchronization
let rendererReady = false;

// External API services
let externalAPIManager: ExternalAPIManager | null = null;
let apiHandlers: APIHandlers | null = null;
// AuthStateManager replaced by DataLoaderService
let systemAudioManager: SystemAudioManager | null = null;

// Auto-updater configuration
autoUpdater.checkForUpdatesAndNotify =
  autoUpdater.checkForUpdatesAndNotify.bind(autoUpdater);
autoUpdater.autoDownload = false; // Don't auto-download, let user choose

// GitHub provider configuration for all platforms
autoUpdater.setFeedURL({
  provider: "github",
  owner: "Thinking-Sound-Lab",
  repo: "Overlay",
});

// Development configuration
autoUpdater.forceDevUpdateConfig = process.env.NODE_ENV === "development";

console.log("[AutoUpdater] GitHub provider configuration:", {
  provider: "github",
  owner: "Thinking-Sound-Lab",
  repo: "Overlay",
  platform: process.platform,
});

// Auto-updater event handlers
autoUpdater.on("checking-for-update", () => {
  console.log("[AutoUpdater] Checking for updates...");
});

autoUpdater.on("update-available", (info) => {
  console.log("[AutoUpdater] Update available:", info.version);
  windowManager.sendToMain("update-available", {
    version: info.version,
    releaseNotes: info.releaseNotes,
  });
});

autoUpdater.on("update-not-available", () => {
  console.log("[AutoUpdater] Update not available");
});

autoUpdater.on("error", (error) => {
  console.error("[AutoUpdater] Error:", error);
});

autoUpdater.on("download-progress", (progress) => {
  console.log(`[AutoUpdater] Download progress: ${progress.percent}%`);
  windowManager.sendToMain("update-download-progress", progress.percent);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("[AutoUpdater] Update downloaded:", info.version);
  windowManager.sendToMain("update-downloaded", {
    version: info.version,
  });
});

// Initialize DataLoaderService - will be created when ExternalAPIManager is initialized
let dataLoaderService: DataLoaderService | null = null;

// Enhanced Auth State Management Helper Functions with Type Safety
import type { UserStats, UITranscriptEntry, UserRecord } from "../shared/types";
import { User } from "@supabase/auth-js/dist/module";
import { isDevelopment, isProduction } from "../shared/utils/environment";

interface AuthStateEventData {
  user: UserRecord | null;
  authenticated: boolean;
  statistics: UserStats | null;
  settings: Settings | null;
  recentTranscripts: UITranscriptEntry[];
  totalTranscriptCount: number;
  error?: string;
  source?: string;
}

/**
 * Send authenticated user state to renderer with error handling
 */
const sendAuthStateToRenderer = async (
  userData: AuthStateEventData,
  source = "Unknown"
): Promise<void> => {
  const mainWindow = windowManager.getMainWindow();
  if (!mainWindow || !userData) {
    console.warn(
      `[Main] Cannot send auth state - missing window or userData (source: ${source})`
    );
    return;
  }

  try {
    const eventData: AuthStateEventData = {
      user: userData.user,
      authenticated: userData.authenticated,
      statistics: userData.statistics,
      settings: userData.settings,
      recentTranscripts: userData.recentTranscripts || [],
      totalTranscriptCount: userData.totalTranscriptCount,
      error: userData.error,
      source,
    };

    console.log(`[Main] Sending auth state to renderer (${source}):`, {
      authenticated: eventData.authenticated,
      hasUser: !!eventData.user,
      userEmail: eventData.user?.email,
      onboardingCompleted: eventData.user?.onboarding_completed,
      settingsCount: Object.keys(eventData.settings || {}).length,
      transcriptCount: eventData.recentTranscripts.length,
      hasError: !!eventData.error,
      statistics: eventData.statistics,
    });

    windowManager.sendToMain("auth-state-changed", eventData);
  } catch (error) {
    console.error(
      `[Main] Error sending auth state to renderer (${source}):`,
      error
    );
  }
};

/**
 * Send unauthenticated state to renderer
 */
const sendUnauthenticatedStateToRenderer = (
  error?: string,
  source = "Unknown"
): void => {
  const mainWindow = windowManager.getMainWindow();
  if (!mainWindow) {
    console.warn(
      `[Main] Cannot send unauthenticated state - missing window (source: ${source})`
    );
    return;
  }

  try {
    const eventData: AuthStateEventData = {
      user: null,
      authenticated: false,
      statistics: null,
      settings: null,
      recentTranscripts: [],
      totalTranscriptCount: undefined,
      error,
      source,
    };

    console.log(
      `[Main] Sending unauthenticated state to renderer (${source}):`,
      {
        error: error || "No error",
      }
    );

    windowManager.sendToMain("auth-state-changed", eventData);
  } catch (error) {
    console.error(
      `[Main] Error sending unauthenticated state (${source}):`,
      error
    );
  }
};

/**
 * Handle successful authentication with improved error handling and optimizations
 */
const handleAuthenticationSuccess = async (
  user: User,
  source: string
): Promise<void> => {
  if (!user?.id) {
    console.error(
      `[Main] Authentication success handler called without valid user (${source})`
    );
    sendUnauthenticatedStateToRenderer("Invalid user data", source);
    return;
  }

  console.log(
    `[Main] Handling authentication success for ${user.email} (${source})`
  );

  try {
    // Check if we already have data for this user to avoid unnecessary reloading
    const cachedUserId = dataLoaderService?.getCacheInfo()?.userId;
    let userData;

    if (cachedUserId === user.id) {
      console.log(`[Main] Using existing data for user ${user.id} (cache hit)`);
      // Still refresh to ensure we have latest data, but log it as optimization opportunity
      userData = await dataLoaderService?.loadUserData(user.id);
    } else {
      console.log(`[Main] Loading fresh data for new user ${user.id}`);
      userData = await dataLoaderService?.initializeUserData(user.id);
    }

    if (userData) {
      AuthUtils.setAuthenticationState(true);
      await sendAuthStateToRenderer(userData, source);

      // Initialize authenticated services
      if (!windowManager.getRecordingWindow()) {
        windowManager.createRecordingWindow();
      }

      // Show/hide recording window based on onboarding status
      if (userData.user?.onboarding_completed) {
        console.log(
          "[Main] User completed onboarding, showing recording window"
        );
        windowManager.showRecordingWindow();
      } else {
        console.log(
          "[Main] User onboarding not completed, keeping recording window hidden"
        );
        windowManager.hideRecordingWindow();
      }

      // Create information window for user notifications (hidden by default)
      if (!windowManager.getInformationWindow()) {
        windowManager.createInformationWindow();
      }

      // Initialize STT service for authenticated user
      if (sttService) {
        console.log("[Main] Initializing STT service for authenticated user");
        await sttService.initialize();
      }

      if (isDevelopment()) {
        windowManager.openDevTools("recording");
        windowManager.openDevTools("information");
      }

      // Update tray menu for authenticated state
      updateTrayMenu();
    } else {
      throw new Error("DataLoaderService returned no data");
    }
  } catch (error) {
    console.error(
      `[Main] Error during authentication success handling (${source}):`,
      error
    );
    sendUnauthenticatedStateToRenderer(
      `Failed to load user data: ${error.message}`,
      source
    );
  }
};

/**
 * Handle authentication failure or sign-out
 */
const handleAuthenticationFailure = (
  error?: string,
  source = "Unknown"
): void => {
  console.log(
    `[Main] Handling authentication failure (${source}):`,
    error || "No error provided"
  );

  // CRITICAL: Completely disable STT service for unauthenticated users to prevent realtime mode from continuing
  if (sttService) {
    console.log(
      "[Main] Disabling STT service during logout - stopping all connections and realtime mode..."
    );

    // Disable STT service completely for unauthenticated user
    sttService.disableForUnauthenticatedUser();

    console.log(
      "[Main] STT service disabled completely - realtime mode will not operate until user re-authenticates"
    );
  }

  // Close authenticated-only windows
  if (
    windowManager.getRecordingWindow() &&
    !windowManager.getRecordingWindow().isDestroyed()
  ) {
    console.log("[Main] Closing recording window due to logout");
    windowManager.getRecordingWindow().close();
  }

  // Clear all user data
  dataLoaderService?.clearUserData();

  // Send unauthenticated state
  sendUnauthenticatedStateToRenderer(error, source);

  // Update tray menu for unauthenticated state
  updateTrayMenu();
};

// STT Service will be initialized after external API manager is ready
let sttService: STTService;

// Recovery function for stuck processing states
const handleProcessingTimeout = () => {
  console.error("[Main] Processing timeout reached - forcing recovery");

  // Reset main process state
  isProcessing = false;

  // Clear any existing timeout
  if (processingTimeout) {
    clearTimeout(processingTimeout);
    processingTimeout = null;
  }

  // Restore system audio if muted
  if (systemAudioManager) {
    systemAudioManager.restoreSystemAudio().catch(console.error);
  }

  // Reset recording window from processing state
  if (
    windowManager.getRecordingWindow() &&
    !windowManager.getRecordingWindow().isDestroyed()
  ) {
    windowManager.sendToRecording("processing-complete");
    windowManager.compactRecordingWindow();
  }

  // Show error in information window
  windowManager.showInformation({
    type: "processing-error",
    title: "Processing Timeout",
    message: "Recording timed out and was reset",
    duration: 4000,
  });

  console.log("[Main] Processing timeout recovery completed");
};

// ----------- Window & Tray Functions -----------

const createMainWindow = () => {
  const mainWindow = windowManager.createMainWindow();

  // Set main window for microphone service after creation
  MicrophoneService.getInstance().setMainWindow(mainWindow);

  // Window ready - wait for renderer to signal when it's ready for auth events
  mainWindow.webContents.once("did-finish-load", async () => {
    console.log(
      "[Main] Main window loaded, waiting for renderer to signal ready for auth events"
    );
  });

  if (isDevelopment()) {
    windowManager.openDevTools("main");
  }
};

const createTray = () => {
  const iconPath = path.join(__dirname, "../../assets/icon.png");

  // Create tray with proper icon sizing for primary display
  let trayIcon = nativeImage.createFromPath(iconPath);

  // Ensure proper icon size for different displays
  if (process.platform === "darwin") {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } else if (process.platform === "win32") {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon);

  updateTrayMenu();
  tray.setToolTip("Overlay");
};

// Helper function to build microphone submenu
const buildMicrophoneSubmenu = async (): Promise<
  Electron.MenuItemConstructorOptions[]
> => {
  try {
    const micService = MicrophoneService.getInstance();
    const devices = await micService.getAvailableDevices();

    console.log(`[Tray] Available devices:`, devices);

    // Get current selected device from session state (no database)
    const currentDeviceId = micService.getCurrentDeviceId();

    console.log(`[Tray] Current selected device: ${currentDeviceId}`);

    return devices.map((device: any) => ({
      label: device.label || `Unknown Device`,
      type: "radio" as const,
      checked: currentDeviceId === device.deviceId,
      click: async () => {
        // Update microphone selection in session state only (no database)
        try {
          const result = await micService.setCurrentDeviceId(device.deviceId);
          if (result.success) {
            console.log(
              `[Tray] Microphone changed to: ${device.label} (${device.deviceId})`
            );

            // Notify recording window of device change
            if (windowManager) {
              windowManager.sendToRecording("microphone-device-changed", {
                deviceId: device.deviceId,
              });
            }

            updateTrayMenu(); // Refresh menu to show new selection
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
};

// Helper function to build language submenu
const buildLanguageSubmenu = (): Electron.MenuItemConstructorOptions[] => {
  try {
    // Get current target language from data loader service
    const currentSettings = dataLoaderService?.getUserSettings();
    const currentTargetLanguage = currentSettings?.targetLanguage || "en";

    console.log(`[Tray] Current target language: ${currentTargetLanguage}`);

    return SUPPORTED_LANGUAGES.map((language) => ({
      label: getLanguageDisplayName(language.code),
      type: "radio" as const,
      checked: currentTargetLanguage === language.code,
      click: async () => {
        try {
          // Update target language in settings
          if (dataLoaderService && AuthUtils.isUserAuthenticated()) {
            // Get current settings first
            const currentSettings = dataLoaderService.getUserSettings();
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
              await dataLoaderService.updateUserSettings(updatedSettings);

            if (result.success) {
              console.log(
                `[Tray] Language changed to: ${getLanguageDisplayName(language.code)} (${language.code})`
              );

              // Notify main window of language change
              if (windowManager) {
                windowManager.sendToMain("language-changed", {
                  targetLanguage: language.code,
                });
              }

              updateTrayMenu(); // Refresh menu to show new selection
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
};

const updateTrayMenu = async () => {
  if (!tray) return;

  console.log("[Tray] Updating tray menu...");
  // Get dynamic microphone submenu
  const microphoneSubmenu = await buildMicrophoneSubmenu();
  // Get dynamic language submenu
  const languageSubmenu = buildLanguageSubmenu();
  const userStats = dataLoaderService.getUserStats();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Overlay",
      click: () => {
        if (!windowManager.getMainWindow()) {
          createMainWindow();
        } else if (
          windowManager.getMainWindow() &&
          !windowManager.getMainWindow().isVisible()
        ) {
          // Window exists but is hidden, just show it without reloading
          windowManager.getMainWindow().show();
          windowManager.getMainWindow().focus();

          if (process.platform === "darwin") {
            app.dock.show();
          }
        } else if (
          windowManager.getMainWindow() &&
          windowManager.getMainWindow().isVisible()
        ) {
          // Window is already visible, just focus it
          windowManager.getMainWindow().focus();
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
        autoUpdater.checkForUpdatesAndNotify();
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
  tray.setContextMenu(contextMenu);
};

// ----------- Hotkey & Dictation Logic -----------

const registerGlobalHotkey = () => {
  let hotkey: string | null = null;

  switch (process.platform) {
    case "darwin": // macOS
      hotkey = "option+space";
      break;
    case "win32": // Windows
      hotkey = "ctrl+alt+space"; // cmd maps to Windows key on Windows
      break;
    default: // Linux and others - no hotkey
      console.log(
        `[Main] Global hotkey not supported on platform: ${process.platform}`
      );
      return;
  }

  if (hotkey) {
    globalShortcut.register(hotkey, async () => {
      // If in test mode, just notify main window and don't start recording
      if (isHotkeyTestMode) {
        console.log("[Main] Hotkey detected during test mode");
        if (windowManager.getMainWindow()) {
          windowManager.sendToMain("hotkey-detected");
        }
        return;
      }

      // Normal recording behavior
      if (isProcessing) return;
      if (isRecording) await stopRecording();
      else await startRecording();
    });
    console.log(
      `[Main] Global hotkey registered: ${hotkey} (${process.platform})`
    );
  }
};

const startRecording = async () => {
  // Don't allow recording if user is not authenticated
  if (!AuthUtils.isUserAuthenticated()) {
    console.log("[Main] Recording blocked - user not authenticated");
    windowManager.sendToInformation("User not authenticated");
    return;
  }

  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  if (isRecording || isProcessing) return;
  isRecording = true;

  // Mute system audio BEFORE starting recording
  if (systemAudioManager) {
    await systemAudioManager.muteSystemAudio();
  }

  // Recording window should already exist after authentication
  // Only use existing window, don't create for unauthorized users

  if (windowManager.getRecordingWindow()) {
    windowManager.expandRecordingWindow();
  }

  windowManager.sendToRecording("recording-started");

  // Start batch STT session logic
  sttService.startDictation();
  console.log("[Main] Recording session started");
};

const stopRecording = async () => {
  if (!isRecording) return;
  isRecording = false;

  if (isProcessing) return;
  isProcessing = true;

  // Set up processing timeout (30 seconds)
  processingTimeout = setTimeout(() => {
    console.warn("[Main] Processing timeout reached - forcing recovery");
    handleProcessingTimeout();
  }, 30000);

  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }

  // add a delay of 1 second before finalizing dictation
  setTimeout(async () => {
    // Update processing stage and send to UI
    windowManager.sendToRecording("recording-stopped");

    // Restore system audio as soon as recording stops and transcription begins
    if (systemAudioManager) {
      await systemAudioManager.restoreSystemAudio();
    }

    try {
      // Stage 1: Transcribing
      await sttService.finalizeDictation();
      console.log("[Main] Dictation finalized successfully");
    } catch (error) {
      console.error("[Main] Error finalizing dictation:", error);

      // Ensure audio is restored even in error cases
      if (systemAudioManager) {
        await systemAudioManager.restoreSystemAudio();
      }

      // Send error to information window
      windowManager.showInformation({
        type: "processing-error",
        title: "Processing Error",
        message: error.message,
        duration: 4000,
      });

      // Reset recording window from processing state on error
      if (
        windowManager.getRecordingWindow() &&
        !windowManager.getRecordingWindow().isDestroyed()
      ) {
        windowManager.sendToRecording("processing-complete");
        windowManager.compactRecordingWindow();
      }
    } finally {
      // Clear processing timeout
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        processingTimeout = null;
      }

      // Reset processing state - window management moved to handleMetricsUpdate
      isProcessing = false;
    }
  }, 500);
};

// ----------- App Lifecycle -----------

// Register custom protocol for OAuth
app.setAsDefaultProtocolClient("overlay");

// Handle OAuth callback URLs
app.on("open-url", async (event, url) => {
  event.preventDefault();
  console.log("[Main] Received OAuth callback URL:", url);
  await handleOAuthCallback(url);
});

// Handle OAuth callback URL parsing and authentication
const handleOAuthCallback = async (url: string) => {
  try {
    const urlObj = new URL(url);

    console.log("[Main] Received OAuth callback URL:", urlObj);

    if (urlObj.protocol === "overlay:" && urlObj.pathname === "/callback") {
      console.log("[Main] Processing OAuth callback...");

      // Extract OAuth parameters from hash fragment (implicit flow)
      if (!urlObj.hash) {
        console.error(
          "[Main] OAuth callback missing hash fragment with tokens"
        );
        sendUnauthenticatedStateToRenderer(
          "OAuth callback missing required token data",
          "OAuth Error - Missing Hash"
        );
        return;
      }

      const hashParams = new URLSearchParams(urlObj.hash.substring(1)); // Remove # prefix

      // Check for OAuth errors
      const error = hashParams.get("error");
      const errorDescription = hashParams.get("error_description");
      if (error) {
        console.error("[Main] OAuth error:", { error, errorDescription });
        handleAuthenticationFailure(
          `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`,
          "OAuth Error"
        );
        return;
      }

      // Extract tokens from hash fragment
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const tokenType = hashParams.get("token_type");
      const expiresIn = hashParams.get("expires_in");

      console.log("[Main] OAuth tokens received:", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        tokenType: tokenType,
        expiresIn: expiresIn,
      });

      if (!accessToken || !refreshToken) {
        console.error("[Main] OAuth callback missing required tokens");
        sendUnauthenticatedStateToRenderer(
          "OAuth callback missing access_token or refresh_token",
          "OAuth Error - Missing Tokens"
        );
        return;
      }

      if (!externalAPIManager?.supabase) {
        console.error("[Main] Supabase service not available for OAuth");
        sendUnauthenticatedStateToRenderer(
          "Authentication service not available",
          "OAuth Error - Service Unavailable"
        );
        return;
      }

      // Create session directly with tokens from implicit flow
      console.log("[Main] Creating Supabase session with OAuth tokens...");

      try {
        const { data, error } =
          await externalAPIManager.supabase.setSessionWithTokens(
            accessToken,
            refreshToken
          );

        if (error) {
          console.error("[Main] Error creating session with tokens:", error);
          sendUnauthenticatedStateToRenderer(
            `Authentication failed: ${error.message}`,
            "OAuth Error - Session Creation"
          );
          return;
        }

        if (data.session && data.user) {
          // Update main process state
          AuthUtils.setAuthenticationState(true);

          // Focus main window
          const mainWindow = windowManager.getMainWindow();
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          console.error("[Main] Session created but no user data received");
          sendUnauthenticatedStateToRenderer(
            "Authentication completed but no user session received",
            "OAuth Error - No User Data"
          );
        }
      } catch (tokenError) {
        console.error(
          "[Main] Exception during token session creation:",
          tokenError
        );
        sendUnauthenticatedStateToRenderer(
          `Token authentication failed: ${tokenError.message}`,
          "OAuth Error - Token Exception"
        );
      }
    }
  } catch (error) {
    console.error("[Main] Error handling OAuth callback:", error);
    sendUnauthenticatedStateToRenderer(
      "Unexpected error during OAuth processing",
      "OAuth Error - Unexpected"
    );
  }
};

// Single instance handling to prevent multiple app instances
// This is especially important for Windows protocol handling
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  console.log("[Main] Another instance is running, quitting...");
  app.quit();
} else {
  // This is the first instance, handle second instance attempts
  app.on("second-instance", (event, commandLine) => {
    console.log("[Main] Second instance detected, focusing existing window");

    // Focus main window if it exists
    if (windowManager?.getMainWindow()) {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // On Windows, bring to front
      if (process.platform === "win32") {
        mainWindow.show();
      }
    }

    // Handle protocol URL from command line (Windows specific)
    // On Windows, protocol URLs are passed as command line arguments to new instances
    if (process.platform === "win32" && commandLine.length > 1) {
      // Look for overlay:// protocol in command line arguments
      const protocolArg = commandLine.find((arg) =>
        arg.startsWith("overlay://")
      );
      if (protocolArg) {
        console.log(
          "[Main] Processing protocol URL from second instance:",
          protocolArg
        );
        handleOAuthCallback(protocolArg);
      }
    }
  });
}

app.whenReady().then(async () => {
  try {
    console.log("[Main] Initializing external API services...");

    // Initialize window manager first
    windowManager = new WindowManager();

    // Initialize external API manager and handlers
    externalAPIManager = new ExternalAPIManager();
    apiHandlers = new APIHandlers(externalAPIManager, windowManager);
    dataLoaderService = DataLoaderService.getInstance(
      externalAPIManager.supabase
    );

    // Initialize system audio manager
    systemAudioManager = new SystemAudioManager();

    // Initialize microphone service with default device selection
    await MicrophoneService.getInstance().initializeDefaultDevice();

    // Initialize auth utils with API manager
    AuthUtils.setAuthManager(externalAPIManager);

    // Initialize STT service with analytics and dictionary support
    const dictionaryService = DictionaryService.getInstance(
      externalAPIManager.supabase
    );
    sttService = new STTService(
      dataLoaderService,
      async (
        metrics: SpeechMetrics,
        transcript?: string,
        translationMeta?: TranslationResult
      ) => {
        console.log("[Main] STT metrics received:", {
          wordCount: metrics.wordCount,
          wpm: metrics.wordsPerMinute,
          hasTranscript: !!transcript,
          wasTranslated: !!translationMeta?.wasTranslated,
        });

        // Handle transcript saving if provided and user is authenticated
        if (
          transcript &&
          transcript.trim() &&
          AuthUtils.isUserAuthenticated() &&
          dataLoaderService
        ) {
          const userId = dataLoaderService.getCacheInfo().userId;

          if (userId) {
            const transcriptData: Omit<
              DatabaseTranscriptEntry,
              "id" | "created_at"
            > = {
              user_id: userId,
              text: transcript.trim(),
              original_text: translationMeta?.originalText,
              language: translationMeta?.sourceLanguage || "en",
              target_language: translationMeta?.targetLanguage,
              was_translated: !!translationMeta?.wasTranslated,
              confidence: translationMeta?.confidence,
              word_count: metrics.wordCount,
              wpm: metrics.wordsPerMinute,
              metadata: {
                localId: Date.now().toString(),
                detectedLanguage: translationMeta?.detectedLanguage,
                wordCountRatio: translationMeta?.wordCountRatio,
              },
            };

            try {
              // Save transcript using DataLoaderService (DB-first approach)
              const result =
                await dataLoaderService.addTranscript(transcriptData);

              if (result.success) {
                console.log("[Main] Transcript saved to database successfully");

                // Debug: Log the full translationMeta structure
                console.log(
                  "[Main] Full translationMeta received:",
                  JSON.stringify(translationMeta, null, 2)
                );

                // Create UI transcript for renderer notification
                const uiTranscript = {
                  id: transcriptData.metadata.localId,
                  text: transcript.trim(),
                  timestamp: new Date(),
                  wordCount: metrics.wordCount,
                  wpm: metrics.wordsPerMinute,
                  originalText: translationMeta?.originalText,
                  sourceLanguage: translationMeta?.sourceLanguage,
                  targetLanguage: translationMeta?.targetLanguage,
                  wasTranslated: translationMeta?.wasTranslated,
                  confidence: translationMeta?.confidence,
                  detectedLanguage: translationMeta?.detectedLanguage,
                  wordCountRatio: translationMeta?.wordCountRatio,
                };

                if (
                  windowManager.getMainWindow() &&
                  !windowManager.getMainWindow().isDestroyed()
                ) {
                  // Send activity-updated event for immediate UI transcript display
                  windowManager.sendToMain("transcript-updated", uiTranscript);

                  // Send statistics-updated event for stats refresh
                  const currentStats = dataLoaderService.getUserStats();
                  windowManager.sendToMain("statistics-updated", currentStats);
                }

                // Send processing-complete event to recording window
                if (
                  windowManager.getRecordingWindow() &&
                  !windowManager.getRecordingWindow().isDestroyed()
                ) {
                  windowManager.sendToRecording("processing-complete");

                  // Clear processing timeout on success
                  if (processingTimeout) {
                    clearTimeout(processingTimeout);
                    processingTimeout = null;
                  }

                  // Reset processing state and animate window back to compact
                  isProcessing = false;
                  windowManager.compactRecordingWindow();
                }

                // Update tray with latest stats
                updateTrayMenu();
              } else {
                console.error(
                  "[Main] Failed to save transcript:",
                  result.error
                );
              }
            } catch (error) {
              console.error("[Main] Error saving transcript:", error);
            }
          } else {
            console.warn("[Main] Cannot save transcript: no user ID available");
          }
        } else if (
          transcript &&
          transcript.trim() &&
          !AuthUtils.isUserAuthenticated()
        ) {
          console.log(
            "[Main] User not authenticated, transcript will not be saved to database"
          );
        }
      },
      externalAPIManager.analytics,
      windowManager,
      dictionaryService
    );

    // Register auth state callback with hybrid approach for renderer synchronization
    externalAPIManager.supabase.setAuthStateChangeCallback(async (user) => {
      if (rendererReady) {
        // Normal flow - renderer is ready to handle auth events
        if (user) {
          await handleAuthenticationSuccess(user, "Auth State Change");
        } else {
          handleAuthenticationFailure("User signed out", "Auth State Change");
        }
      } else {
        // Renderer not ready yet - only handle logout (cleanup), defer login events
        if (!user) {
          handleAuthenticationFailure(
            "User signed out",
            "Auth State Change - Early"
          );
        }
        // For login events, wait for renderer to signal ready and check auth state then
        console.log(
          "[Main] Auth state change detected but renderer not ready, deferring login event"
        );
      }
    });

    updateTrayMenu();
    console.log("[Main] External API services initialized successfully");

    // Create main window AFTER all services are initialized

    createMainWindow();
  } catch (error) {
    console.error("[Main] Failed to initialize external API services:", error);

    // Still create window even if services fail
    createMainWindow();
  }

  // STT service will be initialized when user authenticates
  console.log(
    "[Main] STT service created but not initialized - waiting for user authentication"
  );

  // Export sttService for use by other modules

  setTimeout(() => {
    createTray();
    registerGlobalHotkey();

    // Check for updates after initial setup (only in production)
    if (isProduction()) {
      autoUpdater.checkForUpdatesAndNotify();

      // Schedule daily update checks
      setInterval(
        () => {
          autoUpdater.checkForUpdatesAndNotify();
        },
        24 * 60 * 60 * 1000
      ); // Check every 24 hours
    }
  }, 1000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  console.log("[Main] App activate event triggered");

  const existingWindow = windowManager.getMainWindow();

  // Check if we have a valid window
  if (!existingWindow || existingWindow.isDestroyed()) {
    console.log("[Main] No main window exists, creating new one");
    createMainWindow();
  } else if (!existingWindow.isVisible()) {
    console.log("[Main] Main window exists but is hidden, showing it");
    existingWindow.show();
    existingWindow.focus();
  } else {
    console.log(
      "[Main] Main window already exists and is visible, focusing it"
    );
    existingWindow.focus();
  }
});
app.on("will-quit", async () => {
  console.log("[Main] App shutting down, cleaning up services...");

  globalShortcut.unregisterAll();

  // Restore system audio before shutdown
  if (systemAudioManager) {
    await systemAudioManager.restoreSystemAudio();
    systemAudioManager = null;
  }

  // Cleanup external API services
  if (apiHandlers) {
    apiHandlers.removeAllHandlers();
  }

  if (externalAPIManager) {
    await externalAPIManager.shutdown();
  }

  // Clear auth state manager reference
  // AuthStateManager replaced with DataLoaderService

  console.log("[Main] Services cleanup completed");
});

// ----------- IPC Handlers -----------

ipcMain.handle(
  "audio-recorded",
  (_event, audioData: { data: string; mimeType: string }) => {
    console.log("[Main] Received audio chunk:", audioData.data.length, "bytes");
    if (isRecording) {
      sttService.receiveAudioData(audioData.data);
    }
    return { success: true };
  }
);

ipcMain.handle("window-hover-enter", () => {
  if (windowManager.getRecordingWindow() && !isRecording) {
    windowManager.expandRecordingWindow();
  }
});

ipcMain.handle("window-hover-leave", () => {
  if (
    !windowManager.getRecordingWindow() ||
    windowManager.getRecordingWindow().isDestroyed()
  )
    return;

  if (isProcessing) return;

  if (!isRecording) {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    hoverTimeout = setTimeout(() => {
      if (!isRecording && !isProcessing && windowManager.getRecordingWindow()) {
        windowManager.compactRecordingWindow();
      }
    }, 500);
  }
});

ipcMain.handle("open-external-link", (event, url) => {
  shell.openExternal(url);
});

// Authentication handlers
ipcMain.handle("on-authentication-complete", (_event, user) => {
  if (!user) {
    console.error("[Main] Authentication complete called with no user data");
    return { success: false, error: "No user data provided" };
  }

  AuthUtils.setAuthenticationState(true);
  console.log("[Main] User authenticated:", user.email);

  // Windows are already created in handleAuthenticationSuccess
  // No need to create them here again

  return { success: true };
});

// Auth state refresh handler - reload auth state from database after onboarding completion
ipcMain.handle("refresh-auth-state", async () => {
  console.log("[Main] Auth state refresh requested");

  if (!AuthUtils.isUserAuthenticated()) {
    console.error("[Main] Cannot refresh auth state - user not authenticated");
    return { success: false, error: "User not authenticated" };
  }

  try {
    const currentUser = externalAPIManager.supabase.getCurrentUser();
    console.log("[Main] Refreshing auth state for user:", currentUser?.email);

    // Use enhanced authentication handling for refresh
    await handleAuthenticationSuccess(currentUser, "Auth Refresh");

    // Load fresh profile to get onboarding status for return value
    const profileResult = await externalAPIManager.supabase.getUserProfile();
    const onboardingCompleted =
      profileResult.data?.onboarding_completed || true;

    return { success: true, onboardingCompleted };
  } catch (error) {
    console.error("[Main] Error refreshing auth state:", error);
    return { success: false, error: error.message };
  }
});

// Recording window control handlers
ipcMain.handle("expand-recording-window", () => {
  if (
    windowManager.getRecordingWindow() &&
    !windowManager.getRecordingWindow().isDestroyed()
  ) {
    windowManager.expandRecordingWindow();
  }
  return { success: true };
});

ipcMain.handle("compact-recording-window", () => {
  if (
    windowManager.getRecordingWindow() &&
    !windowManager.getRecordingWindow().isDestroyed()
  ) {
    windowManager.compactRecordingWindow();
  }
  return { success: true };
});

// Information window tooltip handlers
ipcMain.handle("show-recording-tooltip", (event, type: string, message: string) => {
  const tooltipMessage = {
    type: type as any, // Cast to InformationMessage type
    title: "",
    message,
    duration: 2000, // Shorter duration for tooltips
  };
  windowManager.showInformation(tooltipMessage);
  return { success: true };
});

// Permission checking handlers
ipcMain.handle("check-accessibility-permission", async () => {
  const permissionsService = PermissionsService.getInstance();
  const result = await permissionsService.checkAccessibilityPermission();
  return result.granted;
});

ipcMain.handle("check-microphone-permission", async () => {
  const permissionsService = PermissionsService.getInstance();
  const result = await permissionsService.checkMicrophonePermission();
  return result.granted;
});

ipcMain.handle("request-accessibility-permission", async () => {
  const permissionsService = PermissionsService.getInstance();
  return await permissionsService.requestAccessibilityPermission();
});

ipcMain.handle("request-microphone-permission", async () => {
  const permissionsService = PermissionsService.getInstance();
  return await permissionsService.requestMicrophonePermission();
});

// Auto-updater IPC handlers
ipcMain.handle("check-for-updates", () => {
  autoUpdater.checkForUpdatesAndNotify();
  return { success: true };
});

ipcMain.handle("download-update", () => {
  autoUpdater.downloadUpdate();
  return { success: true };
});

ipcMain.handle("install-update", () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});

// Recording control handlers
ipcMain.handle("recording:start", async () => {
  try {
    await startRecording();
    return { success: true };
  } catch (error) {
    console.error("[Main] Recording start failed:", error);
    return { success: false, error: "Failed to start recording" };
  }
});

ipcMain.handle("recording:stop", async () => {
  try {
    await stopRecording();
    return { success: true };
  } catch (error) {
    console.error("[Main] Recording stop failed:", error);
    return { success: false, error: "Failed to stop recording" };
  }
});

ipcMain.handle("recording:cancel", async () => {
  try {
    // Cancel recording without processing
    if (!isRecording) return { success: false, error: "Not recording" };
    
    isRecording = false;
    
    // Clean up recording resources - pass false to prevent transcript processing
    sttService.stopDictation(false);
    
    // Restore system audio
    if (systemAudioManager) {
      await systemAudioManager.restoreSystemAudio();
    }
    
    // Reset window state
    if (windowManager.getRecordingWindow()) {
      windowManager.compactRecordingWindow();
      windowManager.sendToRecording("processing-complete");
    }
    
    console.log("[Main] Recording cancelled");
    return { success: true };
  } catch (error) {
    console.error("[Main] Recording cancel failed:", error);
    return { success: false, error: "Failed to cancel recording" };
  }
});

// Window control handlers for custom navigation bar
ipcMain.handle("window:close", () => {
  if (
    windowManager.getMainWindow() &&
    !windowManager.getMainWindow().isDestroyed()
  ) {
    windowManager.getMainWindow().close();
    return { success: true };
  }
  return { success: false, error: "Main window not available" };
});

ipcMain.handle("window:minimize", () => {
  if (
    windowManager.getMainWindow() &&
    !windowManager.getMainWindow().isDestroyed()
  ) {
    windowManager.getMainWindow().minimize();
    return { success: true };
  }
  return { success: false, error: "Main window not available" };
});

ipcMain.handle("window:maximize", () => {
  if (
    windowManager.getMainWindow() &&
    !windowManager.getMainWindow().isDestroyed()
  ) {
    if (windowManager.getMainWindow().isMaximized()) {
      windowManager.getMainWindow().restore();
      return { success: true, action: "restored" };
    } else {
      windowManager.getMainWindow().maximize();
      return { success: true, action: "maximized" };
    }
  }
  return { success: false, error: "Main window not available" };
});

ipcMain.handle("window:get-maximized-state", () => {
  if (
    windowManager.getMainWindow() &&
    !windowManager.getMainWindow().isDestroyed()
  ) {
    return { isMaximized: windowManager.getMainWindow().isMaximized() };
  }
  return { isMaximized: false };
});

// Language change handler - sync language between tray and main window
ipcMain.handle(
  "update-target-language",
  async (event, languageCode: string) => {
    try {
      if (!dataLoaderService || !AuthUtils.isUserAuthenticated()) {
        return {
          success: false,
          error: "User not authenticated or data service unavailable",
        };
      }

      // Get current settings first
      const currentSettings = dataLoaderService.getUserSettings();
      if (!currentSettings) {
        return { success: false, error: "No current settings available" };
      }

      // Update only the targetLanguage field
      const updatedSettings = {
        ...currentSettings,
        targetLanguage: languageCode,
      };

      // Update target language in settings
      const result =
        await dataLoaderService.updateUserSettings(updatedSettings);

      if (result.success) {
        console.log(`[IPC] Target language updated to: ${languageCode}`);

        // Update tray menu to reflect the change
        updateTrayMenu();

        return { success: true };
      } else {
        console.error("[IPC] Failed to update target language:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("[IPC] Error updating target language:", error);
      return { success: false, error: error.message };
    }
  }
);

// Hotkey test mode handlers
ipcMain.handle("start-hotkey-test", () => {
  console.log("[Main] Starting hotkey test mode");
  isHotkeyTestMode = true;
  return { success: true };
});

ipcMain.handle("end-hotkey-test", () => {
  console.log("[Main] Ending hotkey test mode");
  isHotkeyTestMode = false;
  return { success: true };
});

// Renderer readiness handler for auth state synchronization
ipcMain.handle("renderer-ready-for-auth", async () => {
  console.log("[Main] Renderer signaled ready for auth events");
  rendererReady = true;

  // Check current auth state and send to now-ready renderer
  try {
    const currentUser = externalAPIManager.supabase.getCurrentUser();
    if (currentUser) {
      console.log(
        "[Main] Sending auth state to ready renderer - user authenticated:",
        currentUser.email
      );
      await handleAuthenticationSuccess(currentUser, "Renderer Ready");
    } else {
      console.log(
        "[Main] Sending auth state to ready renderer - no user authenticated"
      );
      handleAuthenticationFailure("No active session", "Renderer Ready");
    }
    return { success: true };
  } catch (error) {
    console.error("[Main] Error handling renderer ready for auth:", error);
    return { success: false, error: error.message };
  }
});

export { sttService };
