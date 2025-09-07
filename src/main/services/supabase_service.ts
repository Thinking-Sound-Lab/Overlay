import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from "@supabase/supabase-js";
import Store from "electron-store";
import {
  DatabaseTranscriptEntry,
  Settings,
  UserStats,
} from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/constants/default-settings";

export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private sessionStore: Store;
  private tempUserName: string | null = null; // Store name for magic link signup
  private authStateChangeCallback?: (user: User | null) => void;
  private isInitialRestorationComplete = false;

  constructor() {
    console.log("SupabaseService: Initializing with config:", {
      url: process.env.REACT_APP_SUPABASE_URL,
      keyLength: process.env.REACT_APP_SUPABASE_ANON_KEY?.length,
      hasUrl: !!process.env.REACT_APP_SUPABASE_URL,
      hasKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
    });

    if (
      !process.env.REACT_APP_SUPABASE_URL ||
      !process.env.REACT_APP_SUPABASE_ANON_KEY
    ) {
      throw new Error(
        "Supabase configuration missing. Check environment variables."
      );
    }

    this.supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_ANON_KEY
    );
    this.sessionStore = new Store<any>({
      name: "supabase-session",
      defaults: {
        session: null,
        user: null,
      },
    });

    // Set up native Supabase auth state change listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log(`SupabaseService: Auth state changed: ${event}`, {
        hasSession: !!session,
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
      });

      if (session?.user) {
        // Store session for persistence and update current state
        this.currentSession = session;
        this.currentUser = session.user;
        this.storeSession(session, session.user);

        // Notify auth state change
        this.notifyAuthStateChange(session.user);
      } else {
        // Clear session and notify sign out
        this.clearStoredSession();
        this.notifyAuthStateChange(null);
      }
    });

    // Try to restore session from storage on startup
    this.attemptSessionRestore();
  }

  private async attemptSessionRestore() {
    try {
      console.log(
        "SupabaseService: Attempting to restore session from storage..."
      );

      const storedSession = this.sessionStore.get("session") as Session | null;

      if (storedSession) {
        console.log("SupabaseService: Found stored session, restoring...");

        // Use setSession to restore - onAuthStateChange will handle the validation
        await this.supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        // onAuthStateChange listener will handle success/failure automatically
      } else {
        console.log("SupabaseService: No stored session found");
      }
    } catch (error) {
      console.error("SupabaseService: Failed to restore session:", error);
      this.clearStoredSession();
    } finally {
      // Mark initial restoration as complete
      this.isInitialRestorationComplete = true;
      console.log("SupabaseService: Initial session restoration completed", {
        hasUser: !!this.currentUser,
        hasSession: !!this.currentSession,
        userEmail: this.currentUser?.email,
      });
    }
  }

  private storeSession(session: Session, user: User) {
    this.sessionStore.set("session", session);
    this.sessionStore.set("user", user);
    this.currentSession = session;
    this.currentUser = user;
  }

  // Public method for OAuth token-based session creation (implicit flow)
  public async setSessionWithTokens(accessToken: string, refreshToken: string) {
    try {
      console.log("SupabaseService: Creating session with OAuth tokens...");
      const { data, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (data.session && data.user && !error) {
        console.log(
          "SupabaseService: OAuth token session creation successful for user:",
          data.user.email
        );
        this.storeSession(data.session, data.user);
        await this.notifyAuthStateChange(data.user);
      }

      return { data, error };
    } catch (error) {
      console.error(
        "SupabaseService: Error creating session with tokens:",
        error
      );
      return { data: null as any, error };
    }
  }

  private clearStoredSession() {
    this.sessionStore.delete("session");
    this.sessionStore.delete("user");
    this.currentSession = null;
    this.currentUser = null;
  }

  private async notifyAuthStateChange(user: User | null) {
    // If we have a newly authenticated user and a stored name, update their profile
    if (user && this.tempUserName) {
      console.log(
        "SupabaseService: New user authenticated with stored name, updating profile"
      );
      try {
        const { error } = await this.supabase.auth.updateUser({
          data: {
            full_name: this.tempUserName,
            name: this.tempUserName,
          },
        });

        if (error) {
          console.error(
            "SupabaseService: Failed to update user profile:",
            error
          );
        } else {
          console.log(
            "SupabaseService: Successfully updated user profile with name:",
            this.tempUserName
          );
        }
      } catch (error) {
        console.error("SupabaseService: Error updating user profile:", error);
      } finally {
        // Clear the temporary name
        this.tempUserName = null;
      }
    }

    // Notify main process about auth state change
    if (this.authStateChangeCallback) {
      this.authStateChangeCallback(user);
    }
  }

  // Set callback for auth state changes (called by main process)
  setAuthStateChangeCallback(callback: (user: User | null) => void) {
    this.authStateChangeCallback = callback;
  }

  // Magic Link Authentication methods
  async signInWithMagicLink(email: string) {
    try {
      console.log("SupabaseService: Sending magic link for sign in to:", email);

      const { data, error } = await this.supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: "https://overlay-beta.vercel.app/oauth-success.html",
          shouldCreateUser: false, // Don't create user for sign in
        },
      });

      if (error) {
        console.error("SupabaseService: Magic link sign in error:", error);
      } else {
        console.log(
          "SupabaseService: Magic link sent successfully for sign in"
        );
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Magic link sign in error:", error);
      return { data: null as any, error };
    }
  }

  async signUpWithMagicLink(email: string, name: string) {
    try {
      console.log(
        "SupabaseService: Sending magic link for sign up to:",
        email,
        "with name:",
        name
      );

      // Store the name temporarily for post-authentication profile update
      this.tempUserName = name;

      const { data, error } = await this.supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: "https://overlay-beta.vercel.app/oauth-success.html",
          shouldCreateUser: true, // Allow user creation for sign up
        },
      });

      if (error) {
        console.error("SupabaseService: Magic link sign up error:", error);
        this.tempUserName = null; // Clear on error
      } else {
        console.log(
          "SupabaseService: Magic link sent successfully for sign up"
        );
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Magic link sign up error:", error);
      this.tempUserName = null; // Clear on error
      return { data: null as any, error };
    }
  }


  async signInWithGoogle() {
    try {
      console.log(
        "SupabaseService: Initiating Google OAuth with custom protocol..."
      );

      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://overlay-beta.vercel.app/oauth-success.html",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      console.log("SupabaseService: Google OAuth initiation result:", {
        success: !!data.url,
        hasError: !!error,
        errorMessage: error?.message,
      });

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Google sign in error:", error);
      return { data: null as any, error };
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();

      this.clearStoredSession();
      await this.notifyAuthStateChange(null);

      return { error };
    } catch (error) {
      console.error("SupabaseService: Sign out error:", error);
      return { error };
    }
  }

  async deleteAccount() {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      // First, delete user's data in the correct order
      const userId = this.currentUser.id;

      // Delete user settings
      const { error: settingsError } = await this.supabase
        .from("user_settings")
        .delete()
        .eq("user_id", userId);

      if (settingsError) {
        console.error("Failed to delete user settings:", settingsError);
      }

      // Delete user transcripts
      const { error: transcriptsError } = await this.supabase
        .from("transcripts")
        .delete()
        .eq("user_id", userId);

      if (transcriptsError) {
        console.error("Failed to delete user transcripts:", transcriptsError);
      }

      // Delete user profile
      const { error: profileError } = await this.supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId);

      if (profileError) {
        console.error("Failed to delete user profile:", profileError);
      }

      // Finally, delete the auth user (this requires RPC or admin privileges)
      // Since we can't delete auth users from client side, we'll call a custom function
      const { error: deleteUserError } = await this.supabase.rpc(
        "delete_user_account"
      );

      if (deleteUserError) {
        // If the RPC function doesn't exist, we'll just sign out
        // The user deletion will need to be handled by an admin or Edge Function
        console.warn(
          "Could not delete auth user, signing out instead:",
          deleteUserError
        );
        await this.signOut();
        return {
          data: {
            message:
              "Account data deleted, but auth record remains. Contact support for complete deletion.",
          },
          error: null,
        };
      }

      // Clear session and notify
      this.clearStoredSession();
      await this.notifyAuthStateChange(null);

      return { data: { message: "Account successfully deleted" }, error: null };
    } catch (error) {
      console.error("SupabaseService: Delete account error:", error);
      return { data: null as any, error };
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  // Check if initial session restoration has completed
  isSessionRestorationComplete() {
    return this.isInitialRestorationComplete;
  }

  async getUserProfile() {
    if (!this.currentUser) {
      console.error(
        "SupabaseService: getUserProfile called but no current user"
      );
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log(
        "SupabaseService: Getting user profile for user ID:",
        this.currentUser.id
      );

      const { data, error } = await this.supabase
        .from("user_profiles")
        .select("*")
        .eq("id", this.currentUser.id)
        .single();

      console.log(
        "SupabaseService: Profile query result - data:",
        data,
        "error:",
        error?.message
      );

      if (error && error.code === "PGRST116") {
        // No rows found - profile doesn't exist, let's create it
        console.log(
          "SupabaseService: Profile not found, attempting to create one"
        );
        return await this.createUserProfile();
      }

      if (error) {
        console.error(
          "SupabaseService: Database error getting user profile:",
          error
        );
      }

      if (!data) {
        console.warn(
          "SupabaseService: No profile found in database for user:",
          this.currentUser.id
        );
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Get user profile error:", error);
      return { data: null as any, error };
    }
  }

  async createUserProfile() {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log(
        "SupabaseService: Creating user profile for user:",
        this.currentUser.id
      );

      // Extract name from user metadata or use email prefix with robust fallback
      let userName = "";

      // Try full_name first
      if (this.currentUser.user_metadata?.full_name?.trim()) {
        userName = this.currentUser.user_metadata.full_name.trim();
      }
      // Then try name
      else if (this.currentUser.user_metadata?.name?.trim()) {
        userName = this.currentUser.user_metadata.name.trim();
      }
      // Then email prefix
      else if (this.currentUser.email) {
        userName = this.currentUser.email.split("@")[0];
      }
      // Final fallback
      else {
        userName = "User";
      }

      // Ensure we never have an empty string
      if (!userName || userName.trim() === "") {
        userName = "User";
      }

      console.log("SupabaseService: Creating profile with name:", userName);

      const { data, error } = await this.supabase
        .from("user_profiles")
        .insert({
          id: this.currentUser.id,
          name: userName,
          subscription_tier: "free",
          onboarding_completed: false,
          email: this.currentUser.email,
        })
        .select()
        .single();

      console.log(
        "SupabaseService: Profile creation result - data:",
        data,
        "error:",
        error?.message
      );

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Create user profile error:", error);
      return { data: null as any, error };
    }
  }

  // Database operations
  async saveTranscript(
    transcript: Omit<DatabaseTranscriptEntry, "id" | "created_at">
  ) {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      const { data, error } = await this.supabase
        .from("transcripts")
        .insert([transcript])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Save transcript error:", error);
      return { data: null as any, error };
    }
  }

  async getTranscripts(limit = 20, offset = 0) {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      // Get paginated transcripts
      const { data: transcripts, error: transcriptsError } = await this.supabase
        .from("transcripts")
        .select("*")
        .eq("user_id", this.currentUser.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (transcriptsError) {
        return { data: null, error: transcriptsError };
      }

      // Get total count for pagination info
      const { count: totalCount, error: countError } = await this.supabase
        .from("transcripts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", this.currentUser.id);

      if (countError) {
        return { data: null, error: countError };
      }

      // Return both transcripts and total count
      return {
        data: {
          transcripts: transcripts || [],
          totalCount: totalCount || 0,
        },
        error: null,
      };
    } catch (error) {
      console.error("SupabaseService: Get transcripts error:", error);
      return { data: null as any, error };
    }
  }

  async saveUserSettings(settings: Settings) {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log("SupabaseService: Saving user settings:", {
        userId: this.currentUser.id,
        settingsKeys: Object.keys(settings),
        settings,
      });

      const { data, error } = await this.supabase
        .from("user_settings")
        .upsert([
          {
            user_id: this.currentUser.id,
            settings: settings,
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("SupabaseService: Save user settings error:", error);
      } else {
        console.log("SupabaseService: Settings saved successfully:", data);
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Save user settings error:", error);
      return { data: null as any, error };
    }
  }

  async getUserSettings(): Promise<{
    data: Settings | null;
    error: Error | null;
  }> {
    // Maintain proper authentication boundary
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log(
        "SupabaseService: Getting user settings from database for:",
        this.currentUser.id
      );

      // Simple database fetch - caching handled by unified CacheService
      const { data, error } = await this.supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", this.currentUser.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No settings found - return null (not an error)
          console.log(
            "SupabaseService: No user settings found, user will get defaults"
          );
          return { data: null, error: null };
        }
        throw error;
      }

      console.log(
        "SupabaseService: Successfully retrieved user settings from database"
      );
      return { data: data?.settings || null, error: null };
    } catch (error) {
      console.error("SupabaseService: Get user settings error:", error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async createInitialUserSettings() {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log(
        "SupabaseService: Creating initial user settings for:",
        this.currentUser.id
      );

      // Use shared default settings constants
      const defaultSettings = DEFAULT_SETTINGS;

      const { data, error } = await this.supabase
        .from("user_settings")
        .insert([
          {
            user_id: this.currentUser.id,
            settings: defaultSettings,
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("SupabaseService: Create initial settings error:", error);
      } else {
        console.log(
          "SupabaseService: Initial settings created successfully:",
          data
        );
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Create initial settings error:", error);
      return { data: null as any, error };
    }
  }

  async getUserStats(): Promise<{ data: UserStats | null; error: any }> {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      const { data: transcripts, error } = await this.supabase
        .from("transcripts")
        .select("word_count, wpm, created_at")
        .eq("user_id", this.currentUser.id);

      if (error) return { data: null, error };

      const totalWordCount =
        transcripts?.reduce((sum, t) => sum + t.word_count, 0) || 0;
      const averageWPM = transcripts?.length
        ? transcripts.reduce((sum, t) => sum + t.wpm, 0) / transcripts.length
        : 0;
      const totalRecordings = transcripts?.length || 0;

      // Calculate streak days with robust error handling
      let streakDays = 0;
      try {
        if (!transcripts || transcripts.length === 0) {
          console.log(
            "SupabaseService: No transcripts found for streak calculation"
          );
          streakDays = 0;
        } else {
          // Extract and validate dates with proper normalization
          const validDates = transcripts
            .map((t) => {
              if (!t.created_at) {
                console.warn(
                  "SupabaseService: Transcript missing created_at field"
                );
                return null;
              }
              try {
                // Normalize to start of day in local timezone for consistent comparison
                const date = new Date(t.created_at);
                const normalizedDate = new Date(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate()
                );
                return normalizedDate;
              } catch (error) {
                console.warn(
                  "SupabaseService: Invalid date in transcript:",
                  t.created_at
                );
                return null;
              }
            })
            .filter((date): date is Date => date !== null);

          console.log(
            `SupabaseService: Found ${validDates.length} valid transcript dates from ${transcripts.length} transcripts`
          );

          if (validDates.length === 0) {
            console.warn(
              "SupabaseService: No valid dates found in transcripts"
            );
            streakDays = 0;
          } else {
            // Get unique dates and sort chronologically (newest first)
            const uniqueDateTimes = Array.from(
              new Set(validDates.map((d) => d.getTime()))
            );
            const uniqueDates = uniqueDateTimes
              .map((time) => new Date(time))
              .sort((a, b) => b.getTime() - a.getTime()); // Newest first

            const uniqueDateStrings = uniqueDates.map((d) => d.toDateString());
            console.log(
              `SupabaseService: Calculating streak from ${uniqueDates.length} unique dates:`,
              uniqueDateStrings
            );

            // Normalize today and yesterday for consistent comparison
            const today = new Date();
            const todayNormalized = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate()
            );
            const yesterdayNormalized = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() - 1
            );

            // Check if there's activity today or yesterday to maintain streak
            const hasActivityToday = uniqueDates.some(
              (date) => date.getTime() === todayNormalized.getTime()
            );
            const hasActivityYesterday = uniqueDates.some(
              (date) => date.getTime() === yesterdayNormalized.getTime()
            );

            console.log(
              "SupabaseService: Activity check -",
              "Today (" + todayNormalized.toDateString() + "):",
              hasActivityToday,
              "Yesterday (" + yesterdayNormalized.toDateString() + "):",
              hasActivityYesterday
            );

            // Only count streak if there's recent activity (today or yesterday)
            if (hasActivityToday || hasActivityYesterday) {
              let checkDate = todayNormalized;

              // If no activity today, start checking from yesterday
              if (!hasActivityToday && hasActivityYesterday) {
                checkDate = yesterdayNormalized;
              }

              console.log(
                `SupabaseService: Starting streak count from ${checkDate.toDateString()}`
              );

              // Count consecutive days
              for (const activityDate of uniqueDates) {
                console.log(
                  `SupabaseService: Checking ${activityDate.toDateString()} against expected ${checkDate.toDateString()}`
                );

                if (activityDate.getTime() === checkDate.getTime()) {
                  streakDays++;
                  console.log(
                    `SupabaseService: Streak day ${streakDays} - ${activityDate.toDateString()}`
                  );
                  // Move to previous day for next iteration
                  checkDate = new Date(
                    checkDate.getFullYear(),
                    checkDate.getMonth(),
                    checkDate.getDate() - 1
                  );
                } else {
                  // Gap found, stop counting
                  console.log(
                    `SupabaseService: Streak broken - found ${activityDate.toDateString()}, expected ${checkDate.toDateString()}`
                  );
                  break;
                }
              }
            } else {
              console.log(
                "SupabaseService: No recent activity (today or yesterday), streak reset to 0"
              );
            }
          }
        }
      } catch (error) {
        console.error("SupabaseService: Error calculating streak days:", error);
        streakDays = 0;
      }

      console.log(
        `SupabaseService: Final streak calculation result: ${streakDays} days`
      );

      return {
        data: {
          totalWordCount,
          averageWPM,
          totalRecordings,
          streakDays,
        },
        error: null as any,
      };
    } catch (error) {
      console.error("SupabaseService: Get user stats error:", error);
      return { data: null as any, error };
    }
  }

  async completeOnboarding() {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log(
        "SupabaseService: Marking onboarding as completed for user:",
        this.currentUser.id
      );

      const { data, error } = await this.supabase
        .from("user_profiles")
        .update({ onboarding_completed: true })
        .eq("id", this.currentUser.id)
        .select()
        .single();

      if (error) {
        console.error(
          "SupabaseService: Failed to mark onboarding complete:",
          error
        );
        return { data, error };
      }

      console.log(
        "SupabaseService: Onboarding completion result - data:",
        data,
        "error:",
        error?.message
      );

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Complete onboarding error:", error);
      return { data: null as any, error };
    }
  }

  /**
   * Clear all Supabase-related cache data
   * Implements CacheableService interface
   */
  clearCache(): void {
    console.log("[SupabaseService] Clearing Supabase cache data...");

    try {
      // Clear stored session data
      this.clearStoredSession();

      // Clear temporary user name
      this.tempUserName = null;

      console.log("[SupabaseService] Cache cleared successfully");
    } catch (error) {
      console.error("[SupabaseService] Error clearing cache:", error);
    }
  }
}
