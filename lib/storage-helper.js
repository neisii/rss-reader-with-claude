// Chrome Storage 관리 헬퍼
// chrome.storage.sync와 chrome.storage.local을 쉽게 사용할 수 있게 도와주는 유틸리티

class StorageHelper {
  constructor() {
    this.SYNC_KEYS = {
      FEEDS: "feeds",
      SETTINGS: "settings",
    };

    this.LOCAL_KEYS = {
      FEED_ITEMS: "feedItems",
      LAST_UPDATE: "lastUpdate",
      TEST_MODE: "testMode",
    };

    this.DEFAULT_SETTINGS = {
      updateInterval: 15,
      enableNotifications: false,
      defaultCategory: "기본",
    };
  }

  // ===== 피드 관리 (Sync Storage) =====

  /**
   * 모든 피드 목록 가져오기
   */
  async getFeeds() {
    try {
      const result = await chrome.storage.sync.get([this.SYNC_KEYS.FEEDS]);
      return result[this.SYNC_KEYS.FEEDS] || [];
    } catch (error) {
      console.error("Error getting feeds:", error);
      return [];
    }
  }

  /**
   * 피드 목록 저장
   */
  async saveFeeds(feeds) {
    try {
      await chrome.storage.sync.set({
        [this.SYNC_KEYS.FEEDS]: feeds,
      });
      console.log(`Saved ${feeds.length} feeds to sync storage`);
      return true;
    } catch (error) {
      console.error("Error saving feeds:", error);
      return false;
    }
  }

  /**
   * 새 피드 추가
   */
  async addFeed(feedData) {
    try {
      const feeds = await this.getFeeds();

      console.log("Checking for duplicate feed:", feedData.url);
      console.log(
        "Existing feeds:",
        feeds.map((f) => f.url),
      );

      // 중복 확인
      const existingFeed = feeds.find((feed) => feed.url === feedData.url);
      if (existingFeed) {
        console.log("Found duplicate:", existingFeed);
        throw new Error("Feed already exists");
      }

      const newFeed = {
        id: this.generateId(),
        url: feedData.url,
        title: feedData.title || this.extractDomainFromUrl(feedData.url),
        category: feedData.category || this.DEFAULT_SETTINGS.defaultCategory,
        addedAt: new Date().toISOString(),
        lastFetched: null,
        itemCount: 0,
      };

      feeds.push(newFeed);
      await this.saveFeeds(feeds);

      console.log("Added new feed:", newFeed);
      return newFeed;
    } catch (error) {
      console.error("Error adding feed:", error);
      throw error;
    }
  }

  /**
   * 피드 삭제
   */
  async removeFeed(feedId) {
    try {
      const feeds = await this.getFeeds();

      // 삭제할 피드 찾기
      const feedToDelete = feeds.find((feed) => feed.id === feedId);
      if (!feedToDelete) {
        throw new Error("Feed not found");
      }

      const updatedFeeds = feeds.filter((feed) => feed.id !== feedId);
      await this.saveFeeds(updatedFeeds);

      // 해당 피드의 아이템들도 삭제 (URL로 삭제)
      await this.removeFeedItems(feedToDelete.url);

      console.log("Removed feed:", feedId, feedToDelete.url);
      return true;
    } catch (error) {
      console.error("Error removing feed:", error);
      return false;
    }
  }

  /**
   * 피드 정보 업데이트
   */
  async updateFeed(feedId, updates) {
    try {
      const feeds = await this.getFeeds();
      const feedIndex = feeds.findIndex((feed) => feed.id === feedId);

      if (feedIndex === -1) {
        throw new Error("Feed not found");
      }

      feeds[feedIndex] = { ...feeds[feedIndex], ...updates };
      await this.saveFeeds(feeds);

      console.log("Updated feed:", feedId, updates);
      return feeds[feedIndex];
    } catch (error) {
      console.error("Error updating feed:", error);
      throw error;
    }
  }

  // ===== 설정 관리 (Sync Storage) =====

  /**
   * 설정 가져오기
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get([this.SYNC_KEYS.SETTINGS]);
      return { ...this.DEFAULT_SETTINGS, ...result[this.SYNC_KEYS.SETTINGS] };
    } catch (error) {
      console.error("Error getting settings:", error);
      return this.DEFAULT_SETTINGS;
    }
  }

  /**
   * 설정 저장
   */
  async saveSettings(settings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };

