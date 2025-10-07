import { test, expect } from '@playwright/test';
import { ExtensionHelper, MOCK_RSS_FEEDS, TestUtils } from './helpers/extension-helper.js';

test.describe('Options Page - Feed Management', () => {
  let extensionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new ExtensionHelper(page);

    // Clear storage before each test
    await extensionHelper.clearStorage();

    // Wait for service worker to be ready
    await extensionHelper.waitForServiceWorker();

    // Set up mock RSS responses
    await page.route('**/test-feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: MOCK_RSS_FEEDS.VALID_RSS.content
      });
    });

    await page.route('**/cdata-feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: MOCK_RSS_FEEDS.CDATA_RSS.content
      });
    });

    await page.route('**/invalid-feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: MOCK_RSS_FEEDS.INVALID_RSS.content
      });
    });

    // Navigate to options page
    await extensionHelper.goToOptionsPage();
  });

  test('TC-01: Add new feed successfully', async ({ page }) => {
    console.log('🧪 TC-01: Testing successful feed addition...');

    // Fill in the feed URL
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.VALID_RSS.url);
    await page.fill('#feedCategory', 'Test Category');

    // Click add button
    await page.click('#addFeedBtn');

    // Wait for success message
    await expect(page.locator('.status-message')).toBeVisible({ timeout: 10000 });
    const statusText = await page.textContent('.status-message');

    // Verify success message
    expect(statusText).toContain('성공');

    // Verify feed appears in the list
    await expect(page.locator('.feed-item')).toHaveCount(1);

    // Check feed details
    const feedItem = page.locator('.feed-item').first();
    await expect(feedItem).toContainText('Test RSS Feed');
    await expect(feedItem).toContainText(MOCK_RSS_FEEDS.VALID_RSS.url);

    console.log('✅ TC-01 passed: Feed added successfully');
  });

  test('TC-02: Prevent duplicate feed addition', async ({ page }) => {
    console.log('🧪 TC-02: Testing duplicate feed prevention...');

    // Add first feed
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.VALID_RSS.url);
    await page.click('#addFeedBtn');

    // Wait for success
    await expect(page.locator('.status-message')).toBeVisible();
    await page.waitForTimeout(1000);

    // Try to add the same feed again
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.VALID_RSS.url);
    await page.click('#addFeedBtn');

    // Wait for error message
    await expect(page.locator('.status-message')).toBeVisible();
    const statusText = await page.textContent('.status-message');

    // Verify duplicate error message
    expect(statusText).toContain('이미 추가된');

    // Verify only one feed in the list
    await expect(page.locator('.feed-item')).toHaveCount(1);

    console.log('✅ TC-02 passed: Duplicate feed prevented');
  });

  test('TC-03: Remove feed successfully', async ({ page }) => {
    console.log('🧪 TC-03: Testing feed removal...');

    // First add a feed
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.VALID_RSS.url);
    await page.click('#addFeedBtn');

    // Wait for feed to be added
    await expect(page.locator('.feed-item')).toHaveCount(1);
    await page.waitForTimeout(1000);

    // Set up dialog handler for confirmation
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    // Click remove button
    const removeButton = page.locator('.feed-item .remove-btn');
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Wait for feed to be removed
    await expect(page.locator('.feed-item')).toHaveCount(0);

    // Verify empty state message
    const emptyMessage = page.locator('.empty-state, .no-feeds');
    if (await emptyMessage.isVisible()) {
      console.log('📭 Empty state displayed correctly');
    }

    console.log('✅ TC-03 passed: Feed removed successfully');
  });

  test('TC-04: Import OPML file', async ({ page }) => {
    console.log('🧪 TC-04: Testing OPML import...');

    // Create test OPML content
    const testFeeds = [
      { title: 'Test Feed 1', url: MOCK_RSS_FEEDS.VALID_RSS.url },
      { title: 'Test Feed 2', url: MOCK_RSS_FEEDS.CDATA_RSS.url }
    ];

    const opmlContent = TestUtils.createTestOPML(testFeeds);

    // Create a file input with OPML content
    const fileInput = page.locator('#opmlFile');
    await expect(fileInput).toBeVisible();

    // Set the file content
    await fileInput.setInputFiles({
      name: 'test-feeds.opml',
      mimeType: 'text/xml',
      buffer: Buffer.from(opmlContent)
    });

    // Click import button
    await page.click('#importOpmlBtn');

    // Wait for import completion
    await expect(page.locator('.status-message')).toBeVisible({ timeout: 15000 });
    const statusText = await page.textContent('.status-message');

    // Verify import success message
    expect(statusText).toContain('완료');

    // Verify feeds were imported
    await expect(page.locator('.feed-item')).toHaveCount(testFeeds.length);

    console.log('✅ TC-04 passed: OPML imported successfully');
  });

  test('TC-05: Export OPML file', async ({ page }) => {
    console.log('🧪 TC-05: Testing OPML export...');

    // First add some feeds to export
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.VALID_RSS.url);
    await page.fill('#feedCategory', 'News');
    await page.click('#addFeedBtn');

    // Wait for feed to be added
    await expect(page.locator('.feed-item')).toHaveCount(1);
    await page.waitForTimeout(1000);

    // Add second feed
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.CDATA_RSS.url);
    await page.fill('#feedCategory', 'Technology');
    await page.click('#addFeedBtn');

    // Wait for second feed
    await expect(page.locator('.feed-item')).toHaveCount(2);
    await page.waitForTimeout(1000);

    // Set up download promise
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('#exportOpmlBtn');

    // Wait for download to start
    const download = await downloadPromise;

    // Verify download properties
    expect(download.suggestedFilename()).toBe('rss_feeds.opml');

    // Save and verify the downloaded file content
    const downloadPath = await download.path();
    if (downloadPath) {
      const fs = await import('fs');
      const fileContent = fs.readFileSync(downloadPath, 'utf8');

      // Verify OPML structure
      expect(fileContent).toContain('<?xml');
      expect(fileContent).toContain('<opml');
      expect(fileContent).toContain('xmlUrl');
      expect(fileContent).toContain(MOCK_RSS_FEEDS.VALID_RSS.url);
      expect(fileContent).toContain(MOCK_RSS_FEEDS.CDATA_RSS.url);
    }

    console.log('✅ TC-05 passed: OPML exported successfully');
  });

  test('TC-05b: Handle invalid feed URL gracefully', async ({ page }) => {
    console.log('🧪 TC-05b: Testing invalid feed URL handling...');

    // Try to add an invalid URL
    await page.fill('#feedUrl', 'not-a-valid-url');
    await page.click('#addFeedBtn');

    // Wait for error message
    await expect(page.locator('.status-message')).toBeVisible();
    const statusText = await page.textContent('.status-message');

    // Verify error message
    expect(statusText).toContain('오류');

    // Verify no feed was added
    await expect(page.locator('.feed-item')).toHaveCount(0);

    console.log('✅ TC-05b passed: Invalid URL handled gracefully');
  });

  test('TC-05c: Handle network error gracefully', async ({ page }) => {
    console.log('🧪 TC-05c: Testing network error handling...');

    // Mock network failure
    await page.route('**/network-error-feed.xml', async route => {
      await route.abort('failed');
    });

    // Try to add a feed that will fail
    await page.fill('#feedUrl', 'https://example.com/network-error-feed.xml');
    await page.click('#addFeedBtn');

    // Wait for error message
    await expect(page.locator('.status-message')).toBeVisible({ timeout: 15000 });
    const statusText = await page.textContent('.status-message');

    // Verify error handling
    expect(statusText).toContain('오류');

    console.log('✅ TC-05c passed: Network error handled gracefully');
  });
});
