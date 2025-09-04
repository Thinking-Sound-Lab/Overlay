import * as path from "path";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  screen,
  shell,
  dialog,
} from "electron";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";

// Handle Squirrel events on Windows (must be early in the main process)
if (process.platform === "win32") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
import { WindowAnimator } from "./helpers/windowAnimator";
import { WindowManager } from "./windows/window-manager";
import { ExternalAPIManager } from "./services/external_api_manager";
import { APIHandlers } from "./ipc/api_handlers";
import { AuthUtils } from "./utils/auth";
import { validateTranscriptData } from "./utils/validation";
import { config } from "../../config/environment";
import { SystemAudioManager } from "./services/system_audio_manager";
import { DataLoaderService } from "./services/data_loader_service";
import { DEFAULT_SETTINGS } from "../shared/constants/default-settings";
import MicrophoneService from "./services/microphone_service";
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

// External API services
let externalAPIManager: ExternalAPIManager | null = null;
let apiHandlers: APIHandlers | null = null;
// AuthStateManager replaced by DataLoaderService
let systemAudioManager: SystemAudioManager | null = null;

// Auto-updater configuration
autoUpdater.checkForUpdatesAndNotify =
  autoUpdater.checkForUpdatesAndNotify.bind(autoUpdater);
autoUpdater.autoDownload = false; // Don't auto-download, let user choose

// Platform-specific configuration
if (process.platform === "win32") {
  // Windows Squirrel configuration
  autoUpdater.setFeedURL({
    provider: "generic",
    url:
      process.env.WINDOWS_UPDATE_SERVER_URL ||
      "https://overlay.app/updates/win32",
    channel: process.env.UPDATE_CHANNEL || "latest",
  });

  // Windows-specific updater settings
  autoUpdater.forceDevUpdateConfig = process.env.NODE_ENV === "development";

  console.log("[AutoUpdater] Windows Squirrel configuration:", {
    url:
      process.env.WINDOWS_UPDATE_SERVER_URL ||
      "https://overlay.app/updates/win32",
    channel: process.env.UPDATE_CHANNEL || "latest",
    platform: "win32",
  });
} else if (process.platform === "darwin") {
  // macOS configuration (existing)
  if (process.env.UPDATE_SERVER_URL) {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: process.env.UPDATE_SERVER_URL,
      channel: process.env.UPDATE_CHANNEL || "latest",
    });
  }
}

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

interface AuthStateEventData {
  user: UserRecord | null;
  authenticated: boolean;
  statistics: UserStats | null;
  settings: Settings | null;
  recentTranscripts: UITranscriptEntry[];
  error?: string;
  source?: string;
}

/**
 * Send authenticated user state to renderer with error handling
 */
