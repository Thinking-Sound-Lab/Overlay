import React, { useState, useEffect } from "react";
import { AuthPage } from "./AuthPage";
import { LanguageSelectionPage } from "./LanguageSelectionPage";
import { PermissionsPage } from "./PermissionsPage";
import { GuidePage } from "./GuidePage";
import { useAppContext } from "../contexts/AppContext";
import { analytics, auth, db } from "../lib/api_client";
import { Button } from "./ui/button";
import { UserRecord } from "../../../shared/types/database";

type OnboardingStep = "auth" | "language" | "permissions" | "guide";

interface OnboardingFlowProps {
  onStepChange?: (step: number, stepName: string) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onStepChange,
}) => {
  const { state, dispatch, setUser, setAuthenticated, completeOnboarding, setSettings } =
    useAppContext();
  const { user, isAuthenticated, settings } = state;
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("auth");
  const [isLoading, setIsLoading] = useState(true);
  const [signUpEmail, setSignUpEmail] = useState<string>("");

  // Determine which flow to show based on authentication state
  useEffect(() => {
    console.log("OnboardingFlow: Determining flow based on auth state:", {
      isAuthenticated,
      hasUser: !!user,
      userEmail: user?.email,
      hasCompletedOnboarding: user?.onboarding_completed,
      timestamp: new Date().toISOString(),
    });

    if (isAuthenticated && user && user.onboarding_completed) {
      console.log(
        "OnboardingFlow: User completed onboarding, navigating to home"
      );
      dispatch({ type: "SET_ACTIVE_VIEW", payload: "home" });
    } else if (isAuthenticated && user && !user.onboarding_completed) {
      console.log("OnboardingFlow: User authenticated but onboarding incomplete, showing language selection");
      setCurrentStep("language");
    } else {
      console.log("OnboardingFlow: User not authenticated, showing auth");
      setCurrentStep("auth");
    }
    setIsLoading(false);
  }, [isAuthenticated, user, dispatch]);

  // Notify parent about step changes
  useEffect(() => {
    if (onStepChange) {
      const stepNumber =
        ["auth", "language", "permissions", "guide"].indexOf(currentStep) + 1;
      const stepName =
        currentStep === "auth"
          ? "Authentication"
          : currentStep === "language"
            ? "Language Selection"
            : currentStep === "permissions"
              ? "Permissions"
              : "Quick Guide";
      onStepChange(stepNumber, stepName);
    }
  }, [currentStep, onStepChange]);

  const handleSignIn = async (authenticatedUser: UserRecord) => {
    console.log(
      "OnboardingFlow: Sign in success with user:",
      authenticatedUser
    );

    // Update app state
    // setUser(authenticatedUser);
    // setAuthenticated(true);

    try {
      // Track successful authentication
      await analytics.identify(authenticatedUser.id, {
        email: authenticatedUser.email,
      });
      await analytics.track("user_authenticated_via_magic_link");

      // User data and navigation will be handled by DataLoaderService
    } catch (error) {
      console.error("OnboardingFlow: Error tracking sign in:", error);
    }
  };

  const handleSignUp = async (signUpData: { user?: UserRecord, email: string, needsVerification: boolean }) => {
    console.log(
      "OnboardingFlow: Sign up response:",
      {
        hasUser: !!signUpData.user,
        email: signUpData.email,
        needsVerification: signUpData.needsVerification
      }
    );

    // Store email for verification step
    setSignUpEmail(signUpData.email);

    if (signUpData.user) {
      console.log("OnboardingFlow: User verified during sign-up, proceeding to language selection");
      
      try {
        // Track successful sign up
        await analytics.identify(signUpData.user.id, {
          email: signUpData.user.email,
        });
        await analytics.track("user_signed_up_via_magic_link");
      } catch (error) {
        console.error("OnboardingFlow: Error tracking sign up:", error);
      }
      
      setCurrentStep("language");
    } else {
      console.error("OnboardingFlow: Unexpected sign-up state - no user returned");
      setCurrentStep("auth"); // Go back to auth step
    }
  };


  const handleLanguageSelection = async (languageCode: string) => {
    console.log("OnboardingFlow: Language selected:", languageCode);
    
    try {
      // Update settings with selected language
      const updatedSettings = { ...settings, language: languageCode };
      setSettings(updatedSettings);
      
      // Save using unified DB-first approach
      const result = await db.saveUserSettings(updatedSettings);
      if (result.success) {
        console.log("OnboardingFlow: Language setting saved via DataLoaderService:", languageCode);
      } else {
        throw new Error(result.error || "Failed to save language setting");
      }
      
      // Track language selection
      await analytics.track("language_selected", {
        language_code: languageCode
      });
      
      // Navigate to permissions
      setCurrentStep("permissions");
    } catch (error) {
      console.error("OnboardingFlow: Error saving language selection:", error);
      // Still proceed to avoid blocking the user
      setCurrentStep("permissions");
    }
  };

  const handlePermissions = async () => {
    console.log("OnboardingFlow: Permissions granted, navigating to guide");
    setCurrentStep("guide");

    try {
      await analytics.track("permissions_granted");
    } catch (error) {
      console.error(
        "OnboardingFlow: Error tracking permissions granted:",
        error
      );
    }
  };

  const handleGuide = async () => {
    console.log("OnboardingFlow: Guide completed, completing onboarding");

    try {
      // Mark onboarding as completed in database
      const dbResult = await auth.completeOnboarding();
      if (!dbResult.success) {
        console.warn(
          "OnboardingFlow: Failed to update database:",
          dbResult.error
        );
      }

      // Complete onboarding locally
      await completeOnboarding();

      // Track completion
      await analytics.track("onboarding_completed");

      // Notify main process
      const currentUser = state.user || user;
      if (currentUser) {
        await window.electronAPI.onAuthenticationComplete(currentUser);
      }

      console.log("OnboardingFlow: Onboarding completed successfully");
    } catch (error) {
      console.error("OnboardingFlow: Error completing onboarding:", error);
      // Navigate to home anyway to prevent user getting stuck
      dispatch({ type: "SET_ACTIVE_VIEW", payload: "home" });
      // Update user onboarding status in state
      if (user) {
        dispatch({ type: "SET_USER", payload: { ...user, onboarding_completed: true } });
      }
    }
  };

  useEffect(() => {
    console.log("OnboardingFlow: Current step changed to:", currentStep, {
      isAuthenticated,
      hasUser: !!user,
      userEmail: user?.email,
      hasCompletedOnboarding: user?.onboarding_completed,
      timestamp: new Date().toISOString(),
    });
  }, [currentStep, isAuthenticated, user]);

  useEffect(() => {
    if (onStepChange) {
      const stepNumber =
        ["auth", "language", "permissions", "guide"].indexOf(currentStep) + 1;
      const stepName =
        currentStep === "auth"
          ? "Authentication"
          : currentStep === "language"
            ? "Language Selection"
            : currentStep === "permissions"
              ? "Permissions"
              : "Quick Guide";
      onStepChange(stepNumber, stepName);
    }
  }, [currentStep, onStepChange]);

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
          <AuthPage onSignIn={handleSignIn} onSignUp={handleSignUp} />
        )}

        {currentStep === "language" && (
          <LanguageSelectionPage onLanguageSelected={handleLanguageSelection} />
        )}

        {currentStep === "permissions" && (
          <PermissionsPage onPermissionsGranted={handlePermissions} />
        )}

        {currentStep === "guide" && <GuidePage onGuideComplete={handleGuide} />}
      </div>
    </div>
  );
};
