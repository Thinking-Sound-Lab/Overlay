import React, { useState } from "react";
import { ViewType } from "../types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Home, BookOpen, HelpCircle, Gift, Settings } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { SettingsDialog } from "./SettingsDialog";

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
  const { state } = useAppContext();
  const { user } = state;
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Get subscription tier from user profile, defaulting to 'free'
  const subscriptionTier = user?.subscription_tier || "free";
  const isPro = subscriptionTier === "pro";
  return (
    <div className="h-full bg-gray-100 font-inter flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 flex flex-col">
        {/* Logo + Subscription Badge */}
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-xl font-bold text-gray-900">Overlay</span>
          <Badge
            className={`text-xs px-2 py-1 ${
              isPro ? "bg-gray-800 text-white" : "bg-gray-500 text-white"
            }`}
          >
            {isPro ? "PRO" : "FREE"}
          </Badge>
        </div>

        {/* Main Navigation */}
        <nav className="px-4 space-y-1">
          <Button
            variant="ghost"
            className={`w-full text-left p-3 rounded-lg transition-colors justify-start ${activeView === "home" ? "bg-gray-200 text-gray-900 hover:bg-gray-200" : "hover:bg-gray-200 hover:text-gray-900 text-gray-600"}`}
            onClick={() => setActiveView("home")}
          >
            <div className="flex items-center gap-3">
              <Home className="h-5 w-5" />
              <span className="font-medium">Home</span>
            </div>
          </Button>

          <Button
            variant="ghost"
            className={`w-full text-left p-3 rounded-lg transition-colors justify-start ${activeView === "dictionary" ? "bg-gray-200 text-gray-900 hover:bg-gray-200" : "hover:bg-gray-200 hover:text-gray-900 text-gray-600"}`}
            onClick={() => setActiveView("dictionary")}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5" />
              <span className="font-medium">Dictionary</span>
            </div>
          </Button>
        </nav>

        {/* Spacer to push bottom content down */}
        <div className="flex-1"></div>

        {/* Upgrade Box - shown for free users only */}
        {!isPro && (
          <div className="px-4 py-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-800 mb-1">
                Upgrade to Pro
              </div>
              <div className="text-xs text-gray-600 mb-2">
                Unlock premium features & unlimited access
              </div>
              <Button
                size="sm"
                className="w-full bg-gray-800 hover:bg-gray-900 text-white text-xs"
                onClick={() => {
                  // TODO: Implement upgrade flow
                  console.log("Upgrade clicked - implement billing flow");
                }}
              >
                Upgrade Now
              </Button>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="px-4 py-4 space-y-1 border-t border-gray-200">
          <Button
            variant="ghost"
            className="w-full text-left p-3 rounded-lg transition-colors justify-start hover:bg-gray-200 hover:text-gray-900 text-gray-600"
            onClick={() => setSettingsOpen(true)}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5" />
              <span className="font-medium">Settings</span>
            </div>
          </Button>

          <Button
            variant="ghost"
            className={`w-full text-left p-3 rounded-lg transition-colors justify-start ${activeView === "help" ? "bg-gray-200 text-gray-900 hover:bg-gray-200" : "hover:bg-gray-200 hover:text-gray-900 text-gray-600"}`}
            onClick={() => setActiveView("help")}
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">Help</span>
            </div>
          </Button>

          <Button
            variant="ghost"
            className={`w-full text-left p-3 rounded-lg transition-colors justify-start ${activeView === "referral" ? "bg-gray-200 text-gray-900 hover:bg-gray-200" : "hover:bg-gray-200 hover:text-gray-900 text-gray-600"}`}
            onClick={() => setActiveView("referral")}
          >
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5" />
              <span className="font-medium">Referral</span>
            </div>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-xl my-4 mr-4">
        {children}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};
