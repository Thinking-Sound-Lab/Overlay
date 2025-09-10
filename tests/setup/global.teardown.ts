// Global teardown for Playwright E2E tests
import { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');
  
  // Clean up any global resources
  // Close any persistent connections, databases, etc.
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;