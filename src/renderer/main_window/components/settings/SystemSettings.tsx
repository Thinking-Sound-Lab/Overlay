import React from "react";
import { Switch } from "../ui/switch";
import { SettingsComponentProps } from "./types";

export const SystemSettings: React.FC<SettingsComponentProps> = ({
  settings,
  updateSetting,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">System</h2>
      </div>

      {/* Dictate Sound Effects */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Sound Effects</h3>
          <p className="text-gray-600 text-sm mt-1">
            Play sounds during dictation for audio feedback
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Mute Background Music</h3>
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
  );
};