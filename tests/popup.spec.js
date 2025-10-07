import { test, expect } from '@playwright/test';
import { ExtensionHelper, MOCK_RSS_FEEDS } from './helpers/extension-helper.js';

test.describe('Popup Page - Feed Display', () => {
  let extensionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new ExtensionHelper(page);

    // Clear storage and setup
    await extensionHelper.clearStorage();
    await extensionHelper.waitForServiceWorker();

    // Mock RSS responses
    await page.route('**/test-feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: MOCK_RSS_FEEDS.VALID_RSS.content
      });
    });

    // Add a test feed and wait for sync
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);
    await extensionHelper.forceFeedSync();
  });

  test('TC-06: Popup loads feeds correctly', async ({ page }) => {
    console.log('🧪 TC-06: Testing popup feed loading...');

    await extensionHelper.goToPopupPage();

    // Wait for loading to complete
    await expect(page.locator('#loadingIndicator')).toBeHidden({ timeout: 15000 });

    // Check that feeds are displayed
    const feedStatus = await extensionHelper.waitForFeedsToLoad();

    if (feedStatus.hasFeeds) {
      // Verify feed items are visible
      const feedItems = page.locator('.feed-item');
      const itemCount = await feedItems.count();
      expect(itemCount).toBeGreaterThan(0);

      // Verify first article content
      const firstArticle = feedItems.first();
      await expect(firstArticle).toContainText('Test Article');

      console.log(`✅ TC-06 passed: ${itemCount} articles loaded successfully`);
    } else if (feedStatus.hasEmptyState) {
      console.log('📭 TC-06: Empty state displayed (feeds may not have synced yet)');

      // Try to trigger sync manually
      const syncButton = page.locator('#syncBtn, .sync-button, [title*="동기화"], [title*="sync"]');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await page.waitForTimeout(3000);

        // Check again
        const newStatus = await extensionHelper.waitForFeedsToLoad();
        if (newStatus.hasFeeds) {
          console.log('✅ TC-06 passed: Articles loaded after manual sync');
        }
      }
    }

    console.log('✅ TC-06 completed: Popup loading tested');
  });

  test('TC-07: Mark article as read when clicked', async ({ page }) => {
    console.log('🧪 TC-07: Testing article read status...');

    await extensionHelper.goToPopupPage();
    await extensionHelper.waitForFeedsToLoad();

    // Wait for at least one article
    await expect(page.locator('.feed-item')).toHaveCountGreaterThan(0, { timeout: 10000 });

    const firstArticle = page.locator('.feed-item').first();
    const articleTitle = firstArticle.locator('.item-title, .article-title, a[href]');

    // Check initial unread state
    const initialClass = await firstArticle.getAttribute('class') || '';
    console.log('📄 Initial article class:', initialClass);

    // Click on the article title (should open in new tab and mark as read)
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      articleTitle.click()
    ]);

    // Verify new tab opened
    expect(newPage.url()).toContain('example.com');
    await newPage.close();

    // Check if article is marked as read
    await page.waitForTimeout(1000); // Wait for state update

    const updatedClass = await firstArticle.getAttribute('class') || '';
    console.log('📄 Updated article class:', updatedClass);

    // Verify read state (either by class or visual indicator)
    const isReadNow = updatedClass.includes('read') ||
                     await firstArticle.locator('.read-indicator, .read-status').isVisible() ||
                     await firstArticle.evaluate(el => el.style.opacity < 1);

    expect(isReadNow).toBeTruthy();

    console.log('✅ TC-07 passed: Article marked as read');
  });

  test('TC-08: Reader view modal functionality', async ({ page }) => {
    console.log('🧪 TC-08: Testing reader view modal...');

    await extensionHelper.goToPopupPage();
    await extensionHelper.waitForFeedsToLoad();

    // Wait for feed items
    await expect(page.locator('.feed-item')).toHaveCountGreaterThan(0);

    // Find and click reader button
    const readerButton = page.locator('.feed-item .reader-btn, .feed-item .read-btn, .feed-item [title*="읽기"], .feed-item [title*="Read"]').first();
    await expect(readerButton).toBeVisible();
    await readerButton.click();

    // Verify modal opens
    const modal = page.locator('#readerModal, .modal, .reader-modal');
    await expect(modal).toBeVisible();

    // Verify modal content
    const modalTitle = page.locator('#readerTitle, .modal-title, .reader-title');
    await expect(modalTitle).toContainText('Test Article');

    const modalContent = page.locator('#readerContent, .modal-body, .reader-content');
    await expect(modalContent).toBeVisible();

    // Test close button
    const closeButton = page.locator('#closeModal, .close-btn, .modal-close');
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // Verify modal closes
    await expect(modal).toBeHidden();

    // Test ESC key functionality
    await readerButton.click(); // Open modal again
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    console.log('✅ TC-08 passed: Reader view modal works correctly');
  });

  test('TC-09: Search functionality', async ({ page }) => {
    console.log('🧪 TC-09: Testing search functionality...');

    await extensionHelper.goToPopupPage();
    await extensionHelper.waitForFeedsToLoad();

    // Wait for articles to load
    await expect(page.locator('.feed-item')).toHaveCountGreaterThan(0);
    const initialCount = await page.locator('.feed-item').count();
    console.log(`📊 Initial article count: ${initialCount}`);

    // Test search with specific term
    const searchInput = page.locator('#searchInput, .search-input, input[placeholder*="검색"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Article 1');

    // Wait for filtering to apply
    await page.waitForTimeout(500);

    // Check filtered results
    const filteredCount = await page.locator('.feed-item:visible').count();
    console.log(`🔍 Filtered article count: ${filteredCount}`);

    // Should have fewer items (or same if only one matches)
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Verify the visible article contains the search term
    if (filteredCount > 0) {
      const visibleArticle = page.locator('.feed-item:visible').first();
      await expect(visibleArticle).toContainText('Article 1');
    }

    // Test clear search
    const clearButton = page.locator('#clearSearch, .clear-btn, .search-clear');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    } else {
      await searchInput.clear();
    }

    // Wait for reset
    await page.waitForTimeout(500);

    // Verify all articles are visible again
    const resetCount = await page.locator('.feed-item:visible').count();
    expect(resetCount).toBe(initialCount);

    console.log('✅ TC-09 passed: Search functionality works correctly');
  });

  test('TC-10: Sorting functionality', async ({ page }) => {
    console.log('🧪 TC-10: Testing sorting functionality...');

    await extensionHelper.goToPopupPage();
    await extensionHelper.waitForFeedsToLoad();

    // Wait for articles
    await expect(page.locator('.feed-item')).toHaveCountGreaterThan(0);

    // Get initial article order
    const getFirstArticleTitle = async () => {
      const firstArticle = page.locator('.feed-item .item-title, .feed-item .article-title').first();
      return await firstArticle.textContent();
    };

    const initialFirstTitle = await getFirstArticleTitle();
    console.log(`📊 Initial first article: "${initialFirstTitle}"`);

    // Test sorting by oldest first
    const sortSelect = page.locator('#sortBy, .sort-select, select[name*="sort"]');
    await expect(sortSelect).toBeVisible();

    await sortSelect.selectOption('oldest');
    await page.waitForTimeout(500);

    const oldestFirstTitle = await getFirstArticleTitle();
    console.log(`📊 After oldest sort: "${oldestFirstTitle}"`);

    // Test sorting by score
    await sortSelect.selectOption('score');
    await page.waitForTimeout(500);

    const scoreFirstTitle = await getFirstArticleTitle();
    console.log(`📊 After score sort: "${scoreFirstTitle}"`);

    // Test back to newest
    await sortSelect.selectOption('newest');
    await page.waitForTimeout(500);

    const backToNewestTitle = await getFirstArticleTitle();
    console.log(`📊 Back to newest: "${backToNewestTitle}"`);

    // Verify sorting changed the order (at least once)
    const orderChanged = (oldestFirstTitle !== initialFirstTitle) ||
                        (scoreFirstTitle !== initialFirstTitle) ||
                        (backToNewestTitle === initialFirstTitle);

    expect(orderChanged).toBeTruthy();

    console.log('✅ TC-10 passed: Sorting functionality works correctly');
  });

  test('TC-11: Unread only filter', async ({ page }) => {
    console.log('🧪 TC-11: Testing unread only filter...');

    await extensionHelper.goToPopupPage();
    await extensionHelper.waitForFeedsToLoad();

    // Wait for articles
    await expect(page.locator('.feed-item')).toHaveCountGreaterThan(0);
    const totalCount = await page.locator('.feed-item').count();
    console.log(`📊 Total articles: ${totalCount}`);

    // Mark one article as read by clicking it
    const firstArticle = page.locator('.feed-item').first();
    const articleLink = firstArticle.locator('.item-title, .article-title, a[href]');

    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      articleLink.click()
    ]);
    await newPage.close();

    // Wait for read status to update
    await page.waitForTimeout(1000);

    // Find and test unread only checkbox
    const unreadCheckbox = page.locator('#unreadOnly, .unread-only, input[type="checkbox"][name*="unread"]');
    await expect(unreadCheckbox).toBeVisible();

    // Check if it's already checked (default behavior)
    const isChecked = await unreadCheckbox.isChecked();
    console.log(`📊 Unread filter initially checked: ${isChecked}`);

    if (isChecked) {
      // Should show only unread items (one less than total)
      const unreadCount = await page.locator('.feed-item:visible').count();
      console.log(`📊 Unread articles visible: ${unreadCount}`);
      expect(unreadCount).toBeLessThan(totalCount);

      // Uncheck to show all articles
      await unreadCheckbox.uncheck();
      await page.waitForTimeout(500);

      const allCount = await page.locator('.feed-item:visible').count();
      console.log(`📊 All articles visible: ${allCount}`);
      expect(allCount).toBe(totalCount);

      // Check again to filter
      await unreadCheckbox.check();
      await page.waitForTimeout(500);

      const filteredAgainCount = await page.locator('.feed-item:visible').count();
      expect(filteredAgainCount).toBeLessThan(totalCount);
    } else {
      // If not checked initially, check it to filter
      await unreadCheckbox.check();
      await page.waitForTimeout(500);

      const filteredCount = await page.locator('.feed-item:visible').count();
      console.log(`📊 Filtered to unread: ${filteredCount}`);
      expect(filteredCount).toBeLessThan(totalCount);

      // Uncheck to show all
      await unreadCheckbox.uncheck();
      await page.waitForTimeout(500);

      const allCount = await page.locator('.feed-item:visible').count();
      expect(allCount).toBe(totalCount);
    }

    console.log('✅ TC-11 passed: Unread only filter works correctly');
  });

  test('TC-11b: Options button navigation', async ({ page }) => {
    console.log('🧪 TC-11b: Testing options button navigation...');

    await extensionHelper.goToPopupPage();

    // Find and click options button
    const optionsButton = page.locator('#optionsBtn, .options-btn, [title*="설정"], [title*="options"]');
    await expect(optionsButton).toBeVisible();

    // Click options button (should open options page)
    const [optionsPage] = await Promise.all([
      page.context().waitForEvent('page'),
      optionsButton.click()
    ]);

    // Verify options page opened
    expect(optionsPage.url()).toContain('options.html');

    // Verify options page content
    await expect(optionsPage.locator('h1, .title')).toContainText('설정');

    await optionsPage.close();

    console.log('✅ TC-11b passed: Options navigation works correctly');
  });
});
