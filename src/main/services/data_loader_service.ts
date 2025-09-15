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
  DictionaryEntry,
} from "../../shared/types/database";
import { DEFAULT_SETTINGS } from "../../shared/constants/default-settings";

export interface AuthStateEventData {
  user: UserRecord | null;
  authenticated: boolean;
  statistics: UserStats | null;
  settings: Settings | null;
  recentTranscripts: UITranscriptEntry[];
  totalTranscriptCount: number;
  dictionaryEntries: DictionaryEntry[];
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
            totalTranscriptCount: cachedData.totalTranscriptCount,
            dictionaryEntries: cachedData.dictionaryEntries,
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
          totalTranscriptCount: freshData.totalTranscriptCount,
          dictionaryEntries: freshData.dictionaryEntries,
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
          totalTranscriptCount: staleData.totalTranscriptCount,
          dictionaryEntries: staleData.dictionaryEntries,
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
        totalTranscriptCount: 0,
        dictionaryEntries: [],
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
        trial_started_at: profileResult.data.trial_started_at,
        words_used_this_month: profileResult.data.words_used_this_month || 0,
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

    // Load recent transcripts (only first 20 for initial load)
    let recentTranscripts: UITranscriptEntry[] = [];
    let totalTranscriptCount = 0;
    const transcriptsResult = await this.supabaseService.getTranscripts(20, 0);
    if (transcriptsResult.data && !transcriptsResult.error) {
      // Handle the new paginated response format
      const { transcripts: transcriptsData, totalCount } =
        transcriptsResult.data;
      totalTranscriptCount = totalCount || 0;

      if (Array.isArray(transcriptsData)) {
        recentTranscripts = transcriptsData.map(
          this.convertDatabaseTranscriptToUI
        );
      }
    } else {
      console.warn(
        `[DataLoader] Failed to load transcripts, using empty array:`,
        transcriptsResult.error?.message
      );
    }

    // Load dictionary entries
    let dictionaryEntries: DictionaryEntry[] = [];
    const dictionaryResult = await this.supabaseService.getDictionaryEntries();
    if (dictionaryResult.data && !dictionaryResult.error) {
      dictionaryEntries = dictionaryResult.data;
    } else {
      console.warn(
        `[DataLoader] Failed to load dictionary entries, using empty array:`,
        dictionaryResult.error?.message
      );
    }

    console.log(`[DataLoader] Database loading complete for user: ${userId}`, {
      hasUser: !!user,
      settingsKeys: Object.keys(settings),
      statsTotal: statistics.totalWordCount,
      transcriptCount: recentTranscripts.length,
      totalTranscriptCount,
      dictionaryEntriesCount: dictionaryEntries.length,
    });

