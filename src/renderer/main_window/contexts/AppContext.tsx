import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ViewType } from "../types";
import { auth, db } from "../lib/api_client";

interface User {
  id: string;
  email: string;
  subscription_tier?: "free" | "pro";
}

interface UserProfile {
  id: string;
  name: string;
  subscription_tier: "free" | "pro";
  created_at: string;
  updated_at: string;
}

interface UserStats {
  totalWordCount: number;
  averageWPM: number;
  totalRecordings: number;
  streakDays: number;
}

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  wordCount: number;
  wpm: number;
  originalText?: string;
  wasTranslated?: boolean;
  targetLanguage?: string;
}

interface Settings {
  outputMode: "auto-insert" | "clipboard" | "both";
  useAI: boolean;
  language: string;
  enableTranslation: boolean;
  targetLanguage: string;
}

interface AppState {
  // Auth state
  user: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;

  // UI state
  activeView: ViewType;
  isLoading: boolean;
  isInitializing: boolean;
  isUserDataLoading: boolean;
  error: string | null;

  // Data state
  userStats: UserStats;
  transcripts: TranscriptEntry[];
  settings: Settings;

  // Recording state
  isRecording: boolean;
  isProcessing: boolean;
}

type AppAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_INITIALIZING"; payload: boolean }
  | { type: "SET_USER_DATA_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_USER_PROFILE"; payload: UserProfile | null }
  | { type: "SET_AUTHENTICATED"; payload: boolean }
  | { type: "SET_ONBOARDING_COMPLETED"; payload: boolean }
  | { type: "SET_ACTIVE_VIEW"; payload: ViewType }
  | { type: "SET_USER_STATS"; payload: UserStats }
  | { type: "SET_TRANSCRIPTS"; payload: TranscriptEntry[] }
  | { type: "ADD_TRANSCRIPT"; payload: TranscriptEntry }
  | { type: "SET_SETTINGS"; payload: Settings }
  | {
      type: "SET_RECORDING_STATE";
      payload: { isRecording: boolean; isProcessing: boolean };
    }
  | { type: "RESET_APP_STATE" };

