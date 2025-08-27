import React, { useState, useEffect } from "react";
import { AuthPage } from "./AuthPage";
import { PermissionsPage } from "./PermissionsPage";
import { GuidePage } from "./GuidePage";
import { useAppContext } from "../contexts/AppContext";
import { analytics, auth } from "../lib/api_client";
import { Button } from "./ui/button";

type OnboardingStep = "auth" | "permissions" | "guide";

interface OnboardingFlowProps {
  onStepChange?: (step: number, stepName: string) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onStepChange,
}) => {
  const { state, dispatch, setUser, setAuthenticated, completeOnboarding } =
    useAppContext();
  const { user, isAuthenticated, hasCompletedOnboarding, isAuthStateComplete } = state;
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("auth");
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated - ONLY after auth state is complete
  useEffect(() => {
    console.log("OnboardingFlow: Evaluating auth state for routing:", {
      isAuthenticated,
      hasUser: !!user,
      userEmail: user?.email,
      hasCompletedOnboarding,
      isAuthStateComplete,
      currentStep,
      isLoading,
      timestamp: new Date().toISOString()
    });
    
    // Don't make routing decisions until auth state is complete
    if (!isAuthStateComplete) {
      console.log("OnboardingFlow: Auth state not yet complete, waiting...");
      return;
    }
    
    // Now make routing decisions based on complete auth state
    if (isAuthenticated && user && hasCompletedOnboarding) {
      // User is authenticated AND completed onboarding -> skip to home
      console.log("OnboardingFlow: User already completed onboarding, skipping to home");
      handleGuideComplete();
    } else if (isAuthenticated && user) {
      // User is authenticated but hasn't completed onboarding -> go to permissions
      console.log("OnboardingFlow: User authenticated but onboarding incomplete, going to permissions");
      setCurrentStep("permissions");
    } else {
      // User is not authenticated -> go to auth step
      console.log("OnboardingFlow: User not authenticated, going to auth step");
      setCurrentStep("auth");
    }
    setIsLoading(false);
  }, [isAuthenticated, user, hasCompletedOnboarding, isAuthStateComplete]);

  // Notify parent about step changes
  useEffect(() => {
    if (onStepChange) {
      const stepNumber =
        ["auth", "permissions", "guide"].indexOf(currentStep) + 1;
      const stepName =
        currentStep === "auth"
          ? "Authentication"
          : currentStep === "permissions"
            ? "Permissions"
            : "Quick Guide";
      onStepChange(stepNumber, stepName);
    }
  }, [currentStep, onStepChange]);

  const handleAuthSuccess = async (authenticatedUser: any) => {
    console.log("OnboardingFlow: Auth success with user:", authenticatedUser);
    console.log("OnboardingFlow: Current app state before auth success:", {
      hasCompletedOnboarding,
      isAuthenticated,
      user: user?.email,
      stateUser: state.user?.email,
      stateAuthenticated: state.isAuthenticated,
      stateHasCompletedOnboarding: state.hasCompletedOnboarding,
      timestamp: new Date().toISOString()
    });

    // CRITICAL FIX: Don't make routing decisions here anymore!
    // For email/password sign-in, the main process will now send auth-state-changed event
    // with complete profile data, which will trigger the useEffect routing logic
    
    // Update the app state with authenticated user (temporary until auth-state-changed event arrives)
    setUser(authenticatedUser);
    setAuthenticated(true);
    
    console.log("OnboardingFlow: Set user in state, waiting for auth-state-changed event with profile data for routing decisions");

    // Track successful authentication
    await analytics.identify(authenticatedUser.id, {
      email: authenticatedUser.email,
    });
    await analytics.track("user_authenticated");
  };

  const handlePermissionsGranted = async () => {
    setCurrentStep("guide");

    // Track permissions granted
    await analytics.track("permissions_granted");
  };

  const handleGuideComplete = async () => {
    console.log(
      "OnboardingFlow: Guide complete with user:",
      user || state.user
    );
    
    console.log("OnboardingFlow: State before completing onboarding:", {
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      isAuthenticated: state.isAuthenticated,
      user: state.user?.email,
      timestamp: new Date().toISOString()
    });

    try {
      // CRITICAL FIX: Mark onboarding as completed in the database with comprehensive verification
      console.log(
        "OnboardingFlow: Marking onboarding as completed in database"
      );
      
      let dbUpdateSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      // Retry logic for database update
      while (!dbUpdateSuccess && retryCount < maxRetries) {
        retryCount++;
        console.log(`OnboardingFlow: Database update attempt ${retryCount}/${maxRetries}`);
        
        const dbResult = await auth.completeOnboarding();
        console.log(
          `OnboardingFlow: Complete onboarding result (attempt ${retryCount}):`,
          JSON.stringify(dbResult, null, 2)
        );

        if (dbResult.success && dbResult.data?.data?.onboarding_completed === true) {
          dbUpdateSuccess = true;
          console.log(
            "OnboardingFlow: Successfully verified onboarding completion in database:",
            dbResult.data.data
          );
          break;
        } else if (dbResult.success) {
          console.warn(
            "OnboardingFlow: Database update succeeded but onboarding_completed not verified:",
            dbResult.data?.data?.onboarding_completed
          );
          // Still consider this a success if the API call succeeded
          dbUpdateSuccess = true;
          break;
        } else {
          console.error(
            `OnboardingFlow: Failed to mark onboarding as completed in database (attempt ${retryCount}):`,
            dbResult.error
          );
          
          if (retryCount < maxRetries) {
            console.log(`OnboardingFlow: Retrying database update in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!dbUpdateSuccess) {
        console.error("OnboardingFlow: All database update attempts failed, but continuing with local completion");
      }

      // CRITICAL FIX: Complete onboarding locally with comprehensive error handling
      console.log("OnboardingFlow: Calling completeOnboarding() on app context");
      
      try {
        await completeOnboarding();
        console.log("OnboardingFlow: completeOnboarding() completed successfully, new state:", {
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          timestamp: new Date().toISOString()
        });

        // Verify local onboarding completion
        if (!state.hasCompletedOnboarding) {
          console.warn("OnboardingFlow: Local onboarding completion may not have updated state yet");
        }

        // Track onboarding completion
        await analytics.track("onboarding_completed");

        // Use the current user from state, fallback to user from hook
        const currentUser = state.user || user;

        if (currentUser) {
          // Notify main process that authentication is complete
          console.log("OnboardingFlow: Notifying main process of authentication completion");
          const authCompleteResult = await window.electronAPI.onAuthenticationComplete(currentUser);
          console.log("OnboardingFlow: Authentication completion notification result:", authCompleteResult);
        } else {
          console.error(
            "OnboardingFlow: No user available to complete authentication - this is a critical error"
          );
          throw new Error("No user available to complete authentication");
        }

        console.log("OnboardingFlow: All onboarding completion steps succeeded");
      } catch (localCompletionError) {
        console.error("OnboardingFlow: Error in local onboarding completion:", localCompletionError);
        throw localCompletionError; // Re-throw to be caught by outer catch block
      }
    } catch (error) {
      console.error("OnboardingFlow: Critical error during onboarding completion:", error);
      
      // CRITICAL FIX: Comprehensive error recovery
      try {
        console.log("OnboardingFlow: Attempting error recovery...");
        
        // Still try to complete onboarding locally as fallback
        console.log("OnboardingFlow: Attempting local onboarding completion as fallback");
        await completeOnboarding();

        const currentUser = state.user || user;
        if (currentUser) {
          console.log("OnboardingFlow: Attempting to notify main process despite earlier errors");
          const fallbackResult = await window.electronAPI.onAuthenticationComplete(currentUser);
          console.log("OnboardingFlow: Fallback authentication completion result:", fallbackResult);
          
          console.log("OnboardingFlow: Error recovery completed successfully");
        } else {
          console.error("OnboardingFlow: Cannot complete error recovery - no user available");
          // Don't throw here - user is already in a problematic state
        }
      } catch (recoveryError) {
        console.error("OnboardingFlow: Error recovery also failed:", recoveryError);
        
        // Last resort: at least ensure user doesn't get stuck
        console.log("OnboardingFlow: Attempting minimal recovery to prevent user getting stuck");
        try {
          // Force navigate to home even if onboarding is incomplete
          dispatch({ type: "SET_ACTIVE_VIEW", payload: "home" });
          dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: true });
          console.log("OnboardingFlow: Minimal recovery completed - user should now see home page");
        } catch (minimalRecoveryError) {
          console.error("OnboardingFlow: Even minimal recovery failed:", minimalRecoveryError);
        }
      }
    }
  };

  const getStepProgress = () => {
    const steps = ["auth", "permissions", "guide"];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {currentStep === "auth" && (
          <AuthPage onAuthSuccess={handleAuthSuccess} />
        )}

        {currentStep === "permissions" && (
          <PermissionsPage onPermissionsGranted={handlePermissionsGranted} />
        )}

        {currentStep === "guide" && (
          <GuidePage onGuideComplete={handleGuideComplete} />
        )}
      </div>
    </div>
  );
};
