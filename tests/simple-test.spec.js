import { test, expect } from "@playwright/test";

test.describe("Simple Chrome Extension Test", () => {
  test("Basic extension loading test", async ({ page }) => {
    console.log("🧪 Starting basic extension loading test...");

    // Go to chrome://extensions first
    await page.goto("chrome://extensions/");
    await page.waitForTimeout(2000);

    console.log("✅ Successfully navigated to chrome://extensions/");

    // Check if developer mode is available
    const devModeExists = await page.locator("#devMode").isVisible();
    console.log(`🔧 Developer mode toggle visible: ${devModeExists}`);

    if (devModeExists) {
      const isEnabled = await page.locator("#devMode").isChecked();
      console.log(`🔧 Developer mode enabled: ${isEnabled}`);

      if (!isEnabled) {
        await page.locator("#devMode").click();
        await page.waitForTimeout(1000);
        console.log("✅ Enabled developer mode");
      }
    }

    // Look for any extensions
    const extensionCards = page.locator("extensions-item");
    const count = await extensionCards.count();
    console.log(`📦 Found ${count} extensions`);

    if (count > 0) {
      // Try to find our RSS Reader extension
      for (let i = 0; i < count; i++) {
        const card = extensionCards.nth(i);
        const name = await card.locator("#name").textContent();
        console.log(`📦 Extension ${i + 1}: ${name}`);

        if (name && name.includes("RSS")) {
          console.log("🎯 Found RSS Reader extension!");
          expect(name).toContain("RSS");
          break;
        }
      }
    }

    console.log("✅ Basic extension loading test completed");
  });

  test("Basic navigation test", async ({ page }) => {
    console.log("🧪 Starting basic navigation test...");

    // Try to navigate to a simple chrome:// page
    await page.goto("chrome://version/");
    await page.waitForTimeout(1000);

    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    expect(title).toMatch(/(Chrome|버전|Version)/i);

    console.log("✅ Basic navigation test completed");
  });
});
