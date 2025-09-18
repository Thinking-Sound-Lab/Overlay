import { EventEmitter } from "events";
import { screen, powerMonitor } from "electron";
import {
  MousePosition,
  DisplayInfo,
  DisplayChangeEvent,
  DisplayManagerConfig,
  DEFAULT_DISPLAY_CONFIG,
} from "../../shared/types/display";

export class MouseTrackingService extends EventEmitter {
  private trackingInterval: NodeJS.Timeout | null = null;
  private isTracking = false;
  private lastMousePosition: MousePosition | null = null;
  private lastDisplayId: number | null = null;
  private config: DisplayManagerConfig;
  private debounceTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<DisplayManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DISPLAY_CONFIG, ...config };
    this.setupPowerMonitorListeners();
  }

  private setupPowerMonitorListeners(): void {
    // Pause tracking when system is suspended to save resources
    powerMonitor.on("suspend", () => {
      this.pause();
    });

    powerMonitor.on("resume", () => {
      if (this.isTracking) {
        this.resume();
      }
    });
  }

  public startTracking(): void {
    if (this.isTracking) {
      return;
    }

    this.isTracking = true;

    // Get initial position
    this.updateMousePosition();

    // Start tracking interval
    this.trackingInterval = setInterval(() => {
      this.updateMousePosition();
    }, this.config.mouseTrackingInterval);
  }

  public stopTracking(): void {
    if (!this.isTracking) {
      return;
    }

    this.isTracking = false;

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    this.lastMousePosition = null;
    this.lastDisplayId = null;
  }

  public pause(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  public resume(): void {
    if (this.isTracking && !this.trackingInterval) {
      this.trackingInterval = setInterval(() => {
        this.updateMousePosition();
      }, this.config.mouseTrackingInterval);
    }
  }

  private updateMousePosition(): void {
    try {
      const cursorPoint = screen.getCursorScreenPoint();
      const allDisplays = screen.getAllDisplays();

      // Custom display detection logic - check if mouse point is within each display's bounds
      const currentDisplay = this.findDisplayContainingPoint(
        cursorPoint,
        allDisplays
      );

      if (!currentDisplay) {
        // Fallback to Electron's API if our custom logic fails
        const fallbackDisplay = screen.getDisplayNearestPoint(cursorPoint);
        if (fallbackDisplay) {
          this.processDisplayUpdate(cursorPoint, fallbackDisplay);
        }
        return;
      }

      this.processDisplayUpdate(cursorPoint, currentDisplay);
    } catch {
      // Silently handle mouse position update errors
    }
  }

  private findDisplayContainingPoint(
    point: { x: number; y: number },
    displays: Electron.Display[]
  ): Electron.Display | null {
    // Find display where the point falls within its bounds
    for (const display of displays) {
      const { bounds } = display;
      if (
        point.x >= bounds.x &&
        point.x < bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y < bounds.y + bounds.height
      ) {
        return display;
      }
    }

    return null;
  }

  private processDisplayUpdate(
    cursorPoint: { x: number; y: number },
    currentDisplay: Electron.Display
  ): void {
    const mousePosition: MousePosition = {
      x: cursorPoint.x,
      y: cursorPoint.y,
      displayId: currentDisplay.id,
      timestamp: Date.now(),
    };

    this.lastMousePosition = mousePosition;

    // Check if display changed
    if (
      this.lastDisplayId !== null &&
      this.lastDisplayId !== currentDisplay.id
    ) {
      // Store the previous display ID before updating lastDisplayId to fix timing bug
      const previousDisplayId = this.lastDisplayId;
      this.handleDisplayChange(currentDisplay, previousDisplayId);
    }

    this.lastDisplayId = currentDisplay.id;
  }

  private handleDisplayChange(
    currentDisplay: Electron.Display,
    previousDisplayId: number
  ): void {
    // Clear any existing debounce timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Debounce rapid display changes
    this.debounceTimeout = setTimeout(() => {
      try {
        let previousDisplay: DisplayInfo | null = null;

        if (previousDisplayId !== null) {
          try {
            const prevElectronDisplay = screen
              .getAllDisplays()
              .find((d) => d.id === previousDisplayId);
            if (prevElectronDisplay) {
              previousDisplay =
                this.convertElectronDisplayToDisplayInfo(prevElectronDisplay);
            }
          } catch {
            // Silently handle previous display info error
          }
        }

        const currentDisplayInfo =
          this.convertElectronDisplayToDisplayInfo(currentDisplay);

        const changeEvent: DisplayChangeEvent = {
          previousDisplay,
          currentDisplay: currentDisplayInfo,
          mousePosition: this.lastMousePosition!,
          timestamp: Date.now(),
        };

        this.emit("display-changed", changeEvent);
      } catch {
        // Silently handle display change error
      }
    }, this.config.debounceDelay);
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

  public getCurrentMousePosition(): MousePosition | null {
    return this.lastMousePosition;
  }

  public getCurrentDisplayId(): number | null {
    return this.lastDisplayId;
  }

  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  public getAllDisplays(): DisplayInfo[] {
    try {
      return screen
        .getAllDisplays()
        .map((display) => this.convertElectronDisplayToDisplayInfo(display));
    } catch {
      return [];
    }
  }

  public getDisplayById(displayId: number): DisplayInfo | null {
    try {
      const displays = screen.getAllDisplays();
      const display = displays.find((d) => d.id === displayId);
      return display ? this.convertElectronDisplayToDisplayInfo(display) : null;
    } catch {
      return null;
    }
  }

  public updateConfig(newConfig: Partial<DisplayManagerConfig>): void {
    const oldInterval = this.config.mouseTrackingInterval;
    this.config = { ...this.config, ...newConfig };

    // If tracking interval changed and we're currently tracking, restart with new interval
    if (this.isTracking && oldInterval !== this.config.mouseTrackingInterval) {
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = setInterval(() => {
          this.updateMousePosition();
        }, this.config.mouseTrackingInterval);
      }
    }
  }

  public destroy(): void {
    this.stopTracking();
    this.removeAllListeners();
  }
}
