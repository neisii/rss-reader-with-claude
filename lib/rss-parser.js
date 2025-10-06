// RSS/Atom 파싱 엔진
// 순수 JavaScript + DOMParser 사용

class RSSParser {
  constructor() {
    this.supportedTypes = ["RSS", "Atom"];
  }

  /**
   * RSS/Atom 피드를 파싱하여 표준화된 형태로 반환
   * @param {string} xmlText - RSS/Atom XML 텍스트
   * @param {string} feedUrl - 피드 URL (ID 생성용)
   * @returns {Object} 파싱된 피드 데이터
   */
  async parseFeed(xmlText, feedUrl) {
    try {
      // Service Worker에서는 DOMParser 사용 불가, 정규식 파싱 사용
      if (typeof DOMParser === "undefined") {
        console.log("Using regex parsing for Service Worker");
        return this.parseWithRegex(xmlText, feedUrl);
      }

      // 브라우저에서는 DOMParser 사용
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");

      // 파싱 에러 확인
      if (this.hasParseError(doc)) {
        throw new Error("Invalid XML format");
      }

      // RSS vs Atom 구분
      if (doc.querySelector("rss")) {
        return this.parseRSS(doc, feedUrl);
      } else if (doc.querySelector("feed")) {
        return this.parseAtom(doc, feedUrl);
      } else {
        throw new Error("Unknown feed format. Must be RSS or Atom.");
      }
    } catch (error) {
      console.error("RSS parsing error:", error);
      throw new Error(`Feed parsing failed: ${error.message}`);
    }
  }

  /**
   * RSS 2.0 파싱
   */
  parseRSS(doc, feedUrl) {
    const channel = doc.querySelector("channel");
    if (!channel) {
      throw new Error("Invalid RSS format: no channel element");
    }

    // 피드 메타데이터
    const feedInfo = {
      title: this.getTextContent(channel, "title") || "Unknown RSS Feed",
      description: this.getTextContent(channel, "description") || "",
      link: this.getTextContent(channel, "link") || feedUrl,
      lastBuildDate: this.getTextContent(channel, "lastBuildDate"),
      language: this.getTextContent(channel, "language") || "ko",
    };

    // 아이템 파싱
    const items = Array.from(channel.querySelectorAll("item")).map((item) => {
      const title = this.getTextContent(item, "title") || "No Title";
      const link = this.getTextContent(item, "link") || "";
      const description = this.getTextContent(item, "description") || "";
      const pubDate = this.getTextContent(item, "pubDate");
      const guid = this.getTextContent(item, "guid") || link;

      return {
        id: this.generateItemId(feedUrl, guid || title),
        title: this.sanitizeText(title),
        url: this.sanitizeUrl(link),
        description: this.sanitizeHtml(description),
        pubDate: this.parseDate(pubDate),
        feedUrl: feedUrl,
        read: false,
        score: this.calculateClickbaitScore(title),
        category: this.extractCategory(item),
      };
    });

    return {
      feedInfo,
      items: items.filter((item) => item.url && item.title), // 필수 필드 있는 것만
    };
  }

  /**
   * Atom 1.0 파싱
   */
  parseAtom(doc, feedUrl) {
    const feed = doc.querySelector("feed");
    if (!feed) {
      throw new Error("Invalid Atom format: no feed element");
    }

    // 피드 메타데이터
    const feedInfo = {
      title: this.getTextContent(feed, "title") || "Unknown Atom Feed",
      description:
        this.getTextContent(feed, "subtitle") ||
        this.getTextContent(feed, "summary") ||
        "",
      link: this.getAtomLink(feed) || feedUrl,
      lastBuildDate: this.getTextContent(feed, "updated"),
      language: feed.getAttribute("xml:lang") || "ko",
    };

    // 엔트리 파싱
    const items = Array.from(feed.querySelectorAll("entry")).map((entry) => {
      const title = this.getTextContent(entry, "title") || "No Title";
      const link = this.getAtomLink(entry);
      const content =
        this.getTextContent(entry, "content") ||
        this.getTextContent(entry, "summary") ||
        "";
      const published =
        this.getTextContent(entry, "published") ||
        this.getTextContent(entry, "updated");
      const id = this.getTextContent(entry, "id") || link;

      return {
        id: this.generateItemId(feedUrl, id || title),
        title: this.sanitizeText(title),
        url: this.sanitizeUrl(link),
        description: this.sanitizeHtml(content),
        pubDate: this.parseDate(published),
        feedUrl: feedUrl,
        read: false,
        score: this.calculateClickbaitScore(title),
        category: this.extractAtomCategory(entry),
      };
    });

    return {
      feedInfo,
      items: items.filter((item) => item.url && item.title),
    };
  }

