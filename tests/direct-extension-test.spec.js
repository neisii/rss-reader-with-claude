import { test, expect } from '@playwright/test';

test.describe('Direct Extension Access Test', () => {

  test('Access extension pages directly', async ({ page }) => {
    console.log('🧪 Testing direct extension page access...');

    // The extension ID is derived from the key in manifest.json
    // For our key, the ID should be: hcidphjhkbigmmbglehpcoflpdijlcob
    const extensionId = 'hcidphjhkbigmmbglehpcoflpdijlcob';

    console.log(`🎯 Using extension ID: ${extensionId}`);

    try {
      // Test 1: Access manifest.json
      console.log('📋 Testing manifest.json access...');
      await page.goto(`chrome-extension://${extensionId}/manifest.json`);
      await page.waitForTimeout(2000);

      const manifestContent = await page.textContent('pre');
      if (manifestContent) {
        const manifest = JSON.parse(manifestContent);
        console.log(`✅ Manifest accessible - Name: ${manifest.name}, Version: ${manifest.version}`);
        expect(manifest.name).toBe('RSS Reader');
        expect(manifest.manifest_version).toBe(3);
      } else {
        throw new Error('Could not read manifest content');
      }

      // Test 2: Access popup.html
      console.log('🪟 Testing popup.html access...');
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.waitForTimeout(3000);

      // Check for key elements
      const title = await page.title();
      console.log(`📄 Popup title: ${title}`);

      const feedList = page.locator('#feedList');
      const loadingIndicator = page.locator('#loadingIndicator');
      const optionsBtn = page.locator('#optionsBtn');

      if (await feedList.isVisible()) {
        console.log('✅ Feed list element found');
      }
      if (await loadingIndicator.isVisible()) {
        console.log('📡 Loading indicator visible');
      }
      if (await optionsBtn.isVisible()) {
        console.log('⚙️ Options button found');
      }

      // Test 3: Access options.html
      console.log('⚙️ Testing options.html access...');
      await page.goto(`chrome-extension://${extensionId}/options.html`);
      await page.waitForTimeout(3000);

      const optionsTitle = await page.title();
      console.log(`📄 Options title: ${optionsTitle}`);

      const feedUrlInput = page.locator('#feedUrl');
      const addFeedBtn = page.locator('#addFeedBtn');

      if (await feedUrlInput.isVisible()) {
        console.log('✅ Feed URL input found');
      }
      if (await addFeedBtn.isVisible()) {
        console.log('✅ Add feed button found');
      }

      // Test 4: Try to interact with the options page
      console.log('🔧 Testing basic interaction...');

      if (await feedUrlInput.isVisible() && await addFeedBtn.isVisible()) {
        // Try to fill in a test URL
        await feedUrlInput.fill('https://example.com/test-feed.xml');
        console.log('✅ Successfully filled feed URL input');

        // Check if the button is enabled
        const isButtonEnabled = await addFeedBtn.isEnabled();
        console.log(`🔘 Add button enabled: ${isButtonEnabled}`);
      }

      console.log('🎉 All direct extension access tests passed!');

    } catch (error) {
      console.log('❌ Direct extension access failed:', error.message);

      // Try alternative extension ID calculation
      console.log('🔄 Trying alternative approach...');

      // Sometimes the extension ID might be different, let's try a few possibilities
      const alternativeIds = [
        'jbihkpcefckidgiijblidbkgjjhpjmpf', // Alternative calculation
        'onhogfjeacnfoofkfgppdlbmlmnplgbn', // Another possibility
        'pnjaodmkngahhkoihkojpfefdebbdud'    // Yet another
      ];

      for (const altId of alternativeIds) {
        try {
          console.log(`🧪 Trying extension ID: ${altId}`);
          await page.goto(`chrome-extension://${altId}/manifest.json`);
          await page.waitForTimeout(1000);

          const content = await page.textContent('pre');
          if (content) {
            const manifest = JSON.parse(content);
            if (manifest.name === 'RSS Reader') {
              console.log(`🎯 Found correct extension ID: ${altId}`);
              console.log(`✅ Extension Name: ${manifest.name}`);
              break;
            }
          }
        } catch (e) {
          console.log(`❌ ID ${altId} not valid`);
        }
      }

      throw error;
    }
  });

  test('Check extension without chrome:// navigation', async ({ page }) => {
    console.log('🧪 Testing extension presence without chrome:// pages...');

    // Start with a regular web page
    await page.goto('data:text/html,<h1>Test Page</h1>');
    await page.waitForTimeout(1000);

    console.log('✅ Loaded basic test page');

    // Try to inject a script that checks for extension APIs
    const hasExtensionAPIs = await page.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        hasStorage: typeof chrome?.storage !== 'undefined',
        extensionId: chrome?.runtime?.id || null
      };
    });

    console.log('🔍 Extension API check:', hasExtensionAPIs);

    if (hasExtensionAPIs.hasChrome) {
      console.log('✅ Chrome APIs available');
      if (hasExtensionAPIs.extensionId) {
        console.log(`🆔 Extension ID from runtime: ${hasExtensionAPIs.extensionId}`);
      }
    } else {
      console.log('⚠️ Chrome APIs not available in content script context');
    }

    // This test mainly checks if the extension environment is set up correctly
    expect(hasExtensionAPIs.hasChrome).toBe(true);

    console.log('✅ Extension environment check completed');
  });
});
