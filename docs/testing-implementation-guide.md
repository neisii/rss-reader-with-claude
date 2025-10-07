# 크롬 확장프로그램 테스트 구현 가이드

이 문서는 현재 RSS Reader 확장프로그램에 Playwright 기반 E2E 테스트를 실제로 구현하는 단계별 가이드입니다.

## 🚀 빠른 시작

### 1단계: 기본 설정 (15분)

#### package.json 생성
```bash
cd /Users/neisii/Development/chrome-extension-rss
npm init -y
```

#### Playwright 설치
```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

#### 기본 설정 파일 생성
```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Extension 테스트는 순차 실행 권장
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Extension 테스트는 단일 워커 사용
  reporter: 'html',
  
  use: {
    headless: false, // Extension은 headful 모드 필수
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chrome-extension',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname)}`,
            `--load-extension=${path.resolve(__dirname)}`,
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
        }
      },
    },
  ],
});
```

### 2단계: 헬퍼 함수 생성 (10분)

```javascript
// tests/helpers/extension-helper.js
import { expect } from '@playwright/test';
import path from 'path';

export class ExtensionHelper {
  constructor(page) {
    this.page = page;
    this.extensionId = null;
  }

  async getExtensionId() {
    if (this.extensionId) return this.extensionId;
    
    // chrome://extensions 페이지에서 Extension ID 추출
    await this.page.goto('chrome://extensions/');
    await this.page.waitForTimeout(1000);
    
    const extensionCard = this.page.locator('[id^="card-"]').first();
    const extensionId = await extensionCard.getAttribute('id');
    this.extensionId = extensionId?.replace('card-', '') || null;
    
    if (!this.extensionId) {
      throw new Error('Extension not found. Make sure it is loaded.');
    }
    
    return this.extensionId;
  }

