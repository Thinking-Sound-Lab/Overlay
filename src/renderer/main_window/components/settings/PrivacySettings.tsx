import React from "react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Trash2 } from "lucide-react";
import { SettingsComponentProps } from "./types";

export const PrivacySettings: React.FC<SettingsComponentProps> = ({
  settings,
  updateSetting,
  setError,
}) => {
  const handleDeleteHistory = async () => {
    if (
      confirm(
        "Are you sure you want to delete all transcript data? This action cannot be undone."
      )
    ) {
      try {
        // For now, show a placeholder message - implement when API is available
        setError("Delete history feature coming soon");
      } catch (error) {
        console.error("Failed to delete history:", error);
        setError("Failed to delete history");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Data and Privacy
        </h2>
      </div>

      {/* Privacy Mode */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Privacy Mode</h3>
          <p className="text-gray-600 text-sm mt-1">
            None of your data will be used to train the model
          </p>
        </div>
        <Switch
          checked={settings.privacyMode}
          onCheckedChange={(checked) => updateSetting("privacyMode", checked)}
        />
      </div>

      {/* Delete History */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <div>
          <h3 className="font-medium text-gray-900">Delete History</h3>
          <p className="text-gray-600 text-sm mt-1 mb-3">
            Delete all transcript data permanently from your account
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
  );
};
