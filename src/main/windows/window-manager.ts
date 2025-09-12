import { BrowserWindow, screen } from "electron";
import { WindowSizes, InformationMessage } from "./types";
import { WindowAnimator } from "../helpers/windowAnimator";

// Webpack entry points
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const RECORDING_WINDOW_WEBPACK_ENTRY: string;
declare const RECORDING_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const INFORMATION_WINDOW_WEBPACK_ENTRY: string;
declare const INFORMATION_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const WINDOW_SIZES: WindowSizes = {
  compact: { width: 50, height: 10 },
  expanded: { width: 100, height: 40 },
};

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private recordingWindow: BrowserWindow | null = null;
  private informationWindow: BrowserWindow | null = null;
  private windowAnimator: WindowAnimator;

  constructor() {
    this.windowAnimator = new WindowAnimator();
  }

  // Window Creation Methods
  createMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minHeight: 600,
      minWidth: 800,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });

    this.mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    return this.mainWindow;
  }

  createRecordingWindow(): BrowserWindow {
    if (this.recordingWindow && !this.recordingWindow.isDestroyed()) {
      return this.recordingWindow;
    }

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    // Windows-specific positioning to avoid taskbar overlap
    // On Windows, position window above the taskbar with proper margin
    const isWindows = process.platform === 'win32';
    const taskbarMargin = isWindows ? 10 : 0; // Add margin on Windows to avoid taskbar
    const recordingWindowY = screenHeight - WINDOW_SIZES.compact.height - taskbarMargin;
    
    this.recordingWindow = new BrowserWindow({
      width: WINDOW_SIZES.compact.width,
      height: WINDOW_SIZES.compact.height,
      x: Math.round((screenWidth - WINDOW_SIZES.compact.width) / 2),
      y: recordingWindowY,
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

    this.recordingWindow.loadURL(RECORDING_WINDOW_WEBPACK_ENTRY);
    // Don't automatically show - will be shown when onboarding is completed
    return this.recordingWindow;
  }

  createInformationWindow(): BrowserWindow {
    if (this.informationWindow && !this.informationWindow.isDestroyed()) {
      return this.informationWindow;
    }

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 280;
    const windowHeight = 50;
    
    // Position above recording window (8 pixels gap)
    // Use expanded size to ensure no overlap when recording window expands
    const isWindows = process.platform === 'win32';
    const taskbarMargin = isWindows ? 10 : 0;
    const recordingWindowY = screenHeight - WINDOW_SIZES.expanded.height - taskbarMargin;
    const informationWindowX = Math.round((screenWidth - windowWidth) / 2);
    const informationWindowY = recordingWindowY - windowHeight - 8;
    
    this.informationWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: informationWindowX,
      y: informationWindowY,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: true,
      resizable: false,
      hasShadow: false,
      show: false, // Don't show by default
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: INFORMATION_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });

    this.informationWindow.loadURL(INFORMATION_WINDOW_WEBPACK_ENTRY);
    
    return this.informationWindow;
  }

  // Window Getters
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
  }

  getRecordingWindow(): BrowserWindow | null {
    return this.recordingWindow && !this.recordingWindow.isDestroyed() ? this.recordingWindow : null;
  }

  getInformationWindow(): BrowserWindow | null {
    return this.informationWindow && !this.informationWindow.isDestroyed() ? this.informationWindow : null;
  }

  // Centralized Messaging
  sendToMain(channel: string, data?: any): void {
    const window = this.getMainWindow();
    if (window) {
      window.webContents.send(channel, data);
    }
  }

  sendToRecording(channel: string, data?: any): void {
    const window = this.getRecordingWindow();
    if (window) {
      window.webContents.send(channel, data);
    }
  }

  sendToInformation(channel: string, data?: any): void {
    const window = this.getInformationWindow();
    if (window) {
      window.webContents.send(channel, data);
    }
  }

  // Information Window Methods
  showInformation(message: InformationMessage): void {
    const window = this.getInformationWindow() || this.createInformationWindow();
    
    // Send message to information window
    this.sendToInformation("show-message", message);
    
    // Show window if hidden
    if (!window.isVisible()) {
      window.show();
    }

    // Auto-dismiss after duration
    const duration = message.duration || 3000;
    setTimeout(() => {
      this.hideInformation();
    }, duration);
  }

  hideInformation(): void {
    const window = this.getInformationWindow();
    if (window && window.isVisible()) {
      window.hide();
    }
  }

  // Recording Window Visibility Methods
  showRecordingWindow(): void {
    const window = this.getRecordingWindow();
    if (window && !window.isVisible()) {
      console.log("[WindowManager] Showing recording window (onboarding completed)");
      window.show();
    }
  }

  hideRecordingWindow(): void {
    const window = this.getRecordingWindow();
    if (window && window.isVisible()) {
      console.log("[WindowManager] Hiding recording window (onboarding not completed)");
      window.hide();
    }
  }

  // Recording Window Animation Methods
  expandRecordingWindow(): void {
    const window = this.getRecordingWindow();
    if (window) {
      this.windowAnimator.animateResize(
        window,
        WINDOW_SIZES.expanded.width,
        WINDOW_SIZES.expanded.height,
        200,
        'bottom-center'
      );
    }
  }

  compactRecordingWindow(): void {
    const window = this.getRecordingWindow();
    if (window) {
      this.windowAnimator.animateResize(
        window,
        WINDOW_SIZES.compact.width,
        WINDOW_SIZES.compact.height,
        200,
        'bottom-center'
      );
    }
  }

  // Utility Methods
  isAnyWindowDestroyed(): boolean {
    return (
      (this.mainWindow && this.mainWindow.isDestroyed()) ||
      (this.recordingWindow && this.recordingWindow.isDestroyed()) ||
      (this.informationWindow && this.informationWindow.isDestroyed())
    );
  }

  closeAllWindows(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
      this.mainWindow = null;
    }
    if (this.recordingWindow && !this.recordingWindow.isDestroyed()) {
      this.recordingWindow.close();
      this.recordingWindow = null;
    }
    if (this.informationWindow && !this.informationWindow.isDestroyed()) {
      this.informationWindow.close();
      this.informationWindow = null;
    }
  }

  // Development Tools
  openDevTools(windowType: 'main' | 'recording' | 'information'): void {
    let window: BrowserWindow | null = null;
    
    switch (windowType) {
      case 'main':
        window = this.getMainWindow();
        break;
      case 'recording':
        window = this.getRecordingWindow();
        break;
      case 'information':
        window = this.getInformationWindow();
        break;
    }

    if (window) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  }
}