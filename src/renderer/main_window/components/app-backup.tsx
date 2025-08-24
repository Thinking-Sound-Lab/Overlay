import React, { useState, useEffect } from "react";
import { Tooltip } from "./Tooltip";
import { db } from "../lib/api_client";

interface Settings {
  outputMode: "auto-insert" | "clipboard" | "both";
  openaiApiKey: string;
  useAI: boolean;
  language: string;
}

interface UserStats {
  totalWordCount: number;
  averageWPM: number;
  totalRecordings: number;
  streakDays: number;
}

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  wordCount: number;
  wpm: number;
}

export const App: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    outputMode: "both",
    openaiApiKey: "",
    useAI: true,
    language: "auto",
  });

  const [activeView, setActiveView] = useState<
    "home" | "dictionary" | "help" | "referral" | "settings" | "profile"
  >("home");

  const [userStats, setUserStats] = useState<UserStats>({
    totalWordCount: 0,
    averageWPM: 0,
    totalRecordings: 0,
    streakDays: 0,
  });

  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [userName] = useState("User");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
    loadUserStats();
    loadTranscripts();

    // Listen for real-time updates
    const unsubscribeStats = window.electronAPI.onStatisticsUpdate(
      (stats: any) => {
        setUserStats({
          totalWordCount: Number(stats.totalWordCount) || 0,
          averageWPM: Number(stats.averageWPM) || 0,
          totalRecordings: Number(stats.totalRecordings) || 0,
          streakDays: Number(stats.streakDays) || 0,
        });
      }
    );

    const unsubscribeActivity = window.electronAPI.onActivityUpdate(
      (activity: any) => {
        if (activity.type === "transcript") {
          const transcriptEntry: TranscriptEntry = {
            id: activity.data.id,
            text: activity.data.text,
            timestamp: new Date(activity.data.timestamp),
            wordCount: Number(activity.data.wordCount) || 0,
            wpm: Number(activity.data.wpm) || 0,
          };
          setTranscripts((prev) => [transcriptEntry, ...prev].slice(0, 50)); // Keep last 50 transcripts
        }
      }
    );

    return () => {
      unsubscribeStats();
      unsubscribeActivity();
    };
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await window.electronAPI.getSettings();
      setSettings(savedSettings as unknown as Settings);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const loadUserStats = async () => {
    try {
      const stats = await window.electronAPI.getStatistics();
      setUserStats({
        totalWordCount: Number(stats.totalWordCount) || 0,
        averageWPM: Number(stats.averageWPM) || 0,
        totalRecordings: Number(stats.totalRecordings) || 0,
        streakDays: Number(stats.streakDays) || 0,
      });
    } catch (error) {
      console.error("Failed to load user stats:", error);
    }
  };

  const loadTranscripts = async () => {
    try {
      // Use database API instead of store-based API
      const result = await db.getTranscripts(100);
      
      if (result.success && result.data?.data) {
        const formattedTranscripts = result.data.data.map(
          (item: any): TranscriptEntry => ({
            id: item.id,
            text: item.text,
            timestamp: new Date(item.created_at),
            wordCount: Number(item.word_count) || 0,
            wpm: Number(item.wpm) || 0,
          })
        );
        setTranscripts(formattedTranscripts);
      } else {
        // Fallback to store-based API if database fails
        console.warn("Database API failed, falling back to store-based API");
        const transcriptData = await window.electronAPI.getTranscripts();
        const formattedTranscripts = (transcriptData || []).map(
          (item: any): TranscriptEntry => ({
            id: item.id,
            text: item.text,
            timestamp: new Date(item.timestamp),
            wordCount: Number(item.wordCount) || 0,
            wpm: Number(item.wpm) || 0,
          })
        );
        setTranscripts(formattedTranscripts);
      }
    } catch (error) {
      console.error("Failed to load transcripts:", error);
      // Try fallback to store-based API
      try {
        const transcriptData = await window.electronAPI.getTranscripts();
        const formattedTranscripts = (transcriptData || []).map(
          (item: any): TranscriptEntry => ({
            id: item.id,
            text: item.text,
            timestamp: new Date(item.timestamp),
            wordCount: Number(item.wordCount) || 0,
            wpm: Number(item.wpm) || 0,
          })
        );
        setTranscripts(formattedTranscripts);
      } catch (fallbackError) {
        console.error("Fallback transcript loading also failed:", fallbackError);
      }
    }
  };

  const updateSetting = (key: keyof Settings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await window.electronAPI.updateSettings(
        settings as unknown as Record<string, unknown>
      );
      setMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderHomeContent = () => {
    const formatDate = (date: Date) => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return "TODAY";
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "YESTERDAY";
      } else {
        return date
          .toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
          .toUpperCase();
      }
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };

    const groupTranscriptsByDate = () => {
      const groups: { [key: string]: TranscriptEntry[] } = {};

      transcripts.forEach((transcript) => {
        const dateKey = formatDate(transcript.timestamp);
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(transcript);
      });

      return groups;
    };

    const transcriptGroups = groupTranscriptsByDate();

    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {userName}
          </h1>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-lg">
              <span className="text-orange-600">🔥</span>
              <span className="font-semibold text-gray-700">
                {userStats.streakDays} days
              </span>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
              <span className="text-blue-600">📝</span>
              <span className="font-semibold text-gray-700">
                {userStats.totalWordCount.toLocaleString()} words
              </span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-lg">
              <span className="text-yellow-600">⭐</span>
              <span className="font-semibold text-gray-700">
                {userStats.averageWPM.toFixed(1)} WPM
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 mb-8 text-white text-center">
          <h2 className="text-xl font-semibold mb-3">
            Voice dictation in any app
          </h2>
          <p className="opacity-90 mb-4">
            Hold down the trigger key and speak into any textbox
          </p>
          <div className="text-sm opacity-75">
            <span>Total recordings: {userStats.totalRecordings}</span>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Recent transcripts
          </h3>

          {Object.keys(transcriptGroups).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>
                No transcripts yet. Start dictating to see your activity here!
              </p>
            </div>
          ) : (
            Object.entries(transcriptGroups).map(
              ([dateKey, transcriptList]) => (
                <div key={dateKey} className="mb-8">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pl-4">
                    {dateKey}
                  </h4>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    {transcriptList.map((transcript, index) => (
                      <div
                        key={transcript.id}
                        className={`p-4 ${index !== transcriptList.length - 1 ? "border-b border-gray-200" : ""}`}
                      >
                        <div className="text-xs font-medium text-gray-500 mb-2">
                          {formatTime(transcript.timestamp)}
                        </div>
                        <div className="text-gray-900 font-medium mb-2 leading-relaxed">
                          {transcript.text}
                        </div>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span className="font-medium">
                            {transcript.wordCount} words
                          </span>
                          <span className="font-medium">
                            {transcript.wpm.toFixed(1)} WPM
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>
    );
  };

  const renderSettingsContent = () => (
    <div className="flex-1 p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">
        <div className="bg-gray-50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="outputMode"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Output Mode
              </label>
              <select
                id="outputMode"
                value={settings.outputMode}
                onChange={(e) => updateSetting("outputMode", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="auto-insert">Auto-insert into active app</option>
                <option value="clipboard">Copy to clipboard only</option>
                <option value="both">Both (insert + clipboard)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Language
              </label>
              <select
                id="language"
                value={settings.language}
                onChange={(e) => updateSetting("language", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            AI Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="openaiApiKey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                OpenAI API Key
              </label>
              <input
                id="openaiApiKey"
                type="password"
                value={settings.openaiApiKey}
                onChange={(e) => updateSetting("openaiApiKey", e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              />
              <p className="mt-2 text-xs text-gray-500">
                Get your API key from{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  OpenAI Platform
                </a>
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="useAI"
                checked={settings.useAI}
                onChange={(e) => updateSetting("useAI", e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="useAI" className="ml-3 text-sm text-gray-700">
                Use AI refinement (improves grammar and formatting)
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? "Saving..." : "Save Settings"}
        </button>

        {message && (
          <div
            className={`p-4 rounded-lg text-center font-medium ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeView) {
      case "home":
        return renderHomeContent();
      case "dictionary":
        return (
          <div className="flex-1 p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Dictionary
            </h1>
            <p className="text-gray-600">
              Dictionary management features coming soon...
            </p>
          </div>
        );
      case "help":
        return (
          <div className="flex-1 p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Help & Support
            </h1>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Getting Started
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Use the global hotkey to start recording your voice and have
                  it transcribed into text.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Keyboard Shortcuts
                </h3>
                <ul className="text-gray-600 leading-relaxed list-disc pl-5">
                  <li>
                    <strong>Hold F1 (macOS)</strong> or{" "}
                    <strong>Ctrl+Shift+Space</strong> - Start/Stop recording
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Need More Help?
                </h3>
                <button
                  onClick={() =>
                    window.electronAPI.openExternalLink(
                      "https://github.com/your-repo/overlay/issues"
                    )
                  }
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Report an Issue
                </button>
              </div>
            </div>
          </div>
        );
      case "referral":
        return (
          <div className="flex-1 p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Refer Friends
            </h1>
            <div className="space-y-4">
              <p className="text-gray-600 leading-relaxed">
                Share Overlay with your friends and colleagues!
              </p>
              <p className="text-gray-600 leading-relaxed">
                Referral program coming soon...
              </p>
            </div>
          </div>
        );
      case "settings":
        return renderSettingsContent();
      case "profile":
        return (
          <div className="flex-1 p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>
            <div className="max-w-lg">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  User Information
                </h3>
                <div className="space-y-3 text-gray-600">
                  <p>
                    <strong className="text-gray-900">Name:</strong> {userName}
                  </p>
                  <p>
                    <strong className="text-gray-900">Total Words:</strong>{" "}
                    {userStats.totalWordCount.toLocaleString()}
                  </p>
                  <p>
                    <strong className="text-gray-900">Average WPM:</strong>{" "}
                    {userStats.averageWPM.toFixed(1)}
                  </p>
                  <p>
                    <strong className="text-gray-900">Total Recordings:</strong>{" "}
                    {userStats.totalRecordings}
                  </p>
                  <p>
                    <strong className="text-gray-900">Current Streak:</strong>{" "}
                    {userStats.streakDays} days
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return renderHomeContent();
    }
  };

  return (
    <div className="h-screen bg-gray-50 font-inter flex flex-col overflow-hidden p-4">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <span className="text-xl font-bold text-gray-900">Overlay</span>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip content="Settings" side="bottom">
            <button
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                activeView === "settings"
                  ? "bg-gray-100 text-indigo-600"
                  : "text-gray-600"
              }`}
              onClick={() => setActiveView("settings")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </Tooltip>
          <Tooltip content="Profile" side="bottom">
            <button
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                activeView === "profile"
                  ? "bg-gray-100 text-indigo-600"
                  : "text-gray-600"
              }`}
              onClick={() => setActiveView("profile")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <nav className="flex-1 px-4 py-6 space-y-2">
            <button
              className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                activeView === "home"
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveView("home")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span>Home</span>
            </button>

            <button
              className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                activeView === "dictionary"
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveView("dictionary")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span>Dictionary</span>
            </button>
          </nav>

          {/* Bottom buttons */}
          <div className="px-4 py-4 border-t border-gray-200 space-y-2">
            <button
              className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                activeView === "help"
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveView("help")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Help</span>
            </button>

            <button
              className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                activeView === "referral"
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveView("referral")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
              <span>Referral</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-white">{renderContent()}</div>
      </div>
    </div>
  );
};
