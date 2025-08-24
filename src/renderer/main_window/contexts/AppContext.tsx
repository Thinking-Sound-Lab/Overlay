import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ViewType } from '../types';

interface User {
  id: string;
  email: string;
  subscription_tier?: 'free' | 'pro';
}

interface UserProfile {
  id: string;
  name: string;
  subscription_tier: 'free' | 'pro';
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
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_USER_PROFILE'; payload: UserProfile | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_ONBOARDING_COMPLETED'; payload: boolean }
  | { type: 'SET_ACTIVE_VIEW'; payload: ViewType }
  | { type: 'SET_USER_STATS'; payload: UserStats }
  | { type: 'SET_TRANSCRIPTS'; payload: TranscriptEntry[] }
  | { type: 'ADD_TRANSCRIPT'; payload: TranscriptEntry }
  | { type: 'SET_SETTINGS'; payload: Settings }
  | { type: 'SET_RECORDING_STATE'; payload: { isRecording: boolean; isProcessing: boolean } }
  | { type: 'RESET_APP_STATE' };

const initialState: AppState = {
  user: null,
  userProfile: null,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  activeView: 'home',
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
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_USER_PROFILE':
      return { ...state, userProfile: action.payload };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_ONBOARDING_COMPLETED':
      return { ...state, hasCompletedOnboarding: action.payload };
    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.payload };
    case 'SET_USER_STATS':
      return { ...state, userStats: action.payload };
    case 'SET_TRANSCRIPTS':
      return { ...state, transcripts: action.payload };
    case 'ADD_TRANSCRIPT':
      return { 
        ...state, 
        transcripts: [action.payload, ...state.transcripts.slice(0, 99)] // Keep only 100 transcripts
      };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_RECORDING_STATE':
      return { 
        ...state, 
        isRecording: action.payload.isRecording,
        isProcessing: action.payload.isProcessing 
      };
    case 'RESET_APP_STATE':
      console.log('AppContext: Resetting app state to initial values');
      return { ...initialState, isLoading: false };
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load user data when authenticated and onboarding completed
  useEffect(() => {
    if (state.isAuthenticated && state.hasCompletedOnboarding && state.user && !state.userProfile) {
      console.log('AppContext: Loading user data after auth state change');
      loadUserDataFromEvents();
    }
  }, [state.isAuthenticated, state.hasCompletedOnboarding, state.user, state.userProfile]);

  const loadUserDataFromEvents = async () => {
    // Import API client
    const { auth, db } = await import('../lib/api_client');
    
    try {
      // Load user profile
      const profileResult = await auth.getUserProfile();
      const actualProfileData = profileResult.success ? profileResult.data?.data : null;
      if (actualProfileData) {
        dispatch({ type: 'SET_USER_PROFILE', payload: actualProfileData });
      }

      // Load user settings
      const settingsResult = await db.getUserSettings();
      const actualSettingsData = settingsResult.success ? settingsResult.data?.data : null;
      if (actualSettingsData?.settings) {
        dispatch({ type: 'SET_SETTINGS', payload: {
          outputMode: actualSettingsData.settings.outputMode || "both",
          useAI: actualSettingsData.settings.useAI ?? true,
          language: actualSettingsData.settings.language || "auto",
          enableTranslation: actualSettingsData.settings.enableTranslation ?? false,
          targetLanguage: actualSettingsData.settings.targetLanguage || "en",
        }});
      }

      // Load user stats
      const statsResult = await db.getUserStats();
      const actualStatsData = statsResult.success ? statsResult.data?.data : null;
      if (actualStatsData) {
        dispatch({ type: 'SET_USER_STATS', payload: actualStatsData });
      }

      // Load transcripts
      const transcriptsResult = await db.getTranscripts(100);
      const actualTranscriptsData = transcriptsResult.success ? transcriptsResult.data?.data : null;
      if (actualTranscriptsData && Array.isArray(actualTranscriptsData)) {
        const formattedTranscripts = actualTranscriptsData.map((item: any) => ({
          id: item.id,
          text: item.text,
          timestamp: new Date(item.timestamp || item.created_at),
          wordCount: Number(item.wordCount || item.word_count) || 0,
          wpm: Number(item.wpm) || 0,
          originalText: item.originalText || item.original_text,
          wasTranslated: item.wasTranslated || item.was_translated,
          targetLanguage: item.targetLanguage || item.target_language,
        }));
        dispatch({ type: 'SET_TRANSCRIPTS', payload: formattedTranscripts });
      }
    } catch (error) {
      console.error('AppContext: Error loading user data:', error);
    }
  };

  // Listen for main process events
  useEffect(() => {
    const handleAuthStateChanged = (event: any) => {
      const { user, authenticated, onboardingCompleted } = event.detail;
      console.log('AppContext: Auth state changed:', { user: user?.email, authenticated, onboardingCompleted });
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_AUTHENTICATED', payload: authenticated });
      if (typeof onboardingCompleted !== 'undefined') {
        dispatch({ type: 'SET_ONBOARDING_COMPLETED', payload: onboardingCompleted });
      }
    };

    const handleStatisticsUpdated = (event: any) => {
      dispatch({ type: 'SET_USER_STATS', payload: event.detail });
    };

    const handleTranscriptsLoaded = (event: any) => {
      console.log('AppContext: Transcripts loaded event received:', event.detail?.length || 0);
      // The main process sends the transcript array directly as event.detail
      if (Array.isArray(event.detail)) {
        dispatch({ type: 'SET_TRANSCRIPTS', payload: event.detail });
      } else {
        console.warn('AppContext: Invalid transcripts data received:', event.detail);
      }
    };

    const handleActivityUpdated = (event: any) => {
      console.log('AppContext: Activity updated event received:', event.detail);
      if (event.detail.type === 'transcript') {
        console.log('AppContext: Adding new transcript to UI:', event.detail.data);
        dispatch({ type: 'ADD_TRANSCRIPT', payload: event.detail.data });
      }
    };

    const handleTranscriptSaved = (event: any) => {
      // Transcript was saved to database, could trigger a refresh if needed
      console.log('Transcript saved to database:', event.detail);
    };

    // Add event listeners
    window.addEventListener('auth-state-changed', handleAuthStateChanged);
    window.addEventListener('statistics-updated', handleStatisticsUpdated);
    window.addEventListener('transcripts-loaded', handleTranscriptsLoaded);
    window.addEventListener('activity-updated', handleActivityUpdated);
    window.addEventListener('transcript-saved-to-database', handleTranscriptSaved);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
      window.removeEventListener('statistics-updated', handleStatisticsUpdated);
      window.removeEventListener('transcripts-loaded', handleTranscriptsLoaded);
      window.removeEventListener('activity-updated', handleActivityUpdated);
      window.removeEventListener('transcript-saved-to-database', handleTranscriptSaved);
    };
  }, []);

  // Convenience action creators
  const contextValue: AppContextType = {
    state,
    dispatch,
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),
    setUser: (user: User | null) => dispatch({ type: 'SET_USER', payload: user }),
    setUserProfile: (profile: UserProfile | null) => dispatch({ type: 'SET_USER_PROFILE', payload: profile }),
    setAuthenticated: (authenticated: boolean) => dispatch({ type: 'SET_AUTHENTICATED', payload: authenticated }),
    setOnboardingCompleted: (completed: boolean) => dispatch({ type: 'SET_ONBOARDING_COMPLETED', payload: completed }),
    setActiveView: (view: ViewType) => dispatch({ type: 'SET_ACTIVE_VIEW', payload: view }),
    setUserStats: (stats: UserStats) => dispatch({ type: 'SET_USER_STATS', payload: stats }),
    setTranscripts: (transcripts: TranscriptEntry[]) => dispatch({ type: 'SET_TRANSCRIPTS', payload: transcripts }),
    addTranscript: (transcript: TranscriptEntry) => dispatch({ type: 'ADD_TRANSCRIPT', payload: transcript }),
    setSettings: (settings: Settings) => dispatch({ type: 'SET_SETTINGS', payload: settings }),
    setRecordingState: (isRecording: boolean, isProcessing: boolean) => 
      dispatch({ type: 'SET_RECORDING_STATE', payload: { isRecording, isProcessing } }),
    resetAppState: () => dispatch({ type: 'RESET_APP_STATE' }),
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};