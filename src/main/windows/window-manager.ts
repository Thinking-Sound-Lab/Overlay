import { BrowserWindow, screen } from "electron";
import { WindowSizes, InformationMessage } from "./types";
import { WindowAnimator } from "../helpers/windowAnimator";
import { DisplayManagerService } from "../services/display_manager_service";
import { WindowPosition, DisplayInfo } from "../../shared/types/display";

interface MoveRecordingWindowEvent {
  displayId: number;
  position: WindowPosition;
  previousDisplayId: number | null;
  animationDuration: number;
}

interface PositionUpdateEvent {
  displayId: number;
  position: WindowPosition;
}

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
  private displayManagerService: DisplayManagerService | null = null;
  private currentRecordingDisplayId: number | null = null;

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

    // Get initial position from display manager service (should always be available now)
    const currentDisplayId = this.displayManagerService!.getCurrentRecordingDisplayId()!;
    const position = this.displayManagerService!.calculateRecordingWindowPosition(currentDisplayId)!;
    
    this.currentRecordingDisplayId = currentDisplayId;
    
    this.recordingWindow = new BrowserWindow({
      width: WINDOW_SIZES.compact.width,
      height: WINDOW_SIZES.compact.height,
      x: position.x,
      y: position.y,
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

    // Get position from display manager service based on current recording display
    const currentDisplayId = this.displayManagerService!.getCurrentRecordingDisplayId();
    // Always use expanded height for information window positioning to avoid overlap
    const recordingWindowHeight = WINDOW_SIZES.expanded.height;
    const position = this.displayManagerService!.calculateInformationWindowPosition(
      currentDisplayId!,
      recordingWindowHeight
    );
    
    const windowWidth = 280;
    const windowHeight = 50;
    
    this.informationWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: position!.x,
      y: position!.y,
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

  // Display Tracking Methods
  initializeDisplayTracking(displayManagerService: DisplayManagerService): void {
    this.displayManagerService = displayManagerService;
    
    // Set initial window dimensions in display manager
    this.displayManagerService.setRecordingWindowDimensions({
      width: WINDOW_SIZES.compact.width,
      height: WINDOW_SIZES.compact.height
    });

    // Listen for display manager events
    this.displayManagerService.on('move-recording-window', (event: MoveRecordingWindowEvent) => {
      this.handleRecordingWindowMove(event);
    });

    this.displayManagerService.on('recording-window-position-update-needed', (event: PositionUpdateEvent) => {
      this.handleRecordingWindowPositionUpdate(event);
    });
  }

  private handleRecordingWindowMove(event: MoveRecordingWindowEvent): void {
    const { displayId, position, animationDuration } = event;
    
    console.log(`[WindowManager] *** RECEIVED MOVE EVENT *** for display ${displayId}`);
    console.log(`[WindowManager] Event details:`, event);
    console.log(`[WindowManager] Recording window exists:`, !!this.recordingWindow);
    console.log(`[WindowManager] Recording window destroyed:`, this.recordingWindow?.isDestroyed());
    console.log(`[WindowManager] Recording window visible:`, this.recordingWindow?.isVisible());
    
    // Validate window exists and is ready for animation
    if (!this.recordingWindow || this.recordingWindow.isDestroyed()) {
      console.warn(`[WindowManager] Cannot move recording window - window not available`);
      return;
    }

    if (!this.recordingWindow.isVisible()) {
      console.warn(`[WindowManager] Cannot move recording window - window not visible (user not authenticated or onboarding not complete)`);
      return;
    }

    const currentBounds = this.recordingWindow.getBounds();
    console.log(`[WindowManager] Current window position: (${currentBounds.x}, ${currentBounds.y})`);
    console.log(`[WindowManager] Target position: (${position.x}, ${position.y})`);
    console.log(`[WindowManager] Animation duration: ${animationDuration || 200}ms`);
    
    // Update current display tracking
    this.currentRecordingDisplayId = displayId;
    
    // Move window to new position instantly (no animation for cross-display movement)
    console.log(`[WindowManager] *** STARTING INSTANT CROSS-DISPLAY POSITIONING ***`);
    console.log(`[WindowManager] Moving from (${currentBounds.x}, ${currentBounds.y}) to (${position.x}, ${position.y})`);
    
    try {
      // First setBounds call - may be affected by display scaling
      this.recordingWindow.setBounds({
        x: position.x,
        y: position.y,
        width: currentBounds.width,
        height: currentBounds.height,
      });
      
      // Check position after first setBounds call
      const boundsAfterFirst = this.recordingWindow.getBounds();
      console.log(`[WindowManager] Position after first setBounds: (${boundsAfterFirst.x}, ${boundsAfterFirst.y})`);
      
      // For cross-display positioning, use dual setBounds() to handle display scaling issues
      // This is an Electron best practice for multi-monitor setups with different scaling
      if (boundsAfterFirst.x !== position.x || boundsAfterFirst.y !== position.y) {
        console.log(`[WindowManager] *** APPLYING SECOND SETBOUNDS (SCALING CORRECTION) ***`);
        console.log(`[WindowManager] Expected: (${position.x}, ${position.y}), Got: (${boundsAfterFirst.x}, ${boundsAfterFirst.y})`);
        
        this.recordingWindow.setBounds({
          x: position.x,
          y: position.y,
          width: currentBounds.width,
          height: currentBounds.height,
        });
      }
      
      // Verify final position
      const finalBounds = this.recordingWindow.getBounds();
      console.log(`[WindowManager] *** INSTANT POSITIONING COMPLETED ***`);
      console.log(`[WindowManager] Final position: (${finalBounds.x}, ${finalBounds.y})`);
      console.log(`[WindowManager] Position accuracy: ${finalBounds.x === position.x && finalBounds.y === position.y ? 'EXACT' : 'APPROXIMATE'}`);
      
    } catch (error) {
      console.error(`[WindowManager] Failed to position recording window:`, error);
    }

    // Also move information window if it exists (regardless of visibility)
    if (this.informationWindow && !this.informationWindow.isDestroyed()) {
      const informationPosition = this.displayManagerService!.calculateInformationWindowPosition(
        displayId,
        WINDOW_SIZES.expanded.height
      );
      
      if (informationPosition) {
        const windowState = this.informationWindow.isVisible() ? 'visible' : 'hidden';
        console.log(`[WindowManager] Moving information window (${windowState}) instantly to (${informationPosition.x}, ${informationPosition.y})`);
        try {
          this.informationWindow.setBounds({
            x: informationPosition.x,
            y: informationPosition.y,
            width: this.informationWindow.getBounds().width,
            height: this.informationWindow.getBounds().height,
          });
          console.log(`[WindowManager] Information window (${windowState}) positioned successfully on display ${displayId}`);
        } catch (error) {
          console.error(`[WindowManager] Failed to position information window:`, error);
        }
      }
    }
  }

  private handleRecordingWindowPositionUpdate(event: PositionUpdateEvent): void {
    const { displayId, position } = event;
    
    // Validate window exists and is ready for position update
    if (!this.recordingWindow || this.recordingWindow.isDestroyed()) {
      console.warn(`[WindowManager] Cannot update recording window position - window not available`);
      return;
    }

    if (!this.recordingWindow.isVisible()) {
      console.warn(`[WindowManager] Cannot update recording window position - window not visible`);
      return;
    }

    console.log(`[WindowManager] Updating recording window position on display ${displayId}:`, position);
    
    // Update window bounds immediately (no animation for metric changes)
    try {
      this.recordingWindow.setBounds({
        x: position.x,
        y: position.y,
        width: this.recordingWindow.getBounds().width,
        height: this.recordingWindow.getBounds().height
      });
      console.log(`[WindowManager] Successfully updated window position to (${position.x}, ${position.y})`);
    } catch (error) {
      console.error(`[WindowManager] Failed to update window position:`, error);
    }

    // Also update information window position if needed (regardless of visibility)
    if (this.informationWindow && !this.informationWindow.isDestroyed()) {
      const informationPosition = this.displayManagerService!.calculateInformationWindowPosition(
        displayId,
        WINDOW_SIZES.expanded.height
      );
      
      if (informationPosition) {
        const windowState = this.informationWindow.isVisible() ? 'visible' : 'hidden';
        console.log(`[WindowManager] Updating information window (${windowState}) position on display ${displayId} to (${informationPosition.x}, ${informationPosition.y})`);
        try {
          this.informationWindow.setBounds({
            x: informationPosition.x,
            y: informationPosition.y,
            width: this.informationWindow.getBounds().width,
            height: this.informationWindow.getBounds().height
          });
          console.log(`[WindowManager] Information window (${windowState}) position updated successfully`);
        } catch (error) {
          console.error(`[WindowManager] Failed to update information window position:`, error);
        }
      }
    }
  }

  moveRecordingWindowToDisplay(displayId: number): void {
    if (this.displayManagerService) {
      this.displayManagerService.moveRecordingWindowToDisplay(displayId);
    }
  }

  getCurrentRecordingDisplayId(): number | null {
    return this.currentRecordingDisplayId;
  }

  getCurrentRecordingDisplay(): DisplayInfo | null {
    if (this.displayManagerService && this.currentRecordingDisplayId !== null) {
      return this.displayManagerService.getCurrentRecordingDisplay();
    }
    return null;
  }

  startDisplayTracking(): void {
    if (this.displayManagerService) {
      console.log('[WindowManager] Starting display tracking');
      this.displayManagerService.startTracking();
    }
  }

  stopDisplayTracking(): void {
    if (this.displayManagerService) {
      console.log('[WindowManager] Stopping display tracking');
      this.displayManagerService.stopTracking();
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