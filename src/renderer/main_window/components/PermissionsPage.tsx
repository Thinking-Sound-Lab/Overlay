import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import {
  Mic,
  Settings,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface PermissionsPageProps {
  onPermissionsGranted: () => void;
}

export const PermissionsPage: React.FC<PermissionsPageProps> = ({
  onPermissionsGranted,
}) => {
  const [microphonePermission, setMicrophonePermission] = useState<
    "granted" | "denied" | "unknown"
  >("unknown");
  const [accessibilityPermission, setAccessibilityPermission] = useState<
    "granted" | "denied" | "unknown"
  >("unknown");
  const [isChecking, setIsChecking] = useState(false);

  const checkPermissions = async () => {
    setIsChecking(true);

    try {
      // Check microphone permission using the proper API
      const hasMicrophone = await window.electronAPI.checkMicrophonePermission();
      setMicrophonePermission(hasMicrophone ? "granted" : "denied");
    } catch (error) {
      console.error("Error checking microphone permission:", error);
      setMicrophonePermission("denied");
    }

    // Check accessibility permission using the proper API
    try {
      const hasAccessibility = await window.electronAPI.checkAccessibilityPermission();
      setAccessibilityPermission(hasAccessibility ? "granted" : "denied");
    } catch (error) {
      console.error("Error checking accessibility permission:", error);
      setAccessibilityPermission("denied");
    }

    setIsChecking(false);
  };

  const requestMicrophonePermission = async () => {
    try {
      // Use Electron's native microphone permission request
      const result = await window.electronAPI.requestMicrophonePermission();
      
      if (result.success) {
        setMicrophonePermission("granted");
      } else {
        setMicrophonePermission("denied");
      }
      
      // Re-check permissions after requesting to be sure
      setTimeout(checkPermissions, 500);
    } catch (error) {
      console.error("Error requesting microphone permission:", error);
      setMicrophonePermission("denied");
    }
  };

  const requestAccessibilityPermission = async () => {
    try {
      await window.electronAPI.requestAccessibilityPermission();
      // Recheck after user potentially grants permission
      setTimeout(checkPermissions, 1000);
    } catch (error) {
      console.error("Error requesting accessibility permission:", error);
    }
  };

  const handleContinue = () => {
    if (
      microphonePermission === "granted" &&
      accessibilityPermission === "granted"
    ) {
      onPermissionsGranted();
    }
  };

  useEffect(() => {
    checkPermissions();

    // Set up periodic permission monitoring
    const permissionCheckInterval = setInterval(() => {
      // Only check if we don't already have both permissions
      if (microphonePermission !== "granted" || accessibilityPermission !== "granted") {
        checkPermissions();
      }
    }, 3000); // Check every 3 seconds

    return () => {
      clearInterval(permissionCheckInterval);
    };
  }, [microphonePermission, accessibilityPermission]);

  const getStatusIcon = (permission: string) => {
    switch (permission) {
      case "granted":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "denied":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300 animate-spin border-t-gray-600" />
        );
    }
  };

  const getStatusText = (permission: string) => {
    switch (permission) {
      case "granted":
        return "Granted";
      case "denied":
        return "Denied";
      default:
        return "Checking...";
    }
  };

  const allPermissionsGranted =
    microphonePermission === "granted" && accessibilityPermission === "granted";

  return (
    <div className="flex-1 p-8 max-w-3xl mx-auto relative">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Set up permissions
        </h1>
        <p className="text-gray-600">
          Overlay needs these permissions to provide voice dictation in any app
        </p>
      </div>

      <div className="space-y-6">
        {/* Microphone Permission */}
        <Card
          className={`border-2 ${
            microphonePermission === "granted"
              ? "border-green-200 bg-green-50"
              : microphonePermission === "denied"
                ? "border-red-200 bg-red-50"
                : "border-gray-200"
          }`}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="h-6 w-6 text-gray-600" />
                <div>
                  <CardTitle className="text-lg">Microphone Access</CardTitle>
                  <CardDescription>
                    Required to capture your voice for transcription
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(microphonePermission)}
                <span
                  className={`text-sm font-medium ${
                    microphonePermission === "granted"
                      ? "text-green-600"
                      : microphonePermission === "denied"
                        ? "text-red-600"
                        : "text-gray-600"
                  }`}
                >
                  {getStatusText(microphonePermission)}
                </span>
              </div>
            </div>
          </CardHeader>
          {microphonePermission === "denied" && (
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Please grant microphone access to continue
                </p>
                <Button
                  onClick={requestMicrophonePermission}
                  size="sm"
                  variant="outline"
                >
                  Grant Access
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Accessibility Permission */}
        <Card
          className={`border-2 ${
            accessibilityPermission === "granted"
              ? "border-green-200 bg-green-50"
              : accessibilityPermission === "denied"
                ? "border-red-200 bg-red-50"
                : "border-gray-200"
          }`}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-gray-600" />
                <div>
                  <CardTitle className="text-lg">
                    Accessibility Access
                  </CardTitle>
                  <CardDescription>
                    Required to insert transcribed text into other applications
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(accessibilityPermission)}
                <span
                  className={`text-sm font-medium ${
                    accessibilityPermission === "granted"
                      ? "text-green-600"
                      : accessibilityPermission === "denied"
                        ? "text-red-600"
                        : "text-gray-600"
                  }`}
                >
                  {getStatusText(accessibilityPermission)}
                </span>
              </div>
            </div>
          </CardHeader>
          {accessibilityPermission === "denied" && (
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 mb-2">
                    {window.electronAPI.platform === "darwin" ? (
                      <>
                        <p className="mb-1">Please enable Overlay in:</p>
                        <p className="font-mono text-xs bg-gray-100 p-2 rounded">
                          System Preferences → Security & Privacy → Privacy → Accessibility
                        </p>
                      </>
                    ) : window.electronAPI.platform === "win32" ? (
                      <>
                        <p className="mb-1">Please enable accessibility access in:</p>
                        <p className="font-mono text-xs bg-gray-100 p-2 rounded">
                          Settings → Ease of Access → Narrator
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mb-1">Please ensure accessibility tools are enabled</p>
                        <p className="font-mono text-xs bg-gray-100 p-2 rounded">
                          Check your desktop environment's accessibility settings
                        </p>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Click "Open Settings" to go directly to the system settings
                  </p>
                </div>
                <Button
                  onClick={requestAccessibilityPermission}
                  size="sm"
                  variant="outline"
                >
                  Open Settings
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Continue Button */}
        <div className="flex justify-center pt-6">
          <Button
            onClick={handleContinue}
            disabled={!allPermissionsGranted || isChecking}
            size="lg"
            className="px-8"
          >
            {allPermissionsGranted ? (
              <>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              "Waiting for permissions..."
            )}
          </Button>
        </div>

        {allPermissionsGranted && (
          <div className="text-center">
            <p className="text-sm text-green-600 font-medium">
              ✅ All permissions granted! You're ready to continue.
            </p>
          </div>
        )}

        {!allPermissionsGranted && (
          <div className="text-center">
            <p className="text-sm text-gray-500">
              {isChecking ? (
                <>
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-300 animate-spin border-t-gray-600 mr-2"></span>
                  Checking permissions...
                </>
              ) : (
                <>
                  Monitoring permissions automatically every 3 seconds.
                  <br />
                  <span className="text-xs">
                    Grant the permissions above, then wait a moment for automatic detection.
                  </span>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
