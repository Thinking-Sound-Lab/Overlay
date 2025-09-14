import { EventEmitter } from "events";
import { screen, powerMonitor } from "electron";
import { 
  MousePosition, 
  DisplayInfo, 
  DisplayChangeEvent, 
  DisplayManagerConfig,
  DEFAULT_DISPLAY_CONFIG 
} from "../../shared/types/display";

export class MouseTrackingService extends EventEmitter {
  private static instance: MouseTrackingService;
  private trackingInterval: NodeJS.Timeout | null = null;
  private isTracking = false;
  private lastMousePosition: MousePosition | null = null;
  private lastDisplayId: number | null = null;
  private config: DisplayManagerConfig;
  private debounceTimeout: NodeJS.Timeout | null = null;

  private constructor(config: Partial<DisplayManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DISPLAY_CONFIG, ...config };
    this.setupPowerMonitorListeners();
  }

  public static getInstance(config?: Partial<DisplayManagerConfig>): MouseTrackingService {
    if (!MouseTrackingService.instance) {
      MouseTrackingService.instance = new MouseTrackingService(config);
    }
    return MouseTrackingService.instance;
  }

  private setupPowerMonitorListeners(): void {
    // Pause tracking when system is suspended to save resources
    powerMonitor.on('suspend', () => {
      console.log('[MouseTrackingService] System suspended, pausing mouse tracking');
      this.pause();
    });

    powerMonitor.on('resume', () => {
      console.log('[MouseTrackingService] System resumed, resuming mouse tracking');
      if (this.isTracking) {
        this.resume();
      }
    });
  }

  public startTracking(): void {
    if (this.isTracking) {
      console.log('[MouseTrackingService] Already tracking mouse position');
      return;
    }

    console.log('[MouseTrackingService] Starting mouse position tracking');
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

    console.log('[MouseTrackingService] Stopping mouse position tracking');
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
      const currentDisplay = this.findDisplayContainingPoint(cursorPoint, allDisplays);
      
      // Enhanced debugging for display detection
      console.log(`[MouseTrackingService] Mouse at (${cursorPoint.x}, ${cursorPoint.y})`);
      console.log(`[MouseTrackingService] Available displays:`, allDisplays.map(d => ({
        id: d.id,
        bounds: d.bounds,
        primary: d.id === screen.getPrimaryDisplay().id
      })));
      
      if (!currentDisplay) {
        console.warn('[MouseTrackingService] No display found for mouse position - using fallback');
        // Fallback to Electron's API if our custom logic fails
        const fallbackDisplay = screen.getDisplayNearestPoint(cursorPoint);
        if (fallbackDisplay) {
          console.log(`[MouseTrackingService] Using fallback display: ${fallbackDisplay.id}`);
          this.processDisplayUpdate(cursorPoint, fallbackDisplay);
        }
        return;
      }

      console.log(`[MouseTrackingService] Current display: ${currentDisplay.id} (bounds: ${JSON.stringify(currentDisplay.bounds)})`);
      this.processDisplayUpdate(cursorPoint, currentDisplay);
    } catch (error) {
      console.error('[MouseTrackingService] Error updating mouse position:', error);
    }
  }

  private findDisplayContainingPoint(point: { x: number; y: number }, displays: Electron.Display[]): Electron.Display | null {
    // Find display where the point falls within its bounds
    for (const display of displays) {
      const { bounds } = display;
      if (point.x >= bounds.x && 
          point.x < bounds.x + bounds.width &&
          point.y >= bounds.y && 
          point.y < bounds.y + bounds.height) {
        console.log(`[MouseTrackingService] *** CUSTOM DETECTION *** Mouse (${point.x}, ${point.y}) is within display ${display.id} bounds:`, bounds);
        return display;
      }
    }
    
    console.log(`[MouseTrackingService] *** CUSTOM DETECTION *** Mouse (${point.x}, ${point.y}) not found in any display bounds`);
    return null;
  }

  private processDisplayUpdate(cursorPoint: { x: number; y: number }, currentDisplay: Electron.Display): void {
    const mousePosition: MousePosition = {
      x: cursorPoint.x,
      y: cursorPoint.y,
      displayId: currentDisplay.id,
      timestamp: Date.now(),
    };

    this.lastMousePosition = mousePosition;

    // Check if display changed
    if (this.lastDisplayId !== null && this.lastDisplayId !== currentDisplay.id) {
      console.log(`[MouseTrackingService] *** DISPLAY CHANGE DETECTED *** from ${this.lastDisplayId} to ${currentDisplay.id}`);
      
      // Store the previous display ID before updating lastDisplayId to fix timing bug
      const previousDisplayId = this.lastDisplayId;
      this.handleDisplayChange(currentDisplay, previousDisplayId);
    } else if (this.lastDisplayId === null) {
      console.log(`[MouseTrackingService] Initial display set to: ${currentDisplay.id}`);
    } else {
      // Only log every 10th update to avoid spam when on same display
      if (Date.now() % 2000 < 200) { // Log roughly every 2 seconds
        console.log(`[MouseTrackingService] Mouse still on display ${currentDisplay.id}`);
      }
    }

    this.lastDisplayId = currentDisplay.id;
  }

  private handleDisplayChange(currentDisplay: Electron.Display, previousDisplayId: number): void {
    // Clear any existing debounce timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Debounce rapid display changes
    this.debounceTimeout = setTimeout(() => {
      try {
        let previousDisplay: DisplayInfo | null = null;

        // Use the passed previousDisplayId instead of this.lastDisplayId to fix timing bug
        console.log(`[MouseTrackingService] *** PROCESSING DISPLAY CHANGE *** from ${previousDisplayId} to ${currentDisplay.id}`);
        
        if (previousDisplayId !== null) {
          try {
            const prevElectronDisplay = screen.getAllDisplays()
              .find(d => d.id === previousDisplayId);
            if (prevElectronDisplay) {
              previousDisplay = this.convertElectronDisplayToDisplayInfo(prevElectronDisplay);
              console.log(`[MouseTrackingService] Found previous display info:`, previousDisplay.bounds);
            } else {
              console.warn(`[MouseTrackingService] Could not find previous display with ID ${previousDisplayId}`);
            }
          } catch (error) {
            console.warn('[MouseTrackingService] Could not get previous display info:', error);
          }
        }

        const currentDisplayInfo = this.convertElectronDisplayToDisplayInfo(currentDisplay);
        console.log(`[MouseTrackingService] Current display info:`, currentDisplayInfo.bounds);
        
        const changeEvent: DisplayChangeEvent = {
          previousDisplay,
          currentDisplay: currentDisplayInfo,
          mousePosition: this.lastMousePosition!,
          timestamp: Date.now(),
        };

        console.log(`[MouseTrackingService] *** EMITTING DISPLAY CHANGE EVENT *** from ${previousDisplayId} to ${currentDisplay.id}`);
        console.log(`[MouseTrackingService] Event data:`, {
          previousDisplayId: previousDisplay?.id,
          currentDisplayId: currentDisplayInfo.id,
          mousePosition: this.lastMousePosition
        });
        
        this.emit('display-changed', changeEvent);
      } catch (error) {
        console.error('[MouseTrackingService] Error handling display change:', error);
      }
    }, this.config.debounceDelay);
  }

  private convertElectronDisplayToDisplayInfo(display: Electron.Display): DisplayInfo {
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
      return screen.getAllDisplays().map(display => 
        this.convertElectronDisplayToDisplayInfo(display)
      );
    } catch (error) {
      console.error('[MouseTrackingService] Error getting all displays:', error);
      return [];
    }
  }

  public getDisplayById(displayId: number): DisplayInfo | null {
    try {
      const displays = screen.getAllDisplays();
      const display = displays.find(d => d.id === displayId);
      return display ? this.convertElectronDisplayToDisplayInfo(display) : null;
    } catch (error) {
      console.error('[MouseTrackingService] Error getting display by ID:', error);
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