      await chrome.storage.sync.set({
        [this.SYNC_KEYS.SETTINGS]: updatedSettings,
      });

      console.log("Saved settings:", updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  }

  // ===== 피드 아이템 관리 (Local Storage) =====

  /**
   * 모든 피드 아이템 가져오기
   */
  async getFeedItems() {
    try {
      const result = await chrome.storage.local.get([
        this.LOCAL_KEYS.FEED_ITEMS,
      ]);
      return result[this.LOCAL_KEYS.FEED_ITEMS] || [];
    } catch (error) {
      console.error("Error getting feed items:", error);
      return [];
    }
  }

  /**
   * 피드 아이템 저장
   */
  async saveFeedItems(items) {
    try {
      await chrome.storage.local.set({
        [this.LOCAL_KEYS.FEED_ITEMS]: items,
      });
      console.log(`Saved ${items.length} feed items to local storage`);
      return true;
    } catch (error) {
      console.error("Error saving feed items:", error);
      return false;
    }
  }

  /**
   * 새 피드 아이템들 추가/업데이트
   */
  async updateFeedItems(newItems, feedUrl) {
    try {
      const existingItems = await this.getFeedItems();
      const itemsToAdd = [];
      const itemsToUpdate = [];

      newItems.forEach((newItem) => {
        const existingIndex = existingItems.findIndex(
          (item) => item.id === newItem.id,
        );

        if (existingIndex === -1) {
          // 새 아이템
          itemsToAdd.push(newItem);
        } else {
          // 기존 아이템 업데이트 (읽음 상태는 유지)
          itemsToUpdate.push({
            ...newItem,
            read: existingItems[existingIndex].read,
          });
          existingItems[existingIndex] =
            itemsToUpdate[itemsToUpdate.length - 1];
        }
      });

      // 새 아이템들 추가
      const allItems = [...existingItems, ...itemsToAdd];

      // 오래된 아이템 정리 (30일 이상 된 것들)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const cleanedItems = allItems.filter((item) => {
        const itemDate = new Date(item.pubDate);
        return itemDate > thirtyDaysAgo;
      });

      await this.saveFeedItems(cleanedItems);

      console.log(
        `Updated feed items for ${feedUrl}: ${itemsToAdd.length} new, ${itemsToUpdate.length} updated`,
      );

