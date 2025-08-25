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
import STTService from "./services/stt_service";
import { updateGlobalMetrics, GlobalMetrics } from "./helpers/speech_analytics";
import { WindowAnimator } from "./helpers/windowAnimator";
import { ExternalAPIManager } from "./services/external_api_manager";
import { APIHandlers } from "./ipc/api_handlers";
import { config } from "../../config/environment";
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

// Processing state
let processingStage = "";

// Auto-updater configuration
autoUpdater.checkForUpdatesAndNotify =
  autoUpdater.checkForUpdatesAndNotify.bind(autoUpdater);
autoUpdater.autoDownload = false; // Don't auto-download, let user choose

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
    openaiApiKey: "",
    language: "auto",
    outputMode: "clipboard",
    hotkey: "option+space",
    enableTranslation: false,
    targetLanguage: "en",
  },
});

// Initialize metrics to defaults - will be synced from database when user is authenticated

// Function to validate transcript data
const validateTranscriptData = (transcriptData: any) => {
  const errors = [];

  if (
    !transcriptData.text ||
    typeof transcriptData.text !== "string" ||
    transcriptData.text.trim().length === 0
  ) {
    errors.push("Text is required and must be a non-empty string");
  }

  if (transcriptData.text && transcriptData.text.length > 10000) {
    errors.push("Text exceeds maximum length of 10000 characters");
  }

  if (
    typeof transcriptData.wordCount !== "number" ||
    transcriptData.wordCount < 0
  ) {
    errors.push("Word count must be a non-negative number");
  }

  if (typeof transcriptData.wpm !== "number" || transcriptData.wpm < 0) {
    errors.push("WPM must be a non-negative number");
  }

  return errors;
};

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
  const validationErrors = validateTranscriptData(transcriptData);
  if (validationErrors.length > 0) {
    console.error("[Main] Transcript validation failed:", validationErrors);
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

// Function to load transcripts from database
const loadTranscriptsFromDatabase = async () => {
  if (!isAuthenticated || !externalAPIManager?.supabase.getCurrentUser()) {
    console.log("[Main] Cannot load transcripts: User not authenticated");
    return;
  }

  try {
    console.log("[Main] Loading transcripts from database...");
    const result = await externalAPIManager.supabase.getTranscripts(100);

    if (result.data && !result.error) {
      // Convert database transcripts to local format
      transcriptHistory = result.data.map((dbTranscript: any) => ({
        id: dbTranscript.metadata?.localId || dbTranscript.id,
        text: dbTranscript.text,
        timestamp: new Date(dbTranscript.created_at),
        wordCount: dbTranscript.word_count,
        wpm: dbTranscript.wpm,
        originalText: dbTranscript.original_text,
        wasTranslated: dbTranscript.was_translated,
        targetLanguage: dbTranscript.target_language,
        detectedLanguage: dbTranscript.metadata?.detectedLanguage,
        ...dbTranscript.metadata,
      }));

      console.log(
        `[Main] Loaded ${transcriptHistory.length} transcripts from database`
      );

      // Notify renderer about loaded transcripts
      mainWindow?.webContents.send("transcripts-loaded", transcriptHistory);
    } else {
      console.error(
        "[Main] Failed to load transcripts from database:",
        result.error
      );
    }
  } catch (error) {
    console.error("[Main] Error loading transcripts from database:", error);
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

  // Update streak if this is first activity today
  const today = new Date().toDateString();
  if (lastActivityDate !== today) {
    if (lastActivityDate === new Date(Date.now() - 86400000).toDateString()) {
      speechMetrics.streakDays += 1;
    } else if (lastActivityDate && lastActivityDate !== today) {
      speechMetrics.streakDays = 0;
    }
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
    if (isAuthenticated && externalAPIManager?.supabase.getCurrentUser()) {
      saveTranscriptToDatabase(transcriptEntry)
        .then((success) => {
          if (success) {
            // Notify renderer about successful database save
            mainWindow?.webContents.send(
              "transcript-saved-to-database",
              transcriptEntry
            );
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
    mainWindow?.webContents.send("activity-updated", {
      type: "transcript",
      data: transcriptEntry,
    });
  }

  // speechMetrics and lastActivityDate are managed in memory and database only

  console.log("[Main] Updated metrics:", speechMetrics);

  // Notify renderer about stats update
  mainWindow?.webContents.send("statistics-updated", speechMetrics);

  // Update tray menu with new metrics
  updateTrayMenu();
};

// STT Service will be initialized after external API manager is ready
let sttService: STTService;

// Update STT service with current settings
const updateSTTSettings = () => {
  const currentSettings = {
    enableTranslation: store.get("enableTranslation"),
    targetLanguage: store.get("targetLanguage"),
    useAI: store.get("useAI"),
  };
  sttService.updateSettings(currentSettings);
};

// ----------- Window & Tray Functions -----------

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minHeight: 600,
    minWidth: 800,
    titleBarStyle: "hiddenInset",
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

  // Send current auth state to the new renderer when it's ready
  mainWindow.webContents.once("did-finish-load", async () => {
    console.log(
      "[Main] New window loaded, waiting for session restoration to complete..."
    );

    // Wait for session restoration to complete before checking auth state
    if (externalAPIManager?.supabase) {
      try {
        await externalAPIManager.supabase.waitForSessionRestoration();
        console.log(
          "[Main] Session restoration completed, now checking auth state"
        );
      } catch (error) {
        console.error("[Main] Error waiting for session restoration:", error);
      }
    }

    // Double-check auth state after session restoration
    const currentUser = externalAPIManager?.supabase.getCurrentUser();
    const userExists = !!currentUser;

    console.log(
      "[Main] Final auth check - User exists:",
      userExists,
      "isAuthenticated:",
      isAuthenticated
    );

    if (userExists) {
      // Update main process auth state to match restored session
      isAuthenticated = true;

      // Check onboarding completion status
      let onboardingCompleted = false;
      try {
        console.log(
          "[Main] Checking onboarding status for authenticated user..."
        );
        const profileResult =
          await externalAPIManager.supabase.getUserProfile();
        if (profileResult.data && !profileResult.error) {
          onboardingCompleted = Boolean(
            profileResult.data.onboarding_completed
          );
          console.log(
            "[Main] Onboarding completed status for new window:",
            onboardingCompleted
          );
        } else {
          console.warn(
            "[Main] Could not get profile data:",
            profileResult.error?.message
          );
        }
      } catch (error) {
        console.error(
          "[Main] Error checking onboarding status for new window:",
          error
        );
      }

      mainWindow?.webContents.send("auth-state-changed", {
        user: currentUser,
        authenticated: true,
        onboardingCompleted: onboardingCompleted,
      });
      console.log(
        "[Main] Sent authenticated state to new window - User:",
        currentUser?.email,
        "Onboarding:",
        onboardingCompleted
      );

      // Sync local metrics with database and load transcripts now that window is ready and user is authenticated
      await syncLocalMetricsWithDatabase();
      loadTranscriptsFromDatabase();
    } else {
      isAuthenticated = false;
      mainWindow?.webContents.send("auth-state-changed", {
        user: null,
        authenticated: false,
        onboardingCompleted: false,
      });
      console.log("[Main] Sent unauthenticated state to new window");
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
    y: screenHeight - WINDOW_SIZES.compact.height + 15,
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
    { label: "Quit", click: () => app.quit() },
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
  if (!isAuthenticated) {
    console.log("[Main] Recording blocked - user not authenticated");
    return;
  }

  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  if (isRecording || isProcessing) return;
  isRecording = true;

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

  try {
    // Stage 1: Transcribing
    processingStage = "Transcribing speech...";
    recordingWindow?.webContents.send("processing-stage", processingStage);

    await sttService.finalizeDictation();
    console.log("[Main] Dictation finalized successfully");

    // The actual processing (translation, grammar correction, text insertion)
    // happens in the STT service, so we just wait for completion
    processingStage = "Finalizing...";
    recordingWindow?.webContents.send("processing-stage", processingStage);

    // Give a moment for text insertion to complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.error("[Main] Error finalizing dictation:", error);
    processingStage = "Error occurred";
    recordingWindow?.webContents.send("processing-stage", processingStage);
  } finally {
    isProcessing = false;
    processingStage = "";
    console.log("[Main] Dictation processing completed");

    if (recordingWindow) {
      windowAnimator.animateResize(
        recordingWindow,
        WINDOW_SIZES.compact.width,
        WINDOW_SIZES.compact.height,
        150
      );
    }

    // Clear processing stage
    recordingWindow?.webContents.send("processing-complete");
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
app.setAsDefaultProtocolClient('overlay');

// Handle OAuth callback URLs
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('[Main] Received OAuth callback URL:', url);
  handleOAuthCallback(url);
});

// Handle OAuth callback URL parsing and authentication
const handleOAuthCallback = async (url: string) => {
  try {
    const urlObj = new URL(url);
    
    if (urlObj.protocol === 'overlay:' && urlObj.pathname === '/oauth/callback') {
      console.log('[Main] Processing OAuth callback...');
      
      // Extract OAuth parameters from URL
      const params = new URLSearchParams(urlObj.search);
      const code = params.get('code');
      const error = params.get('error');
      const state = params.get('state');
      
      if (error) {
        console.error('[Main] OAuth error:', error);
        mainWindow?.webContents.send('auth-state-changed', {
          user: null,
          authenticated: false,
          error: `OAuth error: ${error}`
        });
        return;
      }
      
      if (!code) {
        console.error('[Main] OAuth callback missing authorization code');
        mainWindow?.webContents.send('auth-state-changed', {
          user: null,
          authenticated: false,
          error: 'OAuth callback missing authorization code'
        });
        return;
      }
      
      // Exchange code for session using Supabase
      if (externalAPIManager?.supabase) {
        console.log('[Main] Exchanging OAuth code for session...');
        
        try {
          // Use Supabase service's exchangeCodeForSession method
          const { data, error } = await externalAPIManager.supabase.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[Main] Error exchanging code for session:', error);
            mainWindow?.webContents.send('auth-state-changed', {
              user: null,
              authenticated: false,
              error: `Authentication failed: ${error.message}`
            });
            return;
          }
          
          if (data.session && data.user) {
            console.log('[Main] OAuth authentication successful for user:', data.user.email);
            
            // Check onboarding status
            let onboardingCompleted = false;
            try {
              const profileResult = await externalAPIManager.supabase.getUserProfile();
              if (profileResult.data && !profileResult.error) {
                onboardingCompleted = Boolean(profileResult.data.onboarding_completed);
              }
            } catch (profileError) {
              console.error('[Main] Error checking onboarding status:', profileError);
            }
            
            // Notify renderer of successful authentication
            mainWindow?.webContents.send('auth-state-changed', {
              user: data.user,
              authenticated: true,
              onboardingCompleted: onboardingCompleted
            });
            
            // Focus main window
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          } else {
            console.error('[Main] OAuth callback received but no session/user data');
            mainWindow?.webContents.send('auth-state-changed', {
              user: null,
              authenticated: false,
              error: 'Authentication completed but no user session received'
            });
          }
        } catch (exchangeError) {
          console.error('[Main] Exception during code exchange:', exchangeError);
          mainWindow?.webContents.send('auth-state-changed', {
            user: null,
            authenticated: false,
            error: `Authentication failed: ${exchangeError.message}`
          });
        }
      } else {
        console.error('[Main] Supabase service not available for OAuth');
        mainWindow?.webContents.send('auth-state-changed', {
          user: null,
          authenticated: false,
          error: 'Authentication service not available'
        });
      }
    }
  } catch (error) {
    console.error('[Main] Error handling OAuth callback:', error);
  }
};

app.whenReady().then(async () => {
  try {
    console.log("[Main] Initializing external API services...");

    // Initialize external API manager and handlers
    externalAPIManager = new ExternalAPIManager();
    apiHandlers = new APIHandlers(externalAPIManager);

    // Initialize STT service with analytics support
    sttService = new STTService(
      (metrics: any, transcript?: string, translationMeta?: any) => {
        handleMetricsUpdate(metrics, transcript, translationMeta);
      },
      externalAPIManager.analytics
    );

    // Set up auth state change listener
    externalAPIManager.supabase.setAuthStateChangeListener(async (user) => {
      if (user) {
        isAuthenticated = true;
        console.log("[Main] User authenticated via external API:", user.email);

        // Create recording window now that user is authenticated
        if (!recordingWindow) {
          createRecordingWindow();
        }

        // Sync local metrics with database stats now that user is authenticated
        await syncLocalMetricsWithDatabase();

        // Note: Auth state and transcripts will be sent when window finishes loading via createMainWindow's did-finish-load handler
      } else {
        isAuthenticated = false;
        console.log("[Main] User signed out via external API");

        // Clear all user caches when user signs out
        clearUserCaches();

        mainWindow?.webContents.send("auth-state-changed", {
          user: null,
          authenticated: false,
          onboardingCompleted: false,
        });
      }
    });

    console.log("[Main] External API services initialized successfully");
  } catch (error) {
    console.error("[Main] Failed to initialize external API services:", error);
  }

  createMainWindow();
  // Note: Recording window will be created after authentication
  await sttService.initialize(store.get("language") as string);

  // Initialize STT service with current settings
  updateSTTSettings();

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

  // Cleanup external API services
  if (apiHandlers) {
    apiHandlers.removeAllHandlers();
  }

  if (externalAPIManager) {
    await externalAPIManager.shutdown();
  }

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

ipcMain.handle("get-settings", () => store.store);
ipcMain.handle("update-settings", (event, settings) => {
  Object.entries(settings).forEach(([key, value]) => {
    if (key !== "hotkey") store.set(key, value);
  });

  // Update STT service with new settings
  updateSTTSettings();

  return { success: true };
});

ipcMain.handle("get-statistics", async () => {
  // Try to get real-time stats from database if user is authenticated
  if (isAuthenticated && externalAPIManager?.supabase.getCurrentUser()) {
    try {
      const dbStats = await externalAPIManager.supabase.getUserStats();
      if (dbStats.data && !dbStats.error) {
        // Merge database stats with local state
        return {
          totalWordCount: dbStats.data.totalWordCount,
          averageWPM: dbStats.data.averageWPM,
          totalRecordings: dbStats.data.totalRecordings,
          streakDays: dbStats.data.streakDays,
          lastRecordingWords: speechMetrics.lastRecordingWords,
          lastRecordingWPM: speechMetrics.lastRecordingWPM,
        };
      }
    } catch (error) {
      console.error(
        "[Main] Error fetching database stats, using local:",
        error
      );
    }
  }

  // Fallback to local cached stats
  return { ...speechMetrics, streakDays: speechMetrics.streakDays };
});

// Function to sync local speech metrics with database stats
const syncLocalMetricsWithDatabase = async () => {
  if (!isAuthenticated || !externalAPIManager?.supabase.getCurrentUser()) {
    console.log("[Main] Cannot sync metrics: User not authenticated");
    return;
  }

  try {
    console.log("[Main] Syncing local metrics with database stats...");
    const dbStats = await externalAPIManager.supabase.getUserStats();

    if (dbStats.data && !dbStats.error) {
      // Update local speechMetrics with database totals
      speechMetrics = {
        totalWordCount: dbStats.data.totalWordCount || 0,
        averageWPM: dbStats.data.averageWPM || 0,
        totalRecordings: dbStats.data.totalRecordings || 0,
        streakDays: dbStats.data.streakDays || 0,
        lastRecordingWords: speechMetrics.lastRecordingWords, // Keep local recent recording data
        lastRecordingWPM: speechMetrics.lastRecordingWPM, // Keep local recent recording data
      };

      console.log("[Main] Successfully synced local metrics with database:", {
        totalWords: speechMetrics.totalWordCount,
        totalRecordings: speechMetrics.totalRecordings,
        averageWPM: speechMetrics.averageWPM.toFixed(1),
        streakDays: speechMetrics.streakDays,
      });

      // Update tray with synced stats
      updateTrayMenu();
    } else {
      console.warn(
        "[Main] Failed to sync with database stats:",
        dbStats.error?.message
      );
    }
  } catch (error) {
    console.error("[Main] Error syncing local metrics with database:", error);
  }
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

ipcMain.handle("get-transcripts", async () => {
  // Load transcripts from database if user is authenticated
  if (isAuthenticated && externalAPIManager?.supabase.getCurrentUser()) {
    try {
      const result = await externalAPIManager.supabase.getTranscripts(100);
      if (result.data && !result.error) {
        // Update local cache
        transcriptHistory = result.data.map((dbTranscript: any) => ({
          id: dbTranscript.metadata?.localId || dbTranscript.id,
          text: dbTranscript.text,
          timestamp: new Date(dbTranscript.created_at),
          wordCount: dbTranscript.word_count,
          wpm: dbTranscript.wpm,
          originalText: dbTranscript.original_text,
          wasTranslated: dbTranscript.was_translated,
          targetLanguage: dbTranscript.target_language,
          detectedLanguage: dbTranscript.metadata?.detectedLanguage,
          ...dbTranscript.metadata,
        }));
        return transcriptHistory;
      } else {
        console.error(
          "[Main] Failed to load transcripts from database:",
          result.error
        );
        return transcriptHistory; // Return cached data as fallback
      }
    } catch (error) {
      console.error("[Main] Error loading transcripts from database:", error);
      return transcriptHistory; // Return cached data as fallback
    }
  } else {
    // User not authenticated, return cached data
    return transcriptHistory;
  }
});

ipcMain.handle("get-transcript-sync-status", () => {
  return {
    totalLocalTranscripts: transcriptHistory.length,
    isAuthenticated: isAuthenticated,
    hasSupabaseService: !!externalAPIManager?.supabase,
    currentUser: externalAPIManager?.supabase.getCurrentUser()?.email || null,
  };
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
  console.log("[Main] User authenticated:", user.email);

  // Create recording window now that user is authenticated
  if (!recordingWindow) {
    createRecordingWindow();
  }

  return { success: true };
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