  /**
   * XML 파싱 에러 확인
   */
  hasParseError(doc) {
    const parseError = doc.querySelector("parsererror");
    return parseError !== null;
  }

  /**
   * 텍스트 콘텐츠 안전하게 추출 (CDATA 처리 포함)
   */
  getTextContent(parent, selector) {
    const element = parent.querySelector(selector);
    if (!element) return null;

    let text = element.textContent.trim();

    // CDATA 섹션 제거
    text = text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");

    return text;
  }

  /**
   * Atom link 요소에서 href 추출
   */
  getAtomLink(parent) {
    const link =
      parent.querySelector('link[rel="alternate"]') ||
      parent.querySelector("link:not([rel])") ||
      parent.querySelector("link");
    return link ? link.getAttribute("href") : null;
  }

  /**
   * 날짜 파싱 및 표준화
   */
  parseDate(dateString) {
    if (!dateString) {
      return new Date().toISOString();
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Service Worker용 정규식 기반 파싱
   */
  parseWithRegex(xmlText, feedUrl) {
    try {
      // RSS vs Atom 구분
      if (xmlText.includes("<rss") || xmlText.includes("<channel")) {
        return this.parseRSSWithRegex(xmlText, feedUrl);
      } else if (xmlText.includes("<feed") || xmlText.includes("<entry")) {
        return this.parseAtomWithRegex(xmlText, feedUrl);
      } else {
        throw new Error("Unknown feed format");
      }
    } catch (error) {
      console.error("Regex parsing error:", error);
      throw error;
    }
  }

  /**
   * 정규식으로 RSS 파싱
   */
  parseRSSWithRegex(xmlText, feedUrl) {
    const feedInfo = {
      title:
        this.extractWithRegex(xmlText, /<title[^>]*>(.*?)<\/title>/i) ||
        "Unknown RSS Feed",
      description:
        this.extractWithRegex(
          xmlText,
          /<description[^>]*>(.*?)<\/description>/i,
        ) || "",
      link:
        this.extractWithRegex(xmlText, /<link[^>]*>(.*?)<\/link>/i) || feedUrl,
      lastBuildDate: this.extractWithRegex(
        xmlText,
        /<lastBuildDate[^>]*>(.*?)<\/lastBuildDate>/i,
      ),
      language: "ko",
    };

    // 아이템 추출
    const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = [];
    let match;

    while ((match = itemPattern.exec(xmlText)) !== null) {
      const itemXml = match[1];

      const title =
        this.extractWithRegex(itemXml, /<title[^>]*>(.*?)<\/title>/i) ||
        "No Title";
      const link =
        this.extractWithRegex(itemXml, /<link[^>]*>(.*?)<\/link>/i) || "";
      const description =
        this.extractWithRegex(
          itemXml,
          /<description[^>]*>(.*?)<\/description>/i,
        ) || "";
      const pubDate = this.extractWithRegex(
        itemXml,
        /<pubDate[^>]*>(.*?)<\/pubDate>/i,
      );
      const guid =
        this.extractWithRegex(itemXml, /<guid[^>]*>(.*?)<\/guid>/i) || link;

      if (title && link) {
        items.push({
          id: this.generateItemId(feedUrl, guid || title),
          title: this.sanitizeText(title),
          url: this.sanitizeUrl(link),
          description: this.sanitizeText(description),
          pubDate: this.parseDate(pubDate),
          feedUrl: feedUrl,
          read: false,
          score: this.calculateClickbaitScore(title),
          category: "기본",
        });
      }
    }

    return { feedInfo, items };
  }

  /**
   * 정규식으로 Atom 파싱
   */
  parseAtomWithRegex(xmlText, feedUrl) {
    const feedInfo = {
      title:
        this.extractWithRegex(xmlText, /<title[^>]*>(.*?)<\/title>/i) ||
        "Unknown Atom Feed",
      description:
        this.extractWithRegex(xmlText, /<subtitle[^>]*>(.*?)<\/subtitle>/i) ||
        "",
      link: feedUrl,
      lastBuildDate: this.extractWithRegex(
        xmlText,
        /<updated[^>]*>(.*?)<\/updated>/i,
      ),
      language: "ko",
    };

    // 엔트리 추출
    const entryPattern = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    const items = [];
    let match;

    while ((match = entryPattern.exec(xmlText)) !== null) {
      const entryXml = match[1];

      const title =
        this.extractWithRegex(entryXml, /<title[^>]*>(.*?)<\/title>/i) ||
        "No Title";
      const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']*)/i);
      const link = linkMatch ? linkMatch[1] : "";
      const content =
        this.extractWithRegex(entryXml, /<content[^>]*>(.*?)<\/content>/i) ||
        this.extractWithRegex(entryXml, /<summary[^>]*>(.*?)<\/summary>/i) ||
        "";
      const published =
        this.extractWithRegex(
          entryXml,
          /<published[^>]*>(.*?)<\/published>/i,
        ) || this.extractWithRegex(entryXml, /<updated[^>]*>(.*?)<\/updated>/i);
      const id =
        this.extractWithRegex(entryXml, /<id[^>]*>(.*?)<\/id>/i) || link;

      if (title && link) {
        items.push({
          id: this.generateItemId(feedUrl, id || title),
          title: this.sanitizeText(title),
          url: this.sanitizeUrl(link),
          description: this.sanitizeText(content),
          pubDate: this.parseDate(published),
          feedUrl: feedUrl,
          read: false,
          score: this.calculateClickbaitScore(title),
          category: "기본",
        });
      }
    }

    return { feedInfo, items };
  }

  /**
   * 정규식으로 텍스트 추출
   */
  extractWithRegex(text, pattern) {
    // 줄바꿈이 포함된 텍스트도 처리할 수 있도록 s 플래그 추가
    let modifiedPattern = pattern;
    if (!pattern.flags.includes("s")) {
      modifiedPattern = new RegExp(pattern.source, pattern.flags + "s");
    }

    const match = text.match(modifiedPattern);
    if (!match || !match[1]) return null;

    let result = match[1].trim();
    if (!result) return null;

    // CDATA 섹션 제거
    result = result.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");

    return this.decodeHtmlEntities(result);
  }

  /**
   * HTML 엔티티 디코딩
   */
  decodeHtmlEntities(text) {
    const entities = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&apos;": "'",
    };

    return text.replace(/&[^;]+;/g, (match) => entities[match] || match);
  }

  /**
   * 아이템 고유 ID 생성
   */
  generateItemId(feedUrl, guid) {
    const combined = `${feedUrl}:${guid}`;
    return this.simpleHash(combined);
  }

  /**
   * 간단한 해시 함수
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return hash.toString(36);
  }

  /**
   * 텍스트 정리 (XSS 방지)
   */
  sanitizeText(text) {
    if (!text) return "";

    // Service Worker에서는 document 사용 불가
    if (typeof document === "undefined") {
      return this.stripHtmlTags(text);
    }

    // 브라우저에서는 DOM 사용
    const div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent || div.innerText || "";
  }

  /**
   * Service Worker용 HTML 태그 제거
   */
  stripHtmlTags(html) {
    if (!html) return "";

    // HTML 태그 제거
    let text = html.replace(/<[^>]*>/g, "");

    // HTML 엔티티 디코딩
    text = this.decodeHtmlEntities(text);

    // 연속 공백 정리
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }

  /**
   * HTML 콘텐츠 정리 (기본적인 태그만 허용)
   */
  sanitizeHtml(html) {
    if (!html) return "";

    // Service Worker에서는 간단한 텍스트만 반환
    if (typeof document === "undefined") {
      return this.stripHtmlTags(html);
    }

    const div = document.createElement("div");
    div.innerHTML = html;

    // 허용할 태그들
    const allowedTags = ["p", "br", "strong", "b", "em", "i", "a"];
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        return allowedTags.includes(node.tagName.toLowerCase())
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    // 위험한 속성 제거
    let node;
    while ((node = walker.nextNode())) {
      // href 이외의 속성 제거
      if (node.tagName.toLowerCase() === "a") {
        const href = node.getAttribute("href");
        node.removeAttribute("onclick");
        node.removeAttribute("onload");
        node.removeAttribute("onerror");
        if (href && this.isValidUrl(href)) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        } else {
          node.removeAttribute("href");
        }
      }
    }

    return div.innerHTML;
  }

