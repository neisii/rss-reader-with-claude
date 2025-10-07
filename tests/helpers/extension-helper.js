import { expect } from '@playwright/test';

/**
 * Extension Helper Class for Chrome Extension Testing
 * Provides utilities for interacting with the RSS Reader Extension
 */
export class ExtensionHelper {
  constructor(page) {
    this.page = page;
    this.extensionId = null;
  }

  /**
   * Get the extension ID by parsing chrome://extensions page
   */
  async getExtensionId() {
    if (this.extensionId) return this.extensionId;

    console.log('🔍 Finding extension ID...');
    await this.page.goto('chrome://extensions/');
    await this.page.waitForTimeout(2000);

    // Enable developer mode if not already enabled
    const devModeToggle = this.page.locator('#devMode');
    if (await devModeToggle.isVisible()) {
      const isChecked = await devModeToggle.isChecked();
      if (!isChecked) {
        await devModeToggle.click();
        await this.page.waitForTimeout(1000);
      }
    }

    // Find the RSS Reader extension by looking for manifest content
    const extensionCards = this.page.locator('extensions-item');
    const count = await extensionCards.count();

    for (let i = 0; i < count; i++) {
      const card = extensionCards.nth(i);
      const name = await card.locator('#name').textContent();

      if (name && name.includes('RSS Reader')) {
        const detailsButton = card.locator('#detailsButton');
        await detailsButton.click();
        await this.page.waitForTimeout(1000);

        // Extract ID from the URL
        const url = this.page.url();
        const match = url.match(/id=([a-z]{32})/);
        if (match) {
          this.extensionId = match[1];
          console.log(`✅ Found extension ID: ${this.extensionId}`);
          return this.extensionId;
        }
      }
    }

    // Fallback: look for any extension with our manifest content
    for (let i = 0; i < count; i++) {
      const card = extensionCards.nth(i);
      const id = await card.getAttribute('id');
      if (id) {
        this.extensionId = id;
        console.log(`📌 Using extension ID: ${this.extensionId}`);
        return this.extensionId;
      }
    }

    throw new Error('RSS Reader extension not found. Make sure it is loaded in developer mode.');
  }

