import { BrowserWindow } from "electron";
import Store from "electron-store";
import { ExternalAPIManager } from "../services/external_api_manager";
import { AuthUtils } from "../utils/auth";
import { User } from '@supabase/supabase-js';
import { AuthStateData, UserRecord, DatabaseTranscriptEntry, Settings, UserStats } from "../../shared/types";

export class AuthStateManager {
  private apiManager: ExternalAPIManager;
  private updateTrayCallback?: () => void;
  private updateSpeechMetricsCallback?: (stats: UserStats) => void;
  private updateSTTSettingsCallback?: () => Promise<void>;
  private store: Store<Settings>;

  constructor(
    apiManager: ExternalAPIManager, 
    store: Store<Settings>,
    updateTrayCallback?: () => void,
    updateSpeechMetricsCallback?: (stats: UserStats) => void,
    updateSTTSettingsCallback?: () => Promise<void>
  ) {
    this.apiManager = apiManager;
    this.store = store;
    this.updateTrayCallback = updateTrayCallback;
    this.updateSpeechMetricsCallback = updateSpeechMetricsCallback;
    this.updateSTTSettingsCallback = updateSTTSettingsCallback;
  }

  /**
   * Load complete authentication state including user profile, statistics, settings, and transcripts
   */
  async loadCompleteAuthState(user: User, source = "unknown"): Promise<AuthStateData> {
    if (!user) {
      console.log(`[AuthStateManager] ${source}: No user provided, returning unauthenticated state`);
      return {
        user: null,
        authenticated: false,
        profile: null,
        statistics: null,
        settings: null,
        recentTranscripts: null,
      };
    }

    console.log(`[AuthStateManager] ${source}: Loading complete auth state for user:`, user.email);
    
    const authState: AuthStateData = {
      user,
      authenticated: true,
      profile: null,
      statistics: null,
      settings: null,
      recentTranscripts: null,
    };

    try {
      // Load user profile
      console.log(`[AuthStateManager] ${source}: Loading user profile...`);
      const profileResult = await this.apiManager.supabase.getUserProfile();
      
      if (profileResult.data && !profileResult.error) {
        authState.profile = profileResult.data;
        console.log(`[AuthStateManager] ${source}: Profile loaded successfully:`, {
          id: profileResult.data.id,
          name: profileResult.data.name,
          onboarding_completed: profileResult.data.onboarding_completed,
        });
      } else {
        console.warn(`[AuthStateManager] ${source}: Failed to load profile:`, profileResult.error?.message);
        // For existing users, default onboarding to completed if profile fetch fails
        authState.profile = {
          id: user.id,
          name: user.email,
          onboarding_completed: true,
        };
      }
    } catch (error) {
      console.error(`[AuthStateManager] ${source}: Error loading profile:`, error);
      // Fallback profile for error cases
      authState.profile = {
        id: user.id,
        name: user.email,
        onboarding_completed: true,
      };
    }

    try {
      // Load user statistics
      console.log(`[AuthStateManager] ${source}: Loading user statistics...`);
      const statsResult = await this.apiManager.supabase.getUserStats();
      
      if (statsResult.data && !statsResult.error) {
        authState.statistics = statsResult.data;
        console.log(`[AuthStateManager] ${source}: Statistics loaded:`, {
          totalWordCount: statsResult.data.totalWordCount,
          totalRecordings: statsResult.data.totalRecordings,
          averageWPM: statsResult.data.averageWPM,
          streakDays: statsResult.data.streakDays,
        });
      } else {
        console.warn(`[AuthStateManager] ${source}: Failed to load statistics:`, statsResult.error?.message);
      }
    } catch (error) {
      console.error(`[AuthStateManager] ${source}: Error loading statistics:`, error);
    }

    try {
      // Load user settings
      console.log(`[AuthStateManager] ${source}: Loading user settings...`);
      const settingsResult = await this.apiManager.supabase.getUserSettings();
      
      if (settingsResult.data && !settingsResult.error) {
        // Extract the actual settings object from the database row
        authState.settings = settingsResult.data.settings || settingsResult.data;
        console.log(`[AuthStateManager] ${source}: Settings loaded successfully:`, {
          hasSettings: !!authState.settings,
          settingsKeys: authState.settings ? Object.keys(authState.settings) : []
        });
        
        // CRITICAL FIX: Sync database settings to electron-store so STT service can access them
        if (authState.settings) {
          console.log(`[AuthStateManager] ${source}: Syncing database settings to electron-store...`);
          
          // Sync all database settings to electron-store
          Object.entries(authState.settings).forEach(([key, value]) => {
            const currentStoreValue = this.store.get(key);
            if (currentStoreValue !== value) {
              console.log(`[AuthStateManager] ${source}: Syncing ${key}: ${currentStoreValue} → ${value}`);
              this.store.set(key, value);
            }
          });
          
          console.log(`[AuthStateManager] ${source}: Database settings synced to electron-store successfully`);
          
          // Trigger STT settings update to pick up new language immediately
          if (this.updateSTTSettingsCallback) {
            console.log(`[AuthStateManager] ${source}: Triggering STT settings update...`);
            try {
              await this.updateSTTSettingsCallback();
              console.log(`[AuthStateManager] ${source}: STT settings updated successfully`);
            } catch (error) {
              console.error(`[AuthStateManager] ${source}: Error updating STT settings:`, error);
            }
          }
        }
      } else {
        console.warn(`[AuthStateManager] ${source}: Failed to load settings:`, settingsResult.error?.message);
      }
    } catch (error) {
      console.error(`[AuthStateManager] ${source}: Error loading settings:`, error);
    }

    try {
      // Load recent transcripts (limit to 50 for performance)
      console.log(`[AuthStateManager] ${source}: Loading recent transcripts...`);
      const transcriptsResult = await this.apiManager.supabase.getTranscripts(50);
      
      if (transcriptsResult.data && !transcriptsResult.error) {
        // Convert database transcripts to local format
        authState.recentTranscripts = transcriptsResult.data.map((dbTranscript: DatabaseTranscriptEntry) => ({
          id: dbTranscript.metadata?.localId || dbTranscript.id,
          text: dbTranscript.text,
          timestamp: new Date(dbTranscript.created_at),
          wordCount: dbTranscript.word_count,
          wpm: dbTranscript.wpm,
          originalText: dbTranscript.original_text,
          wasTranslated: dbTranscript.was_translated,
          targetLanguage: dbTranscript.target_language,
          detectedLanguage: dbTranscript.metadata?.detectedLanguage,
          ...dbTranscript.metadata,
        }));
        
        console.log(`[AuthStateManager] ${source}: Loaded ${authState.recentTranscripts.length} transcripts`);
      } else {
        console.warn(`[AuthStateManager] ${source}: Failed to load transcripts:`, transcriptsResult.error?.message);
        authState.recentTranscripts = [];
      }
    } catch (error) {
      console.error(`[AuthStateManager] ${source}: Error loading transcripts:`, error);
      authState.recentTranscripts = [];
    }

    console.log(`[AuthStateManager] ${source}: Complete auth state loaded successfully`);
    
    // Update local speechMetrics and tray with loaded statistics if available
    if (authState.statistics) {
      if (this.updateSpeechMetricsCallback) {
        console.log(`[AuthStateManager] ${source}: Updating local speechMetrics with loaded statistics`);
        this.updateSpeechMetricsCallback(authState.statistics);
      }
      
      if (this.updateTrayCallback) {
        console.log(`[AuthStateManager] ${source}: Updating tray with loaded statistics`);
        this.updateTrayCallback();
      }
    }
    
    return authState;
  }

