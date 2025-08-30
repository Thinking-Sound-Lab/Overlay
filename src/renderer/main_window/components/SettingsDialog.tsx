import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Select, SelectOption } from "./ui/select";
import {
  Settings,
  Palette,
  Monitor,
  User,
  CreditCard,
  Shield,
  Mic,
  Volume2,
  Trash2,
} from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { db } from "../lib/api_client";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection =
  | "general"
  | "system"
  | "personalization"
  | "account"
  | "billing"
  | "privacy";

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { state, setSettings, setError } = useAppContext();
  const { settings } = state;
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const updateSetting = async (
    key: keyof typeof settings,
    value: string | boolean
  ) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    // Auto-save settings immediately
    try {
      // Save to database
      const result = await db.saveUserSettings(updatedSettings);
      if (result.success) {
        // Also save to electron store for offline access
        await window.electronAPI.updateSettings(
          updatedSettings as unknown as Record<string, unknown>
        );
        console.log(`Setting ${key} updated to:`, value);
      } else {
        throw new Error(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to auto-save setting:", error);
      setError("Failed to save setting");
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      // Save to database
      const result = await db.saveUserSettings(settings);
      if (result.success) {
        // Also save to electron store for offline access
        await window.electronAPI.updateSettings(
          settings as unknown as Record<string, unknown>
        );
        setMessage({ type: "success", text: "Settings saved successfully" });
      } else {
        throw new Error(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
      setError("Failed to save settings");
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleResetStats = async () => {
    try {
      await window.electronAPI.resetStatistics();
      setMessage({ type: "success", text: "Statistics reset successfully" });
    } catch (error) {
      console.error("Failed to reset statistics:", error);
      setMessage({ type: "error", text: "Failed to reset statistics" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const sidebarSections = [
    {
      id: "general" as const,
      label: "General",
      icon: Settings,
    },
    {
      id: "system" as const,
      label: "System",
      icon: Monitor,
    },
    {
      id: "personalization" as const,
      label: "Personalization",
      icon: Palette,
    },
    {
      id: "account" as const,
      label: "Account",
      icon: User,
    },
    {
      id: "billing" as const,
      label: "Plans and Billing",
      icon: CreditCard,
    },
    {
      id: "privacy" as const,
      label: "Data and Privacy",
      icon: Shield,
    },
  ];

  // General Section - Microphone and Language
  const renderGeneralSettings = () => {
    const microphoneOptions: SelectOption[] = [
      { value: "default", label: "Default Microphone" },
      { value: "system", label: "System Microphone" },
      { value: "usb", label: "USB Microphone" },
      { value: "bluetooth", label: "Bluetooth Microphone" },
    ];

    const languageOptions: SelectOption[] = [
      { value: "en", label: "English" },
      { value: "es", label: "Spanish" },
      { value: "fr", label: "French" },
      { value: "de", label: "German" },
      { value: "it", label: "Italian" },
      { value: "pt", label: "Portuguese" },
      { value: "ru", label: "Russian" },
      { value: "ja", label: "Japanese" },
      { value: "ko", label: "Korean" },
      { value: "zh", label: "Chinese" },
      { value: "hi", label: "Hindi" },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-6 text-gray-900">General</h2>
        </div>

        {/* Default Microphone */}
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-md font-medium text-gray-900">
              Set default microphone
            </h3>
            <p className="text-gray-600 text-sm">
              Choose your preferred microphone for voice capture.
            </p>
          </div>
          <Select
            value={settings.defaultMicrophone}
            options={microphoneOptions}
            onValueChange={(value) => updateSetting("defaultMicrophone", value)}
            className="w-full max-w-md "
          />
        </div>

        {/* Default Language */}
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-md font-medium text-gray-900">
              Speech recognition language
            </h3>
            <p className="text-gray-600 text-sm">
              Your selected language for speech-to-text conversion.
            </p>
          </div>
          <Select
            value={settings.language}
            options={languageOptions}
            onValueChange={(value) => updateSetting("language", value)}
            className="w-full max-w-md"
          />
        </div>
      </div>
    );
  };

  // System Section - Output, AI, Command Mode
  const renderSystemSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-6 text-gray-900">System</h2>
      </div>

      {/* Sound Header */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Volume2 className="h-5 w-5 text-gray-600" />
          <h3 className="text-xl font-medium text-gray-900">Sound</h3>
        </div>

        <div className="space-y-6">
          {/* Dictate Sound Effects */}
          <div className="flex items-center justify-between py-3">
            <div>
              <h4 className="text-lg font-medium text-gray-900">
                Dictate sound effects
              </h4>
              <p className="text-gray-600 text-sm mt-1">
                Play sound effects during dictation for audio feedback
              </p>
            </div>
            <Switch
              checked={settings.dictateSoundEffects}
              onCheckedChange={(checked) =>
                updateSetting("dictateSoundEffects", checked)
              }
            />
          </div>

          {/* Mute Music While Dictating */}
          <div className="flex items-center justify-between py-3">
            <div>
              <h4 className="text-lg font-medium text-gray-900">
                Mute music while dictating
              </h4>
              <p className="text-gray-600 text-sm mt-1">
                Automatically mute background music during voice input
              </p>
            </div>
            <Switch
              checked={settings.muteMusicWhileDictating}
              onCheckedChange={(checked) =>
                updateSetting("muteMusicWhileDictating", checked)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Personalization Section - Output Mode, AI, Translation, Context Formatting
  const renderPersonalizationSettings = () => {
    const outputModeOptions: SelectOption[] = [
      { value: "clipboard", label: "Copy to Clipboard" },
      { value: "auto-insert", label: "Auto-Insert" },
      { value: "both", label: "Both" },
    ];

    const targetLanguageOptions: SelectOption[] = [
      { value: "en", label: "English" },
      { value: "es", label: "Spanish" },
      { value: "fr", label: "French" },
      { value: "de", label: "German" },
      { value: "it", label: "Italian" },
      { value: "pt", label: "Portuguese" },
      { value: "ru", label: "Russian" },
      { value: "ja", label: "Japanese" },
      { value: "ko", label: "Korean" },
      { value: "zh", label: "Chinese" },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">
            Personalization
          </h2>
        </div>

        {/* Default Output Mode */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Set default output mode
            </h3>
          </div>
          <p className="text-gray-600 text-sm">
            Choose how transcribed text is delivered to your applications.
          </p>
          <Select
            value={settings.outputMode}
            options={outputModeOptions}
            onValueChange={(value) => updateSetting("outputMode", value as any)}
            className="w-full max-w-md"
          />
        </div>

        {/* AI Enhancement */}
        <div className="flex items-center justify-between py-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              AI Enhancement
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              Improve grammar and clarity using AI
            </p>
          </div>
          <Switch
            checked={settings.useAI}
            onCheckedChange={(checked) => updateSetting("useAI", checked)}
          />
        </div>

        {/* Enable Translation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Enable Translation
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                Automatically translate speech to your target language
              </p>
            </div>
            <Switch
              checked={settings.enableTranslation}
              onCheckedChange={(checked) =>
                updateSetting("enableTranslation", checked)
              }
            />
          </div>

          {settings.enableTranslation && (
            <div className="ml-6 space-y-2">
              <label className="text-sm font-medium text-gray-700 block">
                Target Language
              </label>
              <Select
                value={settings.targetLanguage}
                options={targetLanguageOptions}
                onValueChange={(value) =>
                  updateSetting("targetLanguage", value)
                }
                className="w-full max-w-md"
              />
            </div>
          )}
        </div>

        {/* Context Aware Formatting */}
        <div className="flex items-center justify-between py-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Context Aware Formatting
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              Format text differently for emails, notes, code editors, and more
            </p>
          </div>
          <Switch
            checked={settings.enableContextFormatting}
            onCheckedChange={(checked) =>
              updateSetting("enableContextFormatting", checked)
            }
          />
        </div>
      </div>
    );
  };

  // Account Section
  const renderAccountSettings = () => {
    // Get user data from state
    const { user, userProfile } = state;

    const handleSignOut = async () => {
      try {
        await window.electronAPI.auth.signOut();
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to sign out:", error);
        setError("Failed to sign out");
      }
    };

    const handleDeleteAccount = async () => {
      if (
        confirm(
          "Are you sure you want to delete your account? This action cannot be undone."
        )
      ) {
        try {
          await window.electronAPI.deleteAccount();
          onOpenChange(false);
        } catch (error) {
          console.error("Failed to delete account:", error);
          setError("Failed to delete account");
        }
      }
    };

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">Account</h2>
        </div>

        {/* User Information */}
        <div className="space-y-6">
          {/* Name */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Name</h3>
                <p className="text-gray-600 text-sm">Your display name</p>
              </div>
            </div>
            <div className="text-gray-900 font-medium">
              {userProfile?.name || "Not set"}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Email</h3>
                <p className="text-gray-600 text-sm">Your account email</p>
              </div>
            </div>
            <div className="text-gray-900 font-medium">
              {user?.email || "Not available"}
            </div>
          </div>

          {/* Member Since */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Member since
                </h3>
                <p className="text-gray-600 text-sm">Account creation date</p>
              </div>
            </div>
            <div className="text-gray-900 font-medium">
              {userProfile?.created_at
                ? new Date(userProfile.created_at).toLocaleDateString()
                : "Not available"}
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="space-y-4 pt-6">
          <div className="flex gap-3">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="flex-1 text-gray-700 border-gray-300 hover:bg-gray-50"
            >
              Sign Out
            </Button>
            <Button
              onClick={handleDeleteAccount}
              variant="outline"
              className="flex-1 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Billing Section
  const renderBillingSettings = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-6">Plans and Billing</h2>
      </div>
      <div className="text-center py-12">
        <p className="text-gray-500">Billing settings coming soon...</p>
      </div>
    </div>
  );

  // Privacy Section - Data Management
  const renderPrivacySettings = () => {
    const handleDeleteHistory = async () => {
      if (
        confirm(
          "Are you sure you want to delete all transcript data? This action cannot be undone."
        )
      ) {
        try {
          // For now, show a placeholder message - implement when API is available
          setMessage({
            type: "success",
            text: "Delete history feature coming soon",
          });
        } catch (error) {
          console.error("Failed to delete history:", error);
          setMessage({ type: "error", text: "Failed to delete history" });
        }
      }
    };

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">
            Data and Privacy
          </h2>
        </div>

        {/* Privacy Mode */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-gray-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Privacy Mode
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                None of your data will be used to train the model
              </p>
            </div>
          </div>
          <Switch
            checked={settings.privacyMode}
            onCheckedChange={(checked) => updateSetting("privacyMode", checked)}
          />
        </div>

        {/* Delete History */}
        <div className="space-y-4 pt-6">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-gray-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Delete History
              </h3>
              <p className="text-gray-600 text-sm mt-1 mb-4">
                Delete all transcripts data permanently from your account
              </p>
              <Button
                onClick={handleDeleteHistory}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Transcripts
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return renderGeneralSettings();
      case "system":
        return renderSystemSettings();
      case "personalization":
        return renderPersonalizationSettings();
      case "account":
        return renderAccountSettings();
      case "billing":
        return renderBillingSettings();
      case "privacy":
        return renderPrivacySettings();
      default:
        return renderGeneralSettings();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        {/* Header */}
        {/* <DialogHeader className="px-6 py-4">
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader> */}

        {/* Success/Error Messages */}
        {message && (
          <div className="px-6">
            <div
              className={`p-4 rounded-lg transition-all ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              <div className="flex justify-between items-center">
                <span>{message.text}</span>
                <button
                  onClick={() => setMessage(null)}
                  className="ml-4 text-xl leading-none hover:opacity-70"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 border-r bg-gray-50 p-6">
            <div className="space-y-1">
              {sidebarSections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "ghost"}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors justify-start ${
                    activeSection === section.id
                      ? "bg-gray-200 text-gray-900"
                      : "hover:bg-gray-200 hover:text-gray-900 text-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="h-5 w-5" />
                    <span className="font-medium">{section.label}</span>
                  </div>
                </Button>
              ))}
            </div>

            {/* Version at bottom */}
            <div className="absolute bottom-6 left-6 text-xs text-gray-400">
              Overlay v1.0.0
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">{renderContent()}</div>
        </div>

        {/* Footer */}
        {/* <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex justify-end">
            <Button
              onClick={saveSettings}
              disabled={isLoading}
              className="px-8 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div> */}
      </DialogContent>
    </Dialog>
  );
};
