import { app, globalShortcut } from "electron";

// Handle Squirrel events on Windows (must be early in the main process)
if (process.platform === "win32") {
  const squirrelStartup = require("electron-squirrel-startup");
  if (squirrelStartup) {
    console.log("[Squirrel] Squirrel event detected, quitting...");
    app.quit();
  }
}
import { STTService } from "./services/stt_service";
import { WindowManager } from "./windows/window-manager";
import { DisplayManagerService } from "./services/display_manager_service";
import { APIHandlers } from "./ipc/api_handlers";
import { AuthService } from "./services/auth_service";
import { SystemAudioManager } from "./services/system_audio_manager";
import { DataLoaderService } from "./services/data_loader_service";
// Language constants moved to TrayService
import { MicrophoneService } from "./services/microphone_service";
import { PermissionsService } from "./services/permissions_service";
import { AudioStorageService } from "./services/audio_storage_service";
import { SupabaseService } from "./services/supabase_service";
import { AnalyticsService } from "./services/analytics_service";
import { CacheService } from "./services/cache_service";
import { TranslationService } from "./services/translation_service";
import { TextInsertionService } from "./services/text_insertion_service";
import { ApplicationDetectionService } from "./services/application_detection_service";
import { MouseTrackingService } from "./services/mouse_tracking_service";
import { TrayService } from "./services/tray_service";
import { AutoUpdateService } from "./services/auto_update_service";
import { TranscriptCompletionService } from "./services/transcript_completion_service";
// Webpack entry points
// declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
// declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
// declare const RECORDING_WINDOW_WEBPACK_ENTRY: string;
// declare const RECORDING_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
// declare const INFORMATION_WINDOW_WEBPACK_ENTRY: string;
// declare const INFORMATION_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let windowManager: WindowManager;
let displayManagerService: DisplayManagerService;
let trayService: TrayService;
let autoUpdateService: AutoUpdateService;
let hoverTimeout: NodeJS.Timeout | null = null;

// Hotkey test mode for onboarding
let isHotkeyTestMode = false;

// Setter function for hotkey test mode
const setHotkeyTestMode = (enabled: boolean): void => {
  isHotkeyTestMode = enabled;
  console.log(`[Main] Hotkey test mode ${enabled ? "enabled" : "disabled"}`);
};

// Service references - manually initialized
let apiHandlers: APIHandlers;
let authService: AuthService;
let systemAudioManager: SystemAudioManager;
let audioStorageService: AudioStorageService;
let dataLoaderService: DataLoaderService;
let supabaseService: SupabaseService;
let analyticsService: AnalyticsService;
let microphoneService: MicrophoneService;
let sttService: STTService;
let cacheService: CacheService;
let translationService: TranslationService;
let transcriptCompletionService: TranscriptCompletionService;
let textInsertionService: TextInsertionService;
let applicationDetectionService: ApplicationDetectionService;
let mouseTrackingService: MouseTrackingService;
let permissionsService: PermissionsService;

// Autoupdate functionality moved to AutoUpdateService

// Enhanced Auth State Management Helper Functions with Type Safety
import { isDevelopment } from "../shared/utils/environment";
// ----------- Window & Tray Functions -----------

const createMainWindow = () => {
  const mainWindow = windowManager.createMainWindow();

  // Set main window for microphone service after creation
  microphoneService.setMainWindow(mainWindow);

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

      // Don't allow recording if user is not authenticated
      if (!authService.isUserAuthenticated()) {
        console.log("[Main] Recording blocked - user not authenticated");
        windowManager.sendToInformation("User not authenticated");
        return;
      }

      // Clear hover timeout if active
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }

      // Normal recording behavior - delegate to STTService
      if (sttService.isProcessing()) return;
      if (sttService.isRecording()) {
        await sttService.stopRecording();
      } else {
        await sttService.startRecording();
      }
    });
    console.log(
      `[Main] Global hotkey registered: ${hotkey} (${process.platform})`
    );
  }
};
// ----------- App Lifecycle -----------

// Register custom protocol for OAuth
app.setAsDefaultProtocolClient("overlay");

// Handle OAuth callback URLs
app.on("open-url", async (event, url) => {
  event.preventDefault();
  console.log("[Main] Received OAuth callback URL:", url);
  await authService.handleOAuthCallback(url);
});

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
        authService.handleOAuthCallback(protocolArg);
      }
    }
  });
}

