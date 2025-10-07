import { test, expect } from '@playwright/test';

test.describe('Find Extension ID', () => {

  test('Find actual extension ID through DevTools', async ({ page }) => {
    console.log('🕵️ Finding actual extension ID...');

    // Navigate to a simple page first
    await page.goto('data:text/html,<h1>Finding Extension ID</h1>');
    await page.waitForTimeout(1000);

    // Try to find extension ID through various methods

    // Method 1: Check if we can access extension context
    const extensionInfo = await page.evaluate(async () => {
      // Try to get extension info if we're in extension context
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          const manifest = chrome.runtime.getManifest();
          const id = chrome.runtime.id;
          return {
            success: true,
            id,
            name: manifest?.name,
            version: manifest?.version
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: 'Chrome APIs not available' };
    });

    console.log('🔍 Extension context check:', extensionInfo);

    // Method 2: Try to create a new page that might have access
    try {
      const newPage = await page.context().newPage();
      await newPage.goto('chrome://extensions/');
      await newPage.waitForTimeout(2000);

      // Try to extract extension IDs from the page
      const extensionIds = await newPage.evaluate(() => {
        const cards = document.querySelectorAll('extensions-item');
        const ids = [];

        cards.forEach((card, index) => {
          const id = card.id;
          const nameElement = card.querySelector('#name');
          const name = nameElement ? nameElement.textContent : 'Unknown';

          if (id) {
            ids.push({ index, id, name });
          }
        });

        return ids;
      });

      console.log('📦 Found extensions:', extensionIds);

      // Look for RSS Reader
      const rssExtension = extensionIds.find(ext =>
        ext.name && ext.name.toLowerCase().includes('rss')
      );

      if (rssExtension) {
        console.log(`🎯 Found RSS Reader Extension ID: ${rssExtension.id}`);

        // Test access with this ID
        try {
          await newPage.goto(`chrome-extension://${rssExtension.id}/manifest.json`);
          const manifest = await newPage.textContent('pre');

          if (manifest) {
            const manifestObj = JSON.parse(manifest);
            console.log(`✅ Successfully accessed manifest: ${manifestObj.name}`);
            expect(manifestObj.name).toContain('RSS');
          }
        } catch (error) {
          console.log(`❌ Could not access extension files: ${error.message}`);
        }
      }

      await newPage.close();

    } catch (error) {
      console.log('⚠️ Could not access chrome://extensions:', error.message);
    }

    // Method 3: Try a different approach - look for loaded extensions
    const loadedExtensions = await page.evaluate(() => {
      // Check if there are any global extension-related objects
      const extensionObjects = [];

      // Look for common extension global variables
      if (typeof chrome !== 'undefined') {
        extensionObjects.push('chrome API available');

        if (chrome.runtime) {
          extensionObjects.push('chrome.runtime available');
        }
        if (chrome.storage) {
          extensionObjects.push('chrome.storage available');
        }
      }

      return extensionObjects;
    });

    console.log('🔧 Available extension APIs:', loadedExtensions);

    // At minimum, we should have chrome APIs available
    expect(loadedExtensions.length).toBeGreaterThan(0);

    console.log('✅ Extension ID search completed');
  });
});
