import React, { useState, useEffect } from "react";
import { Tooltip } from "./Tooltip";
import { ViewType } from "../types";
import { Button } from "./ui/button";
import { Settings, User, X, Minus, Square, Maximize2 } from "lucide-react";
import { SettingsDialog } from "./SettingsDialog";
import { ProfilePopover } from "./ProfilePopover";

interface NavigationBarProps {
  showAuthButtons?: boolean;
  activeView?: ViewType;
  onViewChange?: (view: ViewType) => void;
  isOnboarding?: boolean;
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  showAuthButtons = false,
  activeView,
  onViewChange,
  isOnboarding = false,
  currentStep = 1,
  totalSteps = 4,
  stepName = "",
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Get initial window state - check if API is available first
    if (window.electronAPI?.windowControls?.getMaximizedState) {
      window.electronAPI.windowControls
        .getMaximizedState()
        .then(({ isMaximized }) => {
          setIsMaximized(isMaximized);
        })
        .catch((error) => {
          console.warn("Failed to get window maximized state:", error);
        });
    }

    // Listen for tray menu settings dialog open event
    const handleOpenSettings = () => {
      setSettingsOpen(true);
    };

    window.addEventListener("open-settings-dialog", handleOpenSettings);

    return () => {
      window.removeEventListener("open-settings-dialog", handleOpenSettings);
    };
  }, []);

  const handleWindowClose = async () => {
    try {
      if (window.electronAPI?.windowControls?.close) {
        await window.electronAPI.windowControls.close();
      } else {
        console.warn("Window close API not available");
      }
    } catch (error) {
      console.error("Error closing window:", error);
    }
  };

  const handleWindowMinimize = async () => {
    try {
      if (window.electronAPI?.windowControls?.minimize) {
        await window.electronAPI.windowControls.minimize();
      } else {
        console.warn("Window minimize API not available");
      }
    } catch (error) {
      console.error("Error minimizing window:", error);
    }
  };

  const handleWindowMaximize = async () => {
    try {
      if (window.electronAPI?.windowControls?.maximize) {
        const result = await window.electronAPI.windowControls.maximize();
        if (result.success) {
          setIsMaximized(result.action === "maximized");
        }
      } else {
        console.warn("Window maximize API not available");
      }
    } catch (error) {
      console.error("Error maximizing window:", error);
    }
  };

  const handleNavBarDoubleClick = async () => {
    // Double-click on nav bar should maximize/restore window
    await handleWindowMaximize();
  };

  return (
    <div
      className="flex items-center justify-between px-6 bg-gray-100 h-14"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      onDoubleClick={handleNavBarDoubleClick}
    >
      {/* Window Control Buttons - Left Side */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-1 focus:ring-red-300 flex items-center justify-center group transition-colors"
          onClick={handleWindowClose}
          title="Close"
        >
          <X className="h-1.5 w-1.5 text-red-800 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-1 focus:ring-yellow-300 flex items-center justify-center group transition-colors"
          onClick={handleWindowMinimize}
          title="Minimize"
        >
          <Minus className="h-1.5 w-1.5 text-yellow-800 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-1 focus:ring-green-300 flex items-center justify-center group transition-colors"
          onClick={handleWindowMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Square className="h-1.5 w-1.5 text-green-800 opacity-0 group-hover:opacity-100 transition-opacity" />
          ) : (
            <Maximize2 className="h-1.5 w-1.5 text-green-800 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </div>

      {/* Step Indicator - Center (Only during onboarding) */}
      {isOnboarding && (
        <div className="flex items-center gap-3 text-sm text-gray-700">
          <span className="font-semibold">
            Step {currentStep} of {totalSteps}
          </span>
          {stepName && (
            <>
              <span className="text-gray-400">•</span>
              <span className="font-medium">{stepName}</span>
            </>
          )}
        </div>
      )}

      {/* Settings and Profile Buttons - Right Side (Conditional) */}
      {showAuthButtons && (
        <div
          className="flex items-center"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <Tooltip content="Settings" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-200 hover:rounded-xl transition-all duration-200 p-2"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-5 w-5 text-gray-600" />
            </Button>
          </Tooltip>

          <ProfilePopover
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-gray-200 hover:rounded-xl transition-all duration-200 p-2"
              >
                <User className="h-5 w-5 text-gray-600" />
              </Button>
            }
          />
        </div>
      )}

      {/* Empty div to maintain spacing when auth buttons are not shown */}
      {!showAuthButtons && <div></div>}

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};
