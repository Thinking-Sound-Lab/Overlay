// src/custom.d.ts
declare module "*.wav" {
  const src: string;
  export default src;
}

declare module "*.mp3" {
  const src: string;
  export default src;
}

// Extend Window interface for electronAPI
declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<Record<string, unknown>>;
      updateSettings: (settings: Record<string, unknown>) => Promise<{ success: boolean }>;
      getStatistics: () => Promise<any>;
      onStatisticsUpdate: (callback: (stats: any) => void) => () => void;
      onActivityUpdate: (callback: (activity: any) => void) => () => void;
      audioRecorded: (data: { data: string; mimeType: string }) => Promise<any>;
      windowHoverEnter: () => Promise<any>;
      windowHoverLeave: () => Promise<any>;
      // New window control methods
      expandRecordingWindow: () => Promise<{ success: boolean }>;
      compactRecordingWindow: () => Promise<{ success: boolean }>;
      onAuthenticationComplete: (user: any) => Promise<any>;
      checkAccessibilityPermission: () => Promise<boolean>;
      requestAccessibilityPermission: () => Promise<{ success: boolean }>;
      checkForUpdates: () => Promise<{ success: boolean }>;
      downloadUpdate: () => Promise<{ success: boolean }>;
      installUpdate: () => Promise<any>;
      platform: string;
      auth: {
        signIn: (email: string, password: string) => Promise<any>;
        signUp: (email: string, password: string, name?: string) => Promise<any>;
        signInWithGoogle: () => Promise<any>;
        signOut: () => Promise<any>;
        getCurrentUser: () => Promise<any>;
        getUserProfile: () => Promise<any>;
        completeOnboarding: () => Promise<any>;
      };
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
        trackTranscriptionCompleted: (wordCount: number, wpm: number, wasTranslated: boolean) => Promise<any>;
      };
      onUpdateAvailable: (callback: (info: any) => void) => () => void;
      onUpdateDownloadProgress: (callback: (percent: number) => void) => () => void;
      onUpdateDownloaded: (callback: (info: any) => void) => () => void;
    };
  }
}
