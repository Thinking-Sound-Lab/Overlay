export interface WindowSizes {
  compact: { width: number; height: number };
  expanded: { width: number; height: number };
}

export interface InformationMessage {
  type: 'empty-transcript' | 'silent-recording' | 'permission-error' | 'processing-error' | 'word-limit-reached';
  title: string;
  message: string;
  duration?: number; // Auto-dismiss duration in ms, default 3000
}

export interface WindowPositions {
  center: { x: number; y: number };
  bottomCenter: { x: number; y: number };
  topCenter: { x: number; y: number };
}

export enum WindowType {
  MAIN = 'main',
  RECORDING = 'recording', 
  INFORMATION = 'information'
}