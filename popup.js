// RSS Reader Popup Script

class RSSReaderPopup {
  constructor() {
    this.feedItems = [];
    this.filteredItems = [];
    this.currentFilter = {
      search: "",
      unreadOnly: true,
      sortBy: "newest",
    };

    this.init();
  }

  async init() {
    console.log("Initializing RSS Reader popup...");

    // DOM이 완전히 로드된 후 실행
    if (document.readyState === "loading") {
      await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve);
      });
    }

    this.setupEventListeners();
    await this.loadFeeds();

    // 스토리지 변경 감지
    this.setupStorageListener();
  }

  setupEventListeners() {
    // 설정 버튼
    document.getElementById("optionsBtn").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

    // 검색 입력
    document.getElementById("searchInput").addEventListener("input", (e) => {
      this.currentFilter.search = e.target.value;
      this.applyFilters();
    });

    // 검색 지우기
    document.getElementById("clearSearch").addEventListener("click", () => {
      document.getElementById("searchInput").value = "";
      this.currentFilter.search = "";
      this.applyFilters();
    });

    // 읽지 않은 글만 필터
    document.getElementById("unreadOnly").addEventListener("change", (e) => {
      this.currentFilter.unreadOnly = e.target.checked;
      this.applyFilters();
    });

    // 정렬 변경
    document.getElementById("sortBy").addEventListener("change", (e) => {
      this.currentFilter.sortBy = e.target.value;
      this.applyFilters();
    });

    // 피드 추가 버튼 (빈 상태에서)
    document.getElementById("addFeedBtn").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

    // 리더 뷰 모달 닫기
    document.getElementById("closeModal").addEventListener("click", () => {
      this.closeReaderModal();
    });

    // 모달 배경 클릭으로 닫기
    document.getElementById("readerModal").addEventListener("click", (e) => {
      if (e.target.id === "readerModal") {
        this.closeReaderModal();
      }
    });

    // ESC 키로 모달 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeReaderModal();
      }
    });
  }

  setupStorageListener() {
    // 저장소 변경 시 자동 새로고침
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.feedItems) {
        console.log("Feed items updated, refreshing...");
        this.feedItems = changes.feedItems.newValue || [];
        this.applyFilters();
      }
    });
  }

  async loadFeeds() {
    console.log("Loading feeds...");

    try {
      // 로딩 표시
      this.showLoading(true);

      // Service Worker 활성화 확인
      await this.ensureServiceWorkerActive();

      // 저장된 피드 아이템 로드
      const result = await chrome.storage.local.get(["feedItems"]);
      this.feedItems = result.feedItems || [];

      console.log(`Loaded ${this.feedItems.length} feed items`);

      // 피드가 없으면 상태 확인
      if (this.feedItems.length === 0) {
        await this.checkFeedStatus();
      } else {
        this.applyFilters();
      }
    } catch (error) {
      console.error("Error loading feeds:", error);
      this.showError("피드를 불러오는 중 오류가 발생했습니다.");
    } finally {
      this.showLoading(false);
    }
  }

  async checkFeedStatus() {
    try {
      // 구독된 피드가 있는지 확인
      const feeds = await chrome.storage.sync.get(["feeds"]);

      if (!feeds.feeds || feeds.feeds.length === 0) {
        // 구독된 피드가 없음
        this.showEmptyState();
      } else {
        // 피드는 있지만 아이템이 없음 (아직 동기화 안됨 또는 실패)
        this.showSyncingState(feeds.feeds.length);
      }
    } catch (error) {
      console.error("Error checking feed status:", error);
      this.showEmptyState();
    }
  }

  async ensureServiceWorkerActive() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "ping" });
      console.log("Service Worker status:", response);
      return response.status === "alive";
    } catch (error) {
      console.warn("Service Worker not responding:", error);
      return false;
    }
  }

  applyFilters() {
    let filtered = [...this.feedItems];

    // 검색 필터
    if (this.currentFilter.search) {
      const searchTerm = this.currentFilter.search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(searchTerm) ||
          this.extractFeedName(item.feedUrl).toLowerCase().includes(searchTerm),
      );
    }

    // 읽지 않은 글만 필터
    if (this.currentFilter.unreadOnly) {
      filtered = filtered.filter((item) => !item.read);
    }

    // 정렬
    switch (this.currentFilter.sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        break;
      case "oldest":
        filtered.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
        break;
      case "score":
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
    }

    this.filteredItems = filtered;
    this.renderFeedList();
  }

  renderFeedList() {
    const feedList = document.getElementById("feedList");

    if (this.filteredItems.length === 0 && this.feedItems.length > 0) {
      // 필터 결과가 없음
      feedList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>검색 결과가 없습니다</h3>
          <p>다른 검색어를 시도하거나 필터를 조정해보세요</p>
        </div>
      `;
      return;
    }

    if (this.filteredItems.length === 0) {
      // 실제로 아이템이 없음
      return;
    }

    const html = this.filteredItems
      .map((item) => this.createFeedItemHTML(item))
      .join("");
    feedList.innerHTML = html;

    // 이벤트 리스너 추가
    this.attachFeedItemListeners();
  }

  createFeedItemHTML(item) {
    const date = new Date(item.pubDate).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const feedName = this.extractFeedName(item.feedUrl);
    const scoreDisplay =
      item.score && item.score !== 0 ? ` (점수: ${item.score})` : "";
    const scoreClass =
      item.score < -5 ? "low-score" : item.score > 5 ? "high-score" : "";

    return `
      <div class="feed-item ${item.read ? "read" : ""} ${scoreClass}" data-item-id="${item.id}">
        <div class="article-title">${this.escapeHtml(item.title)}</div>
        <div class="article-meta">
          <span class="feed-source">${feedName}${scoreDisplay}</span>
          <span class="article-date">${date}</span>
        </div>
        <div class="article-actions">
          <button class="action-btn read-btn" data-action="read" title="리더뷰로 보기">읽기</button>
          <button class="action-btn" data-action="open" title="새 탭에서 열기">새 탭</button>
          ${
            item.read
              ? '<button class="action-btn" data-action="unread" title="읽지 않음으로 표시">안읽음</button>'
              : ""
          }
        </div>
      </div>
    `;
  }

  attachFeedItemListeners() {
    document.querySelectorAll(".feed-item").forEach((item) => {
      const itemId = item.dataset.itemId;

      // 제목 클릭 시 새 탭으로 열기 및 읽음 처리
      item.querySelector(".article-title").addEventListener("click", () => {
        this.openArticleInNewTab(itemId);
      });

      // 액션 버튼들
      item.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;

          if (action === "read") {
            this.openReaderView(itemId);
          } else if (action === "open") {
            this.openArticleInNewTab(itemId);
          } else if (action === "unread") {
            this.markAsRead(itemId, false);
          }
        });
      });
    });
  }

  async openArticleInNewTab(itemId) {
    const item = this.feedItems.find((i) => i.id === itemId);
    if (!item) return;

    // 새 탭으로 열기
    chrome.tabs.create({ url: item.url });

    // 읽음 처리
    await this.markAsRead(itemId, true);
  }

  async openReaderView(itemId) {
    const item = this.feedItems.find((i) => i.id === itemId);
    if (!item) return;

    // 리더 뷰 모달 열기
    document.getElementById("readerTitle").textContent = item.title;
    document.getElementById("readerContent").innerHTML =
      '<div class="loading"><div class="spinner"></div><span>기사 내용을 불러오는 중...</span></div>';
    document.getElementById("readerModal").style.display = "flex";

    // 읽음 처리
    await this.markAsRead(itemId, true);

    // Mock 콘텐츠 표시 (실제로는 Readability.js로 파싱)
    setTimeout(() => {
      document.getElementById("readerContent").innerHTML = `
        <div class="reader-content">
          <div class="article-meta">
            <strong>출처:</strong> ${this.extractFeedName(item.feedUrl)}<br>
            <strong>발행일:</strong> ${new Date(item.pubDate).toLocaleString("ko-KR")}<br>
            <strong>원문 링크:</strong> <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a>
          </div>

          <div class="article-content">
            ${item.description || "<p>기사 요약이 없습니다.</p>"}
          </div>

          <div class="reader-notice">
            <p><strong>📌 알림:</strong> 이것은 RSS에서 제공하는 요약 내용입니다.</p>
            <p>전체 기사를 보시려면 <a href="${item.url}" target="_blank" rel="noopener noreferrer">원문 링크</a>를 클릭하세요.</p>
          </div>
        </div>
      `;
    }, 800);
  }

  closeReaderModal() {
    document.getElementById("readerModal").style.display = "none";
  }

  async markAsRead(itemId, read = true) {
    try {
      // 메모리에서 업데이트
      const item = this.feedItems.find((i) => i.id === itemId);
      if (item) {
        item.read = read;
      }

      // 저장소에 저장
      await chrome.storage.local.set({ feedItems: this.feedItems });

      // UI 업데이트
      this.applyFilters();

      console.log(`Marked item ${itemId} as ${read ? "read" : "unread"}`);
    } catch (error) {
      console.error("Error marking item as read:", error);
    }
  }

  extractFeedName(feedUrl) {
    try {
      const url = new URL(feedUrl);
      return url.hostname.replace("www.", "");
    } catch {
      return "Unknown Feed";
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading(show) {
    const loading = document.getElementById("loadingIndicator");
    const feedList = document.getElementById("feedList");
    const emptyState = document.getElementById("emptyState");

    if (!loading || !feedList || !emptyState) {
      console.warn("Required elements not found for showLoading:");
      console.warn({
        loadingIndicator: !!loading,
        feedList: !!feedList,
        emptyState: !!emptyState,
        readyState: document.readyState,
      });
      return;
    }

    if (show) {
      loading.style.display = "flex";
      feedList.style.display = "block";
      emptyState.style.display = "none";
    } else {
      loading.style.display = "none";
    }
  }

  showEmptyState() {
    document.getElementById("feedList").style.display = "none";
    document.getElementById("emptyState").style.display = "flex";
  }

  showSyncingState(feedCount) {
    const syncStateHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔄</div>
        <h3>피드 동기화 중...</h3>
        <p>${feedCount}개의 피드에서 새 글을 가져오고 있습니다.</p>
        <p>잠시만 기다려주세요.</p>
        <button id="forceSyncBtn" class="btn btn-primary">수동 동기화</button>
      </div>
    `;

    document.getElementById("feedList").innerHTML = syncStateHTML;
    document.getElementById("feedList").style.display = "block";
    document.getElementById("emptyState").style.display = "none";

    // 이벤트 리스너 추가 (CSP 준수)
    const forceSyncBtn = document.getElementById("forceSyncBtn");
    if (forceSyncBtn) {
      forceSyncBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "forceSync" });
      });
    }
  }

  showError(message) {
    const errorHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>오류 발생</h3>
        <p>${message}</p>
        <button id="retryBtn" class="btn btn-primary">다시 시도</button>
      </div>
    `;

    document.getElementById("feedList").innerHTML = errorHTML;
    document.getElementById("feedList").style.display = "block";
    document.getElementById("emptyState").style.display = "none";

    // 이벤트 리스너 추가 (CSP 준수)
    const retryBtn = document.getElementById("retryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        location.reload();
      });
    }
  }
}

// 팝업 로드 시 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new RSSReaderPopup();
  });
} else {
  // DOM이 이미 로드된 경우 즉시 초기화
  new RSSReaderPopup();
}
