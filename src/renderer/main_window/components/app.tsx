import React from "react";
import { NavigationBar } from "./NavigationBar";
import { Layout } from "./Layout";
import { HomePage } from "./HomePage";
import { OnboardingFlow } from "./OnboardingFlow";
import { HelpPage } from "./HelpPage";
import { ReferralPage } from "./ReferralPage";
import { DictionaryPage } from "./DictionaryPage";
import { AppProvider, useAppContext } from "../contexts/AppContext";

const AppContent: React.FC = () => {
  const { state, setActiveView } = useAppContext();
  const { isAuthenticated, isLoading, user } = state;

  // Track onboarding step for NavigationBar
  const [onboardingStep, setOnboardingStep] = React.useState(1);
  const [onboardingStepName, setOnboardingStepName] =
    React.useState("Authentication");

  const handleStepChange = (step: number, stepName: string) => {
    setOnboardingStep(step);
    setOnboardingStepName(stepName);
  };

  // Simplified loading screen logic
  const shouldShowLoading = isLoading;

  // Simple loading message
  const loadingMessage = "Loading...";

  console.log("AppContent: Rendering with state:", {
    isLoading,
    shouldShowLoading,
    isAuthenticated,
    hasCompletedOnboarding: user?.onboarding_completed,
    user: user?.email || null,
    loadingMessage,
    timestamp: new Date().toISOString(),
  });

  if (shouldShowLoading) {
    console.log(
      "AppContent: Showing loading screen with message:",
      loadingMessage
    );
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <NavigationBar showAuthButtons={false} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-64 bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-gray-500 h-2 rounded-full animate-pulse w-3/4"></div>
            </div>
            <p className="text-gray-600">{loadingMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show onboarding flow if user is not authenticated or hasn't completed onboarding
  if (!isAuthenticated || !user?.onboarding_completed) {
    console.log("AppContent: Showing onboarding flow", {
      reason: !isAuthenticated
        ? "not authenticated"
        : "onboarding not completed",
    });
    return (
      <div className="h-screen flex flex-col">
        <NavigationBar
          showAuthButtons={false}
          isOnboarding={true}
          currentStep={onboardingStep}
          totalSteps={4}
          stepName={onboardingStepName}
        />
        <div className="flex-1 overflow-hidden">
          <OnboardingFlow onStepChange={handleStepChange} />
        </div>
      </div>
    );
  }

  // Show main app with layout
  console.log("AppContent: Showing main app layout");
  return (
    <div className="h-screen flex flex-col">
      <NavigationBar
        showAuthButtons={true}
        activeView={state.activeView}
        onViewChange={setActiveView}
      />
      <div className="flex-1 overflow-hidden">
        <Layout activeView={state.activeView} setActiveView={setActiveView}>
          {state.activeView === "home" && <HomePage />}
          {state.activeView === "help" && <HelpPage />}
          {state.activeView === "referral" && <ReferralPage />}
          {state.activeView === "dictionary" && <DictionaryPage />}
        </Layout>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};
