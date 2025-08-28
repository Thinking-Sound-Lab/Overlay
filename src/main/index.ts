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
  clipboard,
  shell,
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
import { updateGlobalMetrics } from "./helpers/speech_analytics";
import { GlobalMetrics } from "../shared/types";
import { WindowAnimator } from "./helpers/windowAnimator";
import { ExternalAPIManager } from "./services/external_api_manager";
import { APIHandlers } from "./ipc/api_handlers";
import { AuthUtils } from "./utils/auth";
import { validateTranscriptData } from "./utils/validation";
import { config } from "../../config/environment";
import { AuthStateManager } from "./auth/auth-state-manager";
import { SystemAudioManager } from "./services/system_audio_manager";
// Webpack entry points
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const RECORDING_WINDOW_WEBPACK_ENTRY: string;
declare const RECORDING_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const windowAnimator = new WindowAnimator();

const WINDOW_SIZES = {
  compact: { width: 50, height: 10 },
  expanded: { width: 100, height: 40 },
};

let robot: any = null;
try {
  robot = require("robotjs");
} catch {
  console.warn("robotjs not available");
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let recordingWindow: BrowserWindow | null = null;
let isRecording = false;
let isProcessing = false;
let hoverTimeout: NodeJS.Timeout | null = null;
let isAuthenticated = false;

// External API services
let externalAPIManager: ExternalAPIManager | null = null;
let apiHandlers: APIHandlers | null = null;
let authStateManager: AuthStateManager | null = null;
let systemAudioManager: SystemAudioManager | null = null;

// Processing state
let processingStage = "";

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
  mainWindow?.webContents.send("update-available", {
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
  mainWindow?.webContents.send("update-download-progress", progress.percent);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("[AutoUpdater] Update downloaded:", info.version);
  mainWindow?.webContents.send("update-downloaded", {
    version: info.version,
  });
});

let speechMetrics: GlobalMetrics = {
  totalWordCount: 0,
  averageWPM: 0,
  totalRecordings: 0,
  lastRecordingWords: 0,
  lastRecordingWPM: 0,
  streakDays: 0,
};

let transcriptHistory: any[] = [];
let lastActivityDate: string | null = null;

const store = new Store({
  defaults: {
    language: "auto",
    outputMode: "clipboard",
    enableTranslation: false,
    targetLanguage: "en",
  },
});

// Initialize metrics to defaults - will be synced from database when user is authenticated

// Using centralized validation utility

// Function to save transcript to database
const saveTranscriptToDatabase = async (transcriptData: any) => {
  if (!externalAPIManager?.supabase) {
    console.warn(
      "[Main] Cannot save transcript: Supabase service not available"
    );
    return false;
  }

  const currentUser = externalAPIManager.supabase.getCurrentUser();
  if (!currentUser) {
    console.warn("[Main] Cannot save transcript: No authenticated user");
    return false;
  }

  // Validate transcript data
  const validation = validateTranscriptData(transcriptData);
  if (!validation.isValid) {
    console.error("[Main] Transcript validation failed:", validation.errors);
    return false;
  }

  try {
    // Format transcript data for database according to TranscriptEntry interface
    const dbTranscriptData = {
      user_id: currentUser.id,
      text: transcriptData.text.trim(),
      original_text: transcriptData.originalText || null,
      language: store.get("language") || "en",
      target_language: transcriptData.targetLanguage || null,
      was_translated: Boolean(transcriptData.wasTranslated),
      confidence:
        typeof transcriptData.confidence === "number"
          ? transcriptData.confidence
          : null,
      word_count: transcriptData.wordCount,
      wpm: transcriptData.wpm,
      metadata: {
        ...transcriptData.metadata,
        localId: transcriptData.id,
        timestamp: transcriptData.timestamp,
        detectedLanguage: transcriptData.detectedLanguage,
        wordCountRatio: transcriptData.wordCountRatio,
      },
    };

    console.log("[Main] Saving transcript to database:", {
      user_id: dbTranscriptData.user_id,
      text_length: dbTranscriptData.text.length,
      word_count: dbTranscriptData.word_count,
      was_translated: dbTranscriptData.was_translated,
      language: dbTranscriptData.language,
      target_language: dbTranscriptData.target_language,
    });

    const result =
      await externalAPIManager.supabase.saveTranscript(dbTranscriptData);

    if (result.error) {
      console.error(
        "[Main] Failed to save transcript to database:",
        result.error
      );
      return false;
    }

    console.log(
      "[Main] Transcript successfully saved to database with ID:",
      result.data?.id
    );
    return true;
  } catch (error) {
    console.error("[Main] Error saving transcript to database:", error);
    return false;
  }
};

// transcriptHistory will be loaded from database when user is authenticated
transcriptHistory = [];
lastActivityDate = null;

// Streak calculation will be handled by database sync when user is authenticated

// ----------- Metrics Update Handler -----------
const handleMetricsUpdate = (
  metrics: any,
  transcript?: string,
  translationMeta?: any
) => {
  speechMetrics = updateGlobalMetrics(
    speechMetrics,
    metrics.wordCount,
    metrics.wordsPerMinute
  );

  // Update last activity date for local tracking
  // Note: Streak calculation is handled by database service for consistency
  const today = new Date().toDateString();
  if (lastActivityDate !== today) {
    lastActivityDate = today;
  }

  // Store transcript if provided
  if (transcript && transcript.trim()) {
    const transcriptEntry = {
      id: Date.now().toString(),
      text: transcript.trim(),
      timestamp: new Date(),
      wordCount: metrics.wordCount,
      wpm: metrics.wordsPerMinute,
      // Include translation metadata
      ...translationMeta,
    };

    // Add to local cache for immediate UI updates
    transcriptHistory.unshift(transcriptEntry);
    // Keep only last 100 transcripts in cache
    if (transcriptHistory.length > 100) {
      transcriptHistory = transcriptHistory.slice(0, 100);
    }

    // Save to database if user is authenticated
    if (AuthUtils.isUserAuthenticated()) {
      saveTranscriptToDatabase(transcriptEntry)
        .then((success) => {
          console.log("[Main] Transcript saved to database:", success);
          if (success) {
            // Notify renderer about successful database save
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow?.webContents.send(
                "transcript-saved-to-database",
                transcriptEntry
              );
            }
          } else {
            console.warn(
              "[Main] Failed to save transcript to database - skipping (app requires internet)"
            );
          }
        })
        .catch((error) => {
          console.error("[Main] Failed to save transcript to database:", error);
        });
    } else {
      console.log(
        "[Main] User not authenticated, transcript will not be saved to database"
      );
    }

    // Notify renderer about new activity
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow?.webContents.send("activity-updated", {
        type: "transcript",
        data: transcriptEntry,
      });
    }
  }

  // speechMetrics and lastActivityDate are managed in memory and database only

  console.log("[Main] Updated metrics:", speechMetrics);

  // Notify renderer about stats update
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow?.webContents.send("statistics-updated", speechMetrics);
  }

  // Update tray menu with new metrics
  updateTrayMenu();

  // Handle window state management AFTER all processing is complete
  // This ensures text insertion and metrics update happen before window state changes
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    console.log(
      "[Main] Processing complete, switching recording window to compact state"
    );
    isProcessing = false;
    processingStage = "";

    // Animate window to compact size
    windowAnimator.animateResize(
      recordingWindow,
      WINDOW_SIZES.compact.width,
      WINDOW_SIZES.compact.height,
      150
    );

    // Send processing-complete event
    recordingWindow.webContents.send("processing-complete");
  }
};

