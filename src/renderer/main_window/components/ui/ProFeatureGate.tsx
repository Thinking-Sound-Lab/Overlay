/**
 * ProFeatureGate Component
 * Wraps components that require Pro access with upgrade prompts
 */

import React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Crown, Lock, Zap } from "lucide-react";
import { useProFeatures } from "../../hooks/useProFeatures";
import { ProFeature, PRO_FEATURES } from "../../../../shared/constants/pro-features";

export interface ProFeatureGateProps {
  feature: ProFeature;
  children: React.ReactNode;
  disabled?: boolean;
  showProBadge?: boolean;
  fallbackText?: string;
}

/**
 * Component that gates Pro features and shows upgrade prompts
 */
export const ProFeatureGate: React.FC<ProFeatureGateProps> = ({
  feature,
  children,
  disabled = false,
  showProBadge = true,
  fallbackText
}) => {
  const { hasFeatureAccess, subscriptionInfo } = useProFeatures();
  const featureInfo = PRO_FEATURES[feature];

  // If user has access, show the feature normally
  if (hasFeatureAccess(feature)) {
    return <>{children}</>;
  }

  // If disabled prop is true, show grayed out version
  if (disabled) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        {showProBadge && (
          <div className="absolute top-0 right-0 -mt-1 -mr-1">
            <Badge className="bg-amber-600 text-white text-xs px-2 py-1">
              <Crown className="h-3 w-3 mr-1" />
              PRO
            </Badge>
          </div>
        )}
      </div>
    );
  }

  // Show upgrade prompt
  return (
    <div className="relative">
      <div className="opacity-75 pointer-events-none">
        {children}
      </div>
      
      {/* Pro Feature Overlay */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          <div className="flex items-center justify-center mb-2">
            <Crown className="h-5 w-5 text-amber-600 mr-1" />
            <Badge className="bg-amber-600 text-white text-xs px-2 py-1">
              PRO FEATURE
            </Badge>
          </div>
          
          <h4 className="font-medium text-gray-900 text-sm mb-1">
            {featureInfo.name}
          </h4>
          
          <p className="text-xs text-gray-600 mb-3">
            {fallbackText || featureInfo.description}
          </p>
          
          <Button
            size="sm"
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => {
              // TODO: Implement upgrade flow
              console.log(`Upgrade clicked for feature: ${feature}`);
            }}
          >
            <Zap className="h-3 w-3 mr-1" />
            Upgrade to Pro
          </Button>
        </div>
      </div>
      
      {showProBadge && (
        <div className="absolute top-0 right-0 -mt-1 -mr-1 z-10">
          <Badge className="bg-amber-600 text-white text-xs px-2 py-1">
            <Crown className="h-3 w-3 mr-1" />
            PRO
          </Badge>
        </div>
      )}
    </div>
  );
};

/**
 * Simple component that shows a Pro badge without gating functionality
 */
export const ProBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <Badge className={`bg-amber-600 text-white text-xs px-2 py-1 ${className}`}>
    <Crown className="h-3 w-3 mr-1" />
    PRO
  </Badge>
);

/**
 * Component for settings that require Pro access
 */
export const ProSettingGate: React.FC<{
  feature: ProFeature;
  children: React.ReactNode;
  label: string;
}> = ({ feature, children, label }) => {
  const { hasFeatureAccess } = useProFeatures();

  if (hasFeatureAccess(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      
      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-400" />
          <ProBadge />
        </div>
      </div>
    </div>
  );
};