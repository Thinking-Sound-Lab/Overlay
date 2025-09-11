// Global teardown for Playwright E2E tests

async function globalTeardown() {
  console.log('🧹 Starting global teardown for E2E tests...');
  
  // Clean up any global resources
  // Close any persistent connections, databases, etc.
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;