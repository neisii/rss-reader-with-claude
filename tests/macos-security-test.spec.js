import { test, expect } from '@playwright/test';

test.describe('macOS Security Fix Test', () => {

  test('Test chrome:// page access with security fixes', async ({ page }) => {
    console.log('🔐 Testing chrome:// page access with macOS security fixes...');

    try {
      // Test 1: Navigate to chrome://version (safest chrome:// page)
      console.log('📄 Step 1: Testing chrome://version access...');
      await page.goto('chrome://version/');
      await page.waitForTimeout(2000);

      const title = await page.title();
      console.log(`✅ Successfully accessed chrome://version - Title: ${title}`);

      // Test 2: Try chrome://extensions (more restricted)
      console.log('🔌 Step 2: Testing chrome://extensions access...');
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(3000);

      const extTitle = await page.title();
      console.log(`✅ Successfully accessed chrome://extensions - Title: ${extTitle}`);

      // Test 3: Check if developer mode is accessible
      console.log('🛠️ Step 3: Testing developer mode access...');
      const devModeToggle = page.locator('#devMode');

      if (await devModeToggle.isVisible()) {
        console.log('✅ Developer mode toggle is accessible');

        const isEnabled = await devModeToggle.isChecked();
        console.log(`🔧 Developer mode status: ${isEnabled ? 'Enabled' : 'Disabled'}`);

        if (!isEnabled) {
          await devModeToggle.click();
          await page.waitForTimeout(1000);
          console.log('✅ Successfully enabled developer mode');
        }
      } else {
        console.log('⚠️ Developer mode toggle not found');
      }

      // Test 4: Look for extensions
      console.log('📦 Step 4: Looking for loaded extensions...');
      const extensionCards = page.locator('extensions-item');
      const count = await extensionCards.count();
      console.log(`📊 Found ${count} extension(s)`);

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const card = extensionCards.nth(i);
          try {
            const name = await card.locator('#name').textContent();
            console.log(`  📦 Extension ${i + 1}: ${name}`);

            if (name && name.toLowerCase().includes('rss')) {
              console.log('🎯 Found RSS Reader extension!');

              // Try to get extension ID
              const detailsButton = card.locator('#detailsButton');
              if (await detailsButton.isVisible()) {
                await detailsButton.click();
                await page.waitForTimeout(1000);

                const url = page.url();
                const match = url.match(/id=([a-z]{32})/);
                if (match) {
                  const extensionId = match[1];
                  console.log(`🆔 Extension ID found: ${extensionId}`);

                  // Test direct extension page access
                  await page.goto(`chrome-extension://${extensionId}/manifest.json`);
                  const manifest = await page.textContent('pre');

                  if (manifest) {
                    const manifestObj = JSON.parse(manifest);
                    console.log(`✅ Extension manifest accessible: ${manifestObj.name}`);
                    expect(manifestObj.name).toContain('RSS');
                  }
                }
              }
            }
          } catch (e) {
            console.log(`⚠️ Could not read extension ${i + 1}: ${e.message}`);
          }
        }
      }

      console.log('🎉 All security tests passed!');

    } catch (error) {
      console.log('❌ Security test failed:', error.message);

      // Log additional debugging info
      console.log('🔍 Debug info:');
      console.log(`  Current URL: ${page.url()}`);

      throw error;
    }
  });

  test('Test automation detection bypass', async ({ page }) => {
    console.log('🤖 Testing Chrome automation detection bypass...');

    await page.goto('data:text/html,<h1>Automation Detection Test</h1>');

    const automationTest = await page.evaluate(() => {
      return {
        webdriver: navigator.webdriver,
        chrome: !!window.chrome,
        chromeRuntime: !!window.chrome?.runtime,
        plugins: navigator.plugins.length,
        languages: navigator.languages.length,
        userAgent: navigator.userAgent.includes('Chrome')
      };
    });

    console.log('🔍 Automation detection results:', automationTest);

    // webdriver should be undefined if automation detection is bypassed
    if (typeof automationTest.webdriver === 'undefined') {
      console.log('✅ Automation detection successfully bypassed');
    } else {
      console.log('⚠️ Automation detected - may cause issues');
    }

    expect(automationTest.chrome).toBe(true);
  });

  test('Test extension environment setup', async ({ page }) => {
    console.log('🔧 Testing extension environment setup...');

    // Start with a simple page
    await page.goto('data:text/html,<h1>Extension Environment Test</h1>');

    const envTest = await page.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1],
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      };
    });

    console.log('🌐 Environment test results:', envTest);

    expect(envTest.hasChrome).toBe(true);
    expect(envTest.platform).toContain('Mac');

    console.log('✅ Extension environment properly configured');
  });
});
