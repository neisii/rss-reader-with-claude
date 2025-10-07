/**
 * Jest Configuration for Chrome Extension Testing with Puppeteer
 */

export default {
  // 테스트 환경
  testEnvironment: "node",

  // 테스트 파일 패턴
  testMatch: ["**/tests/**/*.test.js", "**/tests/**/*.spec.js"],

  // 테스트 타임아웃 (Extension 로딩 고려)
  testTimeout: 30000,

  // Coverage 설정
  collectCoverageFrom: [
    "lib/**/*.js",
    "background.js",
    "popup.js",
    "options.js",
    "!**/node_modules/**",
    "!**/tests/**",
  ],

  // 모듈 경로
  moduleFileExtensions: ["js", "json"],

  // Transform 설정 (ESM 지원)
  transform: {},

  // 테스트 결과 리포터
  reporters: ["default"],

  // 테스트 설정
  verbose: true,
  bail: false,
  maxWorkers: 1, // Extension 테스트는 병렬 실행 불가
};
