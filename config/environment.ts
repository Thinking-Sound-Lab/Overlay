// config/environment.ts
import dotenv from "dotenv";
import path from "path";

// Load environment variables immediately
const envFile =
  process.env.NODE_ENV === "development"
    ? ".env.development"
    : ".env.production";

// Try multiple possible locations for the .env file
const possiblePaths = [
  path.join(process.cwd(), envFile),
  path.join(__dirname, "..", envFile),
  path.join(__dirname, "..", "..", envFile),
  path.join(__dirname, "..", "..", "..", envFile),
];

let result: dotenv.DotenvConfigOutput = { error: new Error("No env file found") };

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
  
  if (!config.openaiApiKey) {
    errors.push("OPENAI_API_KEY is required");
  }
  
  if (!config.supabaseUrl) {
    errors.push("REACT_APP_SUPABASE_URL is required");
  }
  
  if (!config.supabaseAnonKey) {
    errors.push("REACT_APP_SUPABASE_ANON_KEY is required");
  }
  
  if (errors.length > 0) {
    console.error("❌ Missing required environment variables:");
    errors.forEach(error => console.error(`  - ${error}`));
    console.log("Current working directory:", process.cwd());
    console.log("Looking for env file at:", path.join(__dirname, "..", "..", envFile));
    
    if (!config.isDevelopment) {
      throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
    }
  }
};

// Log for debugging (only show presence, not actual values)
console.log("Environment config loaded:", {
  environment: config.environment,
  envFile,
  hasOpenAIKey: !!config.openaiApiKey,
  hasSupabaseUrl: !!config.supabaseUrl,
  hasSupabaseKey: !!config.supabaseAnonKey,
  hasPosthogKey: !!config.posthogKey,
  posthogHost: config.posthogHost,
});

// Validate configuration
validateConfig();
