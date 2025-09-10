/**
 * Dictionary Service
 * 
 * Manages dictionary entries for text replacement functionality.
 * Follows the cache-first, database-authoritative pattern from DataLoaderService.
 */

import { CacheService } from "./cache_service";
import { SupabaseService } from "./supabase_service";
import { AnalyticsService } from "./analytics_service";
import { DictionaryEntry } from "../../shared/types/database";

export class DictionaryService {
  private static instance: DictionaryService | null = null;
  private cacheService: CacheService;
  private supabaseService: SupabaseService;
  private analyticsService: AnalyticsService | null = null;

  private constructor(supabaseService: SupabaseService, analyticsService?: AnalyticsService) {
    this.cacheService = CacheService.getInstance();
    this.supabaseService = supabaseService;
    this.analyticsService = analyticsService || null;
  }

  public static getInstance(supabaseService: SupabaseService, analyticsService?: AnalyticsService): DictionaryService {
    if (!DictionaryService.instance) {
      DictionaryService.instance = new DictionaryService(supabaseService, analyticsService);
      console.log("DictionaryService: Instance created");
    }
    return DictionaryService.instance;
  }

  /**
   * Track analytics event only in production
   */
  private trackAnalyticsEvent(event: string, properties?: Record<string, any>): void {
    if (this.analyticsService && process.env.NODE_ENV === 'production') {
      this.analyticsService.track(event, properties);
    }
  }

  /**
   * Get all dictionary entries for the current user
   * Implements cache-first strategy
   */
  async getDictionaryEntries(): Promise<{
    data: DictionaryEntry[] | null;
    error: any;
  }> {
    try {
      console.log("[DictionaryService] Getting dictionary entries");
      
      // Step 1: Check cache first
      const cachedEntries = this.cacheService.getDictionaryEntries();
      if (cachedEntries && cachedEntries.length >= 0) {
        console.log(`[DictionaryService] Cache hit! Serving ${cachedEntries.length} entries from cache`);
        return {
          data: cachedEntries,
          error: null
        };
      }

      // Step 2: Cache miss - fetch from database
      console.log("[DictionaryService] Cache miss. Fetching from database");
      const result = await this.supabaseService.getDictionaryEntries();
      
      if (result.error) {
        return { data: null, error: result.error };
      }

      // Step 3: Update cache with fresh data
      if (result.data) {
        this.cacheService.setDictionaryEntries(result.data);
        console.log(`[DictionaryService] Cache updated with ${result.data.length} entries`);
      }

      // Track analytics for successful dictionary fetch
      this.trackAnalyticsEvent('dictionary_entries_fetched', {
        count: result.data?.length || 0,
        source: 'database'
      });

      return {
        data: result.data || [],
        error: null
      };
    } catch (error) {
      console.error("[DictionaryService] Error getting dictionary entries:", error);
      return { data: null, error };
    }
  }

  /**
   * Add a new dictionary entry
   * Implements DB-first update pattern
   */
  async addDictionaryEntry(
    key: string, 
    value: string
  ): Promise<{ success: boolean; error?: string; data?: DictionaryEntry }> {
    try {
      console.log(`[DictionaryService] Adding dictionary entry: ${key} -> ${value}`);

      // Validate input
      if (!key.trim() || !value.trim()) {
        return {
          success: false,
          error: "Key and value cannot be empty"
        };
      }

      // Step 1: Save to database first
      const result = await this.supabaseService.addDictionaryEntry(key.trim(), value.trim());
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Step 2: Update cache after successful DB save
      if (result.data) {
        this.cacheService.addDictionaryEntry(result.data);
        console.log(`[DictionaryService] Dictionary entry added successfully: ${key}`);
        
        // Track analytics for successful dictionary entry addition
        this.trackAnalyticsEvent('dictionary_entry_added', {
          key_length: key.trim().length,
          value_length: value.trim().length
        });
        
        return { success: true, data: result.data };
      }

      throw new Error("No data returned from database");
    } catch (error) {
      console.error(`[DictionaryService] Failed to add dictionary entry:`, error);
      return {
        success: false,
        error: `Failed to add dictionary entry: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Update an existing dictionary entry
   * Implements DB-first update pattern
   */
  async updateDictionaryEntry(
    id: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; error?: string; data?: DictionaryEntry }> {
    try {
      console.log(`[DictionaryService] Updating dictionary entry: ${id}`);

      // Validate input
      if (!key.trim() || !value.trim()) {
        return {
          success: false,
          error: "Key and value cannot be empty"
        };
      }

      // Step 1: Save to database first
      const result = await this.supabaseService.updateDictionaryEntry(id, key.trim(), value.trim());
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Step 2: Update cache after successful DB save
      if (result.data) {
        this.cacheService.updateDictionaryEntry(result.data);
        console.log(`[DictionaryService] Dictionary entry updated successfully: ${id}`);
        
        // Track analytics for successful dictionary entry update
        this.trackAnalyticsEvent('dictionary_entry_updated', {
          entry_id: id,
          key_length: key.trim().length,
          value_length: value.trim().length
        });
        
        return { success: true, data: result.data };
      }

      throw new Error("No data returned from database");
    } catch (error) {
      console.error(`[DictionaryService] Failed to update dictionary entry:`, error);
      return {
        success: false,
        error: `Failed to update dictionary entry: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Delete a dictionary entry
   * Implements DB-first update pattern
   */
  async deleteDictionaryEntry(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[DictionaryService] Deleting dictionary entry: ${id}`);

      // Step 1: Delete from database first
      const result = await this.supabaseService.deleteDictionaryEntry(id);
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Step 2: Update cache after successful DB delete
      this.cacheService.removeDictionaryEntry(id);
      console.log(`[DictionaryService] Dictionary entry deleted successfully: ${id}`);
      
      // Track analytics for successful dictionary entry deletion
      this.trackAnalyticsEvent('dictionary_entry_deleted', {
        entry_id: id
      });
      
      return { success: true };
    } catch (error) {
      console.error(`[DictionaryService] Failed to delete dictionary entry:`, error);
      return {
        success: false,
        error: `Failed to delete dictionary entry: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Apply dictionary replacements to text
   * This is used by TextInsertionService before inserting text
   */
  async applyDictionaryReplacements(text: string): Promise<string> {
    try {
      // Get dictionary entries from cache (fast operation)
      const cachedEntries = this.cacheService.getDictionaryEntries();
      
      if (!cachedEntries || cachedEntries.length === 0) {
        return text; // No replacements needed
      }

      let processedText = text;
      
      // Apply each dictionary replacement
      // Sort by key length (descending) to handle longer keys first
      const sortedEntries = [...cachedEntries].sort((a, b) => b.key.length - a.key.length);
      
      for (const entry of sortedEntries) {
        // Case-insensitive replacement, but preserve original case of the replacement value
        const regex = new RegExp(`\\b${entry.key}\\b`, 'gi');
        processedText = processedText.replace(regex, entry.value);
      }

      if (processedText !== text) {
        console.log(`[DictionaryService] Applied dictionary replacements to text`);
        console.log(`[DictionaryService] Original: ${text}`);
        console.log(`[DictionaryService] Processed: ${processedText}`);
      }

      return processedText;
    } catch (error) {
      console.error("[DictionaryService] Error applying dictionary replacements:", error);
      // Return original text if replacement fails
      return text;
    }
  }

  /**
   * Clear dictionary cache
   * Used when user signs out
   */
  clearCache(): void {
    console.log("[DictionaryService] Clearing dictionary cache");
    this.cacheService.clearDictionaryEntries();
  }
}

export default DictionaryService;
