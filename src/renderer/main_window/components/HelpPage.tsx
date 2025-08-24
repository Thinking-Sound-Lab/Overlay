import React from "react";

export const HelpPage: React.FC = () => {
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
};