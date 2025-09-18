import { EventEmitter } from "events";
import { screen } from "electron";
import { MouseTrackingService } from "./mouse_tracking_service";
import {
  DisplayInfo,
  WindowPosition,
  DisplayChangeEvent,
  DisplayManagerConfig,
  DEFAULT_DISPLAY_CONFIG,
  VirtualDesktopInfo,
} from "../../shared/types/display";

export interface RecordingWindowDimensions {
  width: number;
  height: number;
}

export class DisplayManagerService extends EventEmitter {
  private config: DisplayManagerConfig;
  private currentRecordingDisplayId: number | null = null;
  private recordingWindowDimensions: RecordingWindowDimensions = {
    width: 50,
    height: 10,
  };
  private isActive = false;

  constructor(
    private mouseTrackingService: MouseTrackingService,
    config: Partial<DisplayManagerConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_DISPLAY_CONFIG, ...config };
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for display changes from mouse tracking service
    this.mouseTrackingService.on(
      "display-changed",
      (event: DisplayChangeEvent) => {
        this.handleDisplayChange(event);
      }
    );

    // Listen for display configuration changes (monitor added/removed/resolution changed)
    screen.on("display-added", (event, newDisplay) => {
      console.log("[DisplayManagerService] Display added:", newDisplay.id);
      this.emit("display-configuration-changed", {
        type: "added",
        display: this.convertElectronDisplayToDisplayInfo(newDisplay),
        allDisplays: this.getAllDisplays(),
      });
    });

    screen.on("display-removed", (event, oldDisplay) => {
      console.log("[DisplayManagerService] Display removed:", oldDisplay.id);

      // If recording window was on removed display, move to primary
      if (this.currentRecordingDisplayId === oldDisplay.id) {
        const primaryDisplay = screen.getPrimaryDisplay();
        console.log(
          "[DisplayManagerService] Recording window display removed, moving to primary display"
        );
        this.moveRecordingWindowToDisplay(primaryDisplay.id);
      }

      this.emit("display-configuration-changed", {
        type: "removed",
        display: this.convertElectronDisplayToDisplayInfo(oldDisplay),
        allDisplays: this.getAllDisplays(),
      });
    });