const sendAuthStateToRenderer = async (
  userData: AuthStateEventData,
  source: string = "Unknown"
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
  source: string = "Unknown"
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

      // Create information window for user notifications (hidden by default)
      if (!windowManager.getInformationWindow()) {
        windowManager.createInformationWindow();
      }

      // Initialize STT service for authenticated user
      if (sttService) {
        console.log("[Main] Initializing STT service for authenticated user");
        await sttService.initialize();
      }

      if (config.isDevelopment) {
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
  source: string = "Unknown"
): void => {
  console.log(
    `[Main] Handling authentication failure (${source}):`,
    error || "No error provided"
  );

  // Clean up STT service to stop any active connections and logging
  if (sttService) {
    console.log("[Main] Cleaning up STT service during logout...");
    sttService.closeSession();
    sttService.resetRuntimeData();
  }

  // Close authenticated-only windows
  if (windowManager.getRecordingWindow() && !windowManager.getRecordingWindow().isDestroyed()) {
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

// ----------- Window & Tray Functions -----------

const createMainWindow = () => {
  const mainWindow = windowManager.createMainWindow();

  // Set main window for microphone service after creation
  MicrophoneService.getInstance().setMainWindow(mainWindow);

  // Window ready - check if we need to send current auth state to new window
  mainWindow.webContents.once("did-finish-load", async () => {
    console.log("[Main] Main window loaded, checking auth state...");

    // If initial session restoration has completed, send current state to this window
    // This handles window recreation from tray menu
    if (externalAPIManager?.supabase.isSessionRestorationComplete()) {
      console.log(
        "[Main] Session restoration already completed, sending current auth state"
      );
      const currentUser = externalAPIManager?.supabase.getCurrentUser();

      if (currentUser) {
        console.log(
          "[Main] User already authenticated, sending auth state to new window"
        );
        await handleAuthenticationSuccess(currentUser, "Window Recreation");
      } else {
        console.log(
          "[Main] No authenticated user, sending unauthenticated state to new window"
        );
        sendUnauthenticatedStateToRenderer(
          "No active session",
          "Window Recreation"
        );
      }
    } else {
      console.log(
        "[Main] Session restoration in progress, will be handled by auth state change listener"
      );
    }
  });

  if (config.isDevelopment) {
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

    const currentMicrophone = DEFAULT_SETTINGS.defaultMicrophone;

    return devices.map((device: any) => ({
      label: device.label || `Unknown Device`,
      type: "radio" as const,
      checked: currentMicrophone === device.deviceId,
      click: () => {
        updateTrayMenu(); // Refresh menu
      },
    }));
  } catch (error) {
    console.error("[Tray] Failed to load microphones for menu:", error);

    // Fallback to default option
    const currentMicrophone = DEFAULT_SETTINGS.defaultMicrophone;
    return [
      {
        label: "Default Microphone",
        type: "radio" as const,
        checked: currentMicrophone === "default",
        click: () => {
          updateTrayMenu();
        },
      },
    ];
  }
};

const updateTrayMenu = async () => {
  if (!tray) return;

  // Get dynamic microphone submenu
  const microphoneSubmenu = await buildMicrophoneSubmenu();
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
  const hotkey = "option+space";
  globalShortcut.register(hotkey, async () => {
    if (isProcessing) return;
    if (isRecording) await stopRecording();
    else await startRecording();
  });
  console.log(`Global hotkey registered: ${hotkey}`);
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
    } finally {
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

app.whenReady().then(async () => {
  try {
    console.log("[Main] Initializing external API services...");

    // Initialize window manager first
    windowManager = new WindowManager();

    // Initialize external API manager and handlers
    externalAPIManager = new ExternalAPIManager();
    apiHandlers = new APIHandlers(externalAPIManager);
    dataLoaderService = DataLoaderService.getInstance(
      externalAPIManager.supabase
    );

    // Initialize system audio manager
    systemAudioManager = new SystemAudioManager();

    // Initialize auth utils with API manager
    AuthUtils.setAuthManager(externalAPIManager);

    // Initialize STT service with analytics support
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
          wasTranslated: !!translationMeta?.translatedText,
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
              was_translated: !!translationMeta?.translatedText,
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
                  wasTranslated: !!translationMeta?.translatedText,
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
      windowManager
    );

    // Set up callback to receive auth state changes from SupabaseService native listener
    externalAPIManager.supabase.setAuthStateChangeCallback(async (user) => {
      if (user) {
        await handleAuthenticationSuccess(user, "Auth State Change");
      } else {
        handleAuthenticationFailure("User signed out", "Auth State Change");
      }
    });
    updateTrayMenu();
    console.log("[Main] External API services initialized successfully");
  } catch (error) {
    console.error("[Main] Failed to initialize external API services:", error);
  }

  createMainWindow();

  // STT service will be initialized when user authenticates
  console.log("[Main] STT service created but not initialized - waiting for user authentication");

  // Export sttService for use by other modules

  setTimeout(() => {
    createTray();
    registerGlobalHotkey();

    // Check for updates after initial setup (only in production)
    if (config.isProduction) {
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
  if (
    !windowManager.getMainWindow() ||
    windowManager.getMainWindow().isDestroyed()
  )
    createMainWindow();
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
  (event, audioData: { data: string; mimeType: string }) => {
    console.log("[Main] Received audio chunk:", audioData.data.length, "bytes");
    if (isRecording) {
      sttService.receiveAudioData(audioData.data);
    }
    return { success: true };
  }
);

ipcMain.handle("window-hover-enter", (event) => {
  if (windowManager.getRecordingWindow() && !isRecording) {
    windowManager.expandRecordingWindow();
  }
});

ipcMain.handle("window-hover-leave", (event) => {
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
ipcMain.handle("on-authentication-complete", (event, user) => {
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
ipcMain.handle("refresh-auth-state", async (event) => {
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

// Permission checking handlers
ipcMain.handle("check-accessibility-permission", () => {
  // This is a placeholder - actual implementation would depend on the platform
  // For now, we'll return true to allow the demo to work
  return true;
});

ipcMain.handle("request-accessibility-permission", () => {
  // Open system preferences to accessibility settings
  if (process.platform === "darwin") {
    shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    );
  }
  return { success: true };
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

export { sttService };