  async goToOptionsPage() {
    const extensionId = await this.getExtensionId();
    await this.page.goto(`chrome-extension://${extensionId}/options.html`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async goToPopupPage() {
    const extensionId = await this.getExtensionId();
    await this.page.goto(`chrome-extension://${extensionId}/popup.html`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForServiceWorker() {
    // Service Worker가 활성화될 때까지 대기
    await this.page.goto('chrome://serviceworker-internals/');
    await this.page.waitForSelector('text=ACTIVATED', { timeout: 10000 });
  }

  async clearStorage() {
    // 확장프로그램 저장소 초기화
    const extensionId = await this.getExtensionId();
    await this.page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await this.page.evaluate(() => {
      return chrome.runtime.sendMessage({ action: 'clearStorage' });
    });
  }

  async addTestFeed(url, title = null) {
    await this.goToOptionsPage();
    
    await this.page.fill('#feedUrl', url);
    if (title) {
      await this.page.fill('#feedTitle', title);
    }
    
    await this.page.click('#addFeedBtn');
    await this.page.waitForSelector('.status-message', { timeout: 5000 });
  }

  async waitForFeedSync() {
    // 피드 동기화 완료까지 대기
    await this.page.evaluate(() => {
      return chrome.runtime.sendMessage({ action: 'forceSync' });
    });
    
    // 동기화 완료 대기
    await this.page.waitForTimeout(3000);
  }
}

// Mock RSS 피드 데이터
export const MOCK_RSS_FEEDS = {
  VALID_RSS: {
    url: 'https://example.com/feed.xml',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <description>Test RSS Feed</description>
    <link>https://example.com</link>
    <item>
      <title>Test Article 1</title>
      <link>https://example.com/article1</link>
      <description>Test article description</description>
      <pubDate>Mon, 06 Oct 2025 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Test Article 2</title>
      <link>https://example.com/article2</link>
      <description>Another test article</description>
      <pubDate>Mon, 06 Oct 2025 11:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`
  },
  
  CDATA_RSS: {
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[BBC News]]></title>
    <description><![CDATA[BBC News RSS Feed]]></description>
    <item>
      <title><![CDATA[Breaking News: Test Article]]></title>
      <link>https://bbc.com/news/article1</link>
      <description><![CDATA[This is a test article with CDATA]]></description>
      <pubDate>Mon, 06 Oct 2025 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`
  }
};
```

### 3단계: 테스트 시나리오 구현 (60분)

#### Options 페이지 테스트
```javascript
// tests/options.spec.js
import { test, expect } from '@playwright/test';
import { ExtensionHelper, MOCK_RSS_FEEDS } from './helpers/extension-helper.js';

test.describe('Options Page - Feed Management', () => {
  let extensionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new ExtensionHelper(page);
    await extensionHelper.clearStorage();
    await extensionHelper.waitForServiceWorker();
  });

  test('TC-01: Add new feed successfully', async ({ page }) => {
    // Mock RSS 응답 설정
    await page.route('**/feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: MOCK_RSS_FEEDS.VALID_RSS.content
      });
    });

    await extensionHelper.goToOptionsPage();
    
    // 피드 URL 입력
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.VALID_RSS.url);
    await page.click('#addFeedBtn');
    
    // 성공 메시지 확인
    await expect(page.locator('.status-message')).toContainText('성공');
    
    // 피드 목록에 추가된 것 확인
    await expect(page.locator('.feed-item')).toContainText('Test Feed');
  });

  test('TC-02: Prevent duplicate feed addition', async ({ page }) => {
    // 첫 번째 피드 추가
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);
    
    // 동일한 피드 재추가 시도
    await page.fill('#feedUrl', MOCK_RSS_FEEDS.VALID_RSS.url);
    await page.click('#addFeedBtn');
    
    // 중복 오류 메시지 확인
    await expect(page.locator('.status-message')).toContainText('이미 추가된');
  });

  test('TC-03: Remove feed successfully', async ({ page }) => {
    // 피드 추가
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);
    
    // 삭제 버튼 클릭
    await page.click('.feed-item .remove-btn');
    
    // 확인 대화상자 처리
    page.on('dialog', dialog => dialog.accept());
    
    // 피드가 목록에서 제거된 것 확인
    await expect(page.locator('.feed-item')).toHaveCount(0);
  });

  test('TC-04: Import OPML file', async ({ page }) => {
    await extensionHelper.goToOptionsPage();
    
    // OPML 파일 내용 생성
    const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>RSS Feeds</title>
  </head>
  <body>
    <outline text="Test Feed" xmlUrl="${MOCK_RSS_FEEDS.VALID_RSS.url}" />
  </body>
</opml>`;

    // 파일 입력 설정
    const fileInput = page.locator('#opmlFile');
    await fileInput.setInputFiles({
      name: 'feeds.opml',
      mimeType: 'text/xml',
      buffer: Buffer.from(opmlContent)
    });
    
    await page.click('#importOpmlBtn');
    
    // 가져오기 성공 메시지 확인
    await expect(page.locator('.status-message')).toContainText('완료');
  });

  test('TC-05: Export OPML file', async ({ page }) => {
    // 피드 추가
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);
    
    // 다운로드 이벤트 대기
    const downloadPromise = page.waitForEvent('download');
    await page.click('#exportOpmlBtn');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('rss_feeds.opml');
  });
});
```

#### Popup 페이지 테스트
```javascript
// tests/popup.spec.js
import { test, expect } from '@playwright/test';
import { ExtensionHelper, MOCK_RSS_FEEDS } from './helpers/extension-helper.js';

test.describe('Popup Page - Feed Display', () => {
  let extensionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new ExtensionHelper(page);
    await extensionHelper.clearStorage();
    
    // Mock RSS 응답 설정
    await page.route('**/feed.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: MOCK_RSS_FEEDS.VALID_RSS.content
      });
    });
    
    // 테스트 피드 추가 및 동기화
    await extensionHelper.addTestFeed(MOCK_RSS_FEEDS.VALID_RSS.url);
    await extensionHelper.waitForFeedSync();
  });

  test('TC-06: Popup loads feeds correctly', async ({ page }) => {
    await extensionHelper.goToPopupPage();
    
    // 로딩 완료 대기
    await expect(page.locator('#loadingIndicator')).toBeHidden();
    
    // 피드 아이템 표시 확인
    await expect(page.locator('.feed-item')).toHaveCount(2);
    await expect(page.locator('.feed-item').first()).toContainText('Test Article 1');
  });

  test('TC-07: Mark article as read when clicked', async ({ page }) => {
    await extensionHelper.goToPopupPage();
    
    const firstArticle = page.locator('.feed-item').first();
    const articleTitle = firstArticle.locator('.item-title');
    
    // 읽지 않은 상태 확인
    await expect(firstArticle).not.toHaveClass(/read/);
    
    // 새 탭 열기 감지
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      articleTitle.click()
    ]);
    
    // 읽음 상태로 변경 확인
    await expect(firstArticle).toHaveClass(/read/);
    
    await newPage.close();
  });

  test('TC-08: Reader view modal functionality', async ({ page }) => {
    await extensionHelper.goToPopupPage();
    
    // Reader 버튼 클릭
    await page.locator('.feed-item .reader-btn').first().click();
    
    // 모달 표시 확인
    await expect(page.locator('#readerModal')).toBeVisible();
    await expect(page.locator('#readerTitle')).toContainText('Test Article 1');
    
    // 모달 닫기
    await page.locator('#closeModal').click();
    await expect(page.locator('#readerModal')).toBeHidden();
    
    // ESC 키로 닫기 테스트
    await page.locator('.feed-item .reader-btn').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#readerModal')).toBeHidden();
  });

  test('TC-09: Search functionality', async ({ page }) => {
    await extensionHelper.goToPopupPage();
    
    // 검색어 입력
    await page.fill('#searchInput', 'Article 1');
    
    // 필터링 결과 확인
    await expect(page.locator('.feed-item')).toHaveCount(1);
    await expect(page.locator('.feed-item')).toContainText('Test Article 1');
    
    // 검색 초기화
    await page.click('#clearSearch');
    await expect(page.locator('.feed-item')).toHaveCount(2);
  });

  test('TC-10: Sorting functionality', async ({ page }) => {
    await extensionHelper.goToPopupPage();
    
    // 기본 정렬 (최신순) 확인
    const articles = page.locator('.feed-item .item-title');
    await expect(articles.first()).toContainText('Test Article 1');
    
    // 오래된 순으로 정렬
    await page.selectOption('#sortBy', 'oldest');
    await expect(articles.first()).toContainText('Test Article 2');
    
    // 점수순 정렬
    await page.selectOption('#sortBy', 'score');
    // 점수 기반 정렬 확인 (구체적인 검증은 점수 로직에 따라)
    await expect(page.locator('.feed-item')).toHaveCount(2);
  });

  test('TC-11: Unread only filter', async ({ page }) => {
    await extensionHelper.goToPopupPage();
    
    // 첫 번째 기사를 읽음으로 표시
    await page.locator('.feed-item .item-title').first().click();
    
    // 전체 기사 확인
    await page.check('#unreadOnly');
    await expect(page.locator('.feed-item')).toHaveCount(1); // 읽지 않은 것만
    
    // 전체 기사 표시
    await page.uncheck('#unreadOnly');
    await expect(page.locator('.feed-item')).toHaveCount(2); // 전체
  });
});
```

#### Service Worker 특화 테스트
```javascript
// tests/service-worker.spec.js
import { test, expect } from '@playwright/test';
import { ExtensionHelper } from './helpers/extension-helper.js';

test.describe('Service Worker Functionality', () => {
  let extensionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new ExtensionHelper(page);
    await extensionHelper.clearStorage();
  });

  test('Service Worker handles suspension gracefully', async ({ page }) => {
    await extensionHelper.goToPopupPage();
    
    // Service Worker 상태 확인
    await page.goto('chrome://serviceworker-internals/');
    const swEntry = page.locator('[data-partition-id*="chrome-extension"]').first();
    await expect(swEntry.locator('.status')).toContainText('ACTIVATED');
    
    // Service Worker 중단
    await swEntry.locator('.stop').click();
    await expect(swEntry.locator('.status')).toContainText('STOPPED');
    
    // 확장프로그램 기능 테스트 (SW 자동 재시작 확인)
    await extensionHelper.goToPopupPage();
    await page.click('#optionsBtn'); // 설정 버튼 클릭
    
    // Service Worker 재시작 확인
    await page.goto('chrome://serviceworker-internals/');
    await expect(swEntry.locator('.status')).toContainText('ACTIVATED');
  });

  test('Background sync functionality', async ({ page }) => {
    // 알람 설정 확인
    await page.goto('chrome://settings/content/notifications');
    
    // Extension ID로 알림 권한 확인 (실제 구현에서는 더 구체적으로)
    const extensionId = await extensionHelper.getExtensionId();
    
    // 15분 주기 동기화 설정 확인
    await extensionHelper.goToPopupPage();
    await page.evaluate(() => {
      return chrome.runtime.sendMessage({ action: 'forceSync' });
    });
    
    // 동기화 완료 대기
    await page.waitForTimeout(2000);
    
    // 마지막 동기화 시간 확인
    const lastSync = await page.evaluate(() => {
      return chrome.storage.local.get(['lastSyncTime']);
    });
    
    expect(lastSync.lastSyncTime).toBeTruthy();
  });
});
```

### 4단계: package.json 스크립트 설정

```json
{
  "name": "rss-reader-extension",
  "version": "1.0.0-beta",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug",
    "test:report": "playwright show-report",
    "test:install": "playwright install chromium"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

### 5단계: 테스트 실행

```bash
# 브라우저 설치
npm run test:install

# 기본 테스트 실행
npm test

# UI 모드로 실행 (디버깅용)
npm run test:ui

# 결과 리포트 확인
npm run test:report
```

## 🔧 고급 설정

### VSCode 설정 (선택사항)
```json
// .vscode/settings.json
{
  "playwright.reuseBrowser": true,
  "playwright.showTrace": true
}
```

### 환경별 설정
```javascript
// playwright.config.js에 추가
const config = {
  // ... 기본 설정
  
  // CI 환경 감지
  ...(process.env.CI && {
    workers: 1,
    retries: 2,
    use: {
      ...use,
      video: 'retain-on-failure',
      screenshot: 'only-on-failure'
    }
  })
};
```

## 🚨 문제 해결

### 일반적인 이슈들

1. **Extension ID 찾을 수 없음**
```javascript
// Extension이 제대로 로드되지 않은 경우
await page.goto('chrome://extensions/');
await page.check('#developer-mode'); // Developer mode 활성화
await page.reload();
```

2. **Service Worker 시간 초과**
```javascript
// 더 긴 대기 시간 설정
test.setTimeout(60000); // 60초
```

3. **CORS 문제**
```javascript
// Mock 라우트 사용
await page.route('**/*', route => {
  if (route.request().url().includes('feed')) {
    route.fulfill({ ... });
  } else {
    route.continue();
  }
});
```

이 가이드를 따라하면 현재 RSS Reader 확장프로그램에 완전한 E2E 테스트 자동화를 구현할 수 있습니다.