// STT Service will be initialized after external API manager is ready
let sttService: STTService;

// Track the last language setting to detect changes
let lastLanguageSetting: string | null = null;

// Update STT service with current settings
const updateSTTSettings = async () => {
  const currentLanguage = (store.get("language") as string) || "auto";
  const currentSettings = {
    enableTranslation: store.get("enableTranslation"),
    targetLanguage: store.get("targetLanguage"),
    useAI: store.get("useAI"),
  };

  // Check if language setting has changed
  if (lastLanguageSetting !== null && lastLanguageSetting !== currentLanguage) {
    console.log(
      `[Main] Language setting changed from ${lastLanguageSetting} to ${currentLanguage}, reinitializing STT service`
    );

    // Clear any cached language state
    console.log(
      "[Main] Clearing language cache and reinitializing STT service"
    );

    await sttService.reinitialize(currentLanguage);
  }

  // Update settings
  sttService.updateSettings(currentSettings);

  // Update tracked language
  lastLanguageSetting = currentLanguage;
};

// ----------- Window & Tray Functions -----------

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minHeight: 600,
    minWidth: 800,
    frame: false, // Remove native window frame for custom navigation bar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Re-enable web security, handle CSP properly
      allowRunningInsecureContent: false,
      experimentalFeatures: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Send initial session restoration status to renderer when window is ready
  mainWindow.webContents.once("did-finish-load", async () => {
    console.log(
      "[Main] New window loaded, session restoration will handle auth state"
    );

    // Check if session restoration has already completed
    if (externalAPIManager?.supabase.isSessionRestorationComplete()) {
      console.log(
        "[Main] Session restoration already completed, checking current auth state"
      );
      const currentUser = externalAPIManager?.supabase.getCurrentUser();

      if (currentUser) {
        // Session restoration completed with user
        console.log(
          "[Main] Session already restored for user, loading complete auth state"
        );

        mainWindow.webContents.send("session-restoration-status", {
          status: "completed",
          authenticated: true,
        });

        // Use AuthStateManager to load and send complete auth state
        await authStateManager?.loadAndSendAuthState(
          mainWindow,
          currentUser,
          "Window Load - Existing Session"
        );

        // Initialize authenticated services
        if (!recordingWindow) {
          createRecordingWindow();
        }
      } else {
        // Session restoration completed without user
        console.log("[Main] Session restoration completed without user");

        authStateManager?.sendUnauthenticatedState(
          mainWindow,
          undefined,
          "Window Load - No Session"
        );
      }
    } else {
      console.log(
        "[Main] Session restoration still in progress, window will receive events when complete"
      );
    }
  });

  if (config.isDevelopment) {
    mainWindow.webContents.openDevTools({
      mode: "detach",
    });
  }
};