  /**
   * URL 유효성 검사 및 정리
   */
  sanitizeUrl(url) {
    if (!url) return "";

    try {
      const urlObj = new URL(url.trim());
      // HTTP/HTTPS만 허용
      if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
        return urlObj.toString();
      }
      return "";
    } catch {
      return "";
    }
  }

  /**
   * URL 유효성 검사
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * RSS 카테고리 추출
   */
  extractCategory(item) {
    const category = item.querySelector("category");
    if (category) {
      return (
        category.textContent.trim() || category.getAttribute("domain") || "기본"
      );
    }
    return "기본";
  }

  /**
   * Atom 카테고리 추출
   */
  extractAtomCategory(entry) {
    const category = entry.querySelector("category");
    if (category) {
      return (
        category.getAttribute("term") ||
        category.getAttribute("label") ||
        "기본"
      );
    }
    return "기본";
  }

  /**
   * 낚시성 콘텐츠 점수 계산
   * 음수일수록 낚시성, 양수일수록 양질 콘텐츠
   */
  calculateClickbaitScore(title) {
    if (!title) return 0;

    let score = 0;
    const titleLower = title.toLowerCase();

    // 낚시성 키워드 감점
    const clickbaitWords = [
      "충격",
      "경악",
      "반전",
      "대박",
      "실화",
      "레전드",
      "개꿀",
      "완전",
      "진짜",
      "실제",
      "놀라운",
      "믿을 수 없는",
      "최고",
      "!!!",
      "?!",
      "감동",
      "눈물",
      "소름",
      "미쳤",
      "폭발",
    ];

    clickbaitWords.forEach((word) => {
      if (titleLower.includes(word)) {
        score -= 5;
      }
    });

    // 과도한 특수문자 감점
    const exclamationCount = (title.match(/!/g) || []).length;
    const questionCount = (title.match(/\?/g) || []).length;

    if (exclamationCount > 1) score -= exclamationCount * 2;
    if (questionCount > 1) score -= questionCount * 2;

    // 대문자 과용 감점
    const upperCaseCount = (title.match(/[A-Z]/g) || []).length;
    if (upperCaseCount > title.length * 0.3) {
      score -= 5;
    }

    // 숫자 강조 감점 (예: "10가지", "7개")
    if (/\d+가지|\d+개|\d+번/.test(titleLower)) {
      score -= 3;
    }

    // 긍정적 키워드 가점
    const positiveWords = [
      "분석",
      "리뷰",
      "정리",
      "요약",
      "해설",
      "가이드",
      "튜토리얼",
      "연구",
      "보고서",
      "발표",
      "공식",
      "업데이트",
    ];

    positiveWords.forEach((word) => {
      if (titleLower.includes(word)) {
        score += 3;
      }
    });

    return Math.max(-20, Math.min(20, score)); // -20 ~ 20 범위로 제한
  }

  /**
   * 피드 URL 유효성 검사
   */
  async validateFeedUrl(url) {
    try {
      // URL 형식 확인
      new URL(url);

      // RSS/Atom 관련 확장자나 패턴 확인
      const feedPatterns = [
        /\.rss$/i,
        /\.xml$/i,
        /\.atom$/i,
        /\/rss/i,
        /\/feed/i,
        /\/atom/i,
        /rss/i,
        /feed/i,
        /atom/i,
      ];

      const hasValidPattern = feedPatterns.some((pattern) => pattern.test(url));

      return {
        isValid: true,
        hasValidPattern,
        warnings: hasValidPattern
          ? []
          : ["URL에 RSS/Atom 패턴이 없습니다. 정말 피드 URL인지 확인해주세요."],
      };
    } catch (error) {
      return {
        isValid: false,
        hasValidPattern: false,
        warnings: ["유효하지 않은 URL 형식입니다."],
      };
    }
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = RSSParser;
} else if (typeof window !== "undefined") {
  window.RSSParser = RSSParser;
} else {
  // Service Worker environment
  globalThis.RSSParser = RSSParser;
}
