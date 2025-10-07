/**
 * Basic Extension Loading Test with Puppeteer
 * Extension이 제대로 로드되는지 확인
 */

import { PuppeteerExtensionHelper } from './helpers/puppeteer-extension-helper.js';

describe('Chrome Extension Basic Loading', () => {
  let helper;

  beforeAll(async () => {
    helper = new PuppeteerExtensionHelper();
    await helper.launch();
  });

  afterAll(async () => {
    await helper.close();
  });

  test('Extension should load and have valid ID', async () => {
    expect(helper.extensionId).toBeTruthy();
    expect(helper.extensionId).toMatch(/^[a-z]{32}$/);
    console.log(`✅ Extension ID: ${helper.extensionId}`);
  });

  test('Popup page should open successfully', async () => {
    await helper.openPopup();

    const title = await helper.page.title();
    expect(title).toBe('RSS Reader');

    console.log(`✅ Popup title: ${title}`);
  });

  test('Options page should open successfully', async () => {
    await helper.openOptions();

    const title = await helper.page.title();
    expect(title).toBe('RSS Reader - Options');

    console.log(`✅ Options title: ${title}`);
  });

  test('Chrome Storage API should be accessible', async () => {
    await helper.openPopup();

    // 테스트 데이터 저장
    await helper.setStorage({ test: 'hello' });

    // 데이터 읽기
    const data = await helper.getStorage(['test']);
    expect(data.test).toBe('hello');

    // Storage 초기화
    await helper.clearStorage();

    const emptyData = await helper.getStorage(['test']);
    expect(emptyData.test).toBeUndefined();

    console.log('✅ Storage API working');
  });
});
