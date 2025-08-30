import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from "@supabase/supabase-js";
import Store from "electron-store";
import {
  UserRecord,
  DatabaseTranscriptEntry,
  UserSettings,
} from "../../shared/types";

// Re-export for backward compatibility
export type TranscriptEntry = DatabaseTranscriptEntry;

export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private sessionStore: Store;
  private onAuthStateChangeCallback?: (user: User | null) => void;
  private onSessionRestorationStatusCallback?: (
    status: "starting" | "completed",
    user?: User | null
  ) => void;
  private sessionRestorationPromise: Promise<void> | null = null;
  private isSessionRestored: boolean = false;
  private tempUserName: string | null = null; // Store name for magic link signup

  constructor() {
    // Import centralized config
    // const { config } = require("../../../config/environment");

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

    // Try to restore session on startup and track completion
    this.sessionRestorationPromise = this.restoreSession();
  }

  private async restoreSession() {
    try {
      console.log("SupabaseService: Starting session restoration...");

      // Notify that restoration is starting
      if (this.onSessionRestorationStatusCallback) {
        this.onSessionRestorationStatusCallback("starting");
      }

      const storedSession = this.sessionStore.get("session") as Session | null;

      if (storedSession) {
        console.log(
          "SupabaseService: Found stored session, attempting to restore..."
        );
        const { data, error } = await this.supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        if (data.session && data.user && !error) {
          this.currentSession = data.session;
          this.currentUser = data.user;
          console.log(
            "SupabaseService: Session restored successfully for user:",
            data.user.email
          );
          // Don't notify auth state change immediately - wait for profile data to be loaded in main process
        } else {
          // Clear invalid session
          console.log(
            "SupabaseService: Stored session is invalid, clearing...",
            error?.message
          );
          this.clearStoredSession();
        }
      } else {
        console.log("SupabaseService: No stored session found");
      }
    } catch (error) {
      console.error("SupabaseService: Failed to restore session:", error);
      this.clearStoredSession();
    } finally {
      this.isSessionRestored = true;
      console.log(
        "SupabaseService: Session restoration completed. User authenticated:",
        !!this.currentUser
      );

      // Notify that restoration is complete (with or without user)
      if (this.onSessionRestorationStatusCallback) {
        this.onSessionRestorationStatusCallback("completed", this.currentUser);
      }
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

    if (this.onAuthStateChangeCallback) {
      this.onAuthStateChangeCallback(user);
    }
  }

  // Set auth state change listener
  setAuthStateChangeListener(callback: (user: User | null) => void) {
    this.onAuthStateChangeCallback = callback;
  }

  // Set session restoration status listener
  setSessionRestorationStatusListener(
    callback: (status: "starting" | "completed", user?: User | null) => void
  ) {
    this.onSessionRestorationStatusCallback = callback;
  }

  // Magic Link Authentication methods
  async signInWithMagicLink(email: string) {
    try {
      console.log("SupabaseService: Sending magic link for sign in to:", email);

      const { data, error } = await this.supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: "http://localhost:8080/oauth-success",
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
          emailRedirectTo: "http://localhost:8080/oauth-success",
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
          redirectTo: "http://localhost:8080/oauth-success",
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

  // Check if session restoration has completed
  isSessionRestorationComplete() {
    return this.isSessionRestored;
  }

  // Wait for session restoration to complete
  async waitForSessionRestoration() {
    if (this.sessionRestorationPromise) {
      await this.sessionRestorationPromise;
    }
    return this.isSessionRestored;
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
  async saveTranscript(transcript: Omit<TranscriptEntry, "id" | "created_at">) {
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

  async getTranscripts(limit = 50) {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      const { data, error } = await this.supabase
        .from("transcripts")
        .select("*")
        .eq("user_id", this.currentUser.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Get transcripts error:", error);
      return { data: null as any, error };
    }
  }

  async saveUserSettings(settings: UserSettings["settings"]) {
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
            settings,
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

  async getUserSettings() {
    if (!this.currentUser) {
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log(
        "SupabaseService: Getting user settings for:",
        this.currentUser.id
      );

      const { data, error } = await this.supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", this.currentUser.id)
        .single();

      if (error) {
        console.log(
          "SupabaseService: Get user settings error:",
          error?.message
        );
      } else {
        console.log("SupabaseService: Settings retrieved successfully:", {
          hasData: !!data,
          settingsKeys: data?.settings ? Object.keys(data.settings) : [],
        });
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Get user settings error:", error);
      return { data: null as any, error };
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

      // Default settings based on electron store defaults
      const defaultSettings = {
        // General section
        defaultMicrophone: "default",
        language: "auto",

        // System section
        dictateSoundEffects: true,
        muteMusicWhileDictating: true,

        // Personalization section
        outputMode: "both" as const,
        useAI: true,
        enableTranslation: false,
        targetLanguage: "en",
        enableContextFormatting: true,

        // Data and Privacy section
        privacyMode: true,
      };

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

  async getUserStats() {
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

      // First, mark onboarding as completed
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

      // Create initial user settings
      console.log(
        "SupabaseService: Creating initial settings for completed onboarding"
      );
      const settingsResult = await this.createInitialUserSettings();

      if (settingsResult.error) {
        console.warn(
          "SupabaseService: Failed to create initial settings:",
          settingsResult.error?.message
        );
        // Don't fail the onboarding completion if settings creation fails
        // The settings will be created later when first accessed
      } else {
        console.log("SupabaseService: Initial settings created successfully");
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Complete onboarding error:", error);
      return { data: null as any, error };
    }
  }
}
