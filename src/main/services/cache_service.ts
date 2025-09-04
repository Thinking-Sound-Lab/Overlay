/**
 * Simplified Cache Service
 * 
 * Clean caching strategy where database is the single source of truth
 * and electron store is purely for performance.
 * 
 * Flow:
 * 1. On app load: check cache first, DB on miss, update cache
 * 2. On user update: save to DB first, then update cache
 * 3. On logout: clear cache
 */

import Store from "electron-store";
import { Settings, UserStats, UITranscriptEntry } from "../../shared/types";
import { UserRecord } from "../../shared/types/database";
import { DEFAULT_SETTINGS } from "../../shared/constants/default-settings";

interface CacheData {
  // User data
  user: UserRecord | null;
  userSettings: Settings;
  userStats: UserStats;
  recentTranscripts: UITranscriptEntry[];
  
  // Cache metadata
  lastUpdated: number;
  userId: string | null;
}

export class CacheService {
  private static instance: CacheService | null = null;
  private store: Store<CacheData>;

  private constructor() {
    this.store = new Store<CacheData>({
      name: 'user-cache',
      defaults: {
        user: null,
        userSettings: DEFAULT_SETTINGS,
        userStats: {
          totalWordCount: 0,
          averageWPM: 0,
          totalRecordings: 0,
          streakDays: 0,
        },
        recentTranscripts: [],
        lastUpdated: 0,
        userId: null,
      },
    });
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get cached user
   */
  getUser(): UserRecord | null {
    return this.store.get('user');
  }

  /**
   * Set user in cache
   */
  setUser(user: UserRecord | null): void {
    this.store.set('user', user);
    if (user) {
      this.store.set('userId', user.id);
    }
    this.updateLastModified();
  }

  /**
   * Get cached user settings
   */
  getUserSettings(): Settings {
    return this.store.get('userSettings');
  }

  /**
   * Set user settings in cache
   */
  setUserSettings(settings: Settings): void {
    this.store.set('userSettings', settings);
    this.updateLastModified();
  }

  /**
   * Get cached user statistics
   */
  getUserStats(): UserStats {
    return this.store.get('userStats');
  }

  /**
   * Set user statistics in cache
   */
  setUserStats(stats: UserStats): void {
    this.store.set('userStats', stats);
    this.updateLastModified();
  }

  /**
   * Get cached recent transcripts
   */
  getRecentTranscripts(): UITranscriptEntry[] {
    return this.store.get('recentTranscripts');
  }

  /**
   * Set recent transcripts in cache
   */
  setRecentTranscripts(transcripts: UITranscriptEntry[]): void {
    this.store.set('recentTranscripts', transcripts.slice(0, 100)); // Keep only 100 most recent
    this.updateLastModified();
  }

  /**
   * Add a single transcript to cache
   */
  addTranscript(transcript: UITranscriptEntry): void {
    const current = this.getRecentTranscripts();
    const updated = [transcript, ...current].slice(0, 100);
    this.setRecentTranscripts(updated);
  }

  /**
   * Get current cached user ID
   */
  getCachedUserId(): string | null {
    return this.store.get('userId');
  }

  /**
   * Check if cache is for the current user
   */
  isCacheValidForUser(userId: string): boolean {
    const cachedUserId = this.getCachedUserId();
    return cachedUserId === userId;
  }

  /**
   * Check if cache exists and is valid for user
   */
  hasCacheForUser(userId: string): boolean {
    if (!this.isCacheValidForUser(userId)) {
      return false;
    }
    
    const lastUpdated = this.store.get('lastUpdated');
    const user = this.getUser();
    return lastUpdated > 0 && user !== null;
  }

  /**
   * Initialize cache for a new user session
   * Called after successful authentication
   */
  initializeUserCache(userId: string): void {
    // Clear any existing cache data if it's for a different user
    const cachedUserId = this.getCachedUserId();
    if (cachedUserId && cachedUserId !== userId) {
      this.clearUserData();
    }
    
    // Set the user ID
    this.store.set('userId', userId);
    
    console.log(`[CacheService] Initialized cache for user: ${userId}`);
  }

  /**
   * Clear all user-related cache data
   * Called on logout or user change
   */
  clearUserData(): void {
    console.log('[CacheService] Clearing all user cache data...');
    
    this.store.set('user', null);
    this.store.set('userSettings', DEFAULT_SETTINGS);
    this.store.set('userStats', {
      totalWordCount: 0,
      averageWPM: 0,
      totalRecordings: 0,
      streakDays: 0,
    });
    this.store.set('recentTranscripts', []);
    this.store.set('lastUpdated', 0);
    this.store.set('userId', null);
    
    console.log('[CacheService] User cache cleared successfully');
  }

  /**
   * Get all cached user data at once
   * Useful for app initialization
   */
  getAllUserData(): {
    user: UserRecord | null;
    settings: Settings;
    stats: UserStats;
    transcripts: UITranscriptEntry[];
  } {
    return {
      user: this.getUser(),
      settings: this.getUserSettings(),
      stats: this.getUserStats(),
      transcripts: this.getRecentTranscripts(),
    };
  }

  /**
   * Set all user data at once
   * Useful when loading from database
   */
  setAllUserData(data: {
    user?: UserRecord | null;
    settings?: Settings;
    stats?: UserStats;
    transcripts?: UITranscriptEntry[];
  }): void {
    if (data.user !== undefined) {
      this.setUser(data.user);
    }
    if (data.settings !== undefined) {
      this.setUserSettings(data.settings);
    }
    if (data.stats !== undefined) {
      this.setUserStats(data.stats);
    }
    if (data.transcripts !== undefined) {
      this.setRecentTranscripts(data.transcripts);
    }
  }

  /**
   * Get cache debug info
   */
  getCacheInfo(): { 
    userId: string | null; 
    hasUser: boolean; 
    hasSettings: boolean; 
    hasStats: boolean; 
    transcriptCount: number;
  } {
    return {
      userId: this.getCachedUserId(),
      hasUser: !!this.getUser(),
      hasSettings: !!this.getUserSettings(),
      hasStats: !!this.getUserStats(),
      transcriptCount: this.getRecentTranscripts().length,
    };
  }

  private updateLastModified(): void {
    this.store.set('lastUpdated', Date.now());
  }
}