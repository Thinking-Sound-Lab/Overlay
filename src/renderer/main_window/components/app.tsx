import React from "react";
import { Layout } from "./Layout";
import { HomePage } from "./HomePage";
import { OnboardingFlow } from "./OnboardingFlow";
import { SettingsPage } from "./SettingsPage";
import { ProfilePage } from "./ProfilePage";
import { HelpPage } from "./HelpPage";
import { ReferralPage } from "./ReferralPage";
import { DictionaryPage } from "./DictionaryPage";
import { AppProvider, useAppContext } from "../contexts/AppContext";

const AppContent: React.FC = () => {
  const { state, setActiveView } = useAppContext();
  const {
    isAuthenticated,
    hasCompletedOnboarding,
    isLoading,
    isInitializing,
    isUserDataLoading,
    user,
  } = state;

  // Determine if we should show loading screen
  const shouldShowLoading = isLoading || isInitializing || isUserDataLoading;

  // Determine loading message based on state
  let loadingMessage = "Loading...";
  if (isInitializing) {
    loadingMessage = "Initializing...";
  } else if (isUserDataLoading) {
    loadingMessage = "Loading user data...";
  }

  console.log("AppContent: Rendering with state:", {
    isLoading,
    isInitializing,
    isUserDataLoading,
    shouldShowLoading,
    isAuthenticated,
    hasCompletedOnboarding,
    user: user?.email || null,
    willShowOnboarding: !isAuthenticated || !hasCompletedOnboarding,
    willShowMainApp:
      isAuthenticated && hasCompletedOnboarding && !shouldShowLoading,
    loadingMessage,
    timestamp: new Date().toISOString(),
  });

  if (shouldShowLoading) {
    console.log(
      "AppContent: Showing loading screen with message:",
      loadingMessage
    );
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-64 bg-gray-200 rounded-full h-2 mb-4">
            <div className="bg-gray-500 h-2 rounded-full animate-pulse w-3/4"></div>
          </div>
          <p className="text-gray-600">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Show onboarding flow if user is not authenticated or hasn't completed onboarding
  if (!isAuthenticated || !hasCompletedOnboarding) {
    console.log("AppContent: Showing onboarding flow", {
      reason: !isAuthenticated
        ? "not authenticated"
        : "onboarding not completed",
    });
    return <OnboardingFlow />;
  }

  // Show main app with layout
  console.log("AppContent: Showing main app layout");
  return (
    <Layout activeView={state.activeView} setActiveView={setActiveView}>
      {state.activeView === "home" && <HomePage />}
      {state.activeView === "settings" && <SettingsPage />}
      {state.activeView === "profile" && <ProfilePage />}
      {state.activeView === "help" && <HelpPage />}
      {state.activeView === "referral" && <ReferralPage />}
      {state.activeView === "dictionary" && <DictionaryPage />}
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};