    screen.on("display-metrics-changed", (event, display, changedMetrics) => {
      console.log(
        "[DisplayManagerService] Display metrics changed:",
        display.id,
        changedMetrics
      );

      // If the recording window is on this display, recalculate position
      if (
        (this.currentRecordingDisplayId === display.id &&
          changedMetrics.includes("bounds" as any)) ||
        changedMetrics.includes("workArea" as any)
      ) {
        console.log(
          "[DisplayManagerService] Recording window display metrics changed, updating position"
        );
        this.emit("recording-window-position-update-needed", {
          displayId: display.id,
          position: this.calculateRecordingWindowPosition(display.id),
        });
      }

      this.emit("display-configuration-changed", {
        type: "metrics-changed",
        display: this.convertElectronDisplayToDisplayInfo(display),
        changedMetrics,
        allDisplays: this.getAllDisplays(),
      });
    });
  }

  private handleDisplayChange(event: DisplayChangeEvent): void {
    if (!this.isActive) {
      console.log(
        `[DisplayManagerService] Display change ignored - service not active`
      );
      return;
    }

    console.log(
      `[DisplayManagerService] *** HANDLING DISPLAY CHANGE EVENT ***`
    );
    console.log(
      `[DisplayManagerService] Previous display:`,
      event.previousDisplay ? `ID ${event.previousDisplay.id}` : "null"
    );
    console.log(
      `[DisplayManagerService] Current display: ID ${event.currentDisplay.id}`
    );
    console.log(
      `[DisplayManagerService] Previous display bounds:`,
      event.previousDisplay?.bounds
    );
    console.log(
      `[DisplayManagerService] Current display bounds:`,
      event.currentDisplay.bounds
    );
    console.log(`[DisplayManagerService] Mouse position:`, event.mousePosition);

    // Detailed condition checking with explicit logging
    const hasPreviousDisplay = !!event.previousDisplay;
    const displayIdsDifferent =
      event.previousDisplay?.id !== event.currentDisplay.id;

    console.log(`[DisplayManagerService] *** CONDITION CHECK ***`);
    console.log(
      `[DisplayManagerService] Has previous display: ${hasPreviousDisplay}`
    );
    console.log(
      `[DisplayManagerService] Previous display ID: ${event.previousDisplay?.id}`
    );
    console.log(
      `[DisplayManagerService] Current display ID: ${event.currentDisplay.id}`
    );
    console.log(
      `[DisplayManagerService] Display IDs different: ${displayIdsDifferent}`
    );
    console.log(
      `[DisplayManagerService] Should trigger move: ${hasPreviousDisplay && displayIdsDifferent}`
    );

    // Only move if display actually changed
    if (hasPreviousDisplay && displayIdsDifferent) {
      console.log(
        `[DisplayManagerService] *** TRIGGERING WINDOW MOVE *** from display ${event.previousDisplay!.id} to display ${event.currentDisplay.id}`
      );
      this.moveRecordingWindowToDisplay(event.currentDisplay.id);
    } else {
      console.warn(
        `[DisplayManagerService] *** NO WINDOW MOVE TRIGGERED *** - Conditions not met:`
      );
      console.warn(
        `[DisplayManagerService] - Has previous display: ${hasPreviousDisplay}`
      );
      console.warn(
        `[DisplayManagerService] - Display IDs different: ${displayIdsDifferent}`
      );
    }
  }

  public startTracking(): void {
    if (this.isActive) {
      console.log("[DisplayManagerService] Already tracking displays");
      return;
    }

    console.log("[DisplayManagerService] Starting display tracking");
    this.isActive = true;
    this.mouseTrackingService.startTracking();

    // Set initial display
    const currentDisplayId = this.mouseTrackingService.getCurrentDisplayId();
    if (currentDisplayId !== null) {
      this.currentRecordingDisplayId = currentDisplayId;
    } else {
      // Fallback to primary display
      this.currentRecordingDisplayId = screen.getPrimaryDisplay().id;
    }
  }

  public stopTracking(): void {
    if (!this.isActive) {
      return;
    }

    console.log("[DisplayManagerService] Stopping display tracking");
    this.isActive = false;
    this.mouseTrackingService.stopTracking();
    this.currentRecordingDisplayId = null;
  }

  public moveRecordingWindowToDisplay(displayId: number): void {
    const previousDisplayId = this.currentRecordingDisplayId;
    this.currentRecordingDisplayId = displayId;

    const position = this.calculateRecordingWindowPosition(displayId);

    console.log(`[DisplayManagerService] *** MOVE RECORDING WINDOW ***`);
    console.log(
      `[DisplayManagerService] From display: ${previousDisplayId} → To display: ${displayId}`
    );
    console.log(`[DisplayManagerService] Calculated position:`, position);

    if (position) {
      const moveEvent = {
        displayId,
        position,
        previousDisplayId,
        animationDuration: this.config.animationDuration,
      };

      console.log(
        `[DisplayManagerService] *** EMITTING 'move-recording-window' EVENT ***`,
        moveEvent
      );

      this.emit("move-recording-window", moveEvent);
    } else {
      console.error(
        `[DisplayManagerService] Could not calculate position for display ${displayId}`
      );
    }
  }

  public calculateRecordingWindowPosition(
    displayId: number
  ): WindowPosition | null {
    const display = this.mouseTrackingService.getDisplayById(displayId);

    if (!display) {
      console.error(`[DisplayManagerService] Display ${displayId} not found`);
      return null;
    }

    const { bounds, workArea } = display;
    const { width: windowWidth, height: windowHeight } =
      this.recordingWindowDimensions;

    console.log(
      `[DisplayManagerService] *** CALCULATING POSITION WITH DISPLAY ORIGIN OFFSET ***`
    );
    console.log(
      `[DisplayManagerService] Target display ${displayId} bounds:`,
      bounds
    );
    console.log(
      `[DisplayManagerService] Target display ${displayId} workArea:`,
      workArea
    );
    console.log(
      `[DisplayManagerService] Window dimensions: ${windowWidth}x${windowHeight}`
    );

    // Platform-specific positioning adjustments
    const isWindows = process.platform === "win32";
    const taskbarMargin = isWindows ? 10 : 0;

    // Calculate position RELATIVE to the display's workArea (not global coordinates)
    const relativeX = Math.round((workArea.width - windowWidth) / 2);
    const relativeY = workArea.height - windowHeight - taskbarMargin;

    // Convert to global coordinates by adding display bounds offset
    const globalX = bounds.x + relativeX;
    const globalY = bounds.y + relativeY;

    console.log(
      `[DisplayManagerService] Recording window positioning calculation:`
    );
    console.log(
      `[DisplayManagerService] - Work area height: ${workArea.height}`
    );
    console.log(
      `[DisplayManagerService] - Recording window height: ${windowHeight}`
    );
    console.log(`[DisplayManagerService] - Taskbar margin: ${taskbarMargin}`);
    console.log(
      `[DisplayManagerService] - Calculated relative Y: ${relativeY}`
    );
    console.log(`[DisplayManagerService] *** COORDINATE CALCULATION ***`);
    console.log(
      `[DisplayManagerService] Relative position within display: (${relativeX}, ${relativeY})`
    );
    console.log(
      `[DisplayManagerService] Display bounds offset: (${bounds.x}, ${bounds.y})`
    );
    console.log(
      `[DisplayManagerService] Final global position: (${globalX}, ${globalY})`
    );

    return {
      x: globalX,
      y: globalY,
      displayId,
    };
  }

  public calculateInformationWindowPosition(
    displayId: number,
    recordingWindowHeight: number
  ): WindowPosition | null {
    const display = this.mouseTrackingService.getDisplayById(displayId);

    if (!display) {
      console.error(
        `[DisplayManagerService] Display ${displayId} not found for information window`
      );
      return null;
    }

    const { bounds, workArea } = display;
    const informationWindowWidth = 280;
    const informationWindowHeight = 50;
    const gap = 8; // Gap between information and recording windows

    // Platform-specific positioning adjustments
    const isWindows = process.platform === "win32";
    const taskbarMargin = isWindows ? 10 : 0;

    // Calculate position RELATIVE to the display's workArea (not global coordinates)
    const relativeX = Math.round((workArea.width - informationWindowWidth) / 2);
    // Position information window above recording window with proper gap
    const relativeY =
      workArea.height -
      recordingWindowHeight -
      informationWindowHeight -
      gap -
      taskbarMargin;

    // Convert to global coordinates by adding display bounds offset
    const globalX = bounds.x + relativeX;
    const globalY = bounds.y + relativeY;

    console.log(
      `[DisplayManagerService] Information window positioning calculation:`
    );
    console.log(
      `[DisplayManagerService] - Work area height: ${workArea.height}`
    );
    console.log(
      `[DisplayManagerService] - Recording window height: ${recordingWindowHeight}`
    );
    console.log(
      `[DisplayManagerService] - Information window height: ${informationWindowHeight}`
    );
    console.log(`[DisplayManagerService] - Gap: ${gap}`);
    console.log(`[DisplayManagerService] - Taskbar margin: ${taskbarMargin}`);
    console.log(
      `[DisplayManagerService] - Calculated relative Y: ${relativeY}`
    );
    console.log(
      `[DisplayManagerService] Information window position: relative (${relativeX}, ${relativeY}) → global (${globalX}, ${globalY})`
    );

    return {
      x: globalX,
      y: globalY,
      displayId,
    };
  }

  public setRecordingWindowDimensions(
    dimensions: RecordingWindowDimensions
  ): void {
    this.recordingWindowDimensions = dimensions;

    // If we have a current display, recalculate position
    if (this.currentRecordingDisplayId !== null) {
      const position = this.calculateRecordingWindowPosition(
        this.currentRecordingDisplayId
      );
      if (position) {
        this.emit("recording-window-position-update-needed", {
          displayId: this.currentRecordingDisplayId,
          position,
        });
      }
    }
  }

  public getCurrentRecordingDisplayId(): number | null {
    return this.currentRecordingDisplayId;
  }

  public getCurrentRecordingDisplay(): DisplayInfo | null {
    if (this.currentRecordingDisplayId === null) {
      return null;
    }
    return this.mouseTrackingService.getDisplayById(
      this.currentRecordingDisplayId
    );
  }

  public getAllDisplays(): DisplayInfo[] {
    return this.mouseTrackingService.getAllDisplays();
  }

  private convertElectronDisplayToDisplayInfo(
    display: Electron.Display
  ): DisplayInfo {
    return {
      id: display.id,
      bounds: {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      },
      workArea: {
        x: display.workArea.x,
        y: display.workArea.y,
        width: display.workArea.width,
        height: display.workArea.height,
      },
      scaleFactor: display.scaleFactor,
      isPrimary: display.id === screen.getPrimaryDisplay().id,
    };
  }

  public getPrimaryDisplay(): DisplayInfo {
    const primaryDisplay = screen.getPrimaryDisplay();
    return this.convertElectronDisplayToDisplayInfo(primaryDisplay);
  }

  public getDisplayNearestPoint(x: number, y: number): DisplayInfo | null {
    try {
      const display = screen.getDisplayNearestPoint({ x, y });
      return this.convertElectronDisplayToDisplayInfo(display);
    } catch (error) {
      console.error(
        "[DisplayManagerService] Error getting display nearest point:",
        error
      );
      return null;
    }
  }

  // Virtual desktop support (platform-specific implementations can be added later)
  public getVirtualDesktopInfo(): VirtualDesktopInfo | null {
    // This is a placeholder for future virtual desktop detection
    // Implementation would vary by platform:
    // - Windows: Use Windows API to detect virtual desktops
    // - macOS: Use Mission Control/Spaces APIs
    // - Linux: Use workspace detection

    console.log(
      "[DisplayManagerService] Virtual desktop tracking not yet implemented"
    );
    return null;
  }

  public updateConfig(newConfig: Partial<DisplayManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.mouseTrackingService.updateConfig(newConfig);
  }

  public isTrackingActive(): boolean {
    return this.isActive;
  }

  public destroy(): void {
    this.stopTracking();
    this.mouseTrackingService.destroy();
    this.removeAllListeners();
  }
}