// Manual service initialization function
async function initializeServices(): Promise<void> {
  console.log("[Main] Creating services in dependency order...");

  // 1. Core infrastructure services (no dependencies)
  cacheService = new CacheService();
  analyticsService = new AnalyticsService();
  supabaseService = new SupabaseService();

  // 2. Data layer services
  dataLoaderService = new DataLoaderService(cacheService, supabaseService);
  audioStorageService = new AudioStorageService(supabaseService);

  // 3. System services
  microphoneService = new MicrophoneService();
  textInsertionService = new TextInsertionService();
  systemAudioManager = new SystemAudioManager();
  mouseTrackingService = new MouseTrackingService();
  applicationDetectionService = new ApplicationDetectionService();
  permissionsService = new PermissionsService();
  displayManagerService = new DisplayManagerService(mouseTrackingService);

  // WindowManager needs to be created before services that depend on it
  windowManager = new WindowManager();

  // 5. Orchestration services - create dependencies first
  autoUpdateService = new AutoUpdateService(windowManager);
  authService = new AuthService(
    supabaseService,
    dataLoaderService,
    windowManager,
    analyticsService,
    sttService
  );
  trayService = new TrayService(
    windowManager,
    dataLoaderService,
    microphoneService,
    autoUpdateService
  );

  // TranscriptCompletionService needs to be created before TranslationService
  transcriptCompletionService = new TranscriptCompletionService(
    dataLoaderService,
    audioStorageService,
    windowManager,
    trayService,
    authService
  );

  translationService = new TranslationService(
    dataLoaderService,
    applicationDetectionService,
    textInsertionService,
    windowManager,
    transcriptCompletionService
  );
  sttService = new STTService(
    dataLoaderService,
    audioStorageService,
    translationService,
    analyticsService,
    windowManager,
    systemAudioManager,
    applicationDetectionService
  );
  apiHandlers = new APIHandlers(
    supabaseService,
    analyticsService,
    microphoneService,
    dataLoaderService,
    windowManager,
    permissionsService,
    sttService,
    autoUpdateService,
    authService,
    setHotkeyTestMode
  );

  console.log("[Main] All services created, initializing...");

  // Initialize services that need it (in dependency order)
  if (analyticsService.initialize) await analyticsService.initialize();
  //   if (supabaseService.initialize) await supabaseService.initialize();
  if (audioStorageService.initialize) await audioStorageService.initialize();
  if (authService.initialize) await authService.initialize();
  if (sttService.initialize) await sttService.initialize();
  if (apiHandlers.initialize) await apiHandlers.initialize();
  if (autoUpdateService.initialize) autoUpdateService.initialize();

  console.log("[Main] All services initialized successfully");
}

app.whenReady().then(async () => {
  try {
    console.log("[Main] Initializing services manually...");

    // Manual service initialization in dependency order
    await initializeServices();

    // Connect display manager service to window manager
    windowManager.initializeDisplayTracking(displayManagerService);

    // Start display tracking immediately so DisplayManagerService knows current display
    displayManagerService.startTracking();

    // Initialize microphone service with default device selection
    await microphoneService.initializeDefaultDevice();

    trayService.updateMenu();

    // Create main window AFTER all services are initialized
    createMainWindow();
  } catch (error) {
    console.error("[Main] Failed to initialize external API services:", error);
  }

  setTimeout(() => {
    trayService.initialize();
    registerGlobalHotkey();
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

  // Stop display tracking and cleanup display manager
  if (displayManagerService) {
    console.log("[Main] Cleaning up display manager service");
    displayManagerService.destroy();
  }

  // Cleanup tray service
  if (trayService) {
    console.log("[Main] Cleaning up tray service");
    trayService.destroy();
  }

  // Cleanup autoupdate service
  if (autoUpdateService) {
    console.log("[Main] Cleaning up autoupdate service");
    autoUpdateService.destroy();
  }

  // Restore system audio before shutdown
  if (systemAudioManager) {
    await systemAudioManager.restoreSystemAudio();
    systemAudioManager = null;
  }

  // Cleanup external API services
  if (apiHandlers) {
    apiHandlers.removeAllHandlers();
  }

  // Cleanup services manually
  //   await cleanupServices();

  console.log("[Main] Services cleanup completed");
});
