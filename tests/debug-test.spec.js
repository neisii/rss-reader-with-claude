import { test, expect } from '@playwright/test';

test.describe('Debug Test - Keep Browser Open', () => {

  test('Manual verification test', async ({ page }) => {
    console.log('🧪 Starting manual verification test...');
    console.log('ℹ️  This test will keep the browser open for manual inspection');

    try {
      // Navigate to a simple page first
      await page.goto('chrome://version/');
      console.log('✅ Basic navigation successful');

      // Wait a bit to see the page
      await page.waitForTimeout(3000);

      const title = await page.title();
      console.log(`📄 Page title: ${title}`);

      // Try to navigate to extensions page
      console.log('🔍 Attempting to navigate to chrome://extensions/...');
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(3000);

      console.log('✅ Successfully navigated to extensions page');

      // Keep browser open for a while for manual inspection
      console.log('⏸️  Keeping browser open for 30 seconds for manual inspection...');
      console.log('📝 Please manually check:');
      console.log('   1. Is the RSS Reader extension visible?');
      console.log('   2. Is Developer Mode enabled?');
      console.log('   3. Are there any error messages?');

      await page.waitForTimeout(30000);

      console.log('✅ Manual verification window completed');

    } catch (error) {
      console.log('❌ Error occurred:', error.message);
      // Even if there's an error, let's keep the browser open for inspection
      console.log('⏸️  Keeping browser open despite error...');
      await page.waitForTimeout(10000);
      throw error;
    }
  });
});
