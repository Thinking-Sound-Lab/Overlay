import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Settings management
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke("update-settings", settings),

  // Statistics and metrics
  getStatistics: () => ipcRenderer.invoke("get-statistics"),
  resetStatistics: () => ipcRenderer.invoke("reset-statistics"),
  
  // Transcripts
  getTranscripts: () => ipcRenderer.invoke("get-transcripts"),

  // Recording management
  testMicrophone: () => ipcRenderer.invoke("test-microphone"),
  startRecording: () => ipcRenderer.invoke("start-recording"),
  stopRecording: () => ipcRenderer.invoke("stop-recording"),

  // External links
  openExternalLink: (url: string) =>
    ipcRenderer.invoke("open-external-link", url),

  // Real-time updates
  onStatisticsUpdate: (callback: (stats: any) => void) => {
    const subscription = (_: any, stats: any) => callback(stats);
    ipcRenderer.on("statistics-updated", subscription);

    return () => {
      ipcRenderer.removeListener("statistics-updated", subscription);
    };
  },

  onActivityUpdate: (callback: (activity: any) => void) => {
    const subscription = (_: any, activity: any) => callback(activity);
    ipcRenderer.on("activity-updated", subscription);

    return () => {
      ipcRenderer.removeListener("activity-updated", subscription);
    };
  },

  audioRecorded: (data: { data: string; mimeType: string }) =>
    ipcRenderer.invoke("audio-recorded", data),
  windowHoverEnter: () => ipcRenderer.invoke("window-hover-enter"),
  windowHoverLeave: () => ipcRenderer.invoke("window-hover-leave"),
  
  // Direct window control methods
  expandRecordingWindow: () => ipcRenderer.invoke("expand-recording-window"),
  compactRecordingWindow: () => ipcRenderer.invoke("compact-recording-window"),

  // Authentication handlers
  onAuthenticationComplete: (user: any) =>
    ipcRenderer.invoke("on-authentication-complete", user),

  // Permission handlers
  checkAccessibilityPermission: () =>
    ipcRenderer.invoke("check-accessibility-permission"),
  requestAccessibilityPermission: () =>
    ipcRenderer.invoke("request-accessibility-permission"),

  // Auto-updater handlers
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  // Window control handlers for custom navigation bar
  windowControls: {
    close: () => ipcRenderer.invoke("window:close"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    getMaximizedState: () => ipcRenderer.invoke("window:get-maximized-state")
  },

  // Platform information
  platform: process.platform,

  // External API methods (Supabase & Analytics)
  // Authentication
  auth: {
    signIn: (email: string, password: string) => 
      ipcRenderer.invoke("auth:signIn", { email, password }),
    signUp: (email: string, password: string, name?: string) => 
      ipcRenderer.invoke("auth:signUp", { email, password, name }),
    signInWithGoogle: () => ipcRenderer.invoke("auth:signInWithGoogle"),
    signOut: () => ipcRenderer.invoke("auth:signOut"),
    getCurrentUser: () => ipcRenderer.invoke("auth:getCurrentUser"),
    getUserProfile: () => ipcRenderer.invoke("auth:getUserProfile"),
    completeOnboarding: () => ipcRenderer.invoke("auth:completeOnboarding")
  },

  // Account management
  deleteAccount: () => ipcRenderer.invoke("auth:deleteAccount"),

  // Database operations
  db: {
    saveTranscript: (transcript: any) =>
      ipcRenderer.invoke("db:saveTranscript", transcript),
    getTranscripts: (limit?: number) => 
      ipcRenderer.invoke("db:getTranscripts", limit),
    saveUserSettings: (settings: any) =>
      ipcRenderer.invoke("db:saveUserSettings", settings),
    getUserSettings: () => ipcRenderer.invoke("db:getUserSettings"),
    getUserStats: () => ipcRenderer.invoke("db:getUserStats")
  },

  // Analytics
  analytics: {
    track: (event: string, properties?: Record<string, any>) =>
      ipcRenderer.invoke("analytics:track", { event, properties }),
    identify: (userId: string, properties?: Record<string, any>) =>
      ipcRenderer.invoke("analytics:identify", { userId, properties }),
    trackUserSignUp: (method?: 'email' | 'google' | 'github') =>
      ipcRenderer.invoke("analytics:trackUserSignUp", method),
    trackUserSignIn: (method?: 'email' | 'google' | 'github') =>
      ipcRenderer.invoke("analytics:trackUserSignIn", method),
    trackUserSignOut: () => ipcRenderer.invoke("analytics:trackUserSignOut"),
    trackRecordingStarted: () => ipcRenderer.invoke("analytics:trackRecordingStarted"),
    trackRecordingStopped: (duration: number) =>
      ipcRenderer.invoke("analytics:trackRecordingStopped", duration),
    trackTranscriptionCompleted: (data: { wordCount: number; wpm: number; wasTranslated: boolean }) =>
      ipcRenderer.invoke("analytics:trackTranscriptionCompleted", data),
    trackAppLaunched: () => ipcRenderer.invoke("analytics:trackAppLaunched")
  },

  // Update event listeners
  onUpdateAvailable: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info);
    ipcRenderer.on("update-available", subscription);
    return () => {
      ipcRenderer.removeListener("update-available", subscription);
    };
  },

  onUpdateDownloadProgress: (callback: (percent: number) => void) => {
    const subscription = (_: any, percent: number) => callback(percent);
    ipcRenderer.on("update-download-progress", subscription);
    return () => {
      ipcRenderer.removeListener("update-download-progress", subscription);
    };
  },

  onUpdateDownloaded: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info);
    ipcRenderer.on("update-downloaded", subscription);
    return () => {
      ipcRenderer.removeListener("update-downloaded", subscription);
    };
  },
});

