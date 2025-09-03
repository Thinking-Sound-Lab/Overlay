// config/environment.ts
import dotenv from "dotenv";
import path from "path";

// Load environment variables immediately
const envFile =
  process.env.NODE_ENV === "development" ? ".env.development" : ".env";

// Try multiple possible locations for the .env file
const possiblePaths = [
  path.join(process.cwd(), envFile),
  path.join(__dirname, "..", envFile),
  path.join(__dirname, "..", "..", envFile),
  path.join(__dirname, "..", "..", "..", envFile),
];

let result: dotenv.DotenvConfigOutput = {
  error: new Error("No env file found"),
};

for (const envPath of possiblePaths) {
  try {
    result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Environment loaded from: ${envPath}`);
      break;
    }
  } catch (error) {
    // Continue to next path
    continue;
  }
}

if (result.error) {
  console.warn(`Warning: Could not load ${envFile}:`, result.error.message);
  console.log("Tried paths:", possiblePaths);
}

// Centralized environment configuration
export const config = {
  // Node environment
  environment: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",

  // OpenAI configuration
  openaiApiKey: process.env.OPENAI_API_KEY || "",

  // Deepgram configuration
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || "",

  // Supabase configuration
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || "",
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || "",

  // PostHog analytics configuration
  posthogKey: process.env.REACT_APP_POSTHOG_KEY || "",
  posthogHost: process.env.REACT_APP_POSTHOG_HOST || "https://app.posthog.com",
};

// Validation for required environment variables
const validateConfig = () => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.openaiApiKey) {
    const message = "OPENAI_API_KEY is required";
    if (config.isDevelopment) {
      warnings.push(message);
    } else {
      errors.push(message);
    }
  }

  if (!config.supabaseUrl) {
    const message = "REACT_APP_SUPABASE_URL is required";
    if (config.isDevelopment) {
      warnings.push(message);
    } else {
      errors.push(message);
    }
  }

  if (!config.supabaseAnonKey) {
    const message = "REACT_APP_SUPABASE_ANON_KEY is required";
    if (config.isDevelopment) {
      warnings.push(message);
    } else {
      errors.push(message);
    }
  }

  // Show warnings for development
  if (warnings.length > 0 && config.isDevelopment) {
    console.warn("⚠️  Missing environment variables (development mode):");
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
    console.log("💡 These will be required for production builds");
  }

  // Show errors and throw for production
  if (errors.length > 0) {
    console.error("❌ Missing required environment variables:");
    errors.forEach((error) => console.error(`  - ${error}`));
    console.log("Current working directory:", process.cwd());
    console.log(
      "Looking for env file at:",
      path.join(__dirname, "..", "..", envFile)
    );
    console.log(
      "💡 For CI/CD builds, ensure secrets are set in repository settings"
    );

    // Only throw in production if we have actual errors
    if (!config.isDevelopment) {
      throw new Error(
        `Missing required environment variables: ${errors.join(", ")}`
      );
    }
  }
};

// Log for debugging (only show presence, not actual values)
console.log("Environment config loaded:", {
  environment: config.environment,
  envFile,
  loadedFromFile: !result.error,
  hasOpenAIKey: !!config.openaiApiKey,
  hasDeepgramKey: !!config.deepgramApiKey,
  hasSupabaseUrl: !!config.supabaseUrl,
  hasSupabaseKey: !!config.supabaseAnonKey,
  hasPosthogKey: !!config.posthogKey,
  posthogHost: config.posthogHost,
  // Debug process.env availability
  processEnvKeys: Object.keys(process.env).filter(
    (key) =>
      key.includes("OPENAI") ||
      key.includes("DEEPGRAM") ||
      key.includes("SUPABASE") ||
      key.includes("POSTHOG") ||
      key.includes("REACT_APP")
  ).length,
});

// Validate configuration
validateConfig();
