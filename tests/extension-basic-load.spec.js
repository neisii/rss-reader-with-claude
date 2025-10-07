import { test, expect } from "@playwright/test";

test.describe("Basic Extension Loading", () => {

  test("Check if extension loads at all", async ({ context }) => {
    console.log("🔍 Testing basic extension loading...");

    // Create a page and wait for extensions to load
    const page = await context.newPage();
    await page.waitForTimeout(5000); // Give extension time to load

    console.log("📋 Current working directory:", process.cwd());
    console.log("📋 Extension path being loaded:", process.cwd());

    // Check if we can see any extension-related URLs
    const pages = context.pages();
    console.log(`Found ${pages.length} pages:`);
    for (const p of pages) {
      console.log(`- ${p.url()}`);
    }

    // Check service workers
    const serviceWorkers = context.serviceWorkers();
    console.log(`Found ${serviceWorkers.length} service workers:`);
    for (const sw of serviceWorkers) {
      console.log(`- ${sw.url()}`);
    }

    // Check if we can navigate to chrome://extensions to see our extension
    try {
      console.log("🔧 Trying to access chrome://extensions...");
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(3000);

      // Take a screenshot to see what's happening
      await page.screenshot({ path: 'test-results/extensions-page.png' });
      console.log("📸 Screenshot taken of chrome://extensions page");

      const title = await page.title();
      console.log(`Extensions page title: ${title}`);
    } catch (e) {
      console.log(`❌ Could not access chrome://extensions: ${e.message}`);
    }

    // Try to find the extension in the page
    try {
      const extensionCards = page.locator('extensions-item');
      const count = await extensionCards.count();
      console.log(`Found ${count} extension cards`);

      for (let i = 0; i < count; i++) {
        const card = extensionCards.nth(i);
        const name = await card.locator('#name').textContent();
        console.log(`Extension ${i}: ${name}`);

        if (name && name.includes('RSS')) {
          console.log(`🎉 Found our RSS Reader extension!`);

          // Try to get the ID
          const detailsButton = card.locator('#detailsButton');
          if (await detailsButton.isVisible()) {
            await detailsButton.click();
            await page.waitForTimeout(1000);

            const url = page.url();
            const match = url.match(/id=([a-z]{32})/);
            if (match) {
              const actualId = match[1];
              console.log(`🎯 ACTUAL EXTENSION ID: ${actualId}`);

              // Test this ID by navigating back and trying popup
              await page.goBack();
              await page.waitForTimeout(1000);

              try {
                await page.goto(`chrome-extension://${actualId}/popup.html`);
                const popupTitle = await page.title();
                console.log(`✅ Popup works! Title: ${popupTitle}`);
              } catch (e) {
                console.log(`❌ Popup test failed: ${e.message}`);
              }
            }
          }
        }
      }
    } catch (e) {
      console.log(`❌ Could not parse extensions page: ${e.message}`);
    }

    await page.close();
  });
});
