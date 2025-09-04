import React, { useState, useEffect } from "react";
import { Select } from "../ui/select";
import { SettingsComponentProps, SelectOption } from "./types";

export const GeneralSettings: React.FC<SettingsComponentProps> = ({
  settings,
  updateSetting,
}) => {
  const [microphoneOptions, setMicrophoneOptions] = useState<SelectOption[]>(
    []
  );
  const [isLoadingMicrophones, setIsLoadingMicrophones] = useState(true);

  // Load available microphones on component mount
  useEffect(() => {
    const loadMicrophones = async () => {
      setIsLoadingMicrophones(true);
      try {
        const result = await window.electronAPI.microphone.getDevices();

        if (result.success && result.data?.devices) {
          const devices = result.data.devices.map((device: any) => ({
            value: device.deviceId,
            label:
              device.label ||
              `Unknown Device (${device.deviceId.slice(0, 8)}...)`,
          }));

          // Devices are already deduplicated by MicrophoneService
          setMicrophoneOptions(devices);

          // If user currently has "default" selected, auto-select the first available device
          if (settings.defaultMicrophone === "default" && devices.length > 0) {
            const firstDevice = devices[0];
            console.log(
              "Auto-selecting first available microphone:",
              firstDevice.label
            );
            // updateSetting("defaultMicrophone", firstDevice.value);
          }

          // If current device is no longer available, select first available
          const currentDeviceExists = devices.some(
            (device: any) => device.value === settings.defaultMicrophone
          );
          if (
            !currentDeviceExists &&
            devices.length > 0 &&
            settings.defaultMicrophone !== "default"
          ) {
            console.log(
              "Current device no longer available, selecting first available:",
              devices[0].label
            );
            // updateSetting("defaultMicrophone", devices[0].value);
          }
        }
      } catch (error) {
        console.error("Failed to load microphones:", error);
        // Provide fallback for error cases
        setMicrophoneOptions([
          {
            value: "default",
            label: "System Default (Unable to load devices)",
          },
        ]);
      } finally {
        setIsLoadingMicrophones(false);
      }
    };

    loadMicrophones();
  }, []);

  const languageOptions: SelectOption[] = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "pt", label: "Portuguese" },
    { value: "ru", label: "Russian" },
    { value: "ja", label: "Japanese" },
    { value: "ko", label: "Korean" },
    { value: "zh", label: "Chinese" },
    { value: "hi", label: "Hindi" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">General</h2>
      </div>

      {/* Microphone Device */}
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">Microphone Device</h3>
        <p className="text-gray-600 text-sm">
          Select which microphone to use for voice capture
        </p>
        <Select
          value={settings.defaultMicrophone}
          options={microphoneOptions}
          onValueChange={(value) => updateSetting("defaultMicrophone", value)}
          className="w-full max-w-md"
          disabled={isLoadingMicrophones}
        />
        {isLoadingMicrophones && (
          <p className="text-sm text-gray-500 mt-1">Loading microphones...</p>
        )}
      </div>

      {/* Speech Recognition Language */}
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">
          Speech Recognition Language
        </h3>
        <p className="text-gray-600 text-sm">
          Select language for speech-to-text conversion
        </p>
        <Select
          value={settings.language}
          options={languageOptions}
          onValueChange={(value) => updateSetting("language", value)}
          className="w-full max-w-md"
        />
      </div>
    </div>
  );
};
