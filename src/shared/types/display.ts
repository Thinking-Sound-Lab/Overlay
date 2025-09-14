import { Display, Point } from "electron";

export interface DisplayInfo {
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
  isPrimary: boolean;
}

export interface WindowPosition {
  x: number;
  y: number;
  displayId: number;
}

export interface MousePosition extends Point {
  displayId: number;
  timestamp: number;
}

export interface DisplayChangeEvent {
  previousDisplay: DisplayInfo | null;
  currentDisplay: DisplayInfo;
  mousePosition: MousePosition;
  timestamp: number;
}

export interface VirtualDesktopInfo {
  id: string;
  name?: string;
  isActive: boolean;
}

export interface DisplayManagerConfig {
  mouseTrackingInterval: number;
  debounceDelay: number;
  animationDuration: number;
  enableVirtualDesktopTracking: boolean;
}

export const DEFAULT_DISPLAY_CONFIG: DisplayManagerConfig = {
  mouseTrackingInterval: 200,
  debounceDelay: 100,
  animationDuration: 200,
  enableVirtualDesktopTracking: true,
};