  /**
   * Send complete auth state to renderer with safety checks
   */
  sendAuthStateToRenderer(
    mainWindow: BrowserWindow | null,
    authState: AuthStateData,
    source = "unknown"
  ): void {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn(`[AuthStateManager] ${source}: Cannot send auth state - mainWindow unavailable or destroyed`);
      return;
    }

    if (!mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
      console.warn(`[AuthStateManager] ${source}: Cannot send auth state - webContents unavailable or destroyed`);
      return;
    }

    try {
      console.log(`[AuthStateManager] ${source}: Sending complete auth state to renderer:`, {
        authenticated: authState.authenticated,
        userEmail: authState.user?.email,
        hasProfile: !!authState.profile,
        hasStatistics: !!authState.statistics,
        hasSettings: !!authState.settings,
        transcriptCount: authState.recentTranscripts?.length || 0,
        onboardingCompleted: authState.profile?.onboarding_completed,
      });

      mainWindow.webContents.send("auth-state-changed", authState);
    } catch (error) {
      console.error(`[AuthStateManager] ${source}: Error sending auth state to renderer:`, error);
    }
  }

  /**
   * Send unauthenticated state to renderer
   */
  sendUnauthenticatedState(
    mainWindow: BrowserWindow | null,
    error?: string,
    source = "unknown"
  ): void {
    const authState: AuthStateData = {
      user: null,
      authenticated: false,
      profile: null,
      statistics: null,
      settings: null,
      recentTranscripts: null,
      error,
    };

    this.sendAuthStateToRenderer(mainWindow, authState, source);
  }

  /**
   * Load and send complete authenticated state
   */
  async loadAndSendAuthState(
    mainWindow: BrowserWindow | null,
    user: User,
    source = "unknown"
  ): Promise<void> {
    try {
      const authState = await this.loadCompleteAuthState(user, source);
      this.sendAuthStateToRenderer(mainWindow, authState, source);
      
      // Update main process authentication state
      AuthUtils.setAuthenticationState(authState.authenticated);
    } catch (error) {
      console.error(`[AuthStateManager] ${source}: Error in loadAndSendAuthState:`, error);
      this.sendUnauthenticatedState(mainWindow, `Failed to load auth state: ${error.message}`, source);
    }
  }
}