// RSS Reader Chrome Extension - Background Service Worker

// Import dependencies
try {
  importScripts("lib/rss-parser.js", "lib/storage-helper.js");
  console.log("Dependencies imported successfully");
} catch (error) {
  console.error("Failed to import dependencies:", error);
}

console.log("RSS Reader background service worker started");

// 백그라운드 서비스 클래스
class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.testMode = false;

    // Service Worker에서 클래스 인스턴스 생성 확인
    try {
      this.parser = new RSSParser();
      this.storage = new StorageHelper();
      console.log("Parser and Storage initialized successfully");
    } catch (error) {
      console.error("Failed to initialize parser/storage:", error);
      this.parser = null;
      this.storage = null;
    }

    this.isSyncing = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    console.log("Initializing background service...");

    // 테스트 모드 감지
    this.testMode = await this.storage.isTestMode();

    if (this.testMode) {
      console.log("[TEST MODE] Background service initialized");
    }

    this.setupMessageHandlers();
    this.setupAlarms();
    await this.setupDefaultFeeds();
    this.isInitialized = true;

    console.log("Background service initialized successfully");
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Received message:", message);

      switch (message.action) {
        case "ping":
          sendResponse({
            status: "alive",
            testMode: this.testMode,
            timestamp: Date.now(),
          });
          break;

        case "clearStorage":
          this.storage
            .clearAll()
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
          break;

        case "setTestData":
          this.setMockData(message.data)
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
          break;

        case "forceSync":
          this.syncFeeds()
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
          break;

        case "addFeed":
          this.addFeed(message.feedData)
            .then((result) => {
              sendResponse({ success: true, feed: result });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
          break;

        case "validateFeed":
          this.validateFeed(message.url)
            .then((result) => {
              sendResponse({ success: true, ...result });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
          break;

        case "removeFeed":
          this.storage
            .removeFeed(message.feedId)
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
          break;

        case "getUnreadCount":
          this.storage
            .getUnreadCount()
            .then((count) => {
              sendResponse({ success: true, count });
            })
            .catch((error) => {
              sendResponse({ success: false, error: error.message });
            });
          break;

        default:
          console.warn("Unknown message action:", message.action);
          sendResponse({ success: false, error: "Unknown action" });
      }

      return true; // 비동기 응답을 위해 필요
    });
  }

  setupAlarms() {
    // 기존 알람 정리
    chrome.alarms.clearAll();

    // 15분마다 피드 동기화 알람 설정
    chrome.alarms.create("syncFeeds", {
      delayInMinutes: 1, // 1분 후 첫 동기화
      periodInMinutes: 15, // 15분마다 반복
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "syncFeeds") {
        console.log("Feed sync alarm triggered");
        this.syncFeeds();
      }
    });
  }

  async setupDefaultFeeds() {
    try {
      const feeds = await this.storage.getFeeds();

      // 첫 설치 시 기본 피드 추가 (한 번만 실행하도록 플래그 확인)
      const { defaultFeedsAdded } = await chrome.storage.local.get([
        "defaultFeedsAdded",
      ]);

      if (feeds.length === 0 && !this.testMode && !defaultFeedsAdded) {
        console.log("Setting up default feeds...");

        const defaultFeeds = [
          {
            url: "https://feeds.bbci.co.uk/news/rss.xml",
            title: "BBC News – Top Stories",
            category: "News",
          },
          {
            url: "http://rss.cnn.com/rss/edition.rss",
            title: "CNN – Top Stories",
            category: "News",
          },
        ];

        for (const feedData of defaultFeeds) {
          try {
            await this.storage.addFeed(feedData);
            console.log("Added default feed:", feedData.title);
          } catch (error) {
            console.warn("Failed to add default feed:", feedData.title, error);
          }
        }

        // 기본 피드 추가 완료 플래그 설정
        await chrome.storage.local.set({ defaultFeedsAdded: true });

        // 기본 피드 추가 후 즉시 동기화
        this.syncFeeds();
      }
    } catch (error) {
      console.error("Error setting up default feeds:", error);
    }
  }

  async addFeed(feedData) {
    try {
      // 피드 URL 유효성 검사
      const validation = await this.parser.validateFeedUrl(feedData.url);
      if (!validation.isValid) {
        throw new Error(validation.warnings.join(", "));
      }

      // 실제 피드 가져와서 제목 추출 시도
      let feedTitle = feedData.title;
      try {
        const response = await fetch(feedData.url);
        const xmlText = await response.text();
        const parsed = await this.parser.parseFeed(xmlText, feedData.url);
        feedTitle = parsed.feedInfo.title || feedData.title;
      } catch (fetchError) {
        console.warn("Could not fetch feed for title extraction:", fetchError);
      }

      // 피드 추가
      const newFeed = await this.storage.addFeed({
        ...feedData,
        title: feedTitle,
      });

      // 피드 추가 후 즉시 동기화
      this.syncSingleFeed(newFeed.url);

      return newFeed;
    } catch (error) {
      console.error("Error adding feed:", error);
      throw error;
    }
  }

  async validateFeed(url) {
    try {
      const validation = await this.parser.validateFeedUrl(url);

      if (!validation.isValid) {
        return validation;
      }

      // 실제 피드 접근 시도
      try {
        const response = await fetch(url, {
          method: "HEAD",
          mode: "no-cors", // CORS 우회
        });

        return {
          ...validation,
          accessible: true,
          warnings: validation.warnings,
        };
      } catch (fetchError) {
        return {
          ...validation,
          accessible: false,
          warnings: [
            ...validation.warnings,
            "피드에 접근할 수 없습니다. CORS 정책이나 네트워크 문제일 수 있습니다.",
          ],
        };
      }
    } catch (error) {
      throw new Error(`Feed validation failed: ${error.message}`);
    }
  }

  async syncFeeds() {
    if (this.isSyncing) {
      console.log("Sync already in progress, skipping...");
      return;
    }

    this.isSyncing = true;
    console.log("Starting feed synchronization...");

    try {
      const feeds = await this.storage.getFeeds();

      if (feeds.length === 0) {
        console.log("No feeds to sync");
        return;
      }

      console.log(`Syncing ${feeds.length} feeds...`);

      const syncPromises = feeds.map((feed) => this.syncSingleFeed(feed.url));
      const results = await Promise.allSettled(syncPromises);

      // 결과 분석
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(
        `Feed sync completed: ${successful} successful, ${failed} failed`,
      );

      // 마지막 업데이트 시간 저장
      await this.storage.setLastUpdate();

      // 배지 업데이트
      await this.updateBadge();
    } catch (error) {
      console.error("Error during feed sync:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncSingleFeed(feedUrl) {
    try {
      console.log(`Syncing feed: ${feedUrl}`);

      const response = await fetch(feedUrl, {
        method: "GET",
        headers: {
          "User-Agent": "RSS Reader Chrome Extension/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await this.parser.parseFeed(xmlText, feedUrl);

      // 피드 정보 업데이트
      const feeds = await this.storage.getFeeds();
      const feed = feeds.find((f) => f.url === feedUrl);
      if (feed) {
        await this.storage.updateFeed(feed.id, {
          title: parsed.feedInfo.title,
          lastFetched: new Date().toISOString(),
          itemCount: parsed.items.length,
        });
      }

      // 아이템 업데이트
      const updateResult = await this.storage.updateFeedItems(
        parsed.items,
        feedUrl,
      );

      console.log(
        `Synced ${feedUrl}: ${updateResult.newItems.length} new items, ${updateResult.totalItems} total`,
      );

      return updateResult;
    } catch (error) {
      console.error(`Error syncing feed ${feedUrl}:`, error);
      throw error;
    }
  }

  async updateBadge() {
    try {
      const unreadCount = await this.storage.getUnreadCount();

      if (unreadCount > 0) {
        chrome.action.setBadgeText({
          text: unreadCount > 99 ? "99+" : unreadCount.toString(),
        });
        chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
    } catch (error) {
      console.error("Error updating badge:", error);
    }
  }

  async setMockData(mockData) {
    if (!this.testMode) {
      console.warn("setMockData called but not in test mode");
      return;
    }

    console.log("Setting mock data for testing...");

    await this.storage.saveFeedItems(mockData.feedItems || []);
    await this.storage.saveFeeds(mockData.feeds || []);

    console.log("Mock data set successfully");
  }
}

// 서비스 워커 초기화
const backgroundService = new BackgroundService();

// 서비스 워커 시작 시 초기화
backgroundService.initialize();

// 서비스 워커가 깨어날 때마다 초기화 (Manifest V3 특성)
chrome.runtime.onStartup.addListener(() => {
  console.log("Chrome startup detected, reinitializing...");
  backgroundService.initialize();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed/updated:", details.reason);
  backgroundService.initialize();
});
