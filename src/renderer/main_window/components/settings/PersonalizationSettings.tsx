import React from "react";
import { Switch } from "../ui/switch";
import { Select } from "../ui/select";
import { SettingsComponentProps, SelectOption } from "./types";
import { SUPPORTED_LANGUAGES, getLanguageDisplayName } from "../../../../shared/constants/languages";

export const PersonalizationSettings: React.FC<SettingsComponentProps> = ({
  settings,
  updateSetting,
}) => {
  const outputModeOptions: SelectOption[] = [
    { value: "clipboard", label: "Copy to Clipboard" },
    { value: "auto-insert", label: "Auto-Insert" },
    { value: "both", label: "Both" },
  ];

  const targetLanguageOptions: SelectOption[] = SUPPORTED_LANGUAGES.map((language) => ({
    value: language.code,
    label: getLanguageDisplayName(language.code),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Personalization</h2>
      </div>

      {/* Default Output Mode */}
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">Output Mode</h3>
        <p className="text-gray-600 text-sm">
          Choose how transcribed text is delivered to applications
        </p>
        <Select
          value={settings.outputMode}
          options={outputModeOptions}
          onValueChange={(value) => updateSetting("outputMode", value as any)}
          className="w-full max-w-md"
        />
      </div>

      {/* AI Enhancement */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">AI Enhancement</h3>
          <p className="text-gray-600 text-sm mt-1">
            Improve grammar and clarity using AI
          </p>
        </div>
        <Switch
          checked={settings.useAI}
          onCheckedChange={(checked) => updateSetting("useAI", checked)}
        />
      </div>

      {/* Real-time Transcription */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Real-time Mode</h3>
          <p className="text-gray-600 text-sm mt-1">
            Stream audio for immediate transcription
          </p>
        </div>
        <Switch
          checked={settings.enableRealtimeMode}
          onCheckedChange={(checked) => updateSetting("enableRealtimeMode", checked)}
        />
      </div>

      {/* Translation */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Translation</h3>
          <p className="text-gray-600 text-sm mt-1">
            Automatically translate speech to target language
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
        <div className="space-y-2 pl-4">
          <h3 className="text-sm font-medium text-gray-700">Target Language</h3>
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
  );
};