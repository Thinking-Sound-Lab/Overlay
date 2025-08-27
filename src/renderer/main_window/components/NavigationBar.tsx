import React, { useState, useEffect } from "react";
import { Tooltip } from "./Tooltip";
import { ViewType } from "../types";
import { Button } from "./ui/button";
import { Settings, User, X, Minus, Square, Maximize2 } from "lucide-react";

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
  totalSteps = 3,
  stepName = "",
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Get initial window state
    window.electronAPI.windowControls
      .getMaximizedState()
      .then(({ isMaximized }) => {
        setIsMaximized(isMaximized);
      });
  }, []);

  const handleWindowClose = async () => {
    try {
      await window.electronAPI.windowControls.close();
    } catch (error) {
      console.error("Error closing window:", error);
    }
  };

  const handleWindowMinimize = async () => {
    try {
      await window.electronAPI.windowControls.minimize();
    } catch (error) {
      console.error("Error minimizing window:", error);
    }
  };

  const handleWindowMaximize = async () => {
    try {
      const result = await window.electronAPI.windowControls.maximize();
      if (result.success) {
        setIsMaximized(result.action === "maximized");
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
      className="flex items-center justify-between px-4 bg-gray-100 border-b border-gray-200 h-12"
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
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">
            Step {currentStep} of {totalSteps}
          </span>
          {stepName && (
            <>
              <span>•</span>
              <span>{stepName}</span>
            </>
          )}
        </div>
      )}

      {/* Settings and Profile Buttons - Right Side (Conditional) */}
      {showAuthButtons && onViewChange && (
        <div
          className="flex items-center"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <Tooltip content="Settings" side="bottom">
            <Button
              variant={activeView === "settings" ? "default" : "ghost"}
              size="icon"
              className="hover:bg-gray-200 hover:rounded-xl"
              onClick={() => onViewChange("settings")}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Profile" side="bottom">
            <Button
              variant={activeView === "profile" ? "default" : "ghost"}
              size="icon"
              className="hover:bg-gray-200 hover:rounded-xl"
              onClick={() => onViewChange("profile")}
            >
              <User className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      )}

      {/* Empty div to maintain spacing when auth buttons are not shown */}
      {!showAuthButtons && <div></div>}
    </div>
  );
};
