// Global setup for Playwright E2E tests
import { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');
  
  // Set up any global test data or configurations
  process.env.NODE_ENV = 'test';
  
  // Ensure test environment variables are set
  if (!process.env.REACT_APP_SUPABASE_URL) {
    console.warn('⚠️  REACT_APP_SUPABASE_URL not set for tests');
  }
  
  // Create a browser instance for shared use if needed
  // const browser = await chromium.launch();
  // await browser.close();
  
  console.log('✅ Global setup completed');
}

export default globalSetup;