      return {
        newItems: itemsToAdd,
        updatedItems: itemsToUpdate,
        totalItems: cleanedItems.length,
      };
    } catch (error) {
      console.error("Error updating feed items:", error);
      throw error;
    }
  }

  /**
   * 특정 피드의 아이템들 삭제
   */
  async removeFeedItems(feedUrl) {
    try {
      const items = await this.getFeedItems();
      const filteredItems = items.filter((item) => item.feedUrl !== feedUrl);

      await this.saveFeedItems(filteredItems);
      console.log(`Removed items for feed: ${feedUrl}`);
      return true;
    } catch (error) {
      console.error("Error removing feed items:", error);
      return false;
    }
  }

  /**
   * 아이템 읽음 상태 변경
   */
  async markItemAsRead(itemId, read = true) {
    try {
      const items = await this.getFeedItems();
      const itemIndex = items.findIndex((item) => item.id === itemId);

      if (itemIndex === -1) {
        throw new Error("Item not found");
      }

      items[itemIndex].read = read;
      await this.saveFeedItems(items);

      console.log(`Marked item ${itemId} as ${read ? "read" : "unread"}`);
      return items[itemIndex];
    } catch (error) {
      console.error("Error marking item as read:", error);
      throw error;
    }
  }

  /**
   * 읽지 않은 아이템 개수 가져오기
   */
  async getUnreadCount() {
    try {
      const items = await this.getFeedItems();
      return items.filter((item) => !item.read).length;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  // ===== 기타 유틸리티 =====

  /**
   * 마지막 업데이트 시간 가져오기
   */
  async getLastUpdate() {
    try {
      const result = await chrome.storage.local.get([
        this.LOCAL_KEYS.LAST_UPDATE,
      ]);
      return result[this.LOCAL_KEYS.LAST_UPDATE] || null;
    } catch (error) {
      console.error("Error getting last update:", error);
      return null;
    }
  }

  /**
   * 마지막 업데이트 시간 저장
   */
  async setLastUpdate(timestamp = Date.now()) {
    try {
      await chrome.storage.local.set({
        [this.LOCAL_KEYS.LAST_UPDATE]: timestamp,
      });
      return true;
    } catch (error) {
      console.error("Error setting last update:", error);
      return false;
    }
  }

  /**
   * 테스트 모드 확인
   */
  async isTestMode() {
    try {
      const result = await chrome.storage.local.get([
        this.LOCAL_KEYS.TEST_MODE,
      ]);
      return result[this.LOCAL_KEYS.TEST_MODE] || false;
    } catch (error) {
      console.error("Error checking test mode:", error);
      return false;
    }
  }

  /**
   * 테스트 모드 설정
   */
  async setTestMode(enabled) {
    try {
      await chrome.storage.local.set({
        [this.LOCAL_KEYS.TEST_MODE]: enabled,
      });
      console.log(`Test mode ${enabled ? "enabled" : "disabled"}`);
      return true;
    } catch (error) {
      console.error("Error setting test mode:", error);
      return false;
    }
  }

  /**
   * 모든 저장소 데이터 삭제 (테스트용)
   */
  async clearAll() {
    try {
      await Promise.all([
        chrome.storage.sync.clear(),
        chrome.storage.local.clear(),
      ]);
      console.log("Cleared all storage data");
      return true;
    } catch (error) {
      console.error("Error clearing storage:", error);
      return false;
    }
  }

  /**
   * 저장소 사용량 정보 가져오기
   */
  async getStorageInfo() {
    try {
      const [syncUsage, localUsage] = await Promise.all([
        chrome.storage.sync.getBytesInUse(),
        chrome.storage.local.getBytesInUse(),
      ]);

      return {
        sync: {
          used: syncUsage,
          quota: chrome.storage.sync.QUOTA_BYTES,
          percentage: (
            (syncUsage / chrome.storage.sync.QUOTA_BYTES) *
            100
          ).toFixed(2),
        },
        local: {
          used: localUsage,
          quota: chrome.storage.local.QUOTA_BYTES,
          percentage: (
            (localUsage / chrome.storage.local.QUOTA_BYTES) *
            100
          ).toFixed(2),
        },
      };
    } catch (error) {
      console.error("Error getting storage info:", error);
      return null;
    }
  }

  // ===== 헬퍼 메서드들 =====

  /**
   * 고유 ID 생성
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * URL에서 도메인 추출
   */
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "Unknown Domain";
    }
  }

  /**
   * 데이터 내보내기 (백업용)
   */
  async exportData() {
    try {
      const [feeds, settings, items] = await Promise.all([
        this.getFeeds(),
        this.getSettings(),
        this.getFeedItems(),
      ]);

      return {
        version: "1.0",
        exportDate: new Date().toISOString(),
        feeds,
        settings,
        items: items.map((item) => ({
          ...item,
          read: false, // 내보낼 때는 읽음 상태 초기화
        })),
      };
    } catch (error) {
      console.error("Error exporting data:", error);
      throw error;
    }
  }

  /**
   * 데이터 가져오기 (복원용)
   */
  async importData(data) {
    try {
      if (!data.version || !data.feeds) {
        throw new Error("Invalid backup data format");
      }

      // 기존 데이터 백업
      const backup = await this.exportData();

      try {
        // 새 데이터 적용
        await this.saveFeeds(data.feeds || []);
        await this.saveSettings(data.settings || this.DEFAULT_SETTINGS);
        await this.saveFeedItems(data.items || []);

        console.log("Data imported successfully");
        return true;
      } catch (importError) {
        // 실패 시 백업 데이터로 복원
        await this.saveFeeds(backup.feeds);
        await this.saveSettings(backup.settings);
        await this.saveFeedItems(backup.items);

        throw new Error(
          `Import failed, restored backup: ${importError.message}`,
        );
      }
    } catch (error) {
      console.error("Error importing data:", error);
      throw error;
    }
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = StorageHelper;
} else if (typeof window !== "undefined") {
  window.StorageHelper = StorageHelper;
} else {
  // Service Worker environment
  globalThis.StorageHelper = StorageHelper;
}
