import { test, expect } from "@playwright/test";
import { ExtensionHelper } from "./helpers/extension-helper-v2.js";

test.describe("Extension Management Workaround", () => {
  let helper;

  test.beforeEach(async ({ context }) => {
    helper = new ExtensionHelper(context);
  });

  test("Extension management via API instead of chrome://extensions", async ({
    context,
  }) => {
    console.log("🔧 Testing extension management via Chrome APIs...");

    // Get extension ID dynamically
    const extensionId = await helper.getExtensionId();
    console.log(`📦 Extension ID: ${extensionId}`);

    // Test 1: Access extension popup directly
    console.log("🎯 Step 1: Testing popup access...");
    const popupPage = await helper.goToPopupPage();

    const popupTitle = await popupPage.title();
    expect(popupTitle).toBe("RSS Reader");
    console.log(`✅ Popup accessible: ${popupTitle}`);
    await popupPage.close();

    // Test 2: Access options page directly
    console.log("⚙️ Step 2: Testing options page access...");
    const optionsPage = await helper.goToOptionsPage();

    const optionsTitle = await optionsPage.title();
    expect(optionsTitle).toBe("RSS Reader Options");
    console.log(`✅ Options page accessible: ${optionsTitle}`);
    await optionsPage.close();

    // Test 3: Test service worker communication
    console.log("🔄 Step 3: Testing service worker communication...");
    const storageTest = await helper.testServiceWorkerCommunication();
    expect(storageTest).toBe(true);

    // Test 4: Extension manifest access
    console.log("📋 Step 4: Testing manifest access...");
    const manifest = await helper.getManifestInfo();

    expect(manifest).toBeDefined();
    expect(manifest.name).toBe("RSS Reader");
    expect(manifest.manifest_version).toBe(3);

    console.log("🎉 All extension management tests passed via API access!");
  });

  test("Feed management without chrome://extensions page", async ({
    context,
  }) => {
    console.log("📰 Testing feed management functionality...");

    // Clear storage first
    await helper.clearStorage();

    // Test adding a feed
    console.log("➕ Testing feed addition...");
    const addResult = await helper.addTestFeed(
      "https://test.example.com/feed.xml",
      "Test Feed",
      "Test",
    );
    expect(addResult)
      .toContain("success" || addResult)
      .toContain("added");
    console.log("✅ Feed addition working");

    // Check feed count
    console.log("📊 Checking feed count...");
    const feedCount = await helper.getFeedCount();
    expect(feedCount).toBeGreaterThan(0);
    console.log(`✅ Feed count: ${feedCount}`);

    console.log("🎉 Feed management tests completed successfully!");
  });

  test("Extension environment verification", async ({ context }) => {
    console.log("🌐 Testing extension environment...");

    const popupPage = await helper.goToPopupPage();

    // Test Chrome API availability
    const chromeApiTest = await popupPage.evaluate(() => {
      return {
        hasChrome: typeof chrome !== "undefined",
        hasRuntime: typeof chrome?.runtime !== "undefined",
        hasStorage: typeof chrome?.storage !== "undefined",
        extensionId: chrome?.runtime?.id,
      };
    });

    expect(chromeApiTest.hasChrome).toBe(true);
    expect(chromeApiTest.hasRuntime).toBe(true);
    expect(chromeApiTest.hasStorage).toBe(true);
    expect(chromeApiTest.extensionId).toBeDefined();

    console.log(
      `✅ Chrome APIs available, Extension ID: ${chromeApiTest.extensionId}`,
    );

    await popupPage.close();
    console.log("🎉 Extension environment verification completed!");
  });
});
