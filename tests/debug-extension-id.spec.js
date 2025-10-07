import { test, expect } from "@playwright/test";

test.describe("Debug Extension ID", () => {

  test("Debug extension loading and find actual ID", async ({ context }) => {
    console.log("🔍 Starting extension ID debug...");

    // Create a new page
    const page = await context.newPage();

    // Wait a bit for extension to load
    await page.waitForTimeout(3000);

    // Check service workers
    console.log("📋 Checking service workers...");
    const serviceWorkers = context.serviceWorkers();
    console.log(`Found ${serviceWorkers.length} service workers:`);

    for (const sw of serviceWorkers) {
      console.log(`- Service Worker URL: ${sw.url()}`);

      if (sw.url().includes('background.js')) {
        const match = sw.url().match(/chrome-extension:\/\/([a-z]{32})\//);
        if (match) {
          const actualId = match[1];
          console.log(`🎯 FOUND ACTUAL EXTENSION ID: ${actualId}`);

          // Test this ID
          try {
            await page.goto(`chrome-extension://${actualId}/popup.html`);
            const title = await page.title();
            console.log(`✅ Extension ID verified! Title: ${title}`);
          } catch (e) {
            console.log(`❌ Extension ID test failed: ${e.message}`);
          }
        }
      }
    }

    // Also check pages
    console.log("📋 Checking pages...");
    const pages = context.pages();
    console.log(`Found ${pages.length} pages:`);

    for (const p of pages) {
      const url = p.url();
      console.log(`- Page URL: ${url}`);

      if (url.startsWith('chrome-extension://')) {
        const match = url.match(/chrome-extension:\/\/([a-z]{32})\//);
        if (match) {
          console.log(`🎯 Found extension ID from page: ${match[1]}`);
        }
      }
    }

    // Try navigating to each calculated ID to see which works
    const testIds = [
      'gcmnnmjnghdhbnlhooclbcnmidnflgel', // Our calculated ID
      'dgocolfacpgknhpbdpfgfncepgjjmjed', // Previous attempt
      'nhfbkdkjojldemglmjljekhkodabmmjo', // Alternative 1
      'bfkpobdieghkjhncfceblhefgnfnjkfl', // Alternative 2
      'mfkfnjdmbngnhkoicjncnoaojedccjbn'  // Alternative 3
    ];

    console.log("🧪 Testing calculated extension IDs...");

    for (const testId of testIds) {
      try {
        console.log(`Testing ID: ${testId}`);
        await page.goto(`chrome-extension://${testId}/popup.html`);
        const title = await page.title();
        if (title && title.includes('RSS')) {
          console.log(`🎉 SUCCESS! Working extension ID: ${testId}`);
          console.log(`Page title: ${title}`);
          break;
        }
      } catch (e) {
        console.log(`❌ ID ${testId} failed: ${e.message}`);
      }
    }

    await page.close();
  });
});
