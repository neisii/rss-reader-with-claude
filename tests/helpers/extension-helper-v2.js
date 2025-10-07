import { expect } from "@playwright/test";

/**
 * Extension Helper Class for Chrome Extension Testing (Version 2)
 * Avoids chrome://extensions page entirely and uses direct API access
 */
export class ExtensionHelper {
  constructor(context) {
    this.context = context;
    this.extensionId = null;
  }

  /**
   * Get the extension ID without accessing chrome://extensions
   * Uses a combination of service worker detection and fixed key calculation
   */
  async getExtensionId() {
    if (this.extensionId) {
      return this.extensionId;
    }

    console.log("🔍 Finding extension ID via alternative methods...");

    // Method 1: Try to get from service workers
    try {
      const serviceWorkers = this.context.serviceWorkers();
      for (const sw of serviceWorkers) {
        const url = sw.url();
        if (url.includes("background.js")) {
          const match = url.match(/chrome-extension:\/\/([a-z]{32})\//);
          if (match) {
            this.extensionId = match[1];
            console.log(
              `📦 Found extension ID from service worker: ${this.extensionId}`,
            );
            return this.extensionId;
          }
        }
      }
    } catch (e) {
      console.log("Service worker method failed, trying next approach...");
    }

    // Method 2: Use the fixed extension ID derived from our manifest key
    // Our manifest.json has a fixed key, which generates a predictable extension ID
    this.extensionId = "gcmnnmjnghdhbnlhooclbcnmidnflgel";
    console.log(`📦 Using fixed extension ID: ${this.extensionId}`);

    // Method 3: Verify by trying to access popup
    try {
      const page = await this.context.newPage();
      await page.goto(`chrome-extension://${this.extensionId}/popup.html`);
      const title = await page.title();
      if (title === "RSS Reader") {
        console.log("✅ Extension ID verified - popup accessible");
        await page.close();
        return this.extensionId;
      }
      await page.close();
    } catch (e) {
      console.log("❌ Fixed extension ID verification failed");
    }

    // Method 4: Try different calculation
    // If the fixed ID doesn't work, try calculating from the public key
    // This is a fallback that might be needed if Chrome changes ID generation
    console.log("🔄 Trying alternative extension ID calculation...");

    // Common alternative IDs based on different key encodings
    const alternativeIds = [
      "nhfbkdkjojldemglmjljekhkodabmmjo", // Alternative calculation 1
      "bfkpobdieghkjhncfceblhefgnfnjkfl", // Alternative calculation 2
      "mfkfnjdmbngnhkoicjncnoaojedccjbn", // Alternative calculation 3
    ];

    for (const altId of alternativeIds) {
      try {
        const page = await this.context.newPage();
        await page.goto(`chrome-extension://${altId}/popup.html`);
        const title = await page.title();
        if (title === "RSS Reader") {
          this.extensionId = altId;
          console.log(`✅ Found working extension ID: ${altId}`);
          await page.close();
          return this.extensionId;
        }
        await page.close();
      } catch (e) {
        // Continue to next ID
      }
    }

    throw new Error(
      "Could not determine extension ID. Extension may not be loaded properly.",
    );
  }

  /**
   * Navigate to the options page
   */
  async goToOptionsPage() {
    const extensionId = await this.getExtensionId();
    const optionsUrl = `chrome-extension://${extensionId}/options.html`;
    console.log(`📄 Navigating to options page: ${optionsUrl}`);

    const page = await this.context.newPage();
    await page.goto(optionsUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    return page;
  }

  /**
   * Navigate to the popup page
   */
  async goToPopupPage() {
    const extensionId = await this.getExtensionId();
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    console.log(`📄 Navigating to popup page: ${popupUrl}`);

    const page = await this.context.newPage();
    await page.goto(popupUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    return page;
  }

  /**
   * Test service worker communication
   */
  async testServiceWorkerCommunication() {
    console.log("🔄 Testing service worker communication...");

    const page = await this.goToPopupPage();

    try {
      // Test storage access
      const storageTest = await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.storage.local.set({ testKey: "testValue" }, () => {
            chrome.storage.local.get("testKey", (result) => {
              resolve(result.testKey === "testValue");
            });
          });
        });
      });

      if (storageTest) {
        console.log("✅ Service worker storage communication working");
      } else {
        console.log("❌ Service worker storage communication failed");
      }

      await page.close();
      return storageTest;
    } catch (e) {
      console.log("❌ Service worker communication test failed:", e.message);
      await page.close();
      return false;
    }
  }

  /**
   * Get manifest information
   */
  async getManifestInfo() {
    console.log("📋 Getting manifest information...");

    const page = await this.goToPopupPage();

    try {
      const manifest = await page.evaluate(() => {
        return chrome.runtime.getManifest();
      });

      console.log(
        `✅ Manifest accessible: ${manifest.name} v${manifest.version}`,
      );
      await page.close();
      return manifest;
    } catch (e) {
      console.log("❌ Manifest access failed:", e.message);
      await page.close();
      return null;
    }
  }

  /**
   * Clear extension storage
   */
  async clearStorage() {
    console.log("🧹 Clearing extension storage...");

    const page = await this.goToPopupPage();

    try {
      const result = await page.evaluate(async () => {
        try {
          await chrome.storage.sync.clear();
          await chrome.storage.local.clear();
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      if (result.success) {
        console.log("✅ Storage cleared successfully");
      } else {
        console.log("⚠️ Storage clear failed:", result.error);
      }

      await page.close();
      return result.success;
    } catch (error) {
      console.log("⚠️ Could not clear storage:", error.message);
      await page.close();
      return false;
    }
  }

  /**
   * Add a test feed via options page
   */
  async addTestFeed(url, title = "", category = "Test") {
    console.log(`➕ Adding test feed: ${url}`);

    const page = await this.goToOptionsPage();

    try {
      // Fill in the form
      await page.fill("#feedUrl", url);
      if (title) {
        await page.fill("#feedTitle", title);
      }
      if (category) {
        await page.fill("#feedCategory", category);
      }

      // Click add button
      await page.click("#addFeedBtn");

      // Wait for result
      await page.waitForSelector(".status-message", { timeout: 10000 });
      const statusMessage = await page.textContent(".status-message");
      console.log(`📝 Add feed result: ${statusMessage}`);

      await page.close();
      return statusMessage;
    } catch (e) {
      console.log("❌ Add feed failed:", e.message);
      await page.close();
      throw e;
    }
  }

  /**
   * Get feed count from options page
   */
  async getFeedCount() {
    const page = await this.goToOptionsPage();

    try {
      const feedItems = page.locator(".feed-item");
      const count = await feedItems.count();
      await page.close();
      return count;
    } catch (e) {
      await page.close();
      throw e;
    }
  }

  /**
   * Get article count from popup
   */
  async getArticleCount() {
    const page = await this.goToPopupPage();

    try {
      await page.waitForSelector("#loadingIndicator", {
        state: "hidden",
        timeout: 10000,
      });
      const articleItems = page.locator(".feed-item");
      const count = await articleItems.count();
      await page.close();
      return count;
    } catch (e) {
      await page.close();
      throw e;
    }
  }
}

export default ExtensionHelper;
