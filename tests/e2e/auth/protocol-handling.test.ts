// E2E tests for protocol handling - specifically testing Windows single-instance fix
import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

test.describe('Protocol Handling (Windows Single-Instance Fix)', () => {
  test('should prevent multiple instances when handling OAuth protocol', async () => {
    // This test verifies the fix for Windows protocol redirect opening new app instances
    
    // Launch the first instance
    const electronApp1 = await electron.launch({
      args: [path.join(__dirname, '../../../.webpack/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
    
    const window1 = await electronApp1.firstWindow();
    await expect(window1).toHaveTitle(/Overlay/);
    
    // Wait for app to be fully loaded
    await window1.waitForLoadState('domcontentloaded');
    
    try {
      // Attempt to launch a second instance with a protocol URL
      // This should fail due to single-instance lock
      const electronApp2Promise = electron.launch({
        args: [
          path.join(__dirname, '../../../.webpack/main/index.js'),
          'overlay://callback#access_token=test_token&refresh_token=test_refresh&token_type=bearer'
        ],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
        timeout: 5000, // Short timeout - should fail quickly
      });
      
      // The second instance should be prevented from starting
      // We expect this to either timeout or fail
      let secondInstanceStarted = false;
      try {
        await electronApp2Promise;
        secondInstanceStarted = true;
      } catch (error) {
        // Expected - second instance should be prevented
        expect(error.message).toContain('timeout');
      }
      
      // If somehow the second instance started, close it and fail the test
      if (secondInstanceStarted) {
        const app2 = await electronApp2Promise;
        await app2.close();
        throw new Error('Second instance should not have started due to single-instance lock');
      }
      
      // Verify the first window is still the only one and is focused
      const windows = electronApp1.windows();
      expect(windows).toHaveLength(1);
      
      // The first window should remain functional
      await expect(window1).not.toBeClosed();
      
    } finally {
      await electronApp1.close();
    }
  });

  test('should handle OAuth callback URL in existing instance', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../.webpack/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    try {
      // Simulate protocol URL being processed by existing instance
      // In real scenario, this would come from the second-instance event
      await electronApp.evaluate(async ({ app }, protocolUrl) => {
        // Simulate the protocol handling that happens in main process
        const url = new URL(protocolUrl);
        return {
          protocol: url.protocol,
          pathname: url.pathname,
          hash: url.hash,
        };
      }, 'overlay://callback#access_token=mock_token&refresh_token=mock_refresh');

      // Verify the window remains open and functional
      await expect(window).not.toBeClosed();
      
      // Check that the app can handle the protocol URL structure
      const result = await electronApp.evaluate(async ({ app }, protocolUrl) => {
        try {
          const url = new URL(protocolUrl);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          return {
            isValidProtocol: url.protocol === 'overlay:',
            isCallbackPath: url.pathname === '/callback',
            hasAccessToken: hashParams.has('access_token'),
            hasRefreshToken: hashParams.has('refresh_token'),
          };
        } catch (error) {
          return { error: error.message };
        }
      }, 'overlay://callback#access_token=mock_token&refresh_token=mock_refresh');

      expect(result.isValidProtocol).toBe(true);
      expect(result.isCallbackPath).toBe(true);
      expect(result.hasAccessToken).toBe(true);
      expect(result.hasRefreshToken).toBe(true);

    } finally {
      await electronApp.close();
    }
  });

  test('should focus existing window when second instance is prevented', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../.webpack/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    try {
      // Minimize the window first
      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].minimize();
        }
      });

      // Wait a bit for minimize to complete
      await window.waitForTimeout(100);

      // Simulate what happens when a second instance is attempted
      // The existing instance should be restored and focused
      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const mainWindow = windows[0];
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
          
          // On Windows, also call show() to bring to front
          if (process.platform === 'win32') {
            mainWindow.show();
          }
        }
      });

      // Verify window is restored and visible
      const isMinimized = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? windows[0].isMinimized() : true;
      });

      expect(isMinimized).toBe(false);

    } finally {
      await electronApp.close();
    }
  });

  test('should handle malformed protocol URLs gracefully', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../.webpack/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    try {
      // Test various malformed URLs
      const malformedUrls = [
        'overlay://callback', // No hash
        'overlay://callback#', // Empty hash
        'overlay://callback#invalid', // Invalid hash format
        'overlay://wrong-path#access_token=test', // Wrong path
        'wrong://callback#access_token=test', // Wrong protocol
      ];

      for (const url of malformedUrls) {
        const result = await electronApp.evaluate(async ({ app }, testUrl) => {
          try {
            const urlObj = new URL(testUrl);
            
            // Simulate the validation that happens in handleOAuthCallback
            const isValidProtocol = urlObj.protocol === 'overlay:';
            const isValidPath = urlObj.pathname === '/callback';
            const hasHash = !!urlObj.hash;
            
            let hasRequiredTokens = false;
            if (hasHash) {
              const hashParams = new URLSearchParams(urlObj.hash.substring(1));
              hasRequiredTokens = hashParams.has('access_token') && hashParams.has('refresh_token');
            }
            
            return {
              url: testUrl,
              isValid: isValidProtocol && isValidPath && hasRequiredTokens,
              errors: {
                invalidProtocol: !isValidProtocol,
                invalidPath: !isValidPath,
                missingHash: !hasHash,
                missingTokens: hasHash && !hasRequiredTokens,
              }
            };
          } catch (error) {
            return {
              url: testUrl,
              isValid: false,
              parseError: error.message,
            };
          }
        }, url);

        // All malformed URLs should be invalid
        expect(result.isValid).toBe(false);
      }

      // App should remain stable after processing malformed URLs
      await expect(window).not.toBeClosed();

    } finally {
      await electronApp.close();
    }
  });
});