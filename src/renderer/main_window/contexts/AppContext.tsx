import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ViewType } from "../types";
import type {
  Settings,
  UserStats,
  UITranscriptEntry,
} from "../../../shared/types";
import type { UserRecord } from "../../../shared/types/database";
import { auth } from "../lib/api_client";
import { DEFAULT_SETTINGS } from "../../../shared/constants/default-settings";

interface AppState {
  // Auth state
  user: UserRecord | null;
  isAuthenticated: boolean;

  // UI state
  activeView: ViewType;
  isLoading: boolean;
  error: string | null;

  // Data state
  userStats: UserStats;
  transcripts: UITranscriptEntry[];
  totalTranscripts: number;
  settings: Settings;

  // Recording state
  isRecording: boolean;
  isProcessing: boolean;
}

type AppAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_USER"; payload: UserRecord | null }
  | { type: "SET_AUTHENTICATED"; payload: boolean }
  | { type: "SET_ACTIVE_VIEW"; payload: ViewType }
  | { type: "SET_USER_STATS"; payload: UserStats }
  | {
      type: "SET_TRANSCRIPTS";
      payload: { transcripts: UITranscriptEntry[]; totalCount: number };
    }
  | { type: "ADD_TRANSCRIPT"; payload: UITranscriptEntry }
  | { type: "SET_SETTINGS"; payload: Settings }
  | {
      type: "SET_RECORDING_STATE";
      payload: { isRecording: boolean; isProcessing: boolean };
    }
  | { type: "RESET_APP_STATE" };

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  activeView: "home",
  isLoading: true,
  error: null,
  userStats: {
    totalWordCount: 0,
    averageWPM: 0,
    totalRecordings: 0,
    streakDays: 0,
  },
  transcripts: [],
  totalTranscripts: 0,
  settings: DEFAULT_SETTINGS,
  isRecording: false,
  isProcessing: false,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_AUTHENTICATED":
      return { ...state, isAuthenticated: action.payload };
    case "SET_ACTIVE_VIEW":
      return { ...state, activeView: action.payload };
    case "SET_USER_STATS":
      return { ...state, userStats: action.payload };
    case "SET_TRANSCRIPTS":
      return {
        ...state,
        transcripts: action.payload.transcripts,
        totalTranscripts: action.payload.totalCount,
      };
    case "ADD_TRANSCRIPT":
      return {
        ...state,
        transcripts: [action.payload, ...state.transcripts.slice(0, 19)], // Keep only 20 transcripts in memory
        totalTranscripts: state.totalTranscripts + 1, // Increment total count
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
      return {
        ...initialState,
        isLoading: false,
      };
    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;

  // Convenience actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUser: (user: UserRecord | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setActiveView: (view: ViewType) => void;
  setUserStats: (stats: UserStats) => void;
  setTranscripts: (
    transcripts: UITranscriptEntry[],
    totalCount?: number
  ) => void;
  addTranscript: (transcript: UITranscriptEntry) => void;
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

  const completeOnboarding = useCallback(async () => {
    try {
      console.log("AppContext: Completing onboarding...");

      // Update database
      const result = await auth.completeOnboarding();
      if (!result.success) {
        throw new Error(result.error || "Failed to complete onboarding");
      }

      // Update local state
      if (state.user) {
        dispatch({
          type: "SET_USER",
          payload: { ...state.user, onboarding_completed: true },
        });
      }

      // User data will be loaded automatically via auth state events

      // Navigate to home
      dispatch({ type: "SET_ACTIVE_VIEW", payload: "home" });

      console.log("AppContext: Onboarding completed successfully");
    } catch (error) {
      console.error("AppContext: Error completing onboarding:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to complete onboarding" });
    }
  }, [state.user]);

  const signOut = useCallback(async () => {
    try {
      console.log("AppContext: Signing out...");
      dispatch({ type: "SET_LOADING", payload: true });

      await auth.signOut();

      // Clear all state
      dispatch({ type: "RESET_APP_STATE" });
    } catch (error) {
      console.error("AppContext: Error during sign out:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to sign out" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // Listen for main process events
  useEffect(() => {
    const handleAuthStateChanged = (event: CustomEvent) => {
      const {
        user,
        authenticated,
        statistics,
        settings,
        recentTranscripts,
        totalTranscriptCount,
        error,
      } = event.detail;

      console.log("AppContext: Enhanced auth state changed event received:", {
        user: user?.email,
        authenticated,
        onboardingCompleted: user?.onboarding_completed,
        hasStatistics: !!statistics,
        hasSettings: !!settings,
        transcriptCount: recentTranscripts?.length || 0,
        error,
      });

      // Update auth state
      dispatch({ type: "SET_USER", payload: user });
      dispatch({ type: "SET_AUTHENTICATED", payload: authenticated });

      // Update statistics if provided
      if (statistics) {
        dispatch({ type: "SET_USER_STATS", payload: statistics });
        console.log("AppContext: Statistics updated from auth state:", {
          totalWordCount: statistics.totalWordCount,
          totalRecordings: statistics.totalRecordings,
          averageWPM: statistics.averageWPM,
          streakDays: statistics.streakDays,
        });
      }

      // Update transcripts if provided
      if (recentTranscripts && Array.isArray(recentTranscripts)) {
        dispatch({
          type: "SET_TRANSCRIPTS",
          payload: {
            transcripts: recentTranscripts,
            totalCount: totalTranscriptCount ?? recentTranscripts.length,
          },
        });
        console.log(
          "AppContext: Transcripts updated from auth state:",
          recentTranscripts.length,
          "total:",
          totalTranscriptCount ?? recentTranscripts.length
        );
      }

      // Update settings if provided (CRITICAL FIX: This was missing!)
      if (settings) {
        dispatch({ type: "SET_SETTINGS", payload: settings });
        console.log("AppContext: Settings updated from auth state:", {
          language: settings.language,
          dictateSoundEffects: settings.dictateSoundEffects,
          muteMusicWhileDictating: settings.muteMusicWhileDictating,
          outputMode: settings.outputMode,
          useAI: settings.useAI,
          enableTranslation: settings.enableTranslation,
          targetLanguage: settings.targetLanguage,
          privacyMode: settings.privacyMode,
        });
      }

      // Handle authentication error
      if (error) {
        console.error("AppContext: Authentication error received:", error);
        dispatch({ type: "SET_ERROR", payload: error });
      }

      // Stop loading for all cases
      dispatch({ type: "SET_LOADING", payload: false });
    };

    const handleStatisticsUpdated = (event: CustomEvent) => {
      dispatch({ type: "SET_USER_STATS", payload: event.detail });
      console.log(
        "AppContext: Statistics updated event received:",
        event.detail
      );
    };

    const handleActivityUpdated = (event: CustomEvent) => {
      console.log("AppContext: Activity updated event received:", event.detail);
      //   if (event.detail.type === "transcript") {
      //     console.log(
      //       "AppContext: Adding new transcript to UI:",
      //       event.detail.data
      //     );
      //     dispatch({ type: "ADD_TRANSCRIPT", payload: event.detail.data });
      //   }
    };

    const handleCacheCleared = (event: CustomEvent) => {
      void event; // Acknowledged unused event parameter
      console.log(
        "AppContext: Cache cleared event received - resetting app state"
      );
      dispatch({ type: "RESET_APP_STATE" });
    };

    const handleTranscriptUpdated = (event: CustomEvent) => {
      console.log(
        "AppContext: Transcript updated event received:",
        event.detail
      );
      dispatch({ type: "ADD_TRANSCRIPT", payload: event.detail });
    };

    // Add event listeners
    window.addEventListener("transcript-updated", handleTranscriptUpdated);
    window.addEventListener("auth-state-changed", handleAuthStateChanged);
    window.addEventListener("statistics-updated", handleStatisticsUpdated);
    window.addEventListener("activity-updated", handleActivityUpdated);
    window.addEventListener("cache-cleared", handleCacheCleared);

    // Signal to main process that renderer is ready to receive auth events
    // This ensures auth state changes are only sent after event listeners are registered
    const signalRendererReady = async () => {
      try {
        console.log(
          "AppContext: Signaling main process that renderer is ready for auth events"
        );
        const result = await window.electronAPI.rendererReadyForAuth();
        console.log(
          "AppContext: Successfully signaled renderer readiness to main process:",
          result
        );
      } catch (error) {
        console.error("AppContext: Error signaling renderer readiness:", error);
      }
    };

    // Use a small delay to ensure event listeners are fully registered
    setTimeout(signalRendererReady, 100);

    return () => {
      window.removeEventListener("transcript-updated", handleTranscriptUpdated);
      window.removeEventListener("auth-state-changed", handleAuthStateChanged);
      window.removeEventListener("statistics-updated", handleStatisticsUpdated);
      window.removeEventListener("activity-updated", handleActivityUpdated);
      window.removeEventListener("cache-cleared", handleCacheCleared);
    };
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    (): AppContextType => ({
      state,
      dispatch,
      setLoading: (loading: boolean) =>
        dispatch({ type: "SET_LOADING", payload: loading }),
      setError: (error: string | null) =>
        dispatch({ type: "SET_ERROR", payload: error }),
      setUser: (user: UserRecord | null) =>
        dispatch({ type: "SET_USER", payload: user }),
      setAuthenticated: (authenticated: boolean) =>
        dispatch({ type: "SET_AUTHENTICATED", payload: authenticated }),
      setActiveView: (view: ViewType) =>
        dispatch({ type: "SET_ACTIVE_VIEW", payload: view }),
      setUserStats: (stats: UserStats) =>
        dispatch({ type: "SET_USER_STATS", payload: stats }),
      setTranscripts: (transcripts: UITranscriptEntry[], totalCount?: number) =>
        dispatch({
          type: "SET_TRANSCRIPTS",
          payload: {
            transcripts: transcripts || [],
            totalCount: totalCount ?? (transcripts || []).length,
          },
        }),
      addTranscript: (transcript: UITranscriptEntry) =>
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
