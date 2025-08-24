import { useEffect, useRef } from "react";
import { useAppContext } from "../contexts/AppContext";
import { auth, db } from "../lib/api_client";

// Hook that only initializes auth once at the app level
export const useAuthInit = () => {
  const {
    setLoading,
    setError,
    setUser,
    setAuthenticated,
    setOnboardingCompleted,
    setUserStats,
    setTranscripts,
    setSettings,
    setUserProfile,
  } = useAppContext();

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return; // Already initialized, skip
    }

    const initializeAuth = async () => {
      try {
        setLoading(true);
        console.log("useAuthInit: Initializing authentication...");

        // Check if user is authenticated
        const authResult = await auth.getCurrentUser();
        console.log("useAuthInit: Auth check result:", authResult);

        if (authResult.success && authResult.data?.user) {
          const user = authResult.data.user;
          setUser(user);
          setAuthenticated(true);

          // Check onboarding status from database - now using the profile's onboarding_completed field
          const hasCompletedOnboarding = await checkOnboardingStatusInDB(user.id);
          setOnboardingCompleted(hasCompletedOnboarding);

          // Update localStorage to match database state
          if (hasCompletedOnboarding) {
            localStorage.setItem("onboarding-completed", "true");
          } else {
            localStorage.removeItem("onboarding-completed");
          }

          // If onboarding is completed, load user data
          if (hasCompletedOnboarding) {
            await loadUserData(user);

            // Load transcripts from database
            console.log("useAuthInit: Loading transcripts from database");
            try {
              const transcriptsResult = await db.getTranscripts(100);
              console.log("useAuthInit: Transcripts result:", JSON.stringify(transcriptsResult, null, 2));
              
              // Handle nested structure for transcripts: { success, data: { data, error } }
              const actualTranscriptsData = transcriptsResult.success ? transcriptsResult.data?.data : null;
              const actualTranscriptsError = transcriptsResult.success ? transcriptsResult.data?.error : transcriptsResult.error;
              
              if (actualTranscriptsData && Array.isArray(actualTranscriptsData) && !actualTranscriptsError) {
                console.log(
                  "useAuthInit: Received transcripts:",
                  actualTranscriptsData.length
                );
                const formattedTranscripts = actualTranscriptsData.map(
                  (item: any) => ({
                    id: item.id,
                    text: item.text,
                    timestamp: new Date(item.timestamp || item.created_at),
                    wordCount: Number(item.wordCount || item.word_count) || 0,
                    wpm: Number(item.wpm) || 0,
                    originalText: item.originalText || item.original_text,
                    wasTranslated: item.wasTranslated || item.was_translated,
                    targetLanguage:
                      item.targetLanguage || item.target_language,
                  })
                );
                setTranscripts(formattedTranscripts);
              } else {
                console.warn(
                  "useAuthInit: Failed to get transcripts:",
                  actualTranscriptsError
                );
              }
            } catch (error) {
              console.error(
                "useAuthInit: Error loading transcripts:",
                error
              );
            }
          }
        } else {
          // User not authenticated
          setUser(null);
          setAuthenticated(false);
          setOnboardingCompleted(false);
          localStorage.removeItem("onboarding-completed");
        }
      } catch (error) {
        console.error("useAuthInit: Error during auth initialization:", error);
        setError("Failed to initialize authentication");
        setUser(null);
        setAuthenticated(false);
        setOnboardingCompleted(false);
      } finally {
        setLoading(false);
        hasInitialized.current = true;
      }
    };

    initializeAuth();
  }, []);

  // Check if user has completed onboarding by checking the profile's onboarding_completed field
  const checkOnboardingStatusInDB = async (
    userId: string
  ): Promise<boolean> => {
    try {
      console.log("useAuthInit: Checking onboarding status in database for user:", userId);
      
      // Get user profile to check onboarding_completed field
      const profileResult = await auth.getUserProfile();
      console.log("useAuthInit: Checking onboarding - Profile result:", JSON.stringify(profileResult, null, 2));
      
      // Handle the nested response structure: { success, data: { data, error } }
      const actualProfileData = profileResult.success ? profileResult.data?.data : null;
      const actualError = profileResult.success ? profileResult.data?.error : profileResult.error;
      
      if (actualProfileData && !actualError) {
        const onboardingCompleted = actualProfileData.onboarding_completed;
        console.log("useAuthInit: Onboarding completed status from database:", onboardingCompleted);
        return Boolean(onboardingCompleted);
      } else {
        console.warn("useAuthInit: Could not get user profile for onboarding check, defaulting to false");
        return false;
      }
    } catch (error) {
      console.error(
        "useAuthInit: Error checking onboarding status in DB:",
        error
      );
      // Fallback to localStorage as last resort
      const localStatus = localStorage.getItem("onboarding-completed") === "true";
      console.log("useAuthInit: Using localStorage fallback:", localStatus);
      return localStatus;
    }
  };

  // Load user data from database
  const loadUserData = async (user: any) => {
    try {
      console.log("useAuthInit: Loading user data...");

      // Load user profile
      console.log("useAuthInit: Loading user profile...");
      const profileResult = await auth.getUserProfile();
      console.log("useAuthInit: Profile result:", JSON.stringify(profileResult, null, 2));

      // Handle the nested response structure: { success, data: { data, error } }
      const actualProfileData = profileResult.success ? profileResult.data?.data : null;
      const actualError = profileResult.success ? profileResult.data?.error : profileResult.error;

      if (actualProfileData && !actualError) {
        console.log("useAuthInit: Setting user profile:", actualProfileData);
        setUserProfile(actualProfileData);
      } else {
        console.warn(
          "useAuthInit: No profile data or failed to load profile. Error:",
          actualError
        );
      }

      // Load user settings
      const settingsResult = await db.getUserSettings();
      console.log("useAuthInit: Settings result:", JSON.stringify(settingsResult, null, 2));
      
      // Handle the nested response structure for settings
      const actualSettingsData = settingsResult.success ? settingsResult.data?.data : null;
      const actualSettingsError = settingsResult.success ? settingsResult.data?.error : settingsResult.error;
      
      if (actualSettingsData && actualSettingsData.settings && !actualSettingsError) {
        console.log("useAuthInit: Loading settings from database:", actualSettingsData.settings);
        setSettings({
          outputMode: actualSettingsData.settings.outputMode || "both",
          useAI: actualSettingsData.settings.useAI ?? true,
          language: actualSettingsData.settings.language || "auto",
          enableTranslation: actualSettingsData.settings.enableTranslation ?? false,
          targetLanguage: actualSettingsData.settings.targetLanguage || "en",
        });
      } else {
        console.log("useAuthInit: No user settings found in database, using defaults");
      }

      // Load user stats
      const statsResult = await db.getUserStats();
      console.log("useAuthInit: Stats result:", JSON.stringify(statsResult, null, 2));
      
      // Handle the nested response structure for stats
      const actualStatsData = statsResult.success ? statsResult.data?.data : null;
      const actualStatsError = statsResult.success ? statsResult.data?.error : statsResult.error;
      
      if (actualStatsData && !actualStatsError) {
        console.log("useAuthInit: Loading stats from database:", actualStatsData);
        setUserStats(actualStatsData);
      } else {
        console.log("useAuthInit: No user stats found, keeping defaults");
      }

      console.log("useAuthInit: User data loaded successfully");
    } catch (error) {
      console.error("useAuthInit: Error loading user data:", error);
      setError("Failed to load user data");
    }
  };
};
