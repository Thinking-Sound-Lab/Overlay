import React from "react";
import { Switch } from "../ui/switch";
import { Select } from "../ui/select";
import { SettingsComponentProps, SelectOption } from "./types";
import { SUPPORTED_LANGUAGES, getLanguageDisplayName } from "../../../../shared/constants/languages";
import { ProFeatureGate, ProSettingGate } from "../ui/ProFeatureGate";
import { useProFeatures } from "../../hooks/useProFeatures";

export const PersonalizationSettings: React.FC<SettingsComponentProps> = ({
  settings,
  updateSetting,
}) => {
  const { hasFeatureAccess } = useProFeatures();
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
      <ProSettingGate feature="ai_enhancement" label="AI Enhancement">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">AI Enhancement</h3>
            <p className="text-gray-600 text-sm mt-1">
              Improve grammar and clarity using AI
            </p>
          </div>
          <Switch
            checked={settings.useAI && hasFeatureAccess("ai_enhancement")}
            onCheckedChange={(checked) => {
              if (hasFeatureAccess("ai_enhancement")) {
                updateSetting("useAI", checked);
              }
            }}
            disabled={!hasFeatureAccess("ai_enhancement")}
          />
        </div>
      </ProSettingGate>

      {/* Real-time Transcription */}
      <ProSettingGate feature="realtime_mode" label="Real-time Mode">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Real-time Mode</h3>
            <p className="text-gray-600 text-sm mt-1">
              Stream audio for immediate transcription
            </p>
          </div>
          <Switch
            checked={settings.enableRealtimeMode && hasFeatureAccess("realtime_mode")}
            onCheckedChange={(checked) => {
              if (hasFeatureAccess("realtime_mode")) {
                updateSetting("enableRealtimeMode", checked);
              }
            }}
            disabled={!hasFeatureAccess("realtime_mode")}
          />
        </div>
      </ProSettingGate>

      {/* Translation */}
      <ProSettingGate feature="translation" label="Translation">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Translation</h3>
            <p className="text-gray-600 text-sm mt-1">
              Automatically translate speech to target language
            </p>
          </div>
          <Switch
            checked={settings.enableTranslation && hasFeatureAccess("translation")}
            onCheckedChange={(checked) => {
              if (hasFeatureAccess("translation")) {
                updateSetting("enableTranslation", checked);
              }
            }}
            disabled={!hasFeatureAccess("translation")}
          />
        </div>
      </ProSettingGate>

      {settings.enableTranslation && hasFeatureAccess("translation") && (
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