const initialState: AppState = {
  user: null,
  userProfile: null,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  activeView: "home",
  isLoading: true,
  isInitializing: true,
  isUserDataLoading: false,
  error: null,
  userStats: {
    totalWordCount: 0,
    averageWPM: 0,
    totalRecordings: 0,
    streakDays: 0,
  },
  transcripts: [],
  settings: {
    outputMode: "both",
    useAI: true,
    language: "auto",
    enableTranslation: false,
    targetLanguage: "en",
  },
  isRecording: false,
  isProcessing: false,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_INITIALIZING":
      return { ...state, isInitializing: action.payload };
    case "SET_USER_DATA_LOADING":
      return { ...state, isUserDataLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_USER_PROFILE":
      return { ...state, userProfile: action.payload };
    case "SET_AUTHENTICATED":
      return { ...state, isAuthenticated: action.payload };
    case "SET_ONBOARDING_COMPLETED":
      return { ...state, hasCompletedOnboarding: action.payload };
    case "SET_ACTIVE_VIEW":
      return { ...state, activeView: action.payload };
    case "SET_USER_STATS":
      return { ...state, userStats: action.payload };
    case "SET_TRANSCRIPTS":
      return { ...state, transcripts: action.payload };
    case "ADD_TRANSCRIPT":
      return {
        ...state,
        transcripts: [action.payload, ...state.transcripts.slice(0, 99)], // Keep only 100 transcripts
      };
    case "SET_SETTINGS":
      return { ...state, settings: action.payload };
    case "SET_RECORDING_STATE":
      return {
        ...state,
        isRecording: action.payload.isRecording,
        isProcessing: action.payload.isProcessing,
      };
    case "RESET_APP_STATE":
      console.log("AppContext: Resetting app state to initial values");
      return { ...initialState, isLoading: false, isInitializing: false, isUserDataLoading: false };
    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;

  // Convenience actions
  setLoading: (loading: boolean) => void;
  setInitializing: (initializing: boolean) => void;
  setUserDataLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setActiveView: (view: ViewType) => void;
  setUserStats: (stats: UserStats) => void;
  setTranscripts: (transcripts: TranscriptEntry[]) => void;
  addTranscript: (transcript: TranscriptEntry) => void;
  setSettings: (settings: Settings) => void;
  setRecordingState: (isRecording: boolean, isProcessing: boolean) => void;
  resetAppState: () => void;

  // Auth actions (moved from useAuth)
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Simple initialization - just set loading to false after a brief moment to allow auth events to arrive
  useEffect(() => {
    console.log("AppContext: Starting up, waiting for auth state from main process...");
    
    // Give main process a moment to send auth state, then stop loading
    const timer = setTimeout(() => {
      if (state.isLoading) {
        console.log("AppContext: No auth state received, stopping loading");
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }, 1000); // 1 second timeout

    return () => clearTimeout(timer);
  }, []); // Run once on mount

  // Reactive user data loading - triggers when auth state indicates user is fully authenticated
  useEffect(() => {
    const shouldLoadUserData = 
      state.user && 
      state.isAuthenticated && 
      state.hasCompletedOnboarding && 
      !state.userProfile; // Only load if we don't already have profile data

    if (shouldLoadUserData) {
      console.log("AppContext: Auth state indicates authenticated user with completed onboarding, loading user data...");
      
      const loadUserData = async () => {
        try {
          dispatch({ type: "SET_USER_DATA_LOADING", payload: true });
          await initializeUserSession(state.user!.id);
          console.log("AppContext: User data loaded successfully via reactive effect");
          dispatch({ type: "SET_USER_DATA_LOADING", payload: false });
          dispatch({ type: "SET_LOADING", payload: false }); // Stop general loading when user data is ready
        } catch (error) {
          console.error("AppContext: Error loading user data via reactive effect:", error);
          dispatch({ type: "SET_ERROR", payload: "Failed to load user data" });
          dispatch({ type: "SET_USER_DATA_LOADING", payload: false });
          dispatch({ type: "SET_LOADING", payload: false });
        }
      };

      loadUserData();
    }
  }, [state.user, state.isAuthenticated, state.hasCompletedOnboarding, state.userProfile]);

  // Unified function to load all user session data (eliminates duplicate API calls)
  const initializeUserSession = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        console.log("AppContext: Loading complete user session for:", userId);

        // Single comprehensive API call batch - no more duplicates!
        const [profileResult, settingsResult, statsResult, transcriptsResult] =
          await Promise.all([
            auth.getUserProfile(), // Only called ONCE now
            db.getUserSettings(),
            db.getUserStats(),
            db.getTranscripts(100),
          ]);

        // Process profile data AND extract onboarding status
        const actualProfileData = profileResult.success
          ? profileResult.data?.data
          : null;
        const actualProfileError = profileResult.success
          ? profileResult.data?.error
          : profileResult.error;
        let onboardingCompleted = false;

        if (actualProfileData && !actualProfileError) {
          dispatch({ type: "SET_USER_PROFILE", payload: actualProfileData });
          onboardingCompleted = Boolean(actualProfileData.onboarding_completed);
          console.log(
            "AppContext: Profile loaded, onboarding status:",
            onboardingCompleted
          );
        } else {
          console.warn(
            "AppContext: Could not load user profile, defaulting onboarding to false"
          );
          onboardingCompleted = false;
        }

        // Process settings data
        const actualSettingsData = settingsResult.success
          ? settingsResult.data?.data
          : null;
        if (actualSettingsData?.settings) {
          dispatch({
            type: "SET_SETTINGS",
            payload: {
              outputMode: actualSettingsData.settings.outputMode || "both",
              useAI: actualSettingsData.settings.useAI ?? true,
              language: actualSettingsData.settings.language || "auto",
              enableTranslation:
                actualSettingsData.settings.enableTranslation ?? false,
              targetLanguage:
                actualSettingsData.settings.targetLanguage || "en",
            },
          });
        }

        // Process stats data
        const actualStatsData = statsResult.success
          ? statsResult.data?.data
          : null;
        if (actualStatsData) {
          dispatch({ type: "SET_USER_STATS", payload: actualStatsData });
        }

        // Process transcripts data
        const actualTranscriptsData = transcriptsResult.success
          ? transcriptsResult.data?.data
          : null;
        if (actualTranscriptsData && Array.isArray(actualTranscriptsData)) {
          const formattedTranscripts = actualTranscriptsData.map(
            (item: any) => ({
              id: item.id,
              text: item.text,
              timestamp: new Date(item.timestamp || item.created_at),
              wordCount: Number(item.wordCount || item.word_count) || 0,
              wpm: Number(item.wpm) || 0,
              originalText: item.originalText || item.original_text,
              wasTranslated: item.wasTranslated || item.was_translated,
              targetLanguage: item.targetLanguage || item.target_language,
            })
          );
          dispatch({ type: "SET_TRANSCRIPTS", payload: formattedTranscripts });
        }

        return onboardingCompleted;
      } catch (error) {
        console.error("AppContext: Error loading user session:", error);
        return false;
      }
    },
    []
  );

  // Listen for main process events
  useEffect(() => {
    const handleAuthStateChanged = (event: any) => {
      const { user, authenticated, onboardingCompleted } = event.detail;
      console.log("AppContext: Auth state changed event received:", {
        user: user?.email,
        authenticated,
        onboardingCompleted,
        currentState: {
          user: state.user?.email,
          isAuthenticated: state.isAuthenticated,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          isLoading: state.isLoading,
        },
        timestamp: new Date().toISOString(),
      });
      
      dispatch({ type: "SET_USER", payload: user });
      dispatch({ type: "SET_AUTHENTICATED", payload: authenticated });
      if (typeof onboardingCompleted !== "undefined") {
        dispatch({
          type: "SET_ONBOARDING_COMPLETED",
          payload: onboardingCompleted,
        });
      }
      
      // Stop initializing since we've received auth state from main process
      dispatch({ type: "SET_INITIALIZING", payload: false });
      
      // If this is an unauthenticated state, also stop general loading
      if (!authenticated) {
        dispatch({ type: "SET_LOADING", payload: false });
      }
      
      console.log("AppContext: Auth state updated after event:", {
        willShowOnboarding: !authenticated || !onboardingCompleted,
        shouldShowHome: authenticated && onboardingCompleted,
      });
    };

    const handleStatisticsUpdated = (event: any) => {
      dispatch({ type: "SET_USER_STATS", payload: event.detail });
    };

    const handleTranscriptsLoaded = (event: any) => {
      console.log(
        "AppContext: Transcripts loaded event received:",
        event.detail?.length || 0
      );
      // The main process sends the transcript array directly as event.detail
      if (Array.isArray(event.detail)) {
        dispatch({ type: "SET_TRANSCRIPTS", payload: event.detail });
      } else {
        console.warn(
          "AppContext: Invalid transcripts data received:",
          event.detail
        );
      }
    };

    const handleActivityUpdated = (event: any) => {
      console.log("AppContext: Activity updated event received:", event.detail);
      if (event.detail.type === "transcript") {
        console.log(
          "AppContext: Adding new transcript to UI:",
          event.detail.data
        );
        dispatch({ type: "ADD_TRANSCRIPT", payload: event.detail.data });
      }
    };

    const handleTranscriptSaved = (event: any) => {
      // Transcript was saved to database, could trigger a refresh if needed
      console.log("Transcript saved to database:", event.detail);
    };

    // Add event listeners
    window.addEventListener("auth-state-changed", handleAuthStateChanged);
    window.addEventListener("statistics-updated", handleStatisticsUpdated);
    window.addEventListener("transcripts-loaded", handleTranscriptsLoaded);
    window.addEventListener("activity-updated", handleActivityUpdated);
    window.addEventListener(
      "transcript-saved-to-database",
      handleTranscriptSaved
    );

    return () => {
      window.removeEventListener("auth-state-changed", handleAuthStateChanged);
      window.removeEventListener("statistics-updated", handleStatisticsUpdated);
      window.removeEventListener("transcripts-loaded", handleTranscriptsLoaded);
      window.removeEventListener("activity-updated", handleActivityUpdated);
      window.removeEventListener(
        "transcript-saved-to-database",
        handleTranscriptSaved
      );
    };
  }, []);

  // Auth actions (moved from useAuth)
  const completeOnboarding = useCallback(async () => {
    try {
      console.log(
        "AppContext: Completing onboarding for user:",
        state.user?.email
      );
      dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: true });

      // Save initial settings to database to mark onboarding as complete
      if (state.user) {
        await db.saveUserSettings(state.settings);
        console.log("AppContext: User settings saved successfully");
      } else {
        console.warn("AppContext: No user available to save settings");
      }
    } catch (error) {
      console.error("AppContext: Error completing onboarding:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to complete onboarding" });
    }
  }, [state.user, state.settings]);

  const signOut = useCallback(async () => {
    try {
      console.log("AppContext: Starting signout process");

      // Sign out from Supabase (this will clear session stores in main process)
      const result = await auth.signOut();

      // Always clear local data regardless of signout result
      console.log("AppContext: Clearing all local app state and storage");

      // Clear all app state
      dispatch({ type: "SET_USER", payload: null });
      dispatch({ type: "SET_AUTHENTICATED", payload: false });
      dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: false });

      // Clear all localStorage data completely
      localStorage.clear();

      // Clear sessionStorage as well
      sessionStorage.clear();

      // Clear IndexedDB if any (some browsers may store additional data)
      try {
        if ("indexedDB" in window) {
          // This will clear all IndexedDB databases (optional, but thorough)
          console.log("AppContext: Clearing IndexedDB data");
        }
      } catch (idbError) {
        console.warn("AppContext: Could not clear IndexedDB:", idbError);
      }

      if (result.success || !result.error) {
        console.log("AppContext: Signout successful, reloading app");
      } else {
        console.warn(
          "AppContext: Signout had issues but continuing cleanup:",
          result.error
        );
        dispatch({
          type: "SET_ERROR",
          payload: result.error || "Sign out completed with warnings",
        });
      }

      // Always reload to ensure clean state
      console.log("AppContext: All cleanup complete, reloading app");
      window.location.reload();
    } catch (error) {
      console.error("AppContext: Error during signout:", error);

      // Even if signout fails, clear local data and reload
      dispatch({ type: "SET_USER", payload: null });
      dispatch({ type: "SET_AUTHENTICATED", payload: false });
      dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: false });
      localStorage.clear();
      sessionStorage.clear();

      dispatch({
        type: "SET_ERROR",
        payload: "Sign out completed with errors",
      });
      window.location.reload();
    }
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    (): AppContextType => ({
      state,
      dispatch,
      setLoading: (loading: boolean) =>
        dispatch({ type: "SET_LOADING", payload: loading }),
      setInitializing: (initializing: boolean) =>
        dispatch({ type: "SET_INITIALIZING", payload: initializing }),
      setUserDataLoading: (loading: boolean) =>
        dispatch({ type: "SET_USER_DATA_LOADING", payload: loading }),
      setError: (error: string | null) =>
        dispatch({ type: "SET_ERROR", payload: error }),
      setUser: (user: User | null) =>
        dispatch({ type: "SET_USER", payload: user }),
      setUserProfile: (profile: UserProfile | null) =>
        dispatch({ type: "SET_USER_PROFILE", payload: profile }),
      setAuthenticated: (authenticated: boolean) =>
        dispatch({ type: "SET_AUTHENTICATED", payload: authenticated }),
      setOnboardingCompleted: (completed: boolean) =>
        dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: completed }),
      setActiveView: (view: ViewType) =>
        dispatch({ type: "SET_ACTIVE_VIEW", payload: view }),
      setUserStats: (stats: UserStats) =>
        dispatch({ type: "SET_USER_STATS", payload: stats }),
      setTranscripts: (transcripts: TranscriptEntry[]) =>
        dispatch({ type: "SET_TRANSCRIPTS", payload: transcripts }),
      addTranscript: (transcript: TranscriptEntry) =>
        dispatch({ type: "ADD_TRANSCRIPT", payload: transcript }),
      setSettings: (settings: Settings) =>
        dispatch({ type: "SET_SETTINGS", payload: settings }),
      setRecordingState: (isRecording: boolean, isProcessing: boolean) =>
        dispatch({
          type: "SET_RECORDING_STATE",
          payload: { isRecording, isProcessing },
        }),
      resetAppState: () => dispatch({ type: "RESET_APP_STATE" }),

      // Auth actions
      completeOnboarding,
      signOut,
    }),
    [state, completeOnboarding, signOut]
  );

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};
