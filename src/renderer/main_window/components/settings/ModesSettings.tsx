import React from "react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Select } from "../ui/select";
import {
  ModesSettingsProps,
  SelectOption,
  ApplicationModesDraft,
} from "./types";
import {
  getDefaultPromptForApplication,
  getCurrentPromptForApplication,
  getPromptFieldForApplication,
  initializeApplicationModesDraft,
  hasUnsavedApplicationChanges,
} from "./utils";
import {
  getAllApplicationPrompts,
  getApplicationPrompt,
} from "../../../../shared/config/application_prompts";

export const ModesSettings: React.FC<ModesSettingsProps> = ({
  settings,
  updateSetting,
  setError,
}) => {
  // Application Modes local state - includes per-application prompts
  const [applicationModesDraft, setApplicationModesDraft] =
    React.useState<ApplicationModesDraft>(() =>
      initializeApplicationModesDraft(settings)
    );
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Sync application modes draft when settings change
  React.useEffect(() => {
    setApplicationModesDraft(initializeApplicationModesDraft(settings));
    // Only reset unsaved changes flag when prompt content changes (not auto-saved settings)
    setHasUnsavedChanges(false);
  }, [
    settings.selectedApplicationMode,
    settings.customPrompt,
    // Application-specific prompts
    settings.slackPrompt,
    settings.discordPrompt,
    settings.whatsappPrompt,
    settings.telegramPrompt,
    settings.teamsPrompt,
    settings.messagesPrompt,
    settings.notionPrompt,
    settings.obsidianPrompt,
    settings.logseqPrompt,
    settings.roamPrompt,
    settings.notesPrompt,
    settings.evernotePrompt,
    settings.bearPrompt,
    settings.gmailPrompt,
    settings.outlookPrompt,
    settings.mailPrompt,
    settings.vscodePrompt,
    settings.xcodePrompt,
    settings.webstormPrompt,
    settings.sublimePrompt,
    settings.wordPrompt,
    settings.pagesPrompt,
    settings.docsPrompt,
    settings.browserGithubPrompt,
    settings.browserStackoverflowPrompt,
    settings.browserTwitterPrompt,
    settings.browserLinkedinPrompt,
  ]);

  // Update application modes draft and track changes
  const updateDraft = async (key: string, value: any) => {
    const newDraft = { ...applicationModesDraft, [key]: value };

    // Handle turning ON auto-detection - populate textarea with selected application's prompt
    if (
      key === "enableAutoDetection" &&
      value === true &&
      !applicationModesDraft.enableAutoDetection
    ) {
      const selectedPrompt = getCurrentPromptForApplication(
        newDraft.selectedApplicationMode,
        newDraft
      );
      newDraft.customPrompt = selectedPrompt;
    }

    // Handle application switching with smart memory
    if (
      key === "selectedApplicationMode" &&
      value !== applicationModesDraft.selectedApplicationMode
    ) {
      // Save current prompt to the previous application's field before switching
      const currentApp = applicationModesDraft.selectedApplicationMode;
      const currentPromptInTextarea = applicationModesDraft.customPrompt;

      if (currentApp && currentApp !== "custom") {
        const currentAppField = getPromptFieldForApplication(
          currentApp
        ) as keyof typeof applicationModesDraft;
        (newDraft as any)[currentAppField] = currentPromptInTextarea;
      }

      // Update application mode
      newDraft.selectedApplicationMode = value;

      // Load the prompt for the new application (user's customization or default)
      const newPrompt = getCurrentPromptForApplication(value, newDraft);
      newDraft.customPrompt = newPrompt;
    }

    setApplicationModesDraft(newDraft);

    // Auto-save certain settings immediately (no save button needed)
    const autoSaveSettings = ["enableAutoDetection"];
    if (autoSaveSettings.includes(key)) {
      try {
        await updateSetting(key as keyof typeof settings, value);
        // Don't trigger hasUnsavedChanges for auto-saved settings
        return;
      } catch (error) {
        console.error(`Failed to auto-save ${key}:`, error);
        setError(`Failed to save ${key}`);
      }
    }

    // Only check for unsaved changes on prompt content changes
    const hasPromptChanges = hasUnsavedApplicationChanges(newDraft, settings);
    setHasUnsavedChanges(hasPromptChanges);
  };

  // Save application modes changes to database - optimized to reduce backend calls
  const saveApplicationModes = async () => {
    setIsSaving(true);

    try {
      // Save current prompt to the active application's field before comparing changes
      const currentApp = applicationModesDraft.selectedApplicationMode;
      const currentPrompt = applicationModesDraft.customPrompt;

      // Update the draft to include current prompt in the appropriate field
      const finalDraft = { ...applicationModesDraft };
      if (currentApp && currentApp !== "custom") {
        const appField = getPromptFieldForApplication(
          currentApp
        ) as keyof ApplicationModesDraft;
        (finalDraft as any)[appField] = currentPrompt;
      }

      // Only save settings that have actually changed to reduce backend calls
      const changedSettings: Array<{ key: keyof typeof settings; value: any }> =
        [];

      // Check each setting for changes
      if (
        finalDraft.selectedApplicationMode !== settings.selectedApplicationMode
      ) {
        changedSettings.push({
          key: "selectedApplicationMode",
          value: finalDraft.selectedApplicationMode,
        });
      }
      if (finalDraft.customPrompt !== settings.customPrompt) {
        changedSettings.push({
          key: "customPrompt",
          value: finalDraft.customPrompt,
        });
      }

      // Application-specific prompts
      const appPromptChecks = [
        { draft: "slackPrompt", settings: "slackPrompt", app: "slack" },
        { draft: "discordPrompt", settings: "discordPrompt", app: "discord" },
        {
          draft: "whatsappPrompt",
          settings: "whatsappPrompt",
          app: "whatsapp",
        },
        {
          draft: "telegramPrompt",
          settings: "telegramPrompt",
          app: "telegram",
        },
        { draft: "teamsPrompt", settings: "teamsPrompt", app: "teams" },
        {
          draft: "messagesPrompt",
          settings: "messagesPrompt",
          app: "messages",
        },
        { draft: "notionPrompt", settings: "notionPrompt", app: "notion" },
        {
          draft: "obsidianPrompt",
          settings: "obsidianPrompt",
          app: "obsidian",
        },
        { draft: "logseqPrompt", settings: "logseqPrompt", app: "logseq" },
        { draft: "roamPrompt", settings: "roamPrompt", app: "roam" },
        { draft: "notesPrompt", settings: "notesPrompt", app: "notes" },
        {
          draft: "evernotePrompt",
          settings: "evernotePrompt",
          app: "evernote",
        },
        { draft: "bearPrompt", settings: "bearPrompt", app: "bear" },
        { draft: "gmailPrompt", settings: "gmailPrompt", app: "gmail" },
        { draft: "outlookPrompt", settings: "outlookPrompt", app: "outlook" },
        { draft: "mailPrompt", settings: "mailPrompt", app: "mail" },
        { draft: "vscodePrompt", settings: "vscodePrompt", app: "vscode" },
        { draft: "xcodePrompt", settings: "xcodePrompt", app: "xcode" },
        {
          draft: "webstormPrompt",
          settings: "webstormPrompt",
          app: "webstorm",
        },
        { draft: "sublimePrompt", settings: "sublimePrompt", app: "sublime" },
        { draft: "wordPrompt", settings: "wordPrompt", app: "word" },
        { draft: "pagesPrompt", settings: "pagesPrompt", app: "pages" },
        { draft: "docsPrompt", settings: "docsPrompt", app: "docs" },
        {
          draft: "browserGithubPrompt",
          settings: "browserGithubPrompt",
          app: "browser-github",
        },
        {
          draft: "browserStackoverflowPrompt",
          settings: "browserStackoverflowPrompt",
          app: "browser-stackoverflow",
        },
        {
          draft: "browserTwitterPrompt",
          settings: "browserTwitterPrompt",
          app: "browser-twitter",
        },
        {
          draft: "browserLinkedinPrompt",
          settings: "browserLinkedinPrompt",
          app: "browser-linkedin",
        },
      ];

      for (const check of appPromptChecks) {
        const draftValue = (finalDraft as any)[check.draft];
        const settingsValue =
          (settings as any)[check.settings] ||
          getDefaultPromptForApplication(check.app);
        if (draftValue !== settingsValue) {
          changedSettings.push({
            key: check.settings as keyof typeof settings,
            value: draftValue,
          });
        }
      }


      // Save only the changed settings
      for (const { key, value } of changedSettings) {
        await updateSetting(key, value);
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save application modes:", error);
      setError("Failed to save application modes settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Application mode options organized by category (without separators to avoid selection issues)
  const applicationOptions: SelectOption[] = React.useMemo(() => {
    const apps = getAllApplicationPrompts();
    const options: SelectOption[] = [];

    // Group applications by category
    const categories = {
      messaging: apps.filter((app) => app.category === "messaging"),
      notes: apps.filter((app) => app.category === "notes"),
      email: apps.filter((app) => app.category === "email"),
      code: apps.filter((app) => app.category === "code"),
      documents: apps.filter((app) => app.category === "documents"),
      browser: apps.filter((app) => app.category === "browser"),
      other: apps.filter((app) => app.category === "other"),
    };

    // Add options by category without separators (to avoid UI selection issues)
    Object.entries(categories).forEach(([, categoryApps]) => {
      if (categoryApps.length > 0) {
        // Sort apps within category by priority
        categoryApps.sort((a, b) => b.priority - a.priority);

        // Add applications in this category
        categoryApps.forEach((app) => {
          options.push({
            value: app.applicationId,
            label: `${app.displayName}`, // Clean label without category prefixes
          });
        });
      }
    });

    // Add custom option at the end
    options.push({ value: "custom", label: "Custom" });

    // Sort final options alphabetically within their types
    const customOption = options.pop(); // Remove custom to sort others
    options.sort((a, b) => a.label.localeCompare(b.label));
    if (customOption) options.push(customOption); // Add custom back at end

    return options;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Application Modes
        </h2>
        <p className="text-gray-600 mt-2">
          Automatically format your transcribed text based on the specific
          application you're using
        </p>
      </div>

      {/* Auto-Detect Application Context */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">
            Auto-detect application context
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Automatically select formatting based on which application is active
            (Slack, Notion, Gmail, etc.)
          </p>
        </div>
        <Switch
          checked={applicationModesDraft.enableAutoDetection}
          onCheckedChange={(checked) =>
            updateDraft("enableAutoDetection", checked)
          }
        />
      </div>

      {applicationModesDraft.enableAutoDetection && (
        <div className="space-y-4">
          {/* Application Selection */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900">Application Mode</h3>
            <Select
              value={applicationModesDraft.selectedApplicationMode}
              options={applicationOptions}
              onValueChange={(value) =>
                updateDraft("selectedApplicationMode", value)
              }
              className="w-full max-w-md"
            />
            {applicationModesDraft.selectedApplicationMode &&
              applicationModesDraft.selectedApplicationMode !== "custom" && (
                <p className="text-sm text-gray-600">
                  {getApplicationPrompt(
                    applicationModesDraft.selectedApplicationMode
                  )?.description || "Application-specific formatting"}
                </p>
              )}
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                Formatting Instructions
              </h3>
            </div>
            <textarea
              value={applicationModesDraft.customPrompt}
              onChange={(e) => updateDraft("customPrompt", e.target.value)}
              placeholder="Enter formatting instructions for how you want your transcribed text to be processed..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
            />
            {applicationModesDraft.selectedApplicationMode &&
              applicationModesDraft.selectedApplicationMode !== "custom" && (
                <button
                  type="button"
                  onClick={() =>
                    updateDraft(
                      "customPrompt",
                      getDefaultPromptForApplication(
                        applicationModesDraft.selectedApplicationMode
                      )
                    )
                  }
                  className="text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  Reset to default template for{" "}
                  {getApplicationPrompt(
                    applicationModesDraft.selectedApplicationMode
                  )?.displayName ||
                    applicationModesDraft.selectedApplicationMode}
                </button>
              )}
          </div>
        </div>
      )}

      {/* Save Button - only show when auto-detection is ON and there are changes */}
      {applicationModesDraft.enableAutoDetection && hasUnsavedChanges && (
        <div className="pt-4 border-t border-gray-200">
          <Button
            onClick={saveApplicationModes}
            disabled={isSaving}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
};
