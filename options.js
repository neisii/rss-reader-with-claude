// RSS Reader Options Page Script

class RSSReaderOptions {
  constructor() {
    this.feeds = [];
    this.settings = {
      updateInterval: 15,
      enableNotifications: false,
    };

    this.init();
  }

  async init() {
    console.log("Initializing RSS Reader options page...");

    this.setupEventListeners();
    await this.loadData();
  }

  setupEventListeners() {
    // 피드 추가
    document.getElementById("addFeedBtn").addEventListener("click", () => {
      this.addFeed();
    });

    // Enter 키로 피드 추가
    document.getElementById("feedUrl").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.addFeed();
      }
    });

    // OPML 가져오기
    document.getElementById("importOpmlBtn").addEventListener("click", () => {
      this.importOpml();
    });

    // OPML 내보내기
    document.getElementById("exportOpmlBtn").addEventListener("click", () => {
      this.exportOpml();
    });

    // 설정 저장
    document.getElementById("saveSettingsBtn").addEventListener("click", () => {
      this.saveSettings();
    });
  }

  async loadData() {
    console.log("Loading feeds and settings...");

    try {
      this.showLoading(true);

      // Service Worker에서 데이터 로드
      const [feedsResult, settingsResult] = await Promise.all([
        chrome.storage.sync.get(["feeds"]),
        chrome.storage.sync.get(["settings"]),
      ]);

      this.feeds = feedsResult.feeds || [];
      this.settings = { ...this.settings, ...settingsResult.settings };

      console.log(`Loaded ${this.feeds.length} feeds and settings`);

      this.renderFeeds();
      this.renderSettings();
    } catch (error) {
      console.error("Error loading data:", error);
      this.showStatusMessage("데이터 로드 중 오류가 발생했습니다.", "error");
    } finally {
      this.showLoading(false);
    }
  }

  async addFeed() {
    const urlInput = document.getElementById("feedUrl");
    const categoryInput = document.getElementById("feedCategory");

    const url = urlInput.value.trim();
    const category = categoryInput.value.trim() || "기본";

    if (!url) {
      this.showStatusMessage("피드 URL을 입력해주세요.", "error");
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showStatusMessage("올바른 URL 형식이 아닙니다.", "error");
      return;
    }

    // 중복 확인
    if (this.feeds.some((feed) => feed.url === url)) {
      this.showStatusMessage("이미 추가된 피드입니다.", "error");
      return;
    }

    try {
      // 버튼 비활성화
      const addBtn = document.getElementById("addFeedBtn");
      const originalText = addBtn.textContent;
      addBtn.disabled = true;
      addBtn.textContent = "추가 중...";

      // 백엔드에 피드 추가 요청
      const response = await chrome.runtime.sendMessage({
        action: "addFeed",
        feedData: {
          url: url,
          title: this.extractDomainFromUrl(url),
          category: category,
        },
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      // 로컬 상태 업데이트
      this.feeds.push(response.feed);

      // UI 업데이트
      this.renderFeeds();

      // 폼 초기화
      urlInput.value = "";
      categoryInput.value = "";

      this.showStatusMessage(
        "피드가 성공적으로 추가되었습니다. 곧 새 글들이 동기화됩니다.",
        "success",
      );
    } catch (error) {
      console.error("Error adding feed:", error);
      this.showStatusMessage(
        "피드 추가 중 오류가 발생했습니다: " + error.message,
        "error",
      );
    } finally {
      // 버튼 복구
      const addBtn = document.getElementById("addFeedBtn");
      addBtn.disabled = false;
      addBtn.textContent = "피드 추가";
    }
  }

  async removeFeed(feedId) {
    if (
      !confirm(
        "정말로 이 피드를 삭제하시겠습니까? 관련된 모든 글도 함께 삭제됩니다.",
      )
    ) {
      return;
    }

    try {
      // 백엔드에 삭제 요청
      const response = await chrome.runtime.sendMessage({
        action: "removeFeed",
        feedId: feedId,
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      // 로컬 상태 업데이트
      this.feeds = this.feeds.filter((feed) => feed.id !== feedId);

      this.renderFeeds();
      this.showStatusMessage("피드가 삭제되었습니다.", "success");
    } catch (error) {
      console.error("Error removing feed:", error);
      this.showStatusMessage("피드 삭제 중 오류가 발생했습니다.", "error");
    }
  }

  async importOpml() {
    const fileInput = document.getElementById("opmlFile");
    const file = fileInput.files[0];

    if (!file) {
      this.showStatusMessage("OPML 파일을 선택해주세요.", "error");
      return;
    }

    try {
      const content = await this.readFileContent(file);
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/xml");

      // OPML 파싱 에러 확인
      if (doc.querySelector("parsererror")) {
        throw new Error("유효하지 않은 OPML 파일입니다.");
      }

      // OPML 파싱
      const outlines = doc.querySelectorAll("outline[xmlUrl]");
      const feedsToImport = [];

      outlines.forEach((outline) => {
        const url = outline.getAttribute("xmlUrl");
        const title =
          outline.getAttribute("title") || outline.getAttribute("text") || url;
        const category = outline.getAttribute("category") || "가져온 피드";

        if (url && !this.feeds.some((feed) => feed.url === url)) {
          feedsToImport.push({
            url: url,
            title: title,
            category: category,
          });
        }
      });

      if (feedsToImport.length === 0) {
        this.showStatusMessage("가져올 새로운 피드가 없습니다.", "info");
        return;
      }

      // 각 피드를 순차적으로 추가
      let successCount = 0;
      let failCount = 0;

      for (const feedData of feedsToImport) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: "addFeed",
            feedData: feedData,
          });

          if (response.success) {
            this.feeds.push(response.feed);
            successCount++;
          } else {
            failCount++;
            console.warn(
              "Failed to import feed:",
              feedData.url,
              response.error,
            );
          }
        } catch (error) {
          failCount++;
          console.warn("Failed to import feed:", feedData.url, error);
        }
      }

      this.renderFeeds();
      fileInput.value = "";

      this.showStatusMessage(
        `OPML 가져오기 완료: ${successCount}개 성공, ${failCount}개 실패`,
        successCount > 0 ? "success" : "error",
      );
    } catch (error) {
      console.error("Error importing OPML:", error);
      this.showStatusMessage(
        "OPML 가져오기 중 오류가 발생했습니다: " + error.message,
        "error",
      );
    }
  }

  exportOpml() {
    if (this.feeds.length === 0) {
      this.showStatusMessage("내보낼 피드가 없습니다.", "error");
      return;
    }

    try {
      const opmlContent = this.generateOpmlContent();
      const blob = new Blob([opmlContent], { type: "text/xml" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `rss_feeds_${new Date().toISOString().split("T")[0]}.opml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      this.showStatusMessage("OPML 파일이 다운로드되었습니다.", "success");
    } catch (error) {
      console.error("Error exporting OPML:", error);
      this.showStatusMessage("OPML 내보내기 중 오류가 발생했습니다.", "error");
    }
  }

  async saveSettings() {
    try {
      const updateInterval = parseInt(
        document.getElementById("updateInterval").value,
      );
      const enableNotifications = document.getElementById(
        "enableNotifications",
      ).checked;

      const newSettings = {
        updateInterval: updateInterval,
        enableNotifications: enableNotifications,
      };

      // Chrome Storage에 직접 저장 (백엔드 거치지 않음)
      await chrome.storage.sync.set({ settings: newSettings });

      this.settings = newSettings;

      this.showStatusMessage("설정이 저장되었습니다.", "success");
    } catch (error) {
      console.error("Error saving settings:", error);
      this.showStatusMessage("설정 저장 중 오류가 발생했습니다.", "error");
    }
  }

  renderFeeds() {
    const feedList = document.getElementById("feedList");
    const emptyState = document.getElementById("emptyState");

    if (this.feeds.length === 0) {
      feedList.style.display = "none";
      emptyState.style.display = "block";
      return;
    }

    feedList.style.display = "block";
    emptyState.style.display = "none";

    const html = this.feeds
      .map((feed) => this.createFeedItemHTML(feed))
      .join("");
    feedList.innerHTML = html;

    // 삭제 버튼 이벤트 리스너 추가
    feedList.querySelectorAll('[data-action="remove"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const feedId = btn.dataset.feedId;
        this.removeFeed(feedId);
      });
    });
  }

  createFeedItemHTML(feed) {
    const addedDate = new Date(feed.addedAt).toLocaleDateString("ko-KR");
    const lastFetched = feed.lastFetched
      ? new Date(feed.lastFetched).toLocaleDateString("ko-KR")
      : "아직 동기화되지 않음";

    return `
      <div class="feed-item">
        <div class="feed-info">
          <div class="feed-url">${this.escapeHtml(feed.title || feed.url)}</div>
          <div class="feed-meta">
            <span class="feed-category">${this.escapeHtml(feed.category)}</span>
            <span>추가일: ${addedDate}</span>
            <span>최근 동기화: ${lastFetched}</span>
            <span>아이템 수: ${feed.itemCount || 0}개</span>
          </div>
          <div class="feed-url-small">${this.escapeHtml(feed.url)}</div>
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
    document.getElementById("updateInterval").value =
      this.settings.updateInterval;
    document.getElementById("enableNotifications").checked =
      this.settings.enableNotifications;
  }

  generateOpmlContent() {
    const feeds = this.feeds
      .map(
        (feed) =>
          `    <outline type="rss" text="${this.escapeXml(feed.title)}" title="${this.escapeXml(feed.title)}" xmlUrl="${this.escapeXml(feed.url)}" category="${this.escapeXml(feed.category)}"/>`,
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>RSS Reader Feeds</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
    <ownerName>RSS Reader Extension</ownerName>
  </head>
  <body>
${feeds}
  </body>
</opml>`;
  }

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
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

  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "Unknown Domain";
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  escapeXml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  showLoading(show) {
    const loading = document.getElementById("loadingIndicator");

    if (!loading) {
      console.warn("Loading indicator not found");
      return;
    }

    if (show) {
      loading.style.display = "flex";
    } else {
      loading.style.display = "none";
    }
  }

  showStatusMessage(message, type = "info") {
    const statusElement = document.getElementById("statusMessage");
    const statusText = document.getElementById("statusText");

    statusText.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = "block";

    // 5초 후 자동 숨김
    setTimeout(() => {
      statusElement.style.display = "none";
    }, 5000);
  }
}

// 옵션 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  new RSSReaderOptions();
});
