/**
 * Puppeteer Extension Helper
 * Chrome Extension 테스트를 위한 Puppeteer 헬퍼 클래스
 */

import puppeteer from "puppeteer-core";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PuppeteerExtensionHelper {
  constructor() {
    this.browser = null;
    this.extensionId = null;
    this.page = null;
    this.extensionPath = path.resolve(__dirname, "../..");
  }

  /**
   * manifest.json의 key로 Extension ID 계산
   */
  calculateExtensionId() {
    const manifestPath = path.join(this.extensionPath, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    if (!manifest.key) {
      throw new Error("manifest.json에 key 필드가 없습니다");
    }

    // Base64 public key를 SHA256으로 해시
    const publicKeyDer = Buffer.from(manifest.key, "base64");
    const hash = crypto.createHash("sha256").update(publicKeyDer).digest();

    // 처음 16바이트를 사용하여 a-p 문자로 변환
    let extensionId = "";
    for (let i = 0; i < 16; i++) {
      extensionId += String.fromCharCode(97 + (hash[i] % 16)); // a-p
    }

    console.log(`📝 Calculated Extension ID: ${extensionId}`);
    return extensionId;
  }

  /**
   * Chrome 브라우저 및 Extension 시작
   */
  async launch(options = {}) {
    console.log(`📂 Extension path: ${this.extensionPath}`);

    // CI 환경 감지
    const isCI = process.env.CI === "true";
    const executablePath = isCI
      ? "/usr/bin/google-chrome" // Linux CI
      : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; // macOS

    console.log(`🌍 Environment: ${isCI ? "CI (Linux)" : "Local (macOS)"}`);
    console.log(`🔧 Chrome path: ${executablePath}`);

    this.browser = await puppeteer.launch({
      executablePath,
      headless: false, // Extension은 headless에서 안 됨!
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        ...(isCI
          ? [
              "--disable-gpu",
              "--disable-software-rasterizer",
              "--use-gl=swiftshader",
            ]
          : []),
        ...(options.args || []),
      ],
      defaultViewport: null,
      ...options,
    });

    console.log("✅ Browser launched");

    // Extension ID 계산
    this.extensionId = this.calculateExtensionId();

    // Extension 로딩 대기
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extension이 실제로 로드되었는지 확인
    await this.verifyExtensionLoaded();

    return this.browser;
  }

  /**
   * Extension이 로드되었는지 확인
   */
  async verifyExtensionLoaded() {
    console.log("🔍 Verifying extension is loaded...");

    try {
      const testPage = await this.browser.newPage();
      const manifestUrl = `chrome-extension://${this.extensionId}/manifest.json`;

      const response = await testPage.goto(manifestUrl, {
        waitUntil: "networkidle0",
        timeout: 5000,
      });

      if (response && response.ok()) {
        console.log("✅ Extension loaded successfully");
        await testPage.close();
        return true;
      }
    } catch (error) {
      console.error(`❌ Extension not loaded: ${error.message}`);
      throw new Error(`Extension failed to load. ID: ${this.extensionId}`);
    }
  }

  /**
   * Popup 페이지 열기
   */
  async openPopup() {
    if (!this.extensionId) {
      throw new Error("Extension ID not found. Call launch() first.");
    }

    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    this.page = await this.browser.newPage();
    await this.page.goto(popupUrl, { waitUntil: "networkidle0" });

    console.log(`✅ Opened popup: ${popupUrl}`);
    return this.page;
  }

  /**
   * Options 페이지 열기
   */
  async openOptions() {
    if (!this.extensionId) {
      throw new Error("Extension ID not found. Call launch() first.");
    }

    const optionsUrl = `chrome-extension://${this.extensionId}/options.html`;
    this.page = await this.browser.newPage();
    await this.page.goto(optionsUrl, { waitUntil: "networkidle0" });

    console.log(`✅ Opened options: ${optionsUrl}`);
    return this.page;
  }

  /**
   * Service Worker와 통신
   */
  async sendMessageToServiceWorker(message) {
    if (!this.page) {
      await this.openPopup();
    }

    return await this.page.evaluate((msg) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (response) => {
          resolve(response);
        });
      });
    }, message);
  }

  /**
   * Storage 데이터 가져오기
   */
  async getStorage(keys = null) {
    if (!this.page) {
      await this.openPopup();
    }

    return await this.page.evaluate((storageKeys) => {
      return new Promise((resolve) => {
        chrome.storage.local.get(storageKeys, (result) => {
          resolve(result);
        });
      });
    }, keys);
  }

  /**
   * Storage 데이터 설정
   */
  async setStorage(data) {
    if (!this.page) {
      await this.openPopup();
    }

    return await this.page.evaluate((storageData) => {
      return new Promise((resolve) => {
        chrome.storage.local.set(storageData, () => {
          resolve();
        });
      });
    }, data);
  }

  /**
   * Storage 초기화
   */
  async clearStorage() {
    if (!this.page) {
      await this.openPopup();
    }

    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          chrome.storage.sync.clear(() => {
            resolve();
          });
        });
      });
    });
  }

  /**
   * 브라우저 종료
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.extensionId = null;
    }
  }

  /**
   * 스크린샷 저장
   */
  async screenshot(filename) {
    if (!this.page) {
      throw new Error("No page open");
    }

    const screenshotPath = path.resolve(__dirname, "../test-results", filename);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * 페이지 대기
   */
  async waitForSelector(selector, options = {}) {
    if (!this.page) {
      throw new Error("No page open");
    }

    return await this.page.waitForSelector(selector, {
      timeout: 5000,
      ...options,
    });
  }

  /**
   * 클릭
   */
  async click(selector) {
    if (!this.page) {
      throw new Error("No page open");
    }

    await this.page.click(selector);
  }

  /**
   * 텍스트 입력
   */
  async type(selector, text) {
    if (!this.page) {
      throw new Error("No page open");
    }

    await this.page.type(selector, text);
  }

  /**
   * 텍스트 가져오기
   */
  async getText(selector) {
    if (!this.page) {
      throw new Error("No page open");
    }

    return await this.page.$eval(selector, (el) => el.textContent);
  }

  /**
   * 요소 개수 세기
   */
  async count(selector) {
    if (!this.page) {
      throw new Error("No page open");
    }

    return await this.page.$$eval(selector, (els) => els.length);
  }
}
