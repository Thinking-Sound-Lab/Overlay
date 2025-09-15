import React, { useState, useEffect } from "react";
import { Select } from "../ui/select";
import { SettingsComponentProps, SelectOption } from "./types";
import { SUPPORTED_PROFESSIONS, requiresProAccess, isLanguageProfessionSupported } from "../../../../shared/constants/professions";
import { useAppContext } from "../../contexts/AppContext";
import { hasProAccess } from "../../../../shared/utils/subscription-permissions";

export const GeneralSettings: React.FC<SettingsComponentProps> = ({
  settings,
  updateSetting,
}) => {
  const [microphoneOptions, setMicrophoneOptions] = useState<SelectOption[]>(
    []
  );
  const [isLoadingMicrophones, setIsLoadingMicrophones] = useState(true);

  const [currentDeviceId, setCurrentDeviceId] = useState<string>("default");
  const { state } = useAppContext();
  const { user } = state;

  // Load available microphones and get current selection on component mount
  useEffect(() => {
    const loadMicrophonesAndCurrentDevice = async () => {
      setIsLoadingMicrophones(true);
      try {
        // Get available devices
        const devicesResult = await window.electronAPI.microphone.getDevices();
        
        // Get current selected device from session
        const currentResult = await window.electronAPI.microphone.getCurrentDeviceConstraints();

        if (devicesResult.success && devicesResult.data?.devices) {
          const devices = devicesResult.data.devices.map((device: any) => ({
            value: device.deviceId,
            label:
              device.label ||
              `Unknown Device (${device.deviceId.slice(0, 8)}...)`,
          }));

          setMicrophoneOptions(devices);

          // Set current device from session state
          if (currentResult.success && currentResult.data) {
            setCurrentDeviceId(currentResult.data.deviceId);
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

    loadMicrophonesAndCurrentDevice();
  }, []);

  // Handle microphone device change (session-only, no database)
  const handleMicrophoneChange = async (deviceId: string) => {
    try {
      console.log(`[Settings] Changing microphone to: ${deviceId}`);
      
      // Update the session state via IPC (no database persistence)
      // This will be handled by a new IPC handler that calls MicrophoneService.setCurrentDeviceId()
      const result = await window.electronAPI.microphone.setCurrentDevice(deviceId);
      
      if (result.success) {
        setCurrentDeviceId(deviceId);
        console.log(`[Settings] Microphone changed successfully to: ${deviceId}`);
      } else {
        console.error(`[Settings] Failed to change microphone:`, result.error);
      }
    } catch (error) {
      console.error(`[Settings] Error changing microphone:`, error);
    }
  };

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

  // Create profession options with Pro access consideration
  const professionOptions: SelectOption[] = SUPPORTED_PROFESSIONS.map(profession => {
    const canSelect = !requiresProAccess(profession.code) || hasProAccess(user, "profession_models");
    return {
      value: profession.code,
      label: `${profession.icon} ${profession.name}${requiresProAccess(profession.code) ? " (Pro)" : ""}`,
      disabled: !canSelect
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">General</h2>
      </div>

      {/* Microphone Device */}
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">Microphone Device</h3>
        <p className="text-gray-600 text-sm">
          Select which microphone to use for voice capture (session only - changes immediately)
        </p>
        <Select
          value={currentDeviceId}
          options={microphoneOptions}
          onValueChange={handleMicrophoneChange}
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

      {/* Profession for Specialized Models */}
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">
          Professional Context
        </h3>
        <p className="text-gray-600 text-sm">
          Select your profession to use specialized transcription models for better accuracy with industry-specific terminology
        </p>
        <Select
          value={settings.profession || "general"}
          options={professionOptions}
          onValueChange={(value) => updateSetting("profession", value)}
          className="w-full max-w-md"
        />
        {/* Language compatibility warning */}
        {!isLanguageProfessionSupported(settings.language, settings.profession || "general") && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Language Note:</strong> The selected profession requires English. The system will automatically use the general model for your current language.
            </p>
          </div>
        )}
        
        {/* Pro access warning */}
        {requiresProAccess(settings.profession || "general") && !hasProAccess(user, "profession_models") && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              <strong>Pro Feature:</strong> Specialized models for Healthcare and Finance require Pro access for enhanced accuracy with domain-specific terminology.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
