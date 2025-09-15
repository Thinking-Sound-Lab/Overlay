/**
 * Pro Feature Definitions
 * Centralized configuration for all Pro features and subscription limits
 */

export type ProFeature = 
  | "ai_enhancement"
  | "translation"
  | "custom_modes"
  | "unlimited_words"
  | "profession_models";

export interface FeatureDefinition {
  name: string;
  description: string;
  settingKey?: string;
}

export const PRO_FEATURES: Record<ProFeature, FeatureDefinition> = {
  ai_enhancement: {
    name: "AI Enhancement",
    description: "Improve grammar and clarity using AI",
    settingKey: "useAI"
  },
  translation: {
    name: "Translation",
    description: "Automatically translate speech to target language",
    settingKey: "enableTranslation"
  },
  custom_modes: {
    name: "Custom Modes",
    description: "Create custom prompts and auto-detection modes",
    settingKey: "selectedApplicationMode" // When selectedApplicationMode is "custom" or enableAutoDetection is true
  },
  unlimited_words: {
    name: "Unlimited Words",
    description: "No monthly word limits on transcriptions"
  },
  profession_models: {
    name: "Profession-Specific Models",
    description: "Access to specialized transcription models for Healthcare and Finance",
    settingKey: "profession"
  }
};

export interface SubscriptionLimits {
  monthlyWordLimit: number;
  unlimitedTranscriptLength: boolean;
  trialDurationDays: number;
}

export const SUBSCRIPTION_LIMITS: Record<string, SubscriptionLimits> = {
  free: {
    monthlyWordLimit: 2000,
    unlimitedTranscriptLength: true, // Unlimited transcript length for both free and pro
    trialDurationDays: 0
  },
  pro_trial: {
    monthlyWordLimit: -1, // Unlimited during trial
    unlimitedTranscriptLength: true,
    trialDurationDays: 7
  },
  pro: {
    monthlyWordLimit: -1, // Unlimited
    unlimitedTranscriptLength: true,
    trialDurationDays: 0
  }
};