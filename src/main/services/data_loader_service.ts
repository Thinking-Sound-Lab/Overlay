/**
 * Data Loader Service
 *
 * Implements cache-first, DB-on-miss strategy for loading user data.
 * Simplifies the complex authentication and data loading flow.
 */

import { CacheService } from "./cache_service";
import { SupabaseService } from "./supabase_service";
import { Settings, UserStats, UITranscriptEntry } from "../../shared/types";
import {
  UserRecord,
  DatabaseTranscriptEntry,
} from "../../shared/types/database";
import { DEFAULT_SETTINGS } from "../../shared/constants/default-settings";

export interface AuthStateEventData {
  user: UserRecord | null;
  authenticated: boolean;
  statistics: UserStats | null;
  settings: Settings | null;
  recentTranscripts: UITranscriptEntry[];
  error?: string;
  source?: string;
}

export class DataLoaderService {
  private static instance: DataLoaderService | null = null;
  private cacheService: CacheService;
  private supabaseService: SupabaseService;

  private constructor(supabaseService: SupabaseService) {
    this.cacheService = CacheService.getInstance();
    this.supabaseService = supabaseService;
  }

  public static getInstance(
    supabaseService: SupabaseService
  ): DataLoaderService {
    if (!DataLoaderService.instance) {
      DataLoaderService.instance = new DataLoaderService(supabaseService);
      console.log("DataLoaderService: Instance created");
    }
    return DataLoaderService.instance;
  }

