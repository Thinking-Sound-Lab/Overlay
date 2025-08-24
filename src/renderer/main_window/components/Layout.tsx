import React from "react";
import { Tooltip } from "./Tooltip";
import { ViewType } from "../types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Settings, User, Home, BookOpen, HelpCircle, Gift } from "lucide-react";

interface LayoutProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activeView,
  setActiveView,
  children,
}) => {
  return (
    <div className="h-screen bg-gray-50 font-inter flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <div
        className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex items-center gap-1">
          <span className="text-2xl">🎯</span>
          <span className="text-xl font-bold text-gray-900">Overlay</span>
          <Badge className="ml-2 bg-blue-500 text-white">PRO</Badge>
        </div>
        <div
          className="flex items-center"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <Tooltip content="Settings" side="bottom">
            <Button
              variant={activeView === "settings" ? "default" : "ghost"}
              size="icon"
              onClick={() => setActiveView("settings")}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Profile" side="bottom">
            <Button
              variant={activeView === "profile" ? "default" : "ghost"}
              size="icon"
              onClick={() => setActiveView("profile")}
            >
              <User className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-52 bg-white border-r border-gray-200 flex flex-col">
          <nav className="flex-1 px-4 py-6 space-y-2">
            <Button
              variant={activeView === "home" ? "default" : "ghost"}
              className={`w-full justify-start gap-3 hover:bg-gray-100 hover:rounded-lg hover:text-gray-900 ${activeView === "home" ? "bg-gray-100 rounded-md text-gray-900" : ""}`}
              onClick={() => setActiveView("home")}
            >
              <Home className="h-5 w-5" />
              <span>Home</span>
            </Button>

            <Button
              variant={activeView === "dictionary" ? "default" : "ghost"}
              className={`w-full justify-start gap-3 hover:bg-gray-100 hover:rounded-md hover:text-gray-900 ${activeView === "dictionary" ? "bg-gray-100 rounded-md text-gray-900" : ""}`}
              onClick={() => setActiveView("dictionary")}
            >
              <BookOpen className="h-5 w-5" />
              <span>Dictionary</span>
            </Button>
          </nav>

          {/* Bottom buttons */}
          <div className="px-4 py-4 border-t border-gray-200 space-y-2">
            <Button
              variant={activeView === "help" ? "default" : "ghost"}
              className={`w-full justify-start gap-3 hover:bg-gray-100 hover:rounded-md hover:text-gray-900 ${activeView === "help" ? "bg-gray-100 rounded-md text-gray-900" : ""}`}
              onClick={() => setActiveView("help")}
            >
              <HelpCircle className="h-5 w-5" />
              <span>Help</span>
            </Button>

            <Button
              variant={activeView === "referral" ? "default" : "ghost"}
              className={`w-full justify-start gap-3 hover:bg-gray-100 hover:rounded-md hover:text-gray-900 ${activeView === "referral" ? "bg-gray-100 rounded-md text-gray-900" : ""}`}
              onClick={() => setActiveView("referral")}
            >
              <Gift className="h-5 w-5" />
              <span>Referral</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-white">{children}</div>
      </div>
    </div>
  );
};
