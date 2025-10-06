// RSS Reader Options Page Script

class RSSReaderOptions {
  constructor() {
    this.feeds = [];
    this.settings = {
      updateInterval: 15,
      enableNotifications: false
    };

    this.init();
  }

  async init() {
    console.log('Initializing RSS Reader options page...');

    this.setupEventListeners();
    await this.loadData();
  }

  setupEventListeners() {
    // 피드 추가
    document.getElementById('addFeedBtn').addEventListener('click', () => {
      this.addFeed();
    });

    // Enter 키로 피드 추가
    document.getElementById('feedUrl').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addFeed();
      }
    });

    // OPML 가져오기
    document.getElementById('importOpmlBtn').addEventListener('click', () => {
      this.importOpml();
    });

    // OPML 내보내기
    document.getElementById('exportOpmlBtn').addEventListener('click', () => {
      this.exportOpml();
    });

    // 설정 저장
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      this.saveSettings();
    });
  }

  async loadData() {
    console.log('Loading feeds and settings...');

    try {
      this.showLoading(true);

      // 피드 목록 로드
      const feedsResult = await chrome.storage.sync.get(['feeds']);
      this.feeds = feedsResult.feeds || [];

      // 설정 로드
      const settingsResult = await chrome.storage.sync.get(['settings']);
      this.settings = { ...this.settings, ...settingsResult.settings };

      console.log(`Loaded ${this.feeds.length} feeds and settings`);

      this.renderFeeds();
      this.renderSettings();

    } catch (error) {
      console.error('Error loading data:', error);
      this.showStatusMessage('데이터 로드 중 오류가 발생했습니다.', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async addFeed() {
    const urlInput = document.getElementById('feedUrl');
    const categoryInput = document.getElementById('feedCategory');

    const url = urlInput.value.trim();
    const category = categoryInput.value.trim() || '기본';

    if (!url) {
      this.showStatusMessage('피드 URL을 입력해주세요.', 'error');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showStatusMessage('올바른 URL 형식이 아닙니다.', 'error');
      return;
    }

    // 중복 확인
    if (this.feeds.some(feed => feed.url === url)) {
      this.showStatusMessage('이미 추가된 피드입니다.', 'error');
      return;
    }

    try {
      // 피드 유효성 검사 (실제로는 RSS 파싱 시도)
      await this.validateFeed(url);

      // 피드 추가
      const newFeed = {
        id: this.generateId(),
        url: url,
        title: await this.fetchFeedTitle(url),
        category: category,
        addedAt: new Date().toISOString()
      };

      this.feeds.push(newFeed);
      await this.saveFeeds();

      // UI 업데이트
      this.renderFeeds();

      // 폼 초기화
      urlInput.value = '';
      categoryInput.value = '';

      this.showStatusMessage('피드가 성공적으로 추가되었습니다.', 'success');

    } catch (error) {
      console.error('Error adding feed:', error);
      this.showStatusMessage('피드 추가 중 오류가 발생했습니다: ' + error.message, 'error');
    }
  }

  async removeFeed(feedId) {
    if (!confirm('정말로 이 피드를 삭제하시겠습니까?')) {
      return;
    }

    try {
      this.feeds = this.feeds.filter(feed => feed.id !== feedId);
      await this.saveFeeds();

      this.renderFeeds();
      this.showStatusMessage('피드가 삭제되었습니다.', 'success');

    } catch (error) {
      console.error('Error removing feed:', error);
      this.showStatusMessage('피드 삭제 중 오류가 발생했습니다.', 'error');
    }
  }

  async importOpml() {
    const fileInput = document.getElementById('opmlFile');
    const file = fileInput.files[0];

    if (!file) {
      this.showStatusMessage('OPML 파일을 선택해주세요.', 'error');
      return;
    }

    try {
      const content = await this.readFileContent(file);
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');

      // OPML 파싱
      const outlines = doc.querySelectorAll('outline[xmlUrl]');
      const importedFeeds = [];

      outlines.forEach(outline => {
        const url = outline.getAttribute('xmlUrl');
        const title = outline.getAttribute('title') || outline.getAttribute('text') || url;
        const category = outline.getAttribute('category') || '가져온 피드';

        if (url && !this.feeds.some(feed => feed.url === url)) {
          importedFeeds.push({
            id: this.generateId(),
            url: url,
            title: title,
            category: category,
            addedAt: new Date().toISOString()
          });
        }
      });

      if (importedFeeds.length === 0) {
        this.showStatusMessage('가져올 새로운 피드가 없습니다.', 'info');
        return;
      }

      this.feeds.push(...importedFeeds);
      await this.saveFeeds();

      this.renderFeeds();
      fileInput.value = '';

      this.showStatusMessage(`${importedFeeds.length}개의 피드를 가져왔습니다.`, 'success');

    } catch (error) {
      console.error('Error importing OPML:', error);
      this.showStatusMessage('OPML 가져오기 중 오류가 발생했습니다.', 'error');
    }
  }

  exportOpml() {
    if (this.feeds.length === 0) {
      this.showStatusMessage('내보낼 피드가 없습니다.', 'error');
      return;
    }

    try {
      const opmlContent = this.generateOpmlContent();
      const blob = new Blob([opmlContent], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'rss_feeds.opml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      this.showStatusMessage('OPML 파일이 다운로드되었습니다.', 'success');

    } catch (error) {
      console.error('Error exporting OPML:', error);
      this.showStatusMessage('OPML 내보내기 중 오류가 발생했습니다.', 'error');
    }
  }

  async saveSettings() {
    try {
      const updateInterval = parseInt(document.getElementById('updateInterval').value);
      const enableNotifications = document.getElementById('enableNotifications').checked;

      this.settings = {
        updateInterval: updateInterval,
        enableNotifications: enableNotifications
      };

      await chrome.storage.sync.set({ settings: this.settings });

      this.showStatusMessage('설정이 저장되었습니다.', 'success');

    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatusMessage('설정 저장 중 오류가 발생했습니다.', 'error');
    }
  }

  renderFeeds() {
    const feedList = document.getElementById('feedList');
    const emptyState = document.getElementById('emptyState');

    if (this.feeds.length === 0) {
      feedList.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    feedList.style.display = 'block';
    emptyState.style.display = 'none';

    const html = this.feeds.map(feed => this.createFeedItemHTML(feed)).join('');
    feedList.innerHTML = html;

    // 삭제 버튼 이벤트 리스너 추가
    feedList.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const feedId = btn.dataset.feedId;
        this.removeFeed(feedId);
      });
    });
  }

  createFeedItemHTML(feed) {
    const addedDate = new Date(feed.addedAt).toLocaleDateString('ko-KR');

    return `
      <div class="feed-item">
        <div class="feed-info">
          <div class="feed-url">${this.escapeHtml(feed.title || feed.url)}</div>
          <div class="feed-meta">
            <span class="feed-category">${this.escapeHtml(feed.category)}</span>
            <span>추가일: ${addedDate}</span>
            <span>URL: ${this.escapeHtml(feed.url)}</span>
          </div>
        </div>
        <div class="feed-actions">
          <button class="btn btn-danger" data-action="remove" data-feed-id="${feed.id}">
            삭제
          </button>
        </div>
      </div>
    `;
  }

  renderSettings() {
    document.getElementById('updateInterval').value = this.settings.updateInterval;
    document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
  }

  async saveFeeds() {
    await chrome.storage.sync.set({ feeds: this.feeds });
  }

  async validateFeed(url) {
    // TODO: 실제 RSS 피드 유효성 검사 구현
    // 현재는 기본적인 URL 검사만 수행
    return new Promise((resolve) => {
      setTimeout(resolve, 500); // Mock delay
    });
  }

  async fetchFeedTitle(url) {
    // TODO: 실제 RSS 피드에서 제목 추출
    // 현재는 URL에서 도메인 추출
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  generateOpmlContent() {
    const feeds = this.feeds.map(feed =>
      `    <outline type="rss" text="${this.escapeXml(feed.title)}" title="${this.escapeXml(feed.title)}" xmlUrl="${this.escapeXml(feed.url)}" category="${this.escapeXml(feed.category)}"/>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>RSS Reader Feeds</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${feeds}
  </body>
</opml>`;
  }

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  showLoading(show) {
    const loading = document.getElementById('loadingIndicator');

    if (show) {
      loading.style.display = 'flex';
    } else {
      loading.style.display = 'none';
    }
  }

  showStatusMessage(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    const statusText = document.getElementById('statusText');

    statusText.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    // 3초 후 자동 숨김
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// 옵션 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new RSSReaderOptions();
});
