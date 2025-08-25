import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from "@supabase/supabase-js";
import Store from "electron-store";

// Database types (moved from renderer)
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  created_at: string;
  subscription_tier: "free" | "pro";
}

export interface TranscriptEntry {
  id: string;
  user_id: string;
  text: string;
  original_text?: string;
  language: string;
  target_language?: string;
  was_translated: boolean;
  confidence?: number;
  word_count: number;
  wpm: number;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface UserSettings {
  user_id: string;
  settings: {
    outputMode?: "auto-insert" | "clipboard" | "both";
    openaiApiKey?: string;
    useAI?: boolean;
    language?: string;
    enableTranslation?: boolean;
    targetLanguage?: string;
  };
  updated_at: string;
}

export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private sessionStore: Store;
  private onAuthStateChangeCallback?: (user: User | null) => void;
  private sessionRestorationPromise: Promise<void> | null = null;
  private isSessionRestored: boolean = false;

  constructor() {
    // Import centralized config
    const { config } = require("../../../config/environment");

    console.log("SupabaseService: Initializing with config:", {
      url: config.supabaseUrl,
      keyLength: config.supabaseAnonKey?.length,
      hasUrl: !!config.supabaseUrl,
      hasKey: !!config.supabaseAnonKey,
    });

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error(
        "Supabase configuration missing. Check environment variables."
      );
    }

    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
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
      const storedSession = this.sessionStore.get("session") as Session | null;
      