    return {
      user,
      authenticated: true,
      settings,
      statistics,
      recentTranscripts,
      totalTranscriptCount,
      dictionaryEntries,
    };
  }

  /**
   * Convert database transcript to UI transcript format
   */
  private convertDatabaseTranscriptToUI(
    dbTranscript: DatabaseTranscriptEntry
  ): UITranscriptEntry {
    return {
      id: dbTranscript.id,
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
      audioFilePath: dbTranscript.audio_file_path,
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
  ): Promise<{ success: boolean; error?: string; transcriptId?: string }> {
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
      return { success: true, transcriptId: result.data.id };
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
   * Get current user data from cache
   */
  getCurrentUser(): UserRecord | null {
    return this.cacheService.getUser();
  }

  /**
   * Get transcripts with pagination (for UI pagination)
   * Implements cache-first strategy: check cache first, DB on miss
   * 
   * Strategy:
   * 1. Check if requested page is already in cache
   * 2. If cache hit: return cached data (no DB call)
   * 3. If cache miss: fetch from DB, update cache, return data
   */
  async getTranscripts(limit = 20, offset = 0): Promise<{
    data: { transcripts: UITranscriptEntry[]; totalCount: number } | null;
    error: any;
  }> {
    try {
      console.log(`[DataLoader] Getting paginated transcripts: limit=${limit}, offset=${offset}`);
      
      // Step 1: Check cache first (cache-first strategy)
      const cachedTranscripts = this.cacheService.getRecentTranscripts();
      const totalCount = this.cacheService.getTotalTranscriptCount() || 0;
      
      // Calculate if we have the requested page in cache
      const startIndex = offset;
      const endIndex = offset + limit;
      const hasRequestedPageInCache = cachedTranscripts.length >= endIndex;
      
      if (hasRequestedPageInCache && totalCount > 0) {
        // Cache hit - return data from cache
        const requestedTranscripts = cachedTranscripts.slice(startIndex, endIndex);
        console.log(`[DataLoader] Cache hit! Serving ${requestedTranscripts.length} transcripts from cache (offset=${offset})`);
        
        return {
          data: {
            transcripts: requestedTranscripts,
            totalCount
          },
          error: null
        };
      }
      
      // Step 2: Cache miss - fetch from database
      console.log(`[DataLoader] Cache miss. Fetching from DB (cached: ${cachedTranscripts.length}, needed: ${endIndex})`);
      
      const result = await this.supabaseService.getTranscripts(limit, offset);
      if (result.error) {
        return { data: null, error: result.error };
      }

      if (result.data) {
        const { transcripts: dbTranscripts, totalCount: dbTotalCount } = result.data;
        const uiTranscripts = dbTranscripts.map(this.convertDatabaseTranscriptToUI);
        
        // Step 3: Update cache with new data
        if (offset === 0) {
          // First page - replace cache completely
          this.cacheService.setRecentTranscripts(uiTranscripts);
          this.cacheService.setTotalTranscriptCount(dbTotalCount);
          console.log(`[DataLoader] Cache replaced with ${uiTranscripts.length} transcripts (first page)`);
        } else {
          // Subsequent pages - merge with existing cache
          const existingTranscripts = this.cacheService.getRecentTranscripts();
          const mergedTranscripts = [...existingTranscripts, ...uiTranscripts];
          
          // Keep only unique transcripts (in case of overlap)
          const uniqueTranscripts = mergedTranscripts.filter((transcript, index, arr) => 
            arr.findIndex(t => t.id === transcript.id) === index
          );
          
          // Update cache with expanded transcript list (keep reasonable limit)
          this.cacheService.setRecentTranscripts(uniqueTranscripts.slice(0, 100));
          this.cacheService.setTotalTranscriptCount(dbTotalCount);
          console.log(`[DataLoader] Cache expanded to ${uniqueTranscripts.length} transcripts (added page ${Math.floor(offset/limit) + 1})`);
        }
        
        return {
          data: {
            transcripts: uiTranscripts,
            totalCount: dbTotalCount
          },
          error: null
        };
      }

      return { data: null, error: new Error("No data returned from database") };
    } catch (error) {
      console.error(`[DataLoader] Error getting transcripts:`, error);
      return { data: null, error };
    }
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
   * Get the SupabaseService instance for other services
   */
  getSupabaseService(): SupabaseService {
    return this.supabaseService;
  }

  /**
   * Update transcript audio file path in database and cache
   */
  async updateTranscriptAudioPath(transcriptId: string, audioFilePath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`[DataLoader] Updating transcript audio path: ${transcriptId} -> ${audioFilePath}`);

      // Update database first (database is source of truth)
      const { data, error } = await this.supabaseService.updateTranscriptAudioPath(transcriptId, audioFilePath);

      if (error) {
        console.error("[DataLoader] Failed to update transcript audio path in database:", error);
        return { success: false, error: error.message };
      }

      // Update cache after successful database update
      if (data) {
        const cachedTranscripts = this.cacheService.getRecentTranscripts();
        if (cachedTranscripts && cachedTranscripts.length > 0) {
          const transcriptIndex = cachedTranscripts.findIndex(t => t.id === transcriptId);
          if (transcriptIndex !== -1) {
            cachedTranscripts[transcriptIndex].audioFilePath = audioFilePath;
            this.cacheService.setRecentTranscripts(cachedTranscripts);
            console.log(`[DataLoader] Updated transcript audio path in cache for: ${transcriptId}`);
          }
        }
      }

      console.log(`[DataLoader] Successfully updated transcript audio path: ${transcriptId}`);
      return { success: true };
    } catch (error) {
      console.error("[DataLoader] Exception updating transcript audio path:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Download audio file for a transcript
   */
  async downloadAudio(audioFilePath: string): Promise<{
    success: boolean;
    data?: Buffer;
    error?: string;
  }> {
    try {
      console.log(`[DataLoader] Downloading audio file: ${audioFilePath}`);

      const { data, error } = await this.supabaseService.getClient()
        .storage
        .from("audio-recordings")
        .download(audioFilePath);

      if (error) {
        console.error("[DataLoader] Audio download error:", error);
        return { success: false, error: error.message };
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      console.log(`[DataLoader] Audio download successful: ${buffer.length} bytes`);
      
      return { success: true, data: buffer };
    } catch (error) {
      console.error("[DataLoader] Audio download exception:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
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
      totalTranscriptCount: cacheData.totalTranscriptCount,
      dictionaryEntries: cacheData.dictionaryEntries,
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
          totalTranscriptCount: cachedData.totalTranscriptCount,
          dictionaryEntries: cachedData.dictionaryEntries,
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

  /**
   * Update user's monthly word usage
   * Increments the word count and updates both database and cache
   */
  async updateWordUsage(additionalWords: number): Promise<{
    success: boolean;
    error?: string;
    data?: { wordsUsed: number; limit: number };
  }> {
    try {
      console.log(`[DataLoader] Updating word usage: +${additionalWords} words`);
      
      const cachedData = this.cacheService.getAllUserData();
      if (!cachedData || !cachedData.user) {
        throw new Error("No cached user data available for word usage update");
      }

      const currentWordsUsed = cachedData.user.words_used_this_month || 0;
      const newWordsUsed = currentWordsUsed + additionalWords;

      // Update in database first
      const updateResult = await this.supabaseService.updateUserWordUsage(newWordsUsed);
      if (!updateResult.success) {
        throw new Error(updateResult.error || "Failed to update word usage in database");
      }

      // Update cache
      const updatedUser: UserRecord = {
        ...cachedData.user,
        words_used_this_month: newWordsUsed,
      };

      this.cacheService.setAllUserData({
        ...cachedData,
        user: updatedUser,
      });

      console.log(`[DataLoader] Word usage updated: ${currentWordsUsed} -> ${newWordsUsed}`);

      return {
        success: true,
        data: { wordsUsed: newWordsUsed, limit: 2000 } // Free tier limit
      };
    } catch (error) {
      console.error(`[DataLoader] Failed to update word usage:`, error);
      return {
        success: false,
        error: `Failed to update word usage: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Start a pro trial for the user
   * Updates subscription tier to pro_trial and sets trial start date
   */
  async startProTrial(): Promise<{
    success: boolean;
    error?: string;
    data?: UserRecord;
  }> {
    try {
      console.log(`[DataLoader] Starting pro trial`);
      
      const cachedData = this.cacheService.getAllUserData();
      if (!cachedData || !cachedData.user) {
        throw new Error("No cached user data available for trial start");
      }

      // Check if user already has pro or is on trial
      if (cachedData.user.subscription_tier === "pro" || cachedData.user.subscription_tier === "pro_trial") {
        throw new Error("User already has pro access or is on trial");
      }

      const trialStartDate = new Date().toISOString();

      // Update in database first
      const updateResult = await this.supabaseService.updateUserSubscription("pro_trial", trialStartDate);
      if (!updateResult.success) {
        throw new Error(updateResult.error || "Failed to start trial in database");
      }

      // Update cache
      const updatedUser: UserRecord = {
        ...cachedData.user,
        subscription_tier: "pro_trial",
        trial_started_at: trialStartDate,
      };

      this.cacheService.setAllUserData({
        ...cachedData,
        user: updatedUser,
      });

      console.log(`[DataLoader] Pro trial started successfully`);

      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      console.error(`[DataLoader] Failed to start pro trial:`, error);
      return {
        success: false,
        error: `Failed to start pro trial: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Update user's subscription tier
   * Updates both database and cache
   */
  async updateSubscriptionTier(tier: "free" | "pro_trial" | "pro"): Promise<{
    success: boolean;
    error?: string;
    data?: UserRecord;
  }> {
    try {
      console.log(`[DataLoader] Updating subscription tier to: ${tier}`);
      
      const cachedData = this.cacheService.getAllUserData();
      if (!cachedData || !cachedData.user) {
        throw new Error("No cached user data available for subscription update");
      }

      // Update in database first
      const updateResult = await this.supabaseService.updateUserSubscription(tier);
      if (!updateResult.success) {
        throw new Error(updateResult.error || "Failed to update subscription in database");
      }

      // Update cache
      const updatedUser: UserRecord = {
        ...cachedData.user,
        subscription_tier: tier,
        // Clear trial data if moving away from trial
        trial_started_at: tier === "pro_trial" ? cachedData.user.trial_started_at : undefined,
        // Reset word usage if upgrading to pro
        words_used_this_month: tier === "pro" ? 0 : cachedData.user.words_used_this_month,
      };

      this.cacheService.setAllUserData({
        ...cachedData,
        user: updatedUser,
      });

      console.log(`[DataLoader] Subscription tier updated successfully to: ${tier}`);

      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      console.error(`[DataLoader] Failed to update subscription tier:`, error);
      return {
        success: false,
        error: `Failed to update subscription tier: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Reset monthly word usage (typically called at the start of each month)
   */
  async resetMonthlyWordUsage(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`[DataLoader] Resetting monthly word usage`);
      
      const cachedData = this.cacheService.getAllUserData();
      if (!cachedData || !cachedData.user) {
        throw new Error("No cached user data available for word usage reset");
      }

      // Update in database first
      const updateResult = await this.supabaseService.updateUserWordUsage(0);
      if (!updateResult.success) {
        throw new Error(updateResult.error || "Failed to reset word usage in database");
      }

      // Update cache
      const updatedUser: UserRecord = {
        ...cachedData.user,
        words_used_this_month: 0,
      };

      this.cacheService.setAllUserData({
        ...cachedData,
        user: updatedUser,
      });

      console.log(`[DataLoader] Monthly word usage reset successfully`);

      return { success: true };
    } catch (error) {
      console.error(`[DataLoader] Failed to reset monthly word usage:`, error);
      return {
        success: false,
        error: `Failed to reset word usage: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
