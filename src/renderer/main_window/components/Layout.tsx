import React from "react";
import { ViewType } from "../types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Home, BookOpen, HelpCircle, Gift } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

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

  // Get subscription tier from user profile, defaulting to 'free'
  const subscriptionTier = user?.subscription_tier || "free";
  const isPro = subscriptionTier === "pro";
  return (
    <div className="h-full bg-gray-100 font-inter flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 bg-gray-100 flex flex-col">
        {/* Logo + Subscription Badge */}
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-xl font-bold text-gray-900">Overlay</span>
          <Badge
            className={`text-xs px-2 py-1 ${
              isPro ? "bg-blue-500 text-white" : "bg-gray-500 text-white"
            }`}
          >
            {isPro ? "PRO" : "FREE"}
          </Badge>
        </div>

        {/* Main Navigation */}
        <nav className="px-4 space-y-2">
          <Button
            variant={activeView === "home" ? "default" : "ghost"}
            className={`w-full justify-start gap-3 hover:bg-gray-200 hover:rounded-xl hover:text-gray-900 ${activeView === "home" ? "bg-gray-200 rounded-xl text-gray-900" : ""}`}
            onClick={() => setActiveView("home")}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Button>

          <Button
            variant={activeView === "dictionary" ? "default" : "ghost"}
            className={`w-full justify-start gap-3 hover:bg-gray-200 hover:rounded-xl hover:text-gray-900 ${activeView === "dictionary" ? "bg-gray-200 rounded-xl text-gray-900" : ""}`}
            onClick={() => setActiveView("dictionary")}
          >
            <BookOpen className="h-5 w-5" />
            <span>Dictionary</span>
          </Button>
        </nav>

        {/* Spacer to push bottom content down */}
        <div className="flex-1"></div>

        {/* Upgrade Box - shown for free users only */}
        {!isPro && (
          <div className="px-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-800 mb-1">
                Upgrade to Pro
              </div>
              <div className="text-xs text-blue-600 mb-2">
                Unlock premium features & unlimited access
              </div>
              <Button
                size="sm"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs"
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
        <div className="px-4 py-4 space-y-2 border-t border-gray-200">
          <Button
            variant={activeView === "help" ? "default" : "ghost"}
            className={`w-full justify-start gap-3 hover:bg-gray-200 hover:rounded-xl hover:text-gray-900 ${activeView === "help" ? "bg-gray-200 rounded-xl text-gray-900" : ""}`}
            onClick={() => setActiveView("help")}
          >
            <HelpCircle className="h-5 w-5" />
            <span>Help</span>
          </Button>

          <Button
            variant={activeView === "referral" ? "default" : "ghost"}
            className={`w-full justify-start gap-3 hover:bg-gray-200 hover:rounded-xl hover:text-gray-900 ${activeView === "referral" ? "bg-gray-200 rounded-xl text-gray-900" : ""}`}
            onClick={() => setActiveView("referral")}
          >
            <Gift className="h-5 w-5" />
            <span>Referral</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-xl my-4 mr-4">
        {children}
      </div>
    </div>
  );
};
