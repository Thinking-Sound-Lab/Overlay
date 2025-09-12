/**
 * Subscription Permission Utilities
 * Core logic for checking Pro feature access and subscription status
 */

import { UserRecord } from "../types/database";
import { ProFeature, SUBSCRIPTION_LIMITS } from "../constants/pro-features";

export interface SubscriptionInfo {
  tier: "free" | "pro_trial" | "pro";
  displayName: string;
  isOnTrial: boolean;
  isPro: boolean;
  trialInfo?: {
    daysRemaining: number;
    expiresAt: Date;
  };
}

export interface WordUsageInfo {
  allowed: boolean;
  wordsUsed: number;
  limit: number;
  remaining: number;
}

/**
 * Check if user has access to a specific Pro feature
 */
export function hasProAccess(user: UserRecord | null, feature: ProFeature): boolean {
  void feature; // Acknowledged unused feature parameter
  if (!user) return false;

  const tier = user.subscription_tier;
  
  // Pro users always have access
  if (tier === "pro") return true;
  
  // Pro trial users have access if trial is still active
  if (tier === "pro_trial") {
    return isTrialActive(user);
  }
  
  // Free users don't have access to Pro features
  return false;
}

/**
 * Check if a user's trial is still active
 */
export function isTrialActive(user: UserRecord | null): boolean {
  if (!user || user.subscription_tier !== "pro_trial") return false;
  
  if (!user.trial_started_at) return false;
  
  const trialStarted = new Date(user.trial_started_at);
  const trialExpires = new Date(trialStarted.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days
  const now = new Date();
  
  return now < trialExpires;
}

/**
 * Get effective subscription tier (considers trial expiry)
 */
export function getEffectiveTier(user: UserRecord | null): "free" | "pro_trial" | "pro" {
  if (!user) return "free";
  
  if (user.subscription_tier === "pro_trial" && !isTrialActive(user)) {
    return "free"; // Expired trial becomes free
  }
  
  return user.subscription_tier;
}

/**
 * Get subscription info for display purposes
 */
export function getSubscriptionInfo(user: UserRecord | null): SubscriptionInfo {
  if (!user) {
    return {
      tier: "free",
      displayName: "Free",
      isOnTrial: false,
      isPro: false
    };
  }

  const effectiveTier = getEffectiveTier(user);
  
  if (effectiveTier === "pro") {
    return {
      tier: "pro",
      displayName: "Pro",
      isOnTrial: false,
      isPro: true
    };
  }
  
  if (effectiveTier === "pro_trial") {
    const trialStarted = new Date(user.trial_started_at!);
    const trialExpires = new Date(trialStarted.getTime() + (7 * 24 * 60 * 60 * 1000));
    const now = new Date();
    const daysRemaining = Math.ceil((trialExpires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    return {
      tier: "pro_trial",
      displayName: "Pro Trial",
      isOnTrial: true,
      isPro: true,
      trialInfo: {
        daysRemaining: Math.max(0, daysRemaining),
        expiresAt: trialExpires
      }
    };
  }
  
  return {
    tier: "free", 
    displayName: "Free",
    isOnTrial: false,
    isPro: false
  };
}

/**
 * Check if user can use additional words based on their monthly limit
 */
export function canUseWords(user: UserRecord | null, additionalWords: number): WordUsageInfo {
  if (!user) {
    return {
      allowed: false,
      wordsUsed: 0,
      limit: 0,
      remaining: 0
    };
  }

  const effectiveTier = getEffectiveTier(user);
  const limits = SUBSCRIPTION_LIMITS[effectiveTier];
  
  // Pro users have unlimited words
  if (limits.monthlyWordLimit === -1) {
    return {
      allowed: true,
      wordsUsed: user.words_used_this_month || 0,
      limit: -1, // Unlimited
      remaining: -1 // Unlimited
    };
  }
  
  // Free users have monthly limits
  const wordsUsed = user.words_used_this_month || 0;
  const limit = limits.monthlyWordLimit;
  const remaining = limit - wordsUsed;
  const allowed = wordsUsed + additionalWords <= limit;
  
  return {
    allowed,
    wordsUsed,
    limit,
    remaining
  };
}

/**
 * Check if user can access a setting based on Pro requirements
 */
export function canAccessSetting(user: UserRecord | null, settingKey: string): boolean {
  if (!user) return false;
  
  // Map setting keys to Pro features
  const settingToFeatureMap: Record<string, ProFeature> = {
    "useAI": "ai_enhancement",
    "enableRealtimeMode": "realtime_mode", 
    "enableTranslation": "translation",
    "enableAutoDetection": "custom_modes"
  };
  
  const feature = settingToFeatureMap[settingKey];
  if (!feature) {
    return true; // Allow access to non-Pro settings
  }
  
  return hasProAccess(user, feature);
}

/**
 * Validate and filter settings based on Pro access
 */
export function filterSettingsByAccess(user: UserRecord | null, settings: Record<string, any>): Record<string, any> {
  if (!user) return {};
  
  const filteredSettings = { ...settings };
  
  // Check each Pro feature setting
  if (!hasProAccess(user, "ai_enhancement")) {
    filteredSettings.useAI = false;
  }
  
  if (!hasProAccess(user, "realtime_mode")) {
    filteredSettings.enableRealtimeMode = false;
  }
  
  if (!hasProAccess(user, "translation")) {
    filteredSettings.enableTranslation = false;
  }
  
  if (!hasProAccess(user, "custom_modes")) {
    filteredSettings.enableAutoDetection = false;
    if (filteredSettings.selectedApplicationMode === "custom") {
      filteredSettings.selectedApplicationMode = "default"; // Reset to default
    }
  }
  
  return filteredSettings;
}