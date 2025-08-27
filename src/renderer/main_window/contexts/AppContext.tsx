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
  isInitializing: boolean;
  isUserDataLoading: boolean;
  isSessionRestoring: boolean;
  isAuthStateComplete: boolean;
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
  | { type: "SET_SESSION_RESTORING"; payload: boolean }
  | { type: "SET_AUTH_STATE_COMPLETE"; payload: boolean }
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
  isSessionRestoring: true,
  isAuthStateComplete: false,
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
    case "SET_SESSION_RESTORING":
      return { ...state, isSessionRestoring: action.payload };
    case "SET_AUTH_STATE_COMPLETE":
      return { ...state, isAuthStateComplete: action.payload };
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
        isInitializing: false, 
        isUserDataLoading: false, 
        isSessionRestoring: false,
        isAuthStateComplete: false
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
  setInitializing: (initializing: boolean) => void;
  setUserDataLoading: (loading: boolean) => void;
  setSessionRestoring: (restoring: boolean) => void;
  setAuthStateComplete: (complete: boolean) => void;
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
  
  // Track if we've already sent the app launched event to avoid duplicates
  const [appLaunchedTracked, setAppLaunchedTracked] = React.useState(false);
  
  // Debounce auth state changes to prevent rapid state thrashing
  const [authStateDebounceTimer, setAuthStateDebounceTimer] = React.useState<NodeJS.Timeout | null>(null);

  // Wait for session restoration to complete before making any routing decisions
  useEffect(() => {
    console.log("AppContext: Starting up, waiting for session restoration to complete...");
    
    // Set a longer fallback timeout in case session restoration fails to report status
    const fallbackTimer = setTimeout(() => {
      if (state.isSessionRestoring) {
        console.warn("AppContext: Session restoration timeout reached, proceeding without restoration status");
        dispatch({ type: "SET_SESSION_RESTORING", payload: false });
        dispatch({ type: "SET_LOADING", payload: false });
        dispatch({ type: "SET_INITIALIZING", payload: false });
        dispatch({ type: "SET_AUTH_STATE_COMPLETE", payload: true });
      }
    }, 5000); // 5 second fallback timeout (much longer than before, but still has safety net)

    return () => clearTimeout(fallbackTimer);
  }, []); // Run once on mount

  // Reactive user data loading - triggers when auth state indicates user is fully authenticated
  useEffect(() => {
    const shouldLoadUserData = 
      state.user && 
      state.isAuthenticated && 
      state.hasCompletedOnboarding && 
      state.isAuthStateComplete; // Load user data once auth state is complete, regardless of profile existence

    if (shouldLoadUserData) {
      console.log("AppContext: Auth state indicates authenticated user with completed onboarding, loading user data...");
      console.log("AppContext: User data loading check:", {
        hasUser: !!state.user,
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        isAuthStateComplete: state.isAuthStateComplete,
        hasUserProfile: !!state.userProfile,
        userStatsEmpty: state.userStats.totalRecordings === 0,
        transcriptsEmpty: state.transcripts.length === 0
      });
      
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
  }, [state.user, state.isAuthenticated, state.hasCompletedOnboarding, state.isAuthStateComplete]);

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
    const handleSessionRestorationStatus = (event: any) => {
      const { status, authenticated } = event.detail;
      console.log("AppContext: Session restoration status event received:", {
        status,
        authenticated,
        currentState: {
          isSessionRestoring: state.isSessionRestoring,
          isLoading: state.isLoading,
          isInitializing: state.isInitializing,
          isAuthStateComplete: state.isAuthStateComplete,
        },
        timestamp: new Date().toISOString(),
      });
      
      if (status === 'starting') {
        console.log("AppContext: Session restoration starting");
        dispatch({ type: "SET_SESSION_RESTORING", payload: true });
        dispatch({ type: "SET_AUTH_STATE_COMPLETE", payload: false });
      } else if (status === 'completed') {
        console.log("AppContext: Session restoration completed, authenticated:", authenticated);
        dispatch({ type: "SET_SESSION_RESTORING", payload: false });
        dispatch({ type: "SET_INITIALIZING", payload: false });
        
        // Auth state will be complete once auth-state-changed event is received
        // Don't set isAuthStateComplete to true yet - wait for the auth event
      }
    };

    const handleAuthStateChanged = (event: any) => {
      const { user, authenticated, onboardingCompleted } = event.detail;
      console.log("AppContext: Auth state changed event received:", {
        user: user?.email,
        authenticated,
        onboardingCompleted,
        onboardingCompletedType: typeof onboardingCompleted,
        onboardingCompletedRaw: onboardingCompleted,
        currentState: {
          user: state.user?.email,
          isAuthenticated: state.isAuthenticated,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          isLoading: state.isLoading,
        },
        timestamp: new Date().toISOString(),
      });

      // Clear any existing debounce timer
      if (authStateDebounceTimer) {
        clearTimeout(authStateDebounceTimer);
      }

      // Debounce auth state changes to prevent rapid state updates
      const newTimer = setTimeout(() => {
        console.log("AppContext: Processing debounced auth state change");
        
        // Additional debugging for onboarding logic
        console.log("AppContext: Onboarding logic evaluation:", {
          willSetOnboardingCompleted: onboardingCompleted,
          currentOnboardingStatus: state.hasCompletedOnboarding,
          shouldShowOnboarding: !authenticated || !onboardingCompleted,
          shouldShowHome: authenticated && onboardingCompleted,
          isAuthenticated: authenticated,
          hasOnboardingCompleted: onboardingCompleted
        });
        
        dispatch({ type: "SET_USER", payload: user });
        dispatch({ type: "SET_AUTHENTICATED", payload: authenticated });
        if (typeof onboardingCompleted !== "undefined") {
          dispatch({
            type: "SET_ONBOARDING_COMPLETED",
            payload: onboardingCompleted,
          });
        }
        
        // Mark auth state as complete since we've received complete auth data
        dispatch({ type: "SET_AUTH_STATE_COMPLETE", payload: true });
        dispatch({ type: "SET_INITIALIZING", payload: false });
        
        // Stop general loading for different cases:
        if (!authenticated) {
          // Unauthenticated users - stop loading immediately
          dispatch({ type: "SET_LOADING", payload: false });
        } else if (authenticated && onboardingCompleted) {
          // Authenticated users with completed onboarding - they'll need user data loaded
          // Loading will be stopped when user data loading completes
          console.log("AppContext: Authenticated user with completed onboarding - will load user data");
        } else {
          // Authenticated users without completed onboarding - stop loading, go to onboarding
          dispatch({ type: "SET_LOADING", payload: false });
          console.log("AppContext: Authenticated user without completed onboarding - going to onboarding flow");
        }
        
        console.log("AppContext: Auth state updated after debounced event:", {
          willShowOnboarding: !authenticated || !onboardingCompleted,
          shouldShowHome: authenticated && onboardingCompleted,
        });
        
        // Track app launch event once user is authenticated (and we haven't tracked it yet)
        if (authenticated && user && !appLaunchedTracked) {
          console.log("AppContext: User authenticated, tracking app launch event");
          analytics.trackAppLaunched()
            .then(() => {
              console.log("AppContext: App launch event tracked successfully");
              setAppLaunchedTracked(true);
            })
            .catch((error) => {
              console.error("AppContext: Failed to track app launch event:", error);
            });
        }
        
        setAuthStateDebounceTimer(null);
      }, 100); // 100ms debounce to prevent rapid state changes

      setAuthStateDebounceTimer(newTimer);
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
    window.addEventListener("session-restoration-status", handleSessionRestorationStatus);
    window.addEventListener("auth-state-changed", handleAuthStateChanged);
    window.addEventListener("statistics-updated", handleStatisticsUpdated);
    window.addEventListener("transcripts-loaded", handleTranscriptsLoaded);
    window.addEventListener("activity-updated", handleActivityUpdated);
    window.addEventListener(
      "transcript-saved-to-database",
      handleTranscriptSaved
    );

    return () => {
      // Clean up debounce timer if it exists
      if (authStateDebounceTimer) {
        clearTimeout(authStateDebounceTimer);
      }
      
      window.removeEventListener("session-restoration-status", handleSessionRestorationStatus);
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
      console.log("AppContext: State before completing onboarding:", {
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        user: state.user?.email,
        isAuthenticated: state.isAuthenticated,
        timestamp: new Date().toISOString()
      });

      // CRITICAL FIX: Update database onboarding_completed field
      console.log("AppContext: Updating onboarding_completed in database...");
      const dbResult = await auth.completeOnboarding();
      
      if (!dbResult.success) {
        console.error("AppContext: Failed to update database onboarding status:", dbResult.error);
        throw new Error(dbResult.error || "Failed to update onboarding status in database");
      }
      
      console.log("AppContext: Database onboarding_completed field updated successfully");
      
      // Update local state
      dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: true });
      console.log("AppContext: SET_ONBOARDING_COMPLETED dispatched, state should now show completed");

      // Save initial settings to database
      if (state.user) {
        await db.saveUserSettings(state.settings);
        console.log("AppContext: User settings saved successfully");
      } else {
        console.warn("AppContext: No user available to save settings");
      }

      // CRITICAL FIX: Ensure navigation goes to home page
      dispatch({ type: "SET_ACTIVE_VIEW", payload: "home" });
      console.log("AppContext: Set activeView to home page");

      // CRITICAL FIX: Request auth state refresh from main process to sync updated database status
      console.log("AppContext: Requesting auth state refresh from main process...");
      try {
        // Notify main process that onboarding was completed and request fresh auth state
        if (window.electronAPI && window.electronAPI.refreshAuthState) {
          const refreshResult = await window.electronAPI.refreshAuthState();
          console.log("AppContext: Auth state refresh result:", refreshResult);
          
          if (refreshResult.success) {
            console.log("AppContext: Auth state refresh completed, updated onboarding status:", refreshResult.onboardingCompleted);
            
            // CRITICAL FIX: Force data loading after auth state refresh
            // This ensures user data loads even if the auth-state-changed event was already processed
            if (refreshResult.onboardingCompleted && state.user) {
              console.log("AppContext: Triggering user data loading after auth refresh...");
              setTimeout(() => {
                if (state.user && state.isAuthenticated) {
                  console.log("AppContext: Executing post-onboarding data loading");
                  dispatch({ type: "SET_USER_DATA_LOADING", payload: true });
                  initializeUserSession(state.user.id)
                    .then(() => {
                      console.log("AppContext: Post-onboarding user data loaded successfully");
                      dispatch({ type: "SET_USER_DATA_LOADING", payload: false });
                      dispatch({ type: "SET_LOADING", payload: false });
                    })
                    .catch((error) => {
                      console.error("AppContext: Error loading post-onboarding user data:", error);
                      dispatch({ type: "SET_USER_DATA_LOADING", payload: false });
                      dispatch({ type: "SET_LOADING", payload: false });
                    });
                }
              }, 500); // Small delay to ensure auth state update has processed
            }
          } else {
            console.warn("AppContext: Auth state refresh failed:", refreshResult.error);
          }
        } else {
          console.warn("AppContext: refreshAuthState not available on electronAPI");
        }
      } catch (refreshError) {
        console.error("AppContext: Error requesting auth state refresh:", refreshError);
        // Don't fail the whole onboarding process if refresh fails
      }
      
      console.log("AppContext: Onboarding completion process finished successfully");
    } catch (error) {
      console.error("AppContext: Error completing onboarding:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to complete onboarding" });
      
      // Rollback local state if database update failed
      dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: false });
    }
  }, [state.user, state.settings]);

  const signOut = useCallback(async () => {
    try {
      console.log("AppContext: Starting signout process");

      // Set loading state while signing out
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      // Sign out from Supabase (this will clear session stores in main process and trigger auth state change)
      const result = await auth.signOut();

      if (result.success || !result.error) {
        console.log("AppContext: Signout successful, waiting for auth state change event");
        // Don't reload - the main process will send auth-state-changed event with unauthenticated state
        // The auth state change event will handle the UI transition
      } else {
        console.warn("AppContext: Signout had issues:", result.error);
        
        // Still try to clear local state even if signout had issues
        console.log("AppContext: Clearing local state despite signout issues");
        localStorage.clear();
        sessionStorage.clear();
        
        // Reset state to unauthenticated
        dispatch({ type: "RESET_APP_STATE" });
        dispatch({
          type: "SET_ERROR",
          payload: result.error || "Sign out completed with warnings",
        });
      }
    } catch (error) {
      console.error("AppContext: Error during signout:", error);

      // If signout completely fails, force local cleanup and state reset
      localStorage.clear();
      sessionStorage.clear();

      dispatch({ type: "RESET_APP_STATE" });
      dispatch({
        type: "SET_ERROR",
        payload: "Sign out completed with errors - local state cleared",
      });
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
      setSessionRestoring: (restoring: boolean) =>
        dispatch({ type: "SET_SESSION_RESTORING", payload: restoring }),
      setAuthStateComplete: (complete: boolean) =>
        dispatch({ type: "SET_AUTH_STATE_COMPLETE", payload: complete }),
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
