import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Languages, Zap } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { db } from "../lib/api_client";

export const SettingsPage: React.FC = () => {
  const { state, setSettings, setError } = useAppContext();
  const { settings } = state;
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const updateSetting = (
    key: keyof typeof settings,
    value: string | boolean
  ) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
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

  return (
    <div className="space-y-6 p-6">
      {/* Success/Error Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg shadow-lg transition-all ${
            message.type === "success"
              ? "bg-green-100 border border-green-400 text-green-700"
              : "bg-red-100 border border-red-400 text-red-700"
          }`}
        >
          <div className="flex justify-between items-center">
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-4 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Output Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Output Settings
          </CardTitle>
          <CardDescription>
            Configure how transcribed text is delivered to your applications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Output Mode
            </label>
            <div className="space-y-2">
              {[
                {
                  value: "clipboard",
                  label: "Copy to Clipboard",
                  description: "Text is copied and ready to paste",
                },
                {
                  value: "auto-insert",
                  label: "Auto-Insert",
                  description:
                    "Text is automatically typed into the active application",
                },
                {
                  value: "both",
                  label: "Both",
                  description: "Copy to clipboard AND auto-insert",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-start space-x-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="outputMode"
                    value={option.value}
                    checked={settings.outputMode === option.value}
                    onChange={(e) =>
                      updateSetting("outputMode", e.target.value as any)
                    }
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-500">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                AI Enhancement
              </label>
              <div className="text-sm text-gray-500">
                Improve grammar and clarity using AI
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useAI}
                onChange={(e) => updateSetting("useAI", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Language Settings
          </CardTitle>
          <CardDescription>
            Configure speech recognition and translation preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Speech Recognition Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => updateSetting("language", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Enable Translation
                <Badge className="ml-2 bg-blue-500 text-white">PRO</Badge>
              </label>
              <div className="text-sm text-gray-500">
                Automatically translate speech to your target language
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableTranslation}
                onChange={(e) =>
                  updateSetting("enableTranslation", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {settings.enableTranslation && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Target Language
              </label>
              <select
                value={settings.targetLanguage}
                onChange={(e) =>
                  updateSetting("targetLanguage", e.target.value)
                }
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Manage your transcription data and statistics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleResetStats}
            variant="outline"
            className="w-full"
          >
            Reset All Statistics
          </Button>
        </CardContent>
      </Card>

      {/* Save Settings */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={isLoading} className="px-8">
          {isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};
