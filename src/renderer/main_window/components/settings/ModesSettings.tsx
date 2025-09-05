import React from "react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Select } from "../ui/select";
import { ModesSettingsProps, SelectOption, ContextModesDraft } from "./types";
import {
  getDefaultPromptForMode,
  getCurrentPromptForMode,
  getPromptFieldForMode,
  initializeContextModesDraft,
  hasUnsavedContextChanges,
} from "./utils";

export const ModesSettings: React.FC<ModesSettingsProps> = ({
  settings,
  updateSetting,
  setError,
}) => {
  // Context Modes local state - includes per-mode prompts
  const [contextModesDraft, setContextModesDraft] =
    React.useState<ContextModesDraft>(() =>
      initializeContextModesDraft(settings)
    );
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Sync context modes draft when settings change
  React.useEffect(() => {
    setContextModesDraft(initializeContextModesDraft(settings));
    // Only reset unsaved changes flag when prompt content changes (not auto-saved settings)
    setHasUnsavedChanges(false);
  }, [
    settings.selectedMode,
    settings.customPrompt,
    settings.notesPrompt,
    settings.messagesPrompt,
    settings.emailsPrompt,
    settings.codeCommentsPrompt,
    settings.meetingNotesPrompt,
    settings.creativeWritingPrompt,
  ]);

  // Update context modes draft and track changes
  const updateDraft = async (key: string, value: any) => {
    const newDraft = { ...contextModesDraft, [key]: value };

    // Handle turning ON auto-detection - populate textarea with selected mode's prompt
    if (
      key === "enableAutoDetection" &&
      value === true &&
      !contextModesDraft.enableAutoDetection
    ) {
      const selectedPrompt = getCurrentPromptForMode(
        newDraft.selectedMode,
        newDraft
      );
      newDraft.customPrompt = selectedPrompt;
    }

    // Handle mode switching with smart memory
    if (key === "selectedMode" && value !== contextModesDraft.selectedMode) {
      // Save current prompt to the previous mode's field before switching
      const currentMode = contextModesDraft.selectedMode;
      const currentPromptInTextarea = contextModesDraft.customPrompt;

      if (currentMode && currentMode !== "custom") {
        const currentModeField = getPromptFieldForMode(
          currentMode
        ) as keyof typeof contextModesDraft;
        (newDraft as any)[currentModeField] = currentPromptInTextarea;
      }

      // Load the prompt for the new mode (user's customization or default)
      const newPrompt = getCurrentPromptForMode(value, newDraft);
      newDraft.customPrompt = newPrompt;
    }

    setContextModesDraft(newDraft);

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
    const hasPromptChanges = hasUnsavedContextChanges(newDraft, settings);
    setHasUnsavedChanges(hasPromptChanges);
  };

  // Save context modes changes to database - optimized to reduce backend calls
  const saveContextModes = async () => {
    setIsSaving(true);

    try {
      // Save current prompt to the active mode's field before comparing changes
      const currentMode = contextModesDraft.selectedMode;
      const currentPrompt = contextModesDraft.customPrompt;

      // Update the draft to include current prompt in the appropriate field
      const finalDraft = { ...contextModesDraft };
      if (currentMode && currentMode !== "custom") {
        const modeField = getPromptFieldForMode(
          currentMode
        ) as keyof ContextModesDraft;
        (finalDraft as any)[modeField] = currentPrompt;
      }

      // Only save settings that have actually changed to reduce backend calls
      const changedSettings: Array<{ key: keyof typeof settings; value: any }> =
        [];

      // Check each setting for changes
      if (finalDraft.selectedMode !== settings.selectedMode) {
        changedSettings.push({
          key: "selectedMode",
          value: finalDraft.selectedMode,
        });
      }
      if (finalDraft.customPrompt !== settings.customPrompt) {
        changedSettings.push({
          key: "customPrompt",
          value: finalDraft.customPrompt,
        });
      }
      if (
        finalDraft.notesPrompt !==
        (settings.notesPrompt || getDefaultPromptForMode("notes"))
      ) {
        changedSettings.push({
          key: "notesPrompt",
          value: finalDraft.notesPrompt,
        });
      }
      if (
        finalDraft.messagesPrompt !==
        (settings.messagesPrompt || getDefaultPromptForMode("messages"))
      ) {
        changedSettings.push({
          key: "messagesPrompt",
          value: finalDraft.messagesPrompt,
        });
      }
      if (
        finalDraft.emailsPrompt !==
        (settings.emailsPrompt || getDefaultPromptForMode("email"))
      ) {
        changedSettings.push({
          key: "emailsPrompt",
          value: finalDraft.emailsPrompt,
        });
      }
      if (
        finalDraft.codeCommentsPrompt !==
        (settings.codeCommentsPrompt ||
          getDefaultPromptForMode("code_comments"))
      ) {
        changedSettings.push({
          key: "codeCommentsPrompt",
          value: finalDraft.codeCommentsPrompt,
        });
      }
      if (
        finalDraft.meetingNotesPrompt !==
        (settings.meetingNotesPrompt ||
          getDefaultPromptForMode("meeting_notes"))
      ) {
        changedSettings.push({
          key: "meetingNotesPrompt",
          value: finalDraft.meetingNotesPrompt,
        });
      }
      if (
        finalDraft.creativeWritingPrompt !==
        (settings.creativeWritingPrompt ||
          getDefaultPromptForMode("creative_writing"))
      ) {
        changedSettings.push({
          key: "creativeWritingPrompt",
          value: finalDraft.creativeWritingPrompt,
        });
      }

      // Save only the changed settings
      for (const { key, value } of changedSettings) {
        await updateSetting(key, value);
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save context modes:", error);
      setError("Failed to save context modes settings");
    } finally {
      setIsSaving(false);
    }
  };

  const modeOptions: SelectOption[] = [
    { value: "notes", label: "Notes" },
    { value: "messages", label: "Messages" },
    { value: "email", label: "Email" },
    { value: "code_comments", label: "Code Comments" },
    { value: "meeting_notes", label: "Meeting Notes" },
    { value: "creative_writing", label: "Creative Writing" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Context Modes</h2>
        <p className="text-gray-600 mt-2">
          Automatically format your transcribed text based on context or choose
          a specific mode
        </p>
      </div>

      {/* Auto-Detect Application Context */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">
            Auto-detect application context
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Automatically select formatting mode based on active application
          </p>
        </div>
        <Switch
          checked={contextModesDraft.enableAutoDetection}
          onCheckedChange={(checked) =>
            updateDraft("enableAutoDetection", checked)
          }
        />
      </div>

      {contextModesDraft.enableAutoDetection && (
        <div className="space-y-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900">Context Mode</h3>
            <Select
              value={contextModesDraft.selectedMode}
              options={modeOptions}
              onValueChange={(value) => updateDraft("selectedMode", value)}
              className="w-full max-w-md"
            />
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                Formatting Instructions
              </h3>
            </div>
            <textarea
              value={contextModesDraft.customPrompt}
              onChange={(e) => updateDraft("customPrompt", e.target.value)}
              placeholder="Enter formatting instructions for how you want your transcribed text to be processed..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
            />
            {contextModesDraft.selectedMode &&
              contextModesDraft.selectedMode !== "custom" && (
                <button
                  type="button"
                  onClick={() =>
                    updateDraft(
                      "customPrompt",
                      getDefaultPromptForMode(contextModesDraft.selectedMode)
                    )
                  }
                  className="text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  Reset to default template for {contextModesDraft.selectedMode}
                </button>
              )}
          </div>
        </div>
      )}

      {/* Save Button - only show when auto-detection is ON and there are changes */}
      {contextModesDraft.enableAutoDetection && hasUnsavedChanges && (
        <div className="pt-4 border-t border-gray-200">
          <Button
            onClick={saveContextModes}
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
