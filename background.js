// RSS Reader Chrome Extension - Background Service Worker

console.log('RSS Reader background service worker started');

// 백그라운드 서비스 클래스
class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.testMode = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    console.log('Initializing background service...');

    // 테스트 모드 감지
    this.testMode = await this.detectTestMode();

    if (this.testMode) {
      console.log('[TEST MODE] Background service initialized');
    }

    this.setupMessageHandlers();
    this.setupAlarms();
    this.isInitialized = true;

    console.log('Background service initialized successfully');
  }

  async detectTestMode() {
    try {
      const result = await chrome.storage.local.get(['testMode']);
      return result.testMode || false;
    } catch (error) {
      console.error('Error detecting test mode:', error);
      return false;
    }
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Received message:', message);

      switch(message.action) {
        case 'ping':
          sendResponse({
            status: 'alive',
            testMode: this.testMode,
            timestamp: Date.now()
          });
          break;

        case 'clearStorage':
          this.clearAllStorage().then(() => {
            sendResponse({ success: true });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          break;

        case 'setTestData':
          this.setMockData(message.data).then(() => {
            sendResponse({ success: true });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          break;

        case 'forceSync':
          this.syncFeeds().then(() => {
            sendResponse({ success: true });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          break;

        default:
          console.warn('Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }

      return true; // 비동기 응답을 위해 필요
    });
  }

  setupAlarms() {
    // 15분마다 피드 동기화 알람 설정
    chrome.alarms.create('syncFeeds', {
      delayInMinutes: 1, // 1분 후 첫 동기화
      periodInMinutes: 15 // 15분마다 반복
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'syncFeeds') {
        console.log('Feed sync alarm triggered');
        this.syncFeeds();
      }
    });
  }

  async clearAllStorage() {
    console.log('Clearing all storage...');
    await Promise.all([
      chrome.storage.local.clear(),
      chrome.storage.sync.clear()
    ]);
    console.log('Storage cleared successfully');
  }

  async setMockData(mockData) {
    if (!this.testMode) {
      console.warn('setMockData called but not in test mode');
      return;
    }

    console.log('Setting mock data for testing...');

    await chrome.storage.local.set({
      feedItems: mockData.feedItems || [],
      lastUpdate: Date.now()
    });

    await chrome.storage.sync.set({
      feeds: mockData.feeds || []
    });

    console.log('Mock data set successfully');
  }

  async syncFeeds() {
    console.log('Starting feed synchronization...');

    try {
      // 저장된 피드 목록 가져오기
      const { feeds = [] } = await chrome.storage.sync.get(['feeds']);

      if (feeds.length === 0) {
        console.log('No feeds to sync');
        return;
      }

      console.log(`Syncing ${feeds.length} feeds...`);

      // TODO: 실제 RSS 파싱 및 동기화 로직 구현
      // 현재는 로그만 출력

      console.log('Feed synchronization completed');
    } catch (error) {
      console.error('Error during feed sync:', error);
    }
  }
}

// 서비스 워커 초기화
const backgroundService = new BackgroundService();

// 서비스 워커 시작 시 초기화
backgroundService.initialize();

// 서비스 워커가 깨어날 때마다 초기화 (Manifest V3 특성)
chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome startup detected, reinitializing...');
  backgroundService.initialize();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  backgroundService.initialize();
});
