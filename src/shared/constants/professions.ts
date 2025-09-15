// Single source of truth for profession-specific transcription functionality

export interface ProfessionOption {
  code: string;
  name: string;
  description: string;
  deepgramModel: string;
  icon: string;
}

export const SUPPORTED_PROFESSIONS: ProfessionOption[] = [
  {
    code: "general",
    name: "General",
    description:
      "Optimized for everyday conversations and general use (supports all languages)",
    deepgramModel: "nova-2",
    icon: "💬",
  },
  {
    code: "medical",
    name: "Healthcare & Medical",
    description:
      "Specialized for medical terminology, clinical notes, and healthcare communications (English only)",
    deepgramModel: "nova-2-medical",
    icon: "🏥",
  },
  {
    code: "finance",
    name: "Finance & Business",
    description:
      "Optimized for financial terminology, earnings calls, and business meetings (English only)",
    deepgramModel: "nova-2-finance",
    icon: "💼",
  },
  {
    code: "legal",
    name: "Legal",
    description:
      "Enhanced accuracy for legal documents and professional terminology (English only)",
    deepgramModel: "nova-2",
    icon: "⚖️",
  },
  {
    code: "education",
    name: "Education & Academic",
    description:
      "Optimized for academic discussions and educational content (English only)",
    deepgramModel: "nova-2",
    icon: "🎓",
  },
];

// Default profession for new users
export const DEFAULT_PROFESSION = "general";

// Helper functions for consistent profession handling across the app

/**
 * Get profession by code
 */
export const getProfessionByCode = (
  code: string
): ProfessionOption | undefined => {
  return SUPPORTED_PROFESSIONS.find((prof) => prof.code === code);
};

/**
 * Get display name for a profession
 */
export const getProfessionDisplayName = (code: string): string => {
  const profession = getProfessionByCode(code);
  return profession ? profession.name : code;
};

/**
 * Get Deepgram model for a profession with language validation
 */
export const getDeepgramModelForProfession = (
  professionCode: string,
  language?: string
): string => {
  const profession = getProfessionByCode(professionCode);
  if (!profession) return "nova-3";

  // If non-English language with specialized profession, fall back to general model
  if (language && language !== "en" && requiresEnglish(professionCode)) {
    console.log(
      `[Professions] ${professionCode} requires English but language is ${language}, using nova-3`
    );
    return "nova-3";
  }

  return profession.deepgramModel;
};

/**
 * Check if profession requires Pro access
 */
export const requiresProAccess = (professionCode: string): boolean => {
  // Medical and Finance models require Pro access due to specialized nature
  return ["medical", "finance"].includes(professionCode);
};

/**
 * Check if profession requires English language
 */
export const requiresEnglish = (professionCode: string): boolean => {
  // All specialized professions except general require English
  return professionCode !== "general";
};

/**
 * Check if language-profession combination is supported
 */
export const isLanguageProfessionSupported = (
  language: string,
  professionCode: string
): boolean => {
  if (professionCode === "general") return true; // General supports all languages
  return language === "en"; // Specialized professions only support English
};