const createRecordingWindow = () => {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;
  recordingWindow = new BrowserWindow({
    width: WINDOW_SIZES.compact.width,
    height: WINDOW_SIZES.compact.height,
    x: Math.round((screenWidth - WINDOW_SIZES.compact.width) / 2),
    y: screenHeight,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: RECORDING_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  recordingWindow.loadURL(RECORDING_WINDOW_WEBPACK_ENTRY);
  recordingWindow.show();

  if (config.isDevelopment) {
    recordingWindow.webContents.openDevTools({
      mode: "detach",
    });
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

const updateTrayMenu = () => {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Overlay",
      click: () => {
        if (!mainWindow || mainWindow?.isDestroyed()) {
          createMainWindow();
        } else if (mainWindow && !mainWindow.isVisible()) {
          // Window exists but is hidden, just show it without reloading
          mainWindow.show();
          mainWindow.focus();

          if (process.platform === "darwin") {
            app.dock.show();
          }
        } else if (mainWindow) {
          // Window is already visible, just focus it
          mainWindow.focus();
          if (process.platform === "darwin") {
            app.dock.show();
          }
        }
      },
    },
    { label: `Total Words: ${speechMetrics.totalWordCount}`, enabled: false },
    {
      label: `Average WPM: ${speechMetrics.averageWPM.toFixed(1)}`,
      enabled: false,
    },
    {
      label: `Total Recordings: ${speechMetrics.totalRecordings}`,
      enabled: false,
    },
    {
      label: `Streak: ${speechMetrics.streakDays} days`,
      enabled: false,
    },

    { type: "separator" },
    {
      label: "Share Feedback",
      click: () => {},
    },
    {
      label: "Settings",
      click: () => {},
    },

    { type: "separator" },
    {
      label: "Select microphone",
      click: () => {},
    },

    { type: "separator" },
    {
      label: "Reset Statistics",
      click: () => {
        speechMetrics = {
          totalWordCount: 0,
          averageWPM: 0,
          totalRecordings: 0,
          lastRecordingWords: 0,
          lastRecordingWPM: 0,
          streakDays: 0,
        };
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: `Overlay Version: ${app.getVersion()} - Up to date`,
      click: () => {
        autoUpdater.checkForUpdatesAndNotify();
      },
    },
    { type: "separator" },
    { label: "About Overlay", click: () => {} },
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
  if (!AuthUtils.isUserAuthenticated) {
    console.log("[Main] Recording blocked - user not authenticated");
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

  // Ensure recording window exists (should be created after authentication)
  if (!recordingWindow) {
    createRecordingWindow();
  }

  if (recordingWindow) {
    windowAnimator.animateResize(
      recordingWindow,
      WINDOW_SIZES.expanded.width,
      WINDOW_SIZES.expanded.height,
      100
    );
  }

  // Show recording UI
  recordingWindow?.webContents.send("recording-started");

  // Start batch STT session logic
  await sttService.startDictation();
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

  // Update processing stage and send to UI
  processingStage = "Transcribing audio...";
  recordingWindow?.webContents.send("recording-stopped");
  recordingWindow?.webContents.send("processing-stage", processingStage);

  // Restore system audio as soon as recording stops and transcription begins
  if (systemAudioManager) {
    await systemAudioManager.restoreSystemAudio();
  }

  try {
    // Stage 1: Transcribing
    processingStage = "Transcribing speech...";
    recordingWindow?.webContents.send("processing-stage", processingStage);

    await sttService.finalizeDictation();
    console.log("[Main] Dictation finalized successfully");

    // The actual processing (translation, grammar correction, text insertion)
    // happens in the STT service. The STT service will handle completion timing
    // via the onMetricsUpdate callback, so no artificial delay is needed here.
    processingStage = "Finalizing...";
    recordingWindow?.webContents.send("processing-stage", processingStage);
  } catch (error) {
    console.error("[Main] Error finalizing dictation:", error);
    processingStage = "Error occurred";
    recordingWindow?.webContents.send("processing-stage", processingStage);
    
    // Ensure audio is restored even in error cases
    if (systemAudioManager) {
      await systemAudioManager.restoreSystemAudio();
    }
  } finally {
    // Reset processing state - window management moved to handleMetricsUpdate
    isProcessing = false;
    processingStage = "";
    console.log(
      "[Main] Dictation processing completed - window state will be managed by STT callback"
    );
  }
};

// ----------- Dictation Output -----------

// const outputText = async (text: string) => {
//   const outputMode = store.get("outputMode") as string;
//   if (outputMode === "clipboard" || outputMode === "both")
//     clipboard.writeText(text);

//   if ((outputMode === "auto-insert" || outputMode === "both") && robot) {
//     setTimeout(() => robot.typeString(text), 100); // Small delay for app focus
//   }
//   tray?.displayBalloon({
//     title: "Transcription Complete",
//     content: text,
//     icon: "assets/icon.png",
//   });
// };

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
        authStateManager?.sendUnauthenticatedState(
          mainWindow,
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
        authStateManager?.sendUnauthenticatedState(
          mainWindow,
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
        authStateManager?.sendUnauthenticatedState(
          mainWindow,
          "OAuth callback missing access_token or refresh_token",
          "OAuth Error - Missing Tokens"
        );
        return;
      }

      if (!externalAPIManager?.supabase) {
        console.error("[Main] Supabase service not available for OAuth");
        authStateManager?.sendUnauthenticatedState(
          mainWindow,
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
          authStateManager?.sendUnauthenticatedState(
            mainWindow,
            `Authentication failed: ${error.message}`,
            "OAuth Error - Session Creation"
          );
          return;
        }

        if (data.session && data.user) {
          console.log(
            "[Main] OAuth authentication successful for user:",
            data.user.email
          );

          // Check onboarding status and send complete auth state
          let onboardingCompleted = false;
          try {
            console.log(
              "[Main] OAuth: Checking onboarding status for user:",
              data.user.email
            );
            const profileResult =
              await externalAPIManager.supabase.getUserProfile();
            console.log("[Main] OAuth: Profile result:", {
              hasData: !!profileResult.data,
              hasError: !!profileResult.error,
              error: profileResult.error?.message,
              profileData: profileResult.data
                ? {
                    id: profileResult.data.id,
                    name: profileResult.data.name,
                    onboarding_completed:
                      profileResult.data.onboarding_completed,
                  }
                : null,
              timestamp: new Date().toISOString(),
            });

            if (profileResult.data && !profileResult.error) {
              // Profile exists - use the actual onboarding_completed value
              onboardingCompleted = Boolean(
                profileResult.data.onboarding_completed
              );
              console.log(
                "[Main] OAuth: Existing user profile found, onboarding status:",
                onboardingCompleted,
                "- Raw value:",
                profileResult.data.onboarding_completed
              );
            } else if (profileResult.error) {
              // Error getting profile - this means profile exists but we couldn't fetch it
              // For existing users with profile fetch errors, default to completed (skip onboarding)
              // This prevents existing users from being forced through onboarding due to temporary DB issues
              console.warn(
                "[Main] OAuth: Error fetching existing profile, defaulting to onboarding completed:",
                profileResult.error?.message
              );
              onboardingCompleted = true;
            } else {
              // No profile data and no error - this is handled by getUserProfile() calling createUserProfile()
              // If we reach here, it means createUserProfile() was called and returned successfully
              // New users get onboarding_completed: false from createUserProfile()
              onboardingCompleted = Boolean(
                profileResult.data?.onboarding_completed
              );
              console.log(
                "[Main] OAuth: New user profile created, onboarding status:",
                onboardingCompleted
              );
            }
          } catch (profileError) {
            console.error(
              "[Main] OAuth: Critical error checking onboarding status:",
              profileError
            );
            // For critical errors, default to completed to prevent existing users from being stuck
            onboardingCompleted = true;
          }

          // Update main process state
          isAuthenticated = true;
          AuthUtils.setAuthenticationState(true);

          // Note: Don't send auth-state-changed event here anymore
          // The auth state change listener will handle this automatically
          console.log(
            "[Main] OAuth: Authentication successful, auth-state-changed event will be sent by auth state listener"
          );

          // Focus main window
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          console.error("[Main] Session created but no user data received");
          authStateManager?.sendUnauthenticatedState(
            mainWindow,
            "Authentication completed but no user session received",
            "OAuth Error - No User Data"
          );
        }
      } catch (tokenError) {
        console.error(
          "[Main] Exception during token session creation:",
          tokenError
        );
        authStateManager?.sendUnauthenticatedState(
          mainWindow,
          `Token authentication failed: ${tokenError.message}`,
          "OAuth Error - Token Exception"
        );
      }
    }
  } catch (error) {
    console.error("[Main] Error handling OAuth callback:", error);
    authStateManager?.sendUnauthenticatedState(
      mainWindow,
      "Unexpected error during OAuth processing",
      "OAuth Error - Unexpected"
    );
  }
};

app.whenReady().then(async () => {
  try {
    console.log("[Main] Initializing external API services...");

    // Initialize external API manager and handlers
    externalAPIManager = new ExternalAPIManager();
    apiHandlers = new APIHandlers(externalAPIManager);
    authStateManager = new AuthStateManager(
      externalAPIManager,
      updateTrayMenu,
      updateSpeechMetrics
    );

    // Initialize system audio manager
    systemAudioManager = new SystemAudioManager();

    // Initialize auth utils with API manager
    AuthUtils.setAuthManager(externalAPIManager);

    // Initialize STT service with analytics support
    sttService = new STTService(
      (metrics: any, transcript?: string, translationMeta?: any) => {
        handleMetricsUpdate(metrics, transcript, translationMeta);
      },
      externalAPIManager.analytics
    );

    // // Set up session restoration status listener
    externalAPIManager.supabase.setSessionRestorationStatusListener(
      async (status, user) => {
        console.log(
          "[Main] Session restoration status:",
          status,
          "user:",
          user?.email || null
        );

        if (status === "starting") {
          // Notify renderer that session restoration is starting
        } else if (status === "completed") {
          // Session restoration is complete - load and send complete auth state
          if (user) {
            console.log("[Main] Session restored for user:", user.email);

            // Use AuthStateManager to load and send complete auth state
            await authStateManager?.loadAndSendAuthState(
              mainWindow,
              user,
              "Session Restoration"
            );

            // Initialize other authenticated services
            if (!recordingWindow) {
              createRecordingWindow();
            }
          } else {
            // No user found after restoration - send unauthenticated state
            console.log(
              "[Main] Session restoration: No user found, sending unauthenticated state"
            );
            authStateManager?.sendUnauthenticatedState(
              mainWindow,
              undefined,
              "Session Restoration"
            );
          }
        }
      }
    );

    // Set up auth state change listener (for all authentications - email/password and provider)
    externalAPIManager.supabase.setAuthStateChangeListener(async (user) => {
      if (user) {
        console.log("[Main] User authenticated via external API:", user.email);

        // Use AuthStateManager to load and send complete auth state
        await authStateManager?.loadAndSendAuthState(
          mainWindow,
          user,
          "Auth State Change"
        );

        // Create recording window now that user is authenticated
        if (!recordingWindow) {
          createRecordingWindow();
        }
      } else {
        console.log("[Main] User signed out via external API");

        // Clear all user caches when user signs out
        clearUserCaches();

        // Send sign-out state to renderer
        authStateManager?.sendUnauthenticatedState(
          mainWindow,
          undefined,
          "Auth State Change - Sign Out"
        );
      }
    });
    updateTrayMenu();
    console.log("[Main] External API services initialized successfully");
  } catch (error) {
    console.error("[Main] Failed to initialize external API services:", error);
  }

  createMainWindow();

  // Note: Recording window will be created after authentication
  const initialLanguage = (store.get("language") as string) || "auto";
  await sttService.initialize(initialLanguage);

  // Initialize language tracking
  lastLanguageSetting = initialLanguage;

  // Initialize STT service with current settings
  await updateSTTSettings();

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
  if (!mainWindow) createMainWindow();
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
  authStateManager = null;

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

ipcMain.handle("update-settings", async (event, settings) => {
  Object.entries(settings).forEach(([key, value]) => {
    if (key !== "hotkey") store.set(key, value);
  });

  // Update STT service with new settings
  await updateSTTSettings();

  return { success: true };
});

// Function to update local speechMetrics from database statistics
const updateSpeechMetrics = (stats: any) => {
  console.log(
    "[Main] Updating local speechMetrics with database stats:",
    stats
  );
  speechMetrics = {
    totalWordCount: stats.totalWordCount || 0,
    averageWPM: stats.averageWPM || 0,
    totalRecordings: stats.totalRecordings || 0,
    streakDays: stats.streakDays || 0,
    lastRecordingWords: speechMetrics.lastRecordingWords, // Keep local recent recording data
    lastRecordingWPM: speechMetrics.lastRecordingWPM, // Keep local recent recording data
  };
  console.log("[Main] Local speechMetrics updated:", {
    totalWords: speechMetrics.totalWordCount,
    totalRecordings: speechMetrics.totalRecordings,
    averageWPM: speechMetrics.averageWPM.toFixed(1),
    streakDays: speechMetrics.streakDays,
  });
};

// Function to clear all user-related caches and data
const clearUserCaches = () => {
  console.log("[Main] Clearing all user caches and stored data");

  // Reset metrics and transcripts
  speechMetrics = {
    totalWordCount: 0,
    averageWPM: 0,
    totalRecordings: 0,
    lastRecordingWords: 0,
    lastRecordingWPM: 0,
    streakDays: 0,
  } as GlobalMetrics;
  transcriptHistory = [];
  lastActivityDate = null;

  // Clear stored data in electron-store
  store.clear();

  // Set default values back for app settings only
  store.set("language", "auto");
  store.set("outputMode", "clipboard");
  store.set("enableTranslation", false);
  store.set("targetLanguage", "en");

  // Reset authentication state
  isAuthenticated = false;
  AuthUtils.setAuthenticationState(false);

  // Notify renderer about cleared data
  mainWindow?.webContents.send("statistics-updated", speechMetrics);
  mainWindow?.webContents.send("transcripts-loaded", []);

  updateTrayMenu();

  console.log("[Main] All user caches cleared successfully");
};

ipcMain.handle("reset-statistics", () => {
  speechMetrics = {
    totalWordCount: 0,
    averageWPM: 0,
    totalRecordings: 0,
    lastRecordingWords: 0,
    lastRecordingWPM: 0,
    streakDays: 0,
  } as GlobalMetrics;
  transcriptHistory = [];
  lastActivityDate = null;
  // speechMetrics and transcriptHistory are managed in memory and database only

  // Notify renderer about reset
  mainWindow?.webContents.send("statistics-updated", speechMetrics);
  updateTrayMenu();

  return { success: true };
});

ipcMain.handle("window-hover-enter", (event) => {
  if (recordingWindow && !isRecording) {
    windowAnimator.animateResize(
      recordingWindow,
      WINDOW_SIZES.expanded.width,
      WINDOW_SIZES.expanded.height,
      200
    );
  }
});

ipcMain.handle("window-hover-leave", (event) => {
  if (!recordingWindow) return;

  if (isProcessing) return;

  if (!isRecording) {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    hoverTimeout = setTimeout(() => {
      if (!isRecording && !isProcessing && recordingWindow) {
        windowAnimator.animateResize(
          recordingWindow,
          WINDOW_SIZES.compact.width,
          WINDOW_SIZES.compact.height,
          200
        );
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

  isAuthenticated = true;
  AuthUtils.setAuthenticationState(true);
  console.log("[Main] User authenticated:", user.email);

  // Create recording window now that user is authenticated
  if (!recordingWindow) {
    createRecordingWindow();
  }

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

    // Use AuthStateManager to load and send refreshed auth state
    await authStateManager?.loadAndSendAuthState(
      mainWindow,
      currentUser,
      "Auth Refresh"
    );

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
  if (recordingWindow) {
    windowAnimator.animateResize(
      recordingWindow,
      WINDOW_SIZES.expanded.width,
      WINDOW_SIZES.expanded.height,
      200 // Smooth animation duration
    );
  }
  return { success: true };
});

ipcMain.handle("compact-recording-window", () => {
  if (recordingWindow) {
    windowAnimator.animateResize(
      recordingWindow,
      WINDOW_SIZES.compact.width,
      WINDOW_SIZES.compact.height,
      200 // Smooth animation duration
    );
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return { success: true };
  }
  return { success: false, error: "Main window not available" };
});

ipcMain.handle("window:minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    return { success: true };
  }
  return { success: false, error: "Main window not available" };
});

ipcMain.handle("window:maximize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
      return { success: true, action: "restored" };
    } else {
      mainWindow.maximize();
      return { success: true, action: "maximized" };
    }
  }
  return { success: false, error: "Main window not available" };
});

ipcMain.handle("window:get-maximized-state", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return { isMaximized: mainWindow.isMaximized() };
  }
  return { isMaximized: false };
});
