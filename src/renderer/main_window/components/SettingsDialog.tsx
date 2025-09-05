import React, { useState } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  Settings,
  Palette,
  Monitor,
  User,
  CreditCard,
  Shield,
  Wand2,
} from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { db } from "../lib/api_client";
import {
  GeneralSettings,
  SystemSettings,
  PersonalizationSettings,
  ModesSettings,
  AccountSettings,
  BillingSettings,
  PrivacySettings,
  SettingsSection,
} from "./settings";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { state, setSettings, setError } = useAppContext();
  const { settings } = state;
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");

  const updateSetting = async (
    key: keyof typeof settings,
    value: string | boolean
  ) => {
    console.log("Updating setting:", key, value);

    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    // Auto-save settings using unified DB-first approach
    try {
      const result = await db.saveUserSettings(updatedSettings);
      if (result.success) {
        console.log(
          `Setting ${key} updated successfully via DataLoaderService:`,
          value
        );
      } else {
        throw new Error(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save setting:", error);
      setError("Failed to save setting");
    }
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
      id: "modes" as const,
      label: "Context Modes",
      icon: Wand2,
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

  const renderContent = () => {
    // Get user data from state
    const { user } = state;

    // Base props for all settings components
    const baseProps = {
      settings,
      updateSetting,
      setError,
    };

    switch (activeSection) {
      case "general":
        return <GeneralSettings {...baseProps} />;
      case "system":
        return <SystemSettings {...baseProps} />;
      case "personalization":
        return <PersonalizationSettings {...baseProps} />;
      case "modes":
        return <ModesSettings {...baseProps} />;
      case "account":
        return (
          <AccountSettings
            {...baseProps}
            user={user}
            onOpenChange={onOpenChange}
          />
        );
      case "billing":
        return <BillingSettings {...baseProps} />;
      case "privacy":
        return <PrivacySettings {...baseProps} />;
      default:
        return <GeneralSettings {...baseProps} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 border-r bg-gray-50 p-6">
            <div className="space-y-1">
              {sidebarSections.map((section) => (
                <Button
                  key={section.id}
                  variant="ghost"
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors justify-start ${
                    activeSection === section.id
                      ? "bg-gray-200 text-gray-900 hover:bg-gray-200"
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
              className="px-8 bg-gray-800 hover:bg-gray-900"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div> */}
      </DialogContent>
    </Dialog>
  );
};
