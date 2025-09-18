import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Statistics and metrics
  resetStatistics: () => ipcRenderer.invoke("reset-statistics"),

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

  onTranscriptUpdate: (callback: (transcript: any) => void) => {
    const subscription = (_: any, transcript: any) => callback(transcript);
    ipcRenderer.on("transcript-updated", subscription);

    return () => {
      ipcRenderer.removeListener("transcript-updated", subscription);
    };
  },

  audioRecorded: (data: { data: string; mimeType: string }) =>
    ipcRenderer.invoke("audio-recorded", data),
  windowHoverEnter: () => ipcRenderer.invoke("window-hover-enter"),
  windowHoverLeave: () => ipcRenderer.invoke("window-hover-leave"),
  startProcessingAudio: () => ipcRenderer.invoke("start-processing-audio"),

  // Direct window control methods
  expandRecordingWindow: () => ipcRenderer.invoke("expand-recording-window"),
  compactRecordingWindow: () => ipcRenderer.invoke("compact-recording-window"),

  // Information window tooltip methods
  showRecordingTooltip: (type: string, message: string) =>
    ipcRenderer.invoke("show-recording-tooltip", type, message),

  // Authentication handlers
  onAuthenticationComplete: (user: any) =>
    ipcRenderer.invoke("on-authentication-complete", user),
  refreshAuthState: () => ipcRenderer.invoke("refresh-auth-state"),

  // Permission handlers
  checkAccessibilityPermission: () =>
    ipcRenderer.invoke("check-accessibility-permission"),
  checkMicrophonePermission: () =>
    ipcRenderer.invoke("check-microphone-permission"),
  requestAccessibilityPermission: () =>
    ipcRenderer.invoke("request-accessibility-permission"),
  requestMicrophonePermission: () =>
    ipcRenderer.invoke("request-microphone-permission"),

  // Auto-updater handlers
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  // Window control handlers for custom navigation bar
  windowControls: {
    close: () => ipcRenderer.invoke("window:close"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    getMaximizedState: () => ipcRenderer.invoke("window:get-maximized-state"),
  },

  // Platform information
  platform: process.platform,

  // App version
  getVersion: () => ipcRenderer.invoke("get-app-version"),

  // External API methods (Supabase & Analytics)
  // Authentication
  auth: {
    signInWithMagicLink: (email: string) =>
      ipcRenderer.invoke("auth:signInWithMagicLink", { email }),
    signUpWithMagicLink: (email: string, name: string) =>
      ipcRenderer.invoke("auth:signUpWithMagicLink", { email, name }),
    signInWithGoogle: () => ipcRenderer.invoke("auth:signInWithGoogle"),
    signOut: () => ipcRenderer.invoke("auth:signOut"),
    getCurrentUser: () => ipcRenderer.invoke("auth:getCurrentUser"),
    getUserProfile: () => ipcRenderer.invoke("auth:getUserProfile"),
    completeOnboarding: () => ipcRenderer.invoke("auth:completeOnboarding"),
  },

  // Account management
  deleteAccount: () => ipcRenderer.invoke("auth:deleteAccount"),

  // Database operations
  db: {
    saveTranscript: (transcript: any) =>
      ipcRenderer.invoke("db:saveTranscript", transcript),
    getTranscripts: (limit?: number, offset?: number) =>
      ipcRenderer.invoke("db:getTranscripts", limit, offset),
    downloadAudio: (audioFilePath: string) =>
      ipcRenderer.invoke("db:downloadAudio", audioFilePath),
    saveUserSettings: (settings: any) =>
      ipcRenderer.invoke("db:saveUserSettings", settings),
    getUserSettings: () => ipcRenderer.invoke("db:getUserSettings"),
    getUserStats: () => ipcRenderer.invoke("db:getUserStats"),
  },

  // Analytics
  analytics: {
    track: (event: string, properties?: Record<string, any>) =>
      ipcRenderer.invoke("analytics:track", { event, properties }),
    identify: (userId: string, properties?: Record<string, any>) =>
      ipcRenderer.invoke("analytics:identify", { userId, properties }),
    trackUserSignUp: (method?: "email" | "google" | "github") =>
      ipcRenderer.invoke("analytics:trackUserSignUp", method),
    trackUserSignIn: (method?: "email" | "google" | "github") =>
      ipcRenderer.invoke("analytics:trackUserSignIn", method),
    trackUserSignOut: () => ipcRenderer.invoke("analytics:trackUserSignOut"),
    trackRecordingStarted: () =>
      ipcRenderer.invoke("analytics:trackRecordingStarted"),
    trackRecordingStopped: (duration: number) =>
      ipcRenderer.invoke("analytics:trackRecordingStopped", duration),
    trackTranscriptionCompleted: (data: {
      wordCount: number;
      wpm: number;
      wasTranslated: boolean;
    }) => ipcRenderer.invoke("analytics:trackTranscriptionCompleted", data),
    trackAppLaunched: () => ipcRenderer.invoke("analytics:trackAppLaunched"),
  },

  // Microphone management
  microphone: {
    getDevices: () => ipcRenderer.invoke("microphone:getDevices"),
    // NOTE: testDevice removed - deprecated method that triggers unwanted microphone access
    validateDevice: (deviceId: string) =>
      ipcRenderer.invoke("microphone:validateDevice", deviceId),
    getConstraints: (deviceId: string) =>
      ipcRenderer.invoke("microphone:getConstraints", deviceId),
    getCurrentDeviceConstraints: () =>
      ipcRenderer.invoke("microphone:getCurrentDeviceConstraints"),
    setCurrentDevice: (deviceId: string) =>
      ipcRenderer.invoke("microphone:setCurrentDevice", deviceId),
    requestPermissions: () =>
      ipcRenderer.invoke("microphone:requestPermissions"),
    checkPermissions: () => ipcRenderer.invoke("microphone:checkPermissions"),
  },

  // Dictionary management
  dictionary: {
    getDictionaryEntries: () =>
      ipcRenderer.invoke("dictionary:getDictionaryEntries"),
    addDictionaryEntry: (key: string, value: string) =>
      ipcRenderer.invoke("dictionary:addDictionaryEntry", key, value),
    updateDictionaryEntry: (id: string, key: string, value: string) =>
      ipcRenderer.invoke("dictionary:updateDictionaryEntry", id, key, value),
    deleteDictionaryEntry: (id: string) =>
      ipcRenderer.invoke("dictionary:deleteDictionaryEntry", id),
  },

  // Pro features management
  pro: {
    startTrial: () => ipcRenderer.invoke("pro:startTrial"),
    updateSubscription: (tier: "free" | "pro_trial" | "pro") =>
      ipcRenderer.invoke("pro:updateSubscription", tier),
    getSubscriptionInfo: () => ipcRenderer.invoke("pro:getSubscriptionInfo"),
  },

  // Hotkey test mode for onboarding
  startHotkeyTest: () => ipcRenderer.invoke("start-hotkey-test"),
  endHotkeyTest: () => ipcRenderer.invoke("end-hotkey-test"),

  // Renderer readiness for auth state synchronization
  rendererReadyForAuth: () => ipcRenderer.invoke("renderer-ready-for-auth"),

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

  // Recording controls
  recording: {
    start: () => ipcRenderer.invoke("recording:start"),
    stop: () => ipcRenderer.invoke("recording:stop"),
    cancel: () => ipcRenderer.invoke("recording:cancel"),
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

// Information window messages
ipcRenderer.on("show-message", (_, message) => {
  window.dispatchEvent(new CustomEvent("show-message", { detail: message }));
});

ipcRenderer.on("processing-stage", (_, stage) => {
  window.dispatchEvent(new CustomEvent("processing-stage", { detail: stage }));
});

ipcRenderer.on("auth-state-changed", (_, authState) => {
  console.log("Preload: Received auth-state-changed event:", authState);
  window.dispatchEvent(
    new CustomEvent("auth-state-changed", { detail: authState })
  );
});

ipcRenderer.on("loading-state-changed", (_, loadingState) => {
  console.log("Preload: Received loading-state-changed event:", loadingState);
  window.dispatchEvent(
    new CustomEvent("loading-state-changed", { detail: loadingState })
  );
});

ipcRenderer.on("activity-updated", (_, activity) => {
  console.log("Preload: Received activity-updated event:", activity);
  window.dispatchEvent(
    new CustomEvent("activity-updated", { detail: activity })
  );
});

ipcRenderer.on("transcript-saved-to-database", (_, transcript) => {
  window.dispatchEvent(
    new CustomEvent("transcript-saved-to-database", { detail: transcript })
  );
});

ipcRenderer.on("transcript-updated", (_, transcript) => {
  console.log("Preload: Received transcript-updated event:", transcript);
  window.dispatchEvent(
    new CustomEvent("transcript-updated", { detail: transcript })
  );
});

ipcRenderer.on("statistics-updated", (_, stats) => {
  window.dispatchEvent(
    new CustomEvent("statistics-updated", { detail: stats })
  );
});

ipcRenderer.on("open-settings-dialog", () => {
  window.dispatchEvent(new Event("open-settings-dialog"));
});

ipcRenderer.on("session-restoration-status", (_, status) => {
  window.dispatchEvent(
    new CustomEvent("session-restoration-status", { detail: status })
  );
});

ipcRenderer.on("microphone-device-changed", (_, deviceData) => {
  window.dispatchEvent(
    new CustomEvent("microphone-device-changed", { detail: deviceData })
  );
});

ipcRenderer.on("hotkey-detected", () => {
  window.dispatchEvent(new Event("hotkey-detected"));
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      resetStatistics: () => Promise<{ success: boolean }>;
      audioRecorded: (audioData: {
        data: string;
        mimeType: string;
      }) => Promise<{ success: boolean }>;
      windowHoverEnter: () => Promise<void>;
      windowHoverLeave: () => Promise<void>;
      startProcessingAudio: () => Promise<void>;
      openExternalLink: (url: string) => Promise<void>;
      onStatisticsUpdate: (callback: (stats: any) => void) => () => void;
      onActivityUpdate: (callback: (activity: any) => void) => () => void;

      // Direct window control methods
      expandRecordingWindow: () => Promise<{ success: boolean }>;
      compactRecordingWindow: () => Promise<{ success: boolean }>;

      // Information window tooltip methods
      showRecordingTooltip: (
        type: string,
        message: string
      ) => Promise<{ success: boolean }>;

      // Authentication handlers
      onAuthenticationComplete: (user: any) => Promise<{ success: boolean }>;
      refreshAuthState: () => Promise<{
        success: boolean;
        onboardingCompleted?: boolean;
        error?: string;
      }>;

      // Permission handlers
      checkAccessibilityPermission: () => Promise<boolean>;
      checkMicrophonePermission: () => Promise<boolean>;
      requestAccessibilityPermission: () => Promise<{ success: boolean }>;
      requestMicrophonePermission: () => Promise<{ success: boolean }>;

      // Auto-updater handlers
      checkForUpdates: () => Promise<{ success: boolean }>;
      downloadUpdate: () => Promise<{ success: boolean }>;
      installUpdate: () => Promise<{ success: boolean }>;

      // Window control handlers for custom navigation bar
      windowControls: {
        close: () => Promise<{ success: boolean; error?: string }>;
        minimize: () => Promise<{ success: boolean; error?: string }>;
        maximize: () => Promise<{
          success: boolean;
          action?: string;
          error?: string;
        }>;
        getMaximizedState: () => Promise<{ isMaximized: boolean }>;
      };

      // Update event listeners
      onUpdateAvailable: (callback: (info: any) => void) => () => void;
      onUpdateDownloadProgress: (
        callback: (percent: number) => void
      ) => () => void;
      onUpdateDownloaded: (callback: (info: any) => void) => () => void;

      // Platform information
      platform: string;

      // App version
      getVersion: () => Promise<string>;

      // External API methods (Supabase & Analytics)
      auth: {
        signInWithMagicLink: (email: string) => Promise<any>;
        signUpWithMagicLink: (email: string, name: string) => Promise<any>;
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
        getTranscripts: (limit?: number, offset?: number) => Promise<any>;
        downloadAudio: (audioFilePath: string) => Promise<any>;
        saveUserSettings: (settings: any) => Promise<any>;
        getUserSettings: () => Promise<any>;
        getUserStats: () => Promise<any>;
      };

      analytics: {
        track: (
          event: string,
          properties?: Record<string, any>
        ) => Promise<any>;
        identify: (
          userId: string,
          properties?: Record<string, any>
        ) => Promise<any>;
        trackUserSignUp: (
          method?: "email" | "google" | "github"
        ) => Promise<any>;
        trackUserSignIn: (
          method?: "email" | "google" | "github"
        ) => Promise<any>;
        trackUserSignOut: () => Promise<any>;
        trackRecordingStarted: () => Promise<any>;
        trackRecordingStopped: (duration: number) => Promise<any>;
        trackTranscriptionCompleted: (data: {
          wordCount: number;
          wpm: number;
          wasTranslated: boolean;
        }) => Promise<any>;
        trackAppLaunched: () => Promise<any>;
      };

      microphone: {
        getDevices: () => Promise<any>;
        // NOTE: testDevice removed - deprecated method that triggers unwanted microphone access
        validateDevice: (deviceId: string) => Promise<any>;
        getConstraints: (deviceId: string) => Promise<any>;
        getCurrentDeviceConstraints: () => Promise<any>;
        setCurrentDevice: (deviceId: string) => Promise<any>;
        requestPermissions: () => Promise<any>;
        checkPermissions: () => Promise<any>;
      };

      dictionary: {
        getDictionaryEntries: () => Promise<any>;
        addDictionaryEntry: (key: string, value: string) => Promise<any>;
        updateDictionaryEntry: (
          id: string,
          key: string,
          value: string
        ) => Promise<any>;
        deleteDictionaryEntry: (id: string) => Promise<any>;
      };

      pro: {
        startTrial: () => Promise<any>;
        updateSubscription: (
          tier: "free" | "pro_trial" | "pro"
        ) => Promise<any>;
        getSubscriptionInfo: () => Promise<any>;
      };

      // Recording controls
      recording: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        cancel: () => Promise<{ success: boolean; error?: string }>;
      };

      // Hotkey test mode for onboarding
      startHotkeyTest: () => Promise<{ success: boolean }>;
      endHotkeyTest: () => Promise<{ success: boolean }>;

      // Renderer readiness for auth state synchronization
      rendererReadyForAuth: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}
