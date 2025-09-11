/**
 * React Hook for Pro Features
 * Provides easy access to Pro feature status and subscription info
 */

import { useMemo } from "react";
import { useAppContext } from "../contexts/AppContext";
import { 
  hasProAccess, 
  getSubscriptionInfo, 
  canUseWords,
  canAccessSetting
} from "../../../shared/utils/subscription-permissions";
import { ProFeature } from "../../../shared/constants/pro-features";

export interface UseProFeaturesReturn {
  // Feature access checks
  hasFeatureAccess: (feature: ProFeature) => boolean;
  canAccessSettings: (settingKey: string) => boolean;
  
  // Subscription status
  isPro: boolean;
  isOnTrial: boolean;
  subscriptionInfo: ReturnType<typeof getSubscriptionInfo>;
  
  // Word usage for free users
  wordUsage: ReturnType<typeof canUseWords>;
  canUseMoreWords: (additionalWords: number) => boolean;
  
  // Upgrade helpers
  shouldShowUpgrade: boolean;
  upgradeReason: string | null;
}

/**
 * Hook to check Pro feature access and subscription status
 */
export const useProFeatures = (): UseProFeaturesReturn => {
  const { state } = useAppContext();
  const { user } = state;

  return useMemo(() => {
    const subscriptionInfo = getSubscriptionInfo(user);
    const wordUsage = canUseWords(user, 0);

    // Helper function to check feature access
    const hasFeatureAccess = (feature: ProFeature): boolean => {
      return hasProAccess(user, feature);
    };

    // Helper function to check setting access
    const canAccessSettings = (settingKey: string): boolean => {
      return canAccessSetting(user, settingKey);
    };

    // Helper to check if user can use more words
    const canUseMoreWords = (additionalWords: number): boolean => {
      return canUseWords(user, additionalWords).allowed;
    };

    // Determine if upgrade UI should be shown
    const shouldShowUpgrade = !subscriptionInfo.isPro;
    
    // Determine upgrade reason
    let upgradeReason: string | null = null;
    if (!subscriptionInfo.isPro) {
      if (wordUsage.limit > 0 && wordUsage.wordsUsed >= wordUsage.limit * 0.8) {
        upgradeReason = "You're approaching your monthly word limit";
      } else {
        upgradeReason = "Unlock all Pro features";
      }
    } else if (subscriptionInfo.isOnTrial && subscriptionInfo.trialInfo) {
      if (subscriptionInfo.trialInfo.daysRemaining <= 2) {
        upgradeReason = `Trial expires in ${subscriptionInfo.trialInfo.daysRemaining} days`;
      }
    }

    return {
      hasFeatureAccess,
      canAccessSettings,
      isPro: subscriptionInfo.isPro,
      isOnTrial: subscriptionInfo.isOnTrial,
      subscriptionInfo,
      wordUsage,
      canUseMoreWords,
      shouldShowUpgrade,
      upgradeReason
    };
  }, [user]);
};

/**
 * Hook for specific feature checks (convenience hook)
 */
export const useProFeature = (feature: ProFeature) => {
  const { hasFeatureAccess } = useProFeatures();
  return hasFeatureAccess(feature);
};