      if (storedSession) {
        console.log("SupabaseService: Found stored session, attempting to restore...");
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
          this.notifyAuthStateChange(data.user);
        } else {
          // Clear invalid session
          console.log("SupabaseService: Stored session is invalid, clearing...", error?.message);
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
      console.log("SupabaseService: Session restoration completed. User authenticated:", !!this.currentUser);
    }
  }

  private storeSession(session: Session, user: User) {
    this.sessionStore.set("session", session);
    this.sessionStore.set("user", user);
    this.currentSession = session;
    this.currentUser = user;
  }

  // Public method for OAuth callback handling
  public async exchangeCodeForSession(code: string) {
    try {
      console.log("SupabaseService: Exchanging OAuth code for session...");
      const { data, error } = await this.supabase.auth.exchangeCodeForSession(code);
      
      if (data.session && data.user && !error) {
        console.log("SupabaseService: OAuth session exchange successful for user:", data.user.email);
        this.storeSession(data.session, data.user);
        this.notifyAuthStateChange(data.user);
      }
      
      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Error exchanging code for session:", error);
      return { data: null as any, error };
    }
  }

  private clearStoredSession() {
    this.sessionStore.delete("session");
    this.sessionStore.delete("user");
    this.currentSession = null;
    this.currentUser = null;
  }

  private notifyAuthStateChange(user: User | null) {
    if (this.onAuthStateChangeCallback) {
      this.onAuthStateChangeCallback(user);
    }
  }

  // Set auth state change listener
  setAuthStateChangeListener(callback: (user: User | null) => void) {
    this.onAuthStateChangeCallback = callback;
  }

  // Authentication methods
  async signUp(email: string, password: string, name?: string) {
    try {
      console.log("SupabaseService: Signing up user with email:", email, "and name:", name);
      
      const signupData: any = {
        email,
        password,
      };

      // Add name to user metadata if provided
      if (name && name.trim()) {
        signupData.options = {
          data: {
            full_name: name.trim(),
            name: name.trim()
          }
        };
        console.log("SupabaseService: Adding name to signup metadata:", JSON.stringify(signupData.options.data, null, 2));
      } else {
        console.warn("SupabaseService: No name provided for signup, user profile will use email prefix");
        // Even without a name, we should provide some metadata for the trigger
        signupData.options = {
          data: {
            source: 'email_signup'
          }
        };
      }
      
      console.log("SupabaseService: Complete signup data:", JSON.stringify({
        email: signupData.email,
        options: signupData.options
      }, null, 2));

      const { data, error } = await this.supabase.auth.signUp(signupData);

      console.log("SupabaseService: Signup result - success:", !!data.user, "error:", error?.message);

      if (data.session && data.user && !error) {
        console.log("SupabaseService: User created with metadata:", data.user.user_metadata);
        this.storeSession(data.session, data.user);
        this.notifyAuthStateChange(data.user);

        // As a backup, ensure user profile is created
        // The database trigger should handle this, but let's be safe
        setTimeout(async () => {
          try {
            console.log("SupabaseService: Checking if profile was created by trigger...");
            const profileCheck = await this.supabase
              .from("user_profiles")
              .select("id")
              .eq("id", data.user!.id)
              .single();
            
            if (profileCheck.error && profileCheck.error.code === 'PGRST116') {
              console.log("SupabaseService: Profile not created by trigger, creating manually");
              await this.createUserProfile();
            } else if (profileCheck.data) {
              console.log("SupabaseService: Profile successfully created by trigger");
            }
          } catch (error) {
            console.error("SupabaseService: Error checking profile creation:", error);
          }
        }, 2000); // Wait 2 seconds for trigger to fire
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Sign up error:", error);
      return { data: null as any, error };
    }
  }

  async signInWithGoogle() {
    try {
      console.log("SupabaseService: Initiating Google OAuth with custom protocol...");
      
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "overlay://oauth/callback",
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      console.log("SupabaseService: Google OAuth initiation result:", { 
        success: !!data.url, 
        hasError: !!error,
        errorMessage: error?.message 
      });

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Google sign in error:", error);
      return { data: null as any, error };
    }
  }

  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (data.session && data.user && !error) {
        this.storeSession(data.session, data.user);
        this.notifyAuthStateChange(data.user);
      }

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Sign in error:", error);
      return { data: null as any, error };
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();

      this.clearStoredSession();
      this.notifyAuthStateChange(null);

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
      const { error: deleteUserError } = await this.supabase.rpc('delete_user_account');

      if (deleteUserError) {
        // If the RPC function doesn't exist, we'll just sign out
        // The user deletion will need to be handled by an admin or Edge Function
        console.warn("Could not delete auth user, signing out instead:", deleteUserError);
        await this.signOut();
        return { 
          data: { message: "Account data deleted, but auth record remains. Contact support for complete deletion." }, 
          error: null 
        };
      }

      // Clear session and notify
      this.clearStoredSession();
      this.notifyAuthStateChange(null);

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
      console.error("SupabaseService: getUserProfile called but no current user");
      return { data: null, error: new Error("User not authenticated") };
    }

    try {
      console.log("SupabaseService: Getting user profile for user ID:", this.currentUser.id);
      
      const { data, error } = await this.supabase
        .from("user_profiles")
        .select("*")
        .eq("id", this.currentUser.id)
        .single();

      console.log("SupabaseService: Profile query result - data:", data, "error:", error?.message);

      if (error && error.code === 'PGRST116') {
        // No rows found - profile doesn't exist, let's create it
        console.log("SupabaseService: Profile not found, attempting to create one");
        return await this.createUserProfile();
      }

      if (error) {
        console.error("SupabaseService: Database error getting user profile:", error);
      }

      if (!data) {
        console.warn("SupabaseService: No profile found in database for user:", this.currentUser.id);
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
      console.log("SupabaseService: Creating user profile for user:", this.currentUser.id);
      
      // Extract name from user metadata or use email prefix with robust fallback
      let userName = '';
      
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
        userName = this.currentUser.email.split('@')[0];
      }
      // Final fallback
      else {
        userName = 'User';
      }
      
      // Ensure we never have an empty string
      if (!userName || userName.trim() === '') {
        userName = 'User';
      }

      console.log("SupabaseService: Creating profile with name:", userName);

      const { data, error } = await this.supabase
        .from("user_profiles")
        .insert({
          id: this.currentUser.id,
          name: userName,
          subscription_tier: 'free',
          onboarding_completed: false
        })
        .select()
        .single();

      console.log("SupabaseService: Profile creation result - data:", data, "error:", error?.message);

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
      const { data, error } = await this.supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", this.currentUser.id)
        .single();

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Get user settings error:", error);
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

      // Calculate streak days
      const today = new Date().toDateString();
      const dates =
        transcripts?.map((t) => new Date(t.created_at).toDateString()) || [];
      const uniqueDates = Array.from(new Set(dates)).sort().reverse();

      let streakDays = 0;
      let currentDate = new Date();

      for (const dateStr of uniqueDates) {
        if (dateStr === currentDate.toDateString()) {
          streakDays++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

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
      console.log("SupabaseService: Marking onboarding as completed for user:", this.currentUser.id);
      
      const { data, error } = await this.supabase
        .from("user_profiles")
        .update({ onboarding_completed: true })
        .eq("id", this.currentUser.id)
        .select()
        .single();

      console.log("SupabaseService: Onboarding completion result - data:", data, "error:", error?.message);

      return { data, error };
    } catch (error) {
      console.error("SupabaseService: Complete onboarding error:", error);
      return { data: null as any, error };
    }
  }
}
