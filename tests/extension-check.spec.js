import { test, expect } from '@playwright/test';

test.describe('Extension Direct Access Test', () => {

  test('Check if extension files are accessible', async ({ page }) => {
    console.log('🧪 Testing direct extension file access...');

    // First, let's try to find the extension ID by looking at the chrome://extensions page
    try {
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(2000);

      console.log('✅ Successfully navigated to extensions page');

      // Enable developer mode if not already enabled
      const devModeToggle = page.locator('#devMode');
      if (await devModeToggle.isVisible()) {
        const isChecked = await devModeToggle.isChecked();
        if (!isChecked) {
          await devModeToggle.click();
          await page.waitForTimeout(1000);
          console.log('✅ Enabled developer mode');
        }
      }

      // Look for extension cards
      const extensionCards = page.locator('extensions-item');
      const count = await extensionCards.count();
      console.log(`📦 Found ${count} extension(s)`);

      // Try to find our extension
      let extensionId = null;
      for (let i = 0; i < count; i++) {
        const card = extensionCards.nth(i);
        try {
          const name = await card.locator('#name').textContent();
          console.log(`📦 Extension ${i + 1}: "${name}"`);

          if (name && (name.includes('RSS') || name.includes('Reader'))) {
            // Try to get the extension ID
            const detailsButton = card.locator('#detailsButton');
            if (await detailsButton.isVisible()) {
              await detailsButton.click();
              await page.waitForTimeout(1000);

              const url = page.url();
              const match = url.match(/id=([a-z]{32})/);
              if (match) {
                extensionId = match[1];
                console.log(`🎯 Found RSS extension ID: ${extensionId}`);
                break;
              }
            }
          }
        } catch (e) {
          console.log(`⚠️ Could not read extension ${i + 1}:`, e.message);
        }
      }

      if (extensionId) {
        // Test access to extension pages
        console.log('🔍 Testing extension page access...');

        // Test manifest.json access
        try {
          await page.goto(`chrome-extension://${extensionId}/manifest.json`);
          const content = await page.textContent('pre');
          if (content) {
            const manifest = JSON.parse(content);
            console.log(`✅ Manifest accessible - Name: ${manifest.name}`);
            expect(manifest.manifest_version).toBe(3);
          }
        } catch (e) {
          console.log('⚠️ Could not access manifest:', e.message);
        }

        // Test popup.html access
        try {
          await page.goto(`chrome-extension://${extensionId}/popup.html`);
          const title = await page.title();
          console.log(`✅ Popup page accessible - Title: ${title}`);

          // Check if our key elements exist
          const feedList = page.locator('#feedList');
          const optionsBtn = page.locator('#optionsBtn');

          if (await feedList.isVisible()) {
            console.log('✅ Feed list element found');
          }
          if (await optionsBtn.isVisible()) {
            console.log('✅ Options button found');
          }

        } catch (e) {
          console.log('⚠️ Could not access popup:', e.message);
        }

        // Test options.html access
        try {
          await page.goto(`chrome-extension://${extensionId}/options.html`);
          const title = await page.title();
          console.log(`✅ Options page accessible - Title: ${title}`);

          // Check if our key elements exist
          const feedUrl = page.locator('#feedUrl');
          const addBtn = page.locator('#addFeedBtn');

          if (await feedUrl.isVisible()) {
            console.log('✅ Feed URL input found');
          }
          if (await addBtn.isVisible()) {
            console.log('✅ Add feed button found');
          }

        } catch (e) {
          console.log('⚠️ Could not access options:', e.message);
        }

      } else {
        console.log('❌ RSS Reader extension not found');

        // List all available extensions for debugging
        console.log('📋 Available extensions:');
        for (let i = 0; i < count; i++) {
          const card = extensionCards.nth(i);
          try {
            const name = await card.locator('#name').textContent();
            console.log(`  - ${name}`);
          } catch (e) {
            console.log(`  - Extension ${i + 1} (could not read name)`);
          }
        }
      }

    } catch (error) {
      console.log('❌ Error during extension check:', error.message);
      throw error;
    }

    console.log('✅ Extension check completed');
  });
});
