import React, { useState, useEffect } from "react";
import { AuthPage } from "./AuthPage";
import { PermissionsPage } from "./PermissionsPage";
import { GuidePage } from "./GuidePage";
import { useAppContext } from "../contexts/AppContext";
import { useAuth } from "../hooks/useAuth";
import { analytics, auth } from "../lib/api_client";

type OnboardingStep = "auth" | "permissions" | "guide";

export const OnboardingFlow: React.FC = () => {
  const { state, setUser, setAuthenticated } = useAppContext();
  const { user, isAuthenticated, completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("auth");
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // User is authenticated, move to permissions step
      setCurrentStep("permissions");
    } else {
      setCurrentStep("auth");
    }
    setIsLoading(false);
  }, [isAuthenticated, user]);

  const handleAuthSuccess = async (authenticatedUser: any) => {
    console.log("OnboardingFlow: Auth success with user:", authenticatedUser);

    // Update the app state with authenticated user
    setUser(authenticatedUser);
    setAuthenticated(true);

    setCurrentStep("permissions");

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

    try {
      // Mark onboarding as completed in the database
      console.log(
        "OnboardingFlow: Marking onboarding as completed in database"
      );
      const dbResult = await auth.completeOnboarding();
      console.log(
        "OnboardingFlow: Complete onboarding result:",
        JSON.stringify(dbResult, null, 2)
      );

      if (!dbResult.success) {
        console.error(
          "OnboardingFlow: Failed to mark onboarding as completed in database:",
          dbResult.error
        );
        // Continue anyway, as the user has completed the flow
      } else {
        console.log(
          "OnboardingFlow: Successfully marked onboarding as completed in database"
        );
        // Check the actual data returned
        if (dbResult.data?.data) {
          console.log(
            "OnboardingFlow: Updated profile data:",
            dbResult.data.data
          );
        }
      }

      // Complete onboarding locally (sets localStorage and state)
      await completeOnboarding();

      // Track onboarding completion
      await analytics.track("onboarding_completed");

      // Use the current user from state, fallback to user from hook
      const currentUser = state.user || user;

      if (currentUser) {
        // Notify main process that authentication is complete
        window.electronAPI.onAuthenticationComplete(currentUser);
      } else {
        console.error(
          "OnboardingFlow: No user available to complete authentication"
        );
      }
    } catch (error) {
      console.error("OnboardingFlow: Error completing onboarding:", error);
      // Still try to complete onboarding locally
      await completeOnboarding();

      const currentUser = state.user || user;
      if (currentUser) {
        window.electronAPI.onAuthenticationComplete(currentUser);
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
      {/* Draggable Header */}
      <div
        className="h-6 bg-white flex items-center"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Progress Bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-1 bg-blue-600 transition-all duration-300"
          style={{ width: `${getStepProgress()}%` }}
        />
      </div>

      {/* Step Content */}
      <div className="flex-1">
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

      {/* Step Indicator */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="bg-white rounded-full px-4 py-2 shadow-lg border">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">
              Step {["auth", "permissions", "guide"].indexOf(currentStep) + 1}{" "}
              of 3
            </span>
            <span>•</span>
            <span>
              {currentStep === "auth" && "Authentication"}
              {currentStep === "permissions" && "Permissions"}
              {currentStep === "guide" && "Quick Guide"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
