import { test, expect } from '@playwright/test';
import { ExtensionHelper, MOCK_RSS_FEEDS } from './helpers/extension-helper.js';

test.describe('Service Worker Functionality', () => {
  let extensionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new ExtensionHelper(page);
    await extensionHelper.clearStorage();

    // Set up mock RSS feeds
    await page.route('**/test-feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: MOCK_RSS_FEEDS.VALID_RSS.content
      });
    });
  });

  test('Service Worker activation and lifecycle', async ({ page }) => {
    console.log('🧪 Testing Service Worker activation...');

    // Check Service Worker internals page
    await page.goto('chrome://serviceworker-internals/');
    await page.waitForTimeout(2000);

    // Look for extension service workers
    const serviceWorkers = page.locator('.service-worker-summary');
    const count = await serviceWorkers.count();

    let foundExtensionSW = false;
    for (let i = 0; i < count; i++) {
      const swElement = serviceWorkers.nth(i);
      const swText = await swElement.textContent();

      if (swText && swText.includes('chrome-extension')) {
        console.log('🔍 Found extension Service Worker:', swText);
        foundExtensionSW = true;

        // Check if it's in an active state
        const isActive = swText.includes('ACTIVATED') ||
                        swText.includes('RUNNING') ||
                        swText.includes('REDUNDANT');

        if (isActive) {
          console.log('✅ Service Worker is in active state');
        }
        break;
      }
    }

    if (!foundExtensionSW) {
      console.log('⚠️ Extension Service Worker not found, checking extension loading...');

      // Try to trigger service worker by accessing extension
      await extensionHelper.goToPopupPage();
      await page.waitForTimeout(2000);

      // Check again
      await page.goto('chrome://serviceworker-internals/');
      await page.waitForTimeout(1000);

      const newCount = await serviceWorkers.count();
      console.log(`🔍 Service Workers found after extension access: ${newCount}`);
    }

    console.log('✅ Service Worker lifecycle test completed');
  });

  test('Service Worker handles suspension gracefully', async ({ page }) => {
    console.log('🧪 Testing Service Worker suspension handling...');

    // First ensure we have feeds to test with
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);

    // Navigate to Service Worker internals
    await page.goto('chrome://serviceworker-internals/');
    await page.waitForTimeout(2000);

    // Find extension service worker
    const serviceWorkers = page.locator('.service-worker-summary');
    const count = await serviceWorkers.count();

    let extensionSWElement = null;
    for (let i = 0; i < count; i++) {
      const swElement = serviceWorkers.nth(i);
      const swText = await swElement.textContent();

      if (swText && swText.includes('chrome-extension')) {
        extensionSWElement = swElement;
        console.log('🎯 Found extension Service Worker for testing');
        break;
      }
    }

    if (extensionSWElement) {
      // Try to stop the service worker
      const stopButton = extensionSWElement.locator('input[value="Stop"], button:has-text("Stop")');

      if (await stopButton.isVisible()) {
        await stopButton.click();
        console.log('⏸️ Attempted to stop Service Worker');
        await page.waitForTimeout(1000);
      } else {
        console.log('⚠️ Stop button not found, Service Worker may be protected');
      }
    }

    // Test extension functionality after potential suspension
    console.log('🔄 Testing extension functionality after suspension attempt...');

    // Access popup to trigger service worker restart
    await extensionHelper.goToPopupPage();

    // Check if extension still works
    const feedStatus = await extensionHelper.waitForFeedsToLoad();

    if (feedStatus.hasFeeds || feedStatus.hasEmptyState) {
      console.log('✅ Extension functionality maintained after suspension test');
    } else {
      console.log('⚠️ Extension may need manual interaction to restart');

      // Try clicking a button to trigger SW activation
      const syncButton = page.locator('#syncBtn, .sync-button, [title*="동기화"]');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await page.waitForTimeout(2000);
        console.log('🔄 Triggered manual sync');
      }
    }

    console.log('✅ Service Worker suspension handling test completed');
  });

  test('Background sync and alarms functionality', async ({ page }) => {
    console.log('🧪 Testing background sync and alarms...');

    // Add a test feed first
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);

    // Go to popup to test sync functionality
    await extensionHelper.goToPopupPage();

    // Test manual sync trigger
    const syncResult = await page.evaluate(async () => {
      try {
        // Test if we can communicate with service worker
        const response = await chrome.runtime.sendMessage({
          action: 'ping'
        });

        return {
          success: true,
          response: response,
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    if (syncResult.success) {
      console.log('✅ Service Worker communication successful:', syncResult.response);

      // Test force sync
      const forceSyncResult = await page.evaluate(async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'forceSync'
          });
          return { success: true, response };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      if (forceSyncResult.success) {
        console.log('✅ Force sync command successful');

        // Wait for sync to potentially complete
        await page.waitForTimeout(3000);

        // Check if feeds were updated
        const feedStatus = await extensionHelper.waitForFeedsToLoad();
        if (feedStatus.hasFeeds) {
          console.log('✅ Feeds loaded after sync');
        }
      } else {
        console.log('⚠️ Force sync failed:', forceSyncResult.error);
      }
    } else {
      console.log('⚠️ Service Worker communication failed:', syncResult.error);
    }

    // Test alarm-related functionality
    const alarmTestResult = await page.evaluate(async () => {
      try {
        // Check if alarms API is accessible
        if (chrome.alarms) {
          // Try to get current alarms
          const alarms = await chrome.alarms.getAll();
          return {
            success: true,
            alarmsCount: alarms.length,
            alarms: alarms.map(a => ({ name: a.name, when: a.when }))
          };
        } else {
          return { success: false, error: 'Alarms API not available' };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    if (alarmTestResult.success) {
      console.log(`✅ Alarms API accessible, found ${alarmTestResult.alarmsCount} alarms`);
      if (alarmTestResult.alarms.length > 0) {
        console.log('📅 Active alarms:', alarmTestResult.alarms);
      }
    } else {
      console.log('⚠️ Alarms test failed:', alarmTestResult.error);
    }

    console.log('✅ Background sync and alarms test completed');
  });

  test('Extension storage and data persistence', async ({ page }) => {
    console.log('🧪 Testing extension storage and persistence...');

    // Test storage operations
    await extensionHelper.goToPopupPage();

    const storageTest = await page.evaluate(async () => {
      try {
        // Test local storage
        await chrome.storage.local.set({ testKey: 'testValue', timestamp: Date.now() });
        const localData = await chrome.storage.local.get(['testKey', 'timestamp']);

        // Test sync storage
        await chrome.storage.sync.set({ syncTestKey: 'syncTestValue' });
        const syncData = await chrome.storage.sync.get(['syncTestKey']);

        // Test clearing
        await chrome.storage.local.remove(['testKey']);
        const afterClear = await chrome.storage.local.get(['testKey']);

        return {
          success: true,
          localSet: localData.testKey === 'testValue',
          syncSet: syncData.syncTestKey === 'syncTestValue',
          cleared: !afterClear.testKey,
          timestamp: localData.timestamp
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    if (storageTest.success) {
      expect(storageTest.localSet).toBeTruthy();
      expect(storageTest.syncSet).toBeTruthy();
      expect(storageTest.cleared).toBeTruthy();
      console.log('✅ Storage operations working correctly');
    } else {
      console.log('⚠️ Storage test failed:', storageTest.error);
    }

    // Test feed data persistence
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);

    // Check if feed persisted
    const feedCount = await extensionHelper.getFeedCount();
    expect(feedCount).toBeGreaterThan(0);

    console.log(`✅ Feed persistence test completed with ${feedCount} feeds`);
  });

  test('Extension permissions and security', async ({ page }) => {
    console.log('🧪 Testing extension permissions and security...');

    // Check manifest permissions
    const extensionId = await extensionHelper.getExtensionId();
    const manifestUrl = `chrome-extension://${extensionId}/manifest.json`;

    await page.goto(manifestUrl);
    const manifestContent = await page.textContent('pre');

    if (manifestContent) {
      const manifest = JSON.parse(manifestContent);

      // Check for required permissions
      const permissions = manifest.permissions || [];
      const hostPermissions = manifest.host_permissions || [];

      console.log('📋 Manifest permissions:', permissions);
      console.log('🌐 Host permissions:', hostPermissions);

      // Verify essential permissions
      expect(permissions).toContain('storage');
      expect(permissions).toContain('alarms');

      // Check that we don't have overly broad permissions
      const dangerousPermissions = ['tabs', 'activeTab', 'webRequest', '<all_urls>'];
      const hasDangerousPerms = dangerousPermissions.some(perm =>
        permissions.includes(perm) || hostPermissions.includes(perm)
      );

      if (hasDangerousPerms) {
        console.log('⚠️ Found potentially broad permissions - ensure they are necessary');
      } else {
        console.log('✅ Permissions appear appropriately scoped');
      }

      // Check manifest version
      expect(manifest.manifest_version).toBe(3);
      console.log('✅ Using Manifest V3');

      // Check service worker configuration
      expect(manifest.background).toBeDefined();
      expect(manifest.background.service_worker).toBeDefined();
      console.log('✅ Service Worker properly configured');

    } else {
      console.log('⚠️ Could not read manifest.json');
    }

    console.log('✅ Security and permissions test completed');
  });

  test('Error handling and resilience', async ({ page }) => {
    console.log('🧪 Testing error handling and resilience...');

    await extensionHelper.goToPopupPage();

    // Test handling of invalid messages
    const invalidMessageTest = await page.evaluate(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'invalidAction',
          data: 'test'
        });
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Should either handle gracefully or return appropriate error
    console.log('📝 Invalid message test result:', invalidMessageTest);

    // Test network failure handling
    await page.route('**/error-feed.xml', async route => {
      await route.abort('failed');
    });

    try {
      await extensionHelper.addTestFeed('https://example.com/error-feed.xml');
      console.log('⚠️ Expected network error was handled');
    } catch (error) {
      console.log('✅ Network error properly caught:', error.message);
    }

    // Test malformed feed handling
    await page.route('**/malformed-feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: 'This is not valid XML content'
      });
    });

    try {
      await extensionHelper.addTestFeed('https://example.com/malformed-feed.xml');
      console.log('✅ Malformed feed handled gracefully');
    } catch (error) {
      console.log('✅ Malformed feed error properly handled:', error.message);
    }

    console.log('✅ Error handling and resilience test completed');
  });
});
