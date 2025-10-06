// RSS Reader Popup Script

class RSSReaderPopup {
  constructor() {
    this.feedItems = [];
    this.filteredItems = [];
    this.currentFilter = {
      search: '',
      unreadOnly: true,
      sortBy: 'newest'
    };

    this.init();
  }

  async init() {
    console.log('Initializing RSS Reader popup...');

    this.setupEventListeners();
    await this.loadFeeds();
  }

  setupEventListeners() {
    // 설정 버튼
    document.getElementById('optionsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 검색 입력
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.currentFilter.search = e.target.value;
      this.applyFilters();
    });

    // 검색 지우기
    document.getElementById('clearSearch').addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      this.currentFilter.search = '';
      this.applyFilters();
    });

    // 읽지 않은 글만 필터
    document.getElementById('unreadOnly').addEventListener('change', (e) => {
      this.currentFilter.unreadOnly = e.target.checked;
      this.applyFilters();
    });

    // 정렬 변경
    document.getElementById('sortBy').addEventListener('change', (e) => {
      this.currentFilter.sortBy = e.target.value;
      this.applyFilters();
    });

    // 피드 추가 버튼 (빈 상태에서)
    document.getElementById('addFeedBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 리더 뷰 모달 닫기
    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeReaderModal();
    });

    // 모달 배경 클릭으로 닫기
    document.getElementById('readerModal').addEventListener('click', (e) => {
      if (e.target.id === 'readerModal') {
        this.closeReaderModal();
      }
    });
  }

  async loadFeeds() {
    console.log('Loading feeds...');

    try {
      // 로딩 표시
      this.showLoading(true);

      // Service Worker 활성화 확인
      await this.ensureServiceWorkerActive();

      // 저장된 피드 아이템 로드
      const result = await chrome.storage.local.get(['feedItems']);
      this.feedItems = result.feedItems || [];

      console.log(`Loaded ${this.feedItems.length} feed items`);

      // 피드가 없으면 빈 상태 표시
      if (this.feedItems.length === 0) {
        this.showEmptyState();
      } else {
        this.applyFilters();
      }

    } catch (error) {
      console.error('Error loading feeds:', error);
      this.showError('피드를 불러오는 중 오류가 발생했습니다.');
    } finally {
      this.showLoading(false);
    }
  }

  async ensureServiceWorkerActive() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'ping' });
      console.log('Service Worker status:', response);
      return response.status === 'alive';
    } catch (error) {
      console.warn('Service Worker not responding:', error);
      return false;
    }
  }

  applyFilters() {
    let filtered = [...this.feedItems];

    // 검색 필터
    if (this.currentFilter.search) {
      const searchTerm = this.currentFilter.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchTerm) ||
        item.feedUrl.toLowerCase().includes(searchTerm)
      );
    }

    // 읽지 않은 글만 필터
    if (this.currentFilter.unreadOnly) {
      filtered = filtered.filter(item => !item.read);
    }

    // 정렬
    switch (this.currentFilter.sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
        break;
      case 'score':
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
    }

    this.filteredItems = filtered;
    this.renderFeedList();
  }

  renderFeedList() {
    const feedList = document.getElementById('feedList');

    if (this.filteredItems.length === 0) {
      feedList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>검색 결과가 없습니다</h3>
          <p>다른 검색어를 시도해보세요</p>
        </div>
      `;
      return;
    }

    const html = this.filteredItems.map(item => this.createFeedItemHTML(item)).join('');
    feedList.innerHTML = html;

    // 이벤트 리스너 추가
    this.attachFeedItemListeners();
  }

  createFeedItemHTML(item) {
    const date = new Date(item.pubDate).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const feedName = this.extractFeedName(item.feedUrl);
    const scoreDisplay = item.score ? ` (점수: ${item.score})` : '';

    return `
      <div class="feed-item ${item.read ? 'read' : ''}" data-item-id="${item.id}">
        <div class="article-title">${this.escapeHtml(item.title)}</div>
        <div class="article-meta">
          <span class="feed-source">${feedName}${scoreDisplay}</span>
          <span class="article-date">${date}</span>
        </div>
        <div class="article-actions">
          <button class="action-btn read-btn" data-action="read">읽기</button>
          <button class="action-btn" data-action="open">새 탭</button>
        </div>
      </div>
    `;
  }

  attachFeedItemListeners() {
    document.querySelectorAll('.feed-item').forEach(item => {
      const itemId = item.dataset.itemId;

      // 제목 클릭 시 새 탭으로 열기 및 읽음 처리
      item.querySelector('.article-title').addEventListener('click', () => {
        this.openArticleInNewTab(itemId);
      });

      // 액션 버튼들
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;

          if (action === 'read') {
            this.openReaderView(itemId);
          } else if (action === 'open') {
            this.openArticleInNewTab(itemId);
          }
        });
      });
    });
  }

  async openArticleInNewTab(itemId) {
    const item = this.feedItems.find(i => i.id === itemId);
    if (!item) return;

    // 새 탭으로 열기
    chrome.tabs.create({ url: item.url });

    // 읽음 처리
    await this.markAsRead(itemId);
  }

  async openReaderView(itemId) {
    const item = this.feedItems.find(i => i.id === itemId);
    if (!item) return;

    // 리더 뷰 모달 열기
    document.getElementById('readerTitle').textContent = item.title;
    document.getElementById('readerContent').innerHTML = '<p>기사 내용을 불러오는 중...</p>';
    document.getElementById('readerModal').style.display = 'flex';

    // 읽음 처리
    await this.markAsRead(itemId);

    // Mock 콘텐츠 표시 (실제로는 Readability.js로 파싱)
    setTimeout(() => {
      document.getElementById('readerContent').innerHTML = `
        <p>이것은 Mock 기사 내용입니다.</p>
        <p>실제 구현에서는 Readability.js를 사용하여 원문 페이지의 본문을 추출합니다.</p>
        <p><strong>원문 URL:</strong> <a href="${item.url}" target="_blank">${item.url}</a></p>
      `;
    }, 1000);
  }

  closeReaderModal() {
    document.getElementById('readerModal').style.display = 'none';
  }

  async markAsRead(itemId) {
    // 메모리에서 업데이트
    const item = this.feedItems.find(i => i.id === itemId);
    if (item) {
      item.read = true;
    }

    // 저장소에 저장
    await chrome.storage.local.set({ feedItems: this.feedItems });

    // UI 업데이트
    this.applyFilters();

    console.log(`Marked item ${itemId} as read`);
  }

  extractFeedName(feedUrl) {
    try {
      const url = new URL(feedUrl);
      return url.hostname.replace('www.', '');
    } catch {
      return 'Unknown Feed';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading(show) {
    const loading = document.getElementById('loadingIndicator');
    const feedList = document.getElementById('feedList');

    if (show) {
      loading.style.display = 'flex';
      feedList.style.display = 'block';
    } else {
      loading.style.display = 'none';
    }
  }

  showEmptyState() {
    document.getElementById('feedList').style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
  }

  showError(message) {
    document.getElementById('feedList').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>오류 발생</h3>
        <p>${message}</p>
      </div>
    `;
  }
}

// 팝업 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new RSSReaderPopup();
});
