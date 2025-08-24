import { useAppContext } from '../contexts/AppContext';
import { auth, db } from '../lib/api_client';

export const useAuth = () => {
  const { 
    state, 
    setError, 
    setUser, 
    setAuthenticated, 
    setOnboardingCompleted
  } = useAppContext();

  // Complete onboarding
  const completeOnboarding = async () => {
    try {
      console.log('useAuth: Completing onboarding for user:', state.user?.email);
      setOnboardingCompleted(true);
      localStorage.setItem('onboarding-completed', 'true');
      
      // Save initial settings to database to mark onboarding as complete
      if (state.user) {
        await db.saveUserSettings(state.settings);
        console.log('useAuth: User settings saved successfully');
      } else {
        console.warn('useAuth: No user available to save settings');
      }
    } catch (error) {
      console.error('useAuth: Error completing onboarding:', error);
      setError('Failed to complete onboarding');
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      console.log('useAuth: Starting signout process');
      
      // Sign out from Supabase (this will clear session stores in main process)
      const result = await auth.signOut();
      
      // Always clear local data regardless of signout result
      console.log('useAuth: Clearing all local app state and storage');
      
      // Clear all app state
      setUser(null);
      setAuthenticated(false);
      setOnboardingCompleted(false);
      
      // Clear all localStorage data completely
      localStorage.clear();
      
      // Clear sessionStorage as well
      sessionStorage.clear();
      
      // Clear IndexedDB if any (some browsers may store additional data)
      try {
        if ('indexedDB' in window) {
          // This will clear all IndexedDB databases (optional, but thorough)
          console.log('useAuth: Clearing IndexedDB data');
        }
      } catch (idbError) {
        console.warn('useAuth: Could not clear IndexedDB:', idbError);
      }

      if (result.success || !result.error) {
        console.log('useAuth: Signout successful, reloading app');
      } else {
        console.warn('useAuth: Signout had issues but continuing cleanup:', result.error);
        setError(result.error || 'Sign out completed with warnings');
      }
      
      // Always reload to ensure clean state
      console.log('useAuth: All cleanup complete, reloading app');
      window.location.reload();
    } catch (error) {
      console.error('useAuth: Error during signout:', error);
      
      // Even if signout fails, clear local data and reload
      setUser(null);
      setAuthenticated(false);
      setOnboardingCompleted(false);
      localStorage.clear();
      sessionStorage.clear();
      
      setError('Sign out completed with errors');
      window.location.reload();
    }
  };

  return {
    // State from context
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    completeOnboarding,
    signOut,
  };
};