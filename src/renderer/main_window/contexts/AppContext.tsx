import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ViewType } from "../types";
import { auth, db, analytics } from "../lib/api_client";

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
  onboarding_completed?: boolean;
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

  // Simple startup - check for existing session
  //   useEffect(() => {
  //     console.log("AppContext: Initializing app...");

  //     const initializeApp = async () => {
  //       try {
  //         // Try to get current user from session
  //         const userResult = await auth.getCurrentUser();
  //         if (userResult.success && userResult.data?.data?.user) {
  //           const user = userResult.data.data.user;
  //           console.log("AppContext: Found existing user session:", user.email);

  //           // Get user profile to check onboarding status
  //           const profileResult = await auth.getUserProfile();
  //           if (profileResult.success && profileResult.data?.data) {
  //             const userProfile = profileResult.data.data;
  //             const hasCompletedOnboarding = Boolean(
  //               userProfile.onboarding_completed
  //             );

  //             // Set all auth-related state
  //             dispatch({ type: "SET_USER", payload: user });
  //             dispatch({ type: "SET_USER_PROFILE", payload: userProfile });
  //             dispatch({ type: "SET_AUTHENTICATED", payload: true });
  //             dispatch({
  //               type: "SET_ONBOARDING_COMPLETED",
  //               payload: hasCompletedOnboarding,
  //             });

  //             console.log(
  //               "AppContext: User authenticated, onboarding completed:",
  //               hasCompletedOnboarding
  //             );

  //             // Load user data if onboarding is complete
  //             if (hasCompletedOnboarding) {
  //               await loadUserData();
  //             }
  //           } else {
  //             console.warn("AppContext: Could not load user profile");
  //             dispatch({ type: "SET_USER", payload: user });
  //             dispatch({ type: "SET_AUTHENTICATED", payload: true });
  //             dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: false });
  //           }
  //         } else {
  //           console.log("AppContext: No existing user session");
  //         }
  //       } catch (error) {
  //         console.log("AppContext: No existing session or error:", error);
  //       } finally {
  //         dispatch({ type: "SET_LOADING", payload: false });
  //       }
  //     };

  //     initializeApp();
  //   }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      console.log("AppContext: Completing onboarding...");

      // Update database
      const result = await auth.completeOnboarding();
      if (!result.success) {
        throw new Error(result.error || "Failed to complete onboarding");
      }

      // Update local state
      dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: true });
      if (state.userProfile) {
        dispatch({
          type: "SET_USER_PROFILE",
          payload: { ...state.userProfile, onboarding_completed: true },
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
  }, [state.userProfile]);

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

  // Removed old complex functions - using simple direct approach

  // Listen for main process events
  useEffect(() => {
    const handleAuthStateChanged = (event: any) => {
      const {
        user,
        authenticated,
        profile,
        statistics,
        settings,
        recentTranscripts,
        error,
      } = event.detail;

      console.log("AppContext: Enhanced auth state changed event received:", {
        user: user?.email,
        authenticated,
        onboardingCompleted: profile?.onboarding_completed,
        hasProfile: !!profile,
        hasStatistics: !!statistics,
        hasSettings: !!settings,
        transcriptCount: recentTranscripts?.length || 0,
        error,
      });

      // Update basic auth state
      dispatch({ type: "SET_USER", payload: user });
      dispatch({ type: "SET_AUTHENTICATED", payload: authenticated });
      dispatch({ type: "SET_USER_PROFILE", payload: profile });

      // Update onboarding status from profile
      if (profile && typeof profile.onboarding_completed !== "undefined") {
        dispatch({
          type: "SET_ONBOARDING_COMPLETED",
          payload: profile.onboarding_completed,
        });
      }

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
        dispatch({ type: "SET_TRANSCRIPTS", payload: recentTranscripts });
        console.log(
          "AppContext: Transcripts updated from auth state:",
          recentTranscripts.length
        );
      }

      // Handle authentication error
      if (error) {
        console.error("AppContext: Authentication error received:", error);
        dispatch({ type: "SET_ERROR", payload: error });
      }

      // Stop loading for all cases
      dispatch({ type: "SET_LOADING", payload: false });
    };

    const handleStatisticsUpdated = (event: any) => {
      dispatch({ type: "SET_USER_STATS", payload: event.detail });
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
    window.addEventListener("activity-updated", handleActivityUpdated);
    window.addEventListener(
      "transcript-saved-to-database",
      handleTranscriptSaved
    );

    return () => {
      window.removeEventListener("auth-state-changed", handleAuthStateChanged);
      window.removeEventListener("statistics-updated", handleStatisticsUpdated);
      window.removeEventListener("activity-updated", handleActivityUpdated);
      window.removeEventListener(
        "transcript-saved-to-database",
        handleTranscriptSaved
      );
    };
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    (): AppContextType => ({
      state,
      dispatch,
      setLoading: (loading: boolean) =>
        dispatch({ type: "SET_LOADING", payload: loading }),
      //   setInitializing: (initializing: boolean) =>
      //     dispatch({ type: "SET_INITIALIZING", payload: initializing }),
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
