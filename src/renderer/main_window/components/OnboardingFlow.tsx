import React, { useState, useEffect } from "react";
import { AuthPage } from "./AuthPage";
import { EmailVerificationPage } from "./EmailVerificationPage";
import { PermissionsPage } from "./PermissionsPage";
import { GuidePage } from "./GuidePage";
import { useAppContext } from "../contexts/AppContext";
import { analytics, auth } from "../lib/api_client";
import { Button } from "./ui/button";

type OnboardingStep = "auth" | "email-verification" | "permissions" | "guide";

interface OnboardingFlowProps {
  onStepChange?: (step: number, stepName: string) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onStepChange,
}) => {
  const { state, dispatch, setUser, setAuthenticated, completeOnboarding } =
    useAppContext();
  const { user, isAuthenticated, hasCompletedOnboarding } = state;
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("auth");
  const [isLoading, setIsLoading] = useState(true);
  const [signUpEmail, setSignUpEmail] = useState<string>("");

  // Determine which flow to show based on authentication state
  useEffect(() => {
    console.log("OnboardingFlow: Determining flow based on auth state:", {
      isAuthenticated,
      hasUser: !!user,
      userEmail: user?.email,
      hasCompletedOnboarding,
      timestamp: new Date().toISOString(),
    });

    if (isAuthenticated && user && hasCompletedOnboarding) {
      console.log(
        "OnboardingFlow: User completed onboarding, navigating to home"
      );
      dispatch({ type: "SET_ACTIVE_VIEW", payload: "home" });
    } else if (isAuthenticated && user && !hasCompletedOnboarding) {
      console.log("OnboardingFlow: User authenticated but onboarding incomplete, showing permissions");
      setCurrentStep("permissions");
    } else {
      console.log("OnboardingFlow: User not authenticated, showing auth");
      setCurrentStep("auth");
    }
    setIsLoading(false);
  }, [isAuthenticated, user, hasCompletedOnboarding, dispatch]);

  // Notify parent about step changes
  useEffect(() => {
    if (onStepChange) {
      const stepNumber =
        ["auth", "email-verification", "permissions", "guide"].indexOf(currentStep) + 1;
      const stepName =
        currentStep === "auth"
          ? "Authentication"
          : currentStep === "email-verification"
            ? "Email Verification"
            : currentStep === "permissions"
              ? "Permissions"
              : "Quick Guide";
      onStepChange(stepNumber, stepName);
    }
  }, [currentStep, onStepChange]);

  const handleSignIn = async (authenticatedUser: any) => {
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
      await analytics.track("user_signed_in");

      // User data and navigation will be handled by AuthStateManager
    } catch (error) {
      console.error("OnboardingFlow: Error tracking sign in:", error);
    }
  };

  const handleSignUp = async (signUpData: { user?: any, email: string, needsVerification: boolean }) => {
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

    if (signUpData.needsVerification) {
      console.log("OnboardingFlow: Email verification required, showing verification page");
      setCurrentStep("email-verification");
    } else if (signUpData.user) {
      console.log("OnboardingFlow: User verified during sign-up, proceeding to permissions");
      
      try {
        // Track successful sign up
        await analytics.identify(signUpData.user.id, {
          email: signUpData.user.email,
        });
        await analytics.track("user_signed_up");
      } catch (error) {
        console.error("OnboardingFlow: Error tracking sign up:", error);
      }
      
      setCurrentStep("permissions");
    } else {
      console.error("OnboardingFlow: Unexpected sign-up state");
      setCurrentStep("email-verification"); // Default to verification step
    }
  };

  const handleEmailVerification = async () => {
    console.log("OnboardingFlow: Email verified, navigating to permissions");
    setCurrentStep("permissions");

    try {
      await analytics.track("email_verified");
    } catch (error) {
      console.error(
        "OnboardingFlow: Error tracking email verification:",
        error
      );
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
      dispatch({ type: "SET_ONBOARDING_COMPLETED", payload: true });
    }
  };

  useEffect(() => {
    console.log("OnboardingFlow: Current step changed to:", currentStep, {
      isAuthenticated,
      hasUser: !!user,
      userEmail: user?.email,
      hasCompletedOnboarding,
      timestamp: new Date().toISOString(),
    });
  }, [currentStep, isAuthenticated, user, hasCompletedOnboarding]);

  useEffect(() => {
    if (onStepChange) {
      const stepNumber =
        ["auth", "email-verification", "permissions", "guide"].indexOf(currentStep) + 1;
      const stepName =
        currentStep === "auth"
          ? "Authentication"
          : currentStep === "email-verification"
            ? "Email Verification"
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

        {currentStep === "email-verification" && (
          <EmailVerificationPage 
            userEmail={signUpEmail} 
            onVerificationComplete={handleEmailVerification} 
          />
        )}

        {currentStep === "permissions" && (
          <PermissionsPage onPermissionsGranted={handlePermissions} />
        )}

        {currentStep === "guide" && <GuidePage onGuideComplete={handleGuide} />}
      </div>
    </div>
  );
};