  /**
   * Navigate to the options page
   */
  async goToOptionsPage() {
    const extensionId = await this.getExtensionId();
    const optionsUrl = `chrome-extension://${extensionId}/options.html`;
    console.log(`📄 Navigating to options page: ${optionsUrl}`);

    await this.page.goto(optionsUrl);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000); // Wait for any initialization
  }

  /**
   * Navigate to the popup page
   */
  async goToPopupPage() {
    const extensionId = await this.getExtensionId();
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    console.log(`📄 Navigating to popup page: ${popupUrl}`);

    await this.page.goto(popupUrl);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Wait for Service Worker to be active
   */
  async waitForServiceWorker() {
    console.log('⏳ Waiting for Service Worker to be active...');

    await this.page.goto('chrome://serviceworker-internals/');
    await this.page.waitForTimeout(2000);

    // Look for our extension's service worker
    const serviceWorkerList = this.page.locator('.service-worker-summary');
    const count = await serviceWorkerList.count();

    for (let i = 0; i < count; i++) {
      const swItem = serviceWorkerList.nth(i);
      const swInfo = await swItem.textContent();

      if (swInfo && swInfo.includes('chrome-extension')) {
        // Check if it's running
        if (swInfo.includes('ACTIVATED') || swInfo.includes('RUNNING')) {
          console.log('✅ Service Worker is active');
          return;
        }
      }
    }

    console.log('⚠️ Service Worker not found or not active, continuing anyway...');
  }

  /**
   * Clear extension storage
   */
  async clearStorage() {
    console.log('🧹 Clearing extension storage...');

    try {
      await this.goToPopupPage();

      const result = await this.page.evaluate(async () => {
        try {
          // Clear both sync and local storage
          await chrome.storage.sync.clear();
          await chrome.storage.local.clear();
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      if (result.success) {
        console.log('✅ Storage cleared successfully');
      } else {
        console.log('⚠️ Storage clear failed:', result.error);
      }
    } catch (error) {
      console.log('⚠️ Could not clear storage:', error.message);
    }
  }

  /**
   * Add a test feed
   */
  async addTestFeed(url, category = 'Test') {
    console.log(`➕ Adding test feed: ${url}`);

    await this.goToOptionsPage();

    // Fill in the form
    await this.page.fill('#feedUrl', url);
    if (category) {
      await this.page.fill('#feedCategory', category);
    }

    // Click add button
    await this.page.click('#addFeedBtn');

    // Wait for result
    await this.page.waitForSelector('.status-message', { timeout: 10000 });

    const statusMessage = await this.page.textContent('.status-message');
    console.log(`📝 Add feed result: ${statusMessage}`);

    return statusMessage;
  }

  /**
   * Force sync feeds
   */
  async forceFeedSync() {
    console.log('🔄 Forcing feed synchronization...');

    try {
      await this.goToPopupPage();

      const result = await this.page.evaluate(async () => {
        try {
          const response = await chrome.runtime.sendMessage({ action: 'forceSync' });
          return { success: true, response };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      if (result.success) {
        console.log('✅ Sync completed');
        // Wait for sync to complete
        await this.page.waitForTimeout(3000);
      } else {
        console.log('⚠️ Sync failed:', result.error);
      }
    } catch (error) {
      console.log('⚠️ Could not trigger sync:', error.message);
    }
  }

  /**
   * Wait for feeds to load in popup
   */
  async waitForFeedsToLoad() {
    console.log('⏳ Waiting for feeds to load...');

    await this.goToPopupPage();

    // Wait for loading indicator to disappear
    await this.page.waitForSelector('#loadingIndicator', { state: 'hidden', timeout: 15000 });

    // Check if we have feeds or empty state
    const hasFeeds = await this.page.locator('.feed-item').count() > 0;
    const hasEmptyState = await this.page.locator('#emptyState').isVisible();

    if (hasFeeds) {
      console.log('✅ Feeds loaded successfully');
    } else if (hasEmptyState) {
      console.log('📭 No feeds found (empty state)');
    } else {
      console.log('⚠️ Unexpected state - no feeds and no empty state');
    }

    return { hasFeeds, hasEmptyState };
  }

  /**
   * Get feed count from options page
   */
  async getFeedCount() {
    await this.goToOptionsPage();
    const feedItems = this.page.locator('.feed-item');
    return await feedItems.count();
  }

  /**
   * Get article count from popup
   */
  async getArticleCount() {
    await this.goToPopupPage();
    await this.page.waitForSelector('#loadingIndicator', { state: 'hidden', timeout: 10000 });
    const articleItems = this.page.locator('.feed-item');
    return await articleItems.count();
  }
}

/**
 * Mock RSS Feed Data for Testing
 */
export const MOCK_RSS_FEEDS = {
  VALID_RSS: {
    url: 'https://example.com/test-feed.xml',
    title: 'Test RSS Feed',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test RSS Feed</title>
    <description>A test RSS feed for automated testing</description>
    <link>https://example.com</link>
    <lastBuildDate>Mon, 06 Oct 2025 12:00:00 GMT</lastBuildDate>
    <item>
      <title>Test Article 1: Breaking News</title>
      <link>https://example.com/article1</link>
      <description>This is the first test article with important news content.</description>
      <pubDate>Mon, 06 Oct 2025 12:00:00 GMT</pubDate>
      <guid>https://example.com/article1</guid>
    </item>
    <item>
      <title>Test Article 2: Technology Update</title>
      <link>https://example.com/article2</link>
      <description>This is the second test article about technology updates.</description>
      <pubDate>Mon, 06 Oct 2025 11:00:00 GMT</pubDate>
      <guid>https://example.com/article2</guid>
    </item>
    <item>
      <title>Test Article 3: Sports News</title>
      <link>https://example.com/article3</link>
      <description>This is the third test article covering sports news.</description>
      <pubDate>Mon, 06 Oct 2025 10:00:00 GMT</pubDate>
      <guid>https://example.com/article3</guid>
    </item>
  </channel>
</rss>`
  },

  CDATA_RSS: {
    url: 'https://test-feeds.example.com/cdata-feed.xml',
    title: 'CDATA Test Feed',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[CDATA Test Feed]]></title>
    <description><![CDATA[A test feed with CDATA sections]]></description>
    <link>https://example.com</link>
    <item>
      <title><![CDATA[CDATA Article: Important Update]]></title>
      <link>https://example.com/cdata-article</link>
      <description><![CDATA[This article uses CDATA sections for content.]]></description>
      <pubDate>Mon, 06 Oct 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`
  },

  INVALID_RSS: {
    url: 'https://example.com/invalid-feed.xml',
    content: 'This is not valid XML content'
  },

  ATOM_FEED: {
    url: 'https://example.com/test-atom.xml',
    title: 'Test Atom Feed',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <subtitle>A test Atom feed</subtitle>
  <link href="https://example.com/"/>
  <updated>2025-10-06T12:00:00Z</updated>
  <id>https://example.com/atom-feed</id>

  <entry>
    <title>Atom Article 1</title>
    <link href="https://example.com/atom-article1"/>
    <id>https://example.com/atom-article1</id>
    <updated>2025-10-06T12:00:00Z</updated>
    <summary>This is an Atom feed article for testing.</summary>
  </entry>
</feed>`
  }
};

/**
 * Test utilities
 */
export const TestUtils = {
  /**
   * Wait for a specific amount of time
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate a unique test feed URL
   */
  generateTestFeedUrl() {
    const timestamp = Date.now();
    return `https://test-feeds.example.com/feed-${timestamp}.xml`;
  },

  /**
   * Create OPML content for testing
   */
  createTestOPML(feeds) {
    const outlines = feeds.map(feed =>
      `    <outline text="${feed.title}" xmlUrl="${feed.url}" />`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>Test RSS Feeds</title>
    <dateCreated>Mon, 06 Oct 2025 12:00:00 GMT</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
  }
};
