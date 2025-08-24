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
import { useAuth } from "../hooks/useAuth";
import { useAuthInit } from "../hooks/useAuthInit";

const AppContent: React.FC = () => {
  const { state, setActiveView } = useAppContext();
  const { isAuthenticated, hasCompletedOnboarding, isLoading } = useAuth();

  // Initialize auth only once at the app level
  useAuthInit();

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

  // Show onboarding flow if user is not authenticated or hasn't completed onboarding
  if (!isAuthenticated || !hasCompletedOnboarding) {
    return <OnboardingFlow />;
  }

  // Show main app with layout
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