  /**
   * Load complete user data using cache-first strategy
   * 1. Check cache first
   * 2. If cache miss or invalid, load from DB
   * 3. Update cache with fresh data
   */
  async loadUserData(userId: string): Promise<AuthStateEventData> {
    console.log(`[DataLoader] Loading user data for: ${userId}`);

    try {
      // Step 1: Try cache first
      if (this.cacheService.hasCacheForUser(userId)) {
        console.log(`[DataLoader] Cache hit for user: ${userId}`);
        const cachedData = this.cacheService.getAllUserData();

        if (cachedData.user) {
          return {
            user: cachedData.user,
            authenticated: true,
            settings: cachedData.settings,
            statistics: cachedData.stats,
            recentTranscripts: cachedData.transcripts,
          };
        }
      }

      // Step 2: Cache miss or invalid - load from database
      console.log(
        `[DataLoader] Cache miss for user ${userId}, loading from database`
      );

      const freshData = await this.loadFromDatabase(userId);

      // Step 3: Update cache with fresh data
      if (freshData.user && freshData.settings && freshData.statistics) {
        this.cacheService.setAllUserData({
          user: freshData.user,
          settings: freshData.settings,
          stats: freshData.statistics,
          transcripts: freshData.recentTranscripts,
        });
      }

      console.log(
        `[DataLoader] Data loaded and cached successfully for user: ${userId}`
      );
      return freshData;
    } catch (error) {
      console.error(`[DataLoader] Error loading user data:`, error);

      // Try to return stale cache data if available
      const staleData = this.cacheService.getAllUserData();
      if (staleData.user) {
        console.log(`[DataLoader] Returning stale cache data due to error`);
        return {
          user: staleData.user,
          authenticated: true,
          settings: staleData.settings,
          statistics: staleData.stats,
          recentTranscripts: staleData.transcripts,
          error: `Failed to refresh data: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }

      // No cache available, return error state
      return {
        user: null,
        authenticated: false,
        settings: null,
        statistics: null,
        recentTranscripts: [],
        error: `Failed to load user data: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Load all user data from database
   */
  private async loadFromDatabase(userId: string): Promise<AuthStateEventData> {
    console.log(
      `[DataLoader] Loading all data from database for user: ${userId}`
    );

    // Load user profile
    const profileResult = await this.supabaseService.getUserProfile();
    let user: UserRecord | null = null;

    if (profileResult.data && !profileResult.error) {
      user = {
        id: profileResult.data.id,
        email: this.supabaseService.getCurrentUser()?.email || "",
        name: profileResult.data.name,
        created_at: profileResult.data.created_at || new Date().toISOString(),
        subscription_tier: profileResult.data.subscription_tier || "free",
        onboarding_completed: profileResult.data.onboarding_completed || false,
      };
    } else {
      throw new Error(
        `Failed to load user profile: ${profileResult.error?.message || "Unknown error"}`
      );
    }

    // Load user settings
    let settings: Settings = DEFAULT_SETTINGS;
    const settingsResult = await this.supabaseService.getUserSettings();
    if (settingsResult.data && !settingsResult.error) {
      settings = { ...DEFAULT_SETTINGS, ...settingsResult.data };
    } else {
      console.warn(
        `[DataLoader] Failed to load settings, using defaults:`,
        settingsResult.error?.message
      );
    }

    // Load user statistics
    let statistics: UserStats = {
      totalWordCount: 0,
      averageWPM: 0,
      totalRecordings: 0,
      streakDays: 0,
    };
    const statsResult = await this.supabaseService.getUserStats();
    if (statsResult.data && !statsResult.error) {
      statistics = statsResult.data;
    } else {
      console.warn(
        `[DataLoader] Failed to load stats, using defaults:`,
        statsResult.error?.message
      );
    }

    // Load recent transcripts
    let recentTranscripts: UITranscriptEntry[] = [];
    const transcriptsResult = await this.supabaseService.getTranscripts(100);
    if (transcriptsResult.data && !transcriptsResult.error) {
      recentTranscripts = transcriptsResult.data.map(
        this.convertDatabaseTranscriptToUI
      );
    } else {
      console.warn(
        `[DataLoader] Failed to load transcripts, using empty array:`,
        transcriptsResult.error?.message
      );
    }

    console.log(`[DataLoader] Database loading complete for user: ${userId}`, {
      hasUser: !!user,
      settingsKeys: Object.keys(settings),
      statsTotal: statistics.totalWordCount,
      transcriptCount: recentTranscripts.length,
    });

    return {
      user,
      authenticated: true,
      settings,
      statistics,
      recentTranscripts,
    };
  }

  /**
   * Convert database transcript to UI transcript format
   */
  private convertDatabaseTranscriptToUI(
    dbTranscript: DatabaseTranscriptEntry
  ): UITranscriptEntry {
    return {
      id: dbTranscript.metadata?.localId || dbTranscript.id,
      text: dbTranscript.text,
      timestamp: new Date(dbTranscript.created_at),
      wordCount: dbTranscript.word_count,
      wpm: dbTranscript.wpm,
      originalText: dbTranscript.original_text,
      sourceLanguage: dbTranscript.language,
      targetLanguage: dbTranscript.target_language,
      wasTranslated: dbTranscript.was_translated,
      confidence: dbTranscript.confidence,
      detectedLanguage: dbTranscript.metadata?.detectedLanguage,
      wordCountRatio: dbTranscript.metadata?.wordCountRatio,
    };
  }

  /**
   * Initialize user cache and load data
   */
  async initializeUserData(userId: string): Promise<AuthStateEventData> {
    console.log(`[DataLoader] Initializing user data for: ${userId}`);

    // Initialize cache for this user
    this.cacheService.initializeUserCache(userId);

    // Load data using cache-first strategy
    return await this.loadUserData(userId);
  }

  /**
   * Clear all user data (cache and references)
   */
  clearUserData(): void {
    console.log(`[DataLoader] Clearing all user data`);
    this.cacheService.clearUserData();
  }

  /**
   * Update user settings in DB and cache
   * Implements DB-first update pattern
   */
  async updateUserSettings(
    settings: Settings
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[DataLoader] Updating user settings (DB-first)`);

      // Step 1: Save to database first
      const result = await this.supabaseService.saveUserSettings(settings);
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Step 2: Update cache after successful DB save
      this.cacheService.setUserSettings(settings);

      console.log(`[DataLoader] Settings updated successfully`);
      return { success: true };
    } catch (error) {
      console.error(`[DataLoader] Failed to update settings:`, error);
      return {
        success: false,
        error: `Failed to update settings: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Add transcript to DB and cache
   * Implements DB-first update pattern
   */
  async addTranscript(
    transcript: Omit<DatabaseTranscriptEntry, "id" | "created_at">
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[DataLoader] Adding transcript (DB-first)`);

      // Step 1: Save to database first
      const result = await this.supabaseService.saveTranscript(transcript);
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Step 2: Update statistics in DB
      const statsResult = await this.supabaseService.getUserStats();
      if (statsResult.error) {
        throw new Error(statsResult.error.message);
      }

      // Step 3: Update cache after successful DB save
      if (statsResult.data) {
        const uiTranscript = this.convertDatabaseTranscriptToUI(result.data);
        this.cacheService.addTranscript(uiTranscript);
        this.cacheService.setUserStats(statsResult.data);
      }

      console.log(`[DataLoader] Transcript added successfully`);
      return { success: true };
    } catch (error) {
      console.error(`[DataLoader] Failed to add transcript:`, error);
      return {
        success: false,
        error: `Failed to add transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get user settings from cache
   */
  getUserSettings(): Settings {
    const settings = this.cacheService.getUserSettings();
    return settings;
  }

  /**
   * Get user statistics from cache
   */
  getUserStats(): UserStats {
    return this.cacheService.getUserStats();
  }

  /**
   * Get cache info for debugging
   */
  getCacheInfo(): {
    userId: string | null;
    hasUser: boolean;
    hasSettings: boolean;
    hasStats: boolean;
    transcriptCount: number;
  } {
    return this.cacheService.getCacheInfo();
  }

  /**
   * Update user settings - alias for updateUserSettings()
   * (maintains consistency with index.ts interface)
   */
  async updateSettings(
    settings: Settings
  ): Promise<{ success: boolean; error?: string }> {
    return await this.updateUserSettings(settings);
  }

  /**
   * Get current authentication state data from cache
   * Used to refresh UI after data changes
   */
  getAuthStateData(): AuthStateEventData | null {
    console.log(`[DataLoader] Getting current auth state data from cache`);

    const cacheData = this.cacheService.getAllUserData();
    const cacheInfo = this.cacheService.getCacheInfo();

    if (!cacheInfo.userId || !cacheData.user) {
      console.log(`[DataLoader] No cached auth data available`);
      return null;
    }

    return {
      user: cacheData.user,
      authenticated: true,
      settings: cacheData.settings,
      statistics: cacheData.stats,
      recentTranscripts: cacheData.transcripts,
    };
  }

  /**
   * Complete user onboarding - DB-first approach
   * Updates database and then updates cache with new user state
   */
  async completeOnboarding(): Promise<{
    success: boolean;
    error?: string;
    data?: AuthStateEventData;
  }> {
    try {
      console.log(`[DataLoader] Completing onboarding (DB-first)`);

      const cacheInfo = this.cacheService.getCacheInfo();
      if (!cacheInfo.userId) {
        throw new Error("No user ID available in cache");
      }

      // Step 1: Update database first
      const result = await this.supabaseService.completeOnboarding();
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Step 2: Update cached user object with onboarding completion
      const cachedData = this.cacheService.getAllUserData();
      if (cachedData.user) {
        const updatedUser = { ...cachedData.user, onboarding_completed: true };

        // Update cache with new user object
        this.cacheService.setAllUserData({
          ...cachedData,
          user: updatedUser,
        });

        console.log(`[DataLoader] Cache updated with onboarding completion`);

        // Step 3: Return updated auth state data
        const authStateData: AuthStateEventData = {
          user: updatedUser,
          authenticated: true,
          settings: cachedData.settings,
          statistics: cachedData.stats,
          recentTranscripts: cachedData.transcripts,
        };

        return { success: true, data: authStateData };
      } else {
        throw new Error("No cached user data available to update");
      }
    } catch (error) {
      console.error(`[DataLoader] Failed to complete onboarding:`, error);
      return {
        success: false,
        error: `Failed to complete onboarding: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