// Re-dispatch IPC messages as DOM events so the recording window can listen on window
ipcRenderer.on("recording-started", () => {
  window.dispatchEvent(new Event("recording-started"));
});

ipcRenderer.on("recording-stopped", () => {
  window.dispatchEvent(new Event("recording-stopped"));
});

ipcRenderer.on("processing-complete", () => {
  window.dispatchEvent(new Event("processing-complete"));
});

ipcRenderer.on("processing-stage", (_, stage) => {
  window.dispatchEvent(new CustomEvent("processing-stage", { detail: stage }));
});

ipcRenderer.on("auth-state-changed", (_, authState) => {
  window.dispatchEvent(new CustomEvent("auth-state-changed", { detail: authState }));
});

ipcRenderer.on("transcripts-loaded", (_, transcripts) => {
  console.log("Preload: Received transcripts-loaded event:", transcripts?.length || 0);
  window.dispatchEvent(new CustomEvent("transcripts-loaded", { detail: transcripts }));
});

ipcRenderer.on("activity-updated", (_, activity) => {
  console.log("Preload: Received activity-updated event:", activity);
  window.dispatchEvent(new CustomEvent("activity-updated", { detail: activity }));
});

ipcRenderer.on("transcript-saved-to-database", (_, transcript) => {
  window.dispatchEvent(new CustomEvent("transcript-saved-to-database", { detail: transcript }));
});

ipcRenderer.on("statistics-updated", (_, stats) => {
  window.dispatchEvent(new CustomEvent("statistics-updated", { detail: stats }));
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<Record<string, unknown>>;
      updateSettings: (
        settings: Record<string, unknown>
      ) => Promise<{ success: boolean }>;
      getStatistics: () => Promise<Record<string, unknown>>;
      resetStatistics: () => Promise<{ success: boolean }>;
      getTranscripts: () => Promise<any[]>;
      testMicrophone: () => Promise<{ success: boolean; error?: string }>;
      startRecording: () => Promise<{ success: boolean; error?: string }>;
      stopRecording: () => Promise<{ success: boolean; error?: string }>;
      audioRecorded: (audioData: {
        data: string;
        mimeType: string;
      }) => Promise<{ success: boolean }>;
      windowHoverEnter: () => Promise<void>;
      windowHoverLeave: () => Promise<void>;
      openExternalLink: (url: string) => Promise<void>;
      onStatisticsUpdate: (callback: (stats: any) => void) => () => void;
      onActivityUpdate: (callback: (activity: any) => void) => () => void;
      
      // Authentication handlers
      onAuthenticationComplete: (user: any) => Promise<{ success: boolean }>;
      
      // Permission handlers
      checkAccessibilityPermission: () => Promise<boolean>;
      requestAccessibilityPermission: () => Promise<{ success: boolean }>;
      
      // Auto-updater handlers
      checkForUpdates: () => Promise<{ success: boolean }>;
      downloadUpdate: () => Promise<{ success: boolean }>;
      installUpdate: () => Promise<{ success: boolean }>;
      
      // Window control handlers for custom navigation bar
      windowControls: {
        close: () => Promise<{ success: boolean; error?: string }>;
        minimize: () => Promise<{ success: boolean; error?: string }>;
        maximize: () => Promise<{ success: boolean; action?: string; error?: string }>;
        getMaximizedState: () => Promise<{ isMaximized: boolean }>;
      };
      
      // Update event listeners
      onUpdateAvailable: (callback: (info: any) => void) => () => void;
      onUpdateDownloadProgress: (callback: (percent: number) => void) => () => void;
      onUpdateDownloaded: (callback: (info: any) => void) => () => void;

      // Platform information
      platform: string;

      // External API methods (Supabase & Analytics)
      auth: {
        signIn: (email: string, password: string) => Promise<any>;
        signUp: (email: string, password: string, name?: string) => Promise<any>;
        signInWithGoogle: () => Promise<any>;
        signOut: () => Promise<any>;
        getCurrentUser: () => Promise<any>;
        getUserProfile: () => Promise<any>;
        completeOnboarding: () => Promise<any>;
      };

      // Account management
      deleteAccount: () => Promise<any>;

      db: {
        saveTranscript: (transcript: any) => Promise<any>;
        getTranscripts: (limit?: number) => Promise<any>;
        saveUserSettings: (settings: any) => Promise<any>;
        getUserSettings: () => Promise<any>;
        getUserStats: () => Promise<any>;
      };

      analytics: {
        track: (event: string, properties?: Record<string, any>) => Promise<any>;
        identify: (userId: string, properties?: Record<string, any>) => Promise<any>;
        trackUserSignUp: (method?: 'email' | 'google' | 'github') => Promise<any>;
        trackUserSignIn: (method?: 'email' | 'google' | 'github') => Promise<any>;
        trackUserSignOut: () => Promise<any>;
        trackRecordingStarted: () => Promise<any>;
        trackRecordingStopped: (duration: number) => Promise<any>;
        trackTranscriptionCompleted: (data: { wordCount: number; wpm: number; wasTranslated: boolean }) => Promise<any>;
        trackAppLaunched: () => Promise<any>;
      };
    };
  }
}
