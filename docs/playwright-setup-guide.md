# Playwright 환경 구성 및 테스트 실행 가이드 (2025 Updated)

이 문서는 Chrome Extension을 위한 Playwright 기반 E2E 테스트 환경을 설정하고 실행하는 방법을 안내합니다.

> **🔄 업데이트**: 2025년 최신 버전으로 업데이트됨. 현재 프로젝트 구현과 100% 호환되는 테스트 시나리오 포함.

## 1. 사전 준비

-   **Node.js 및 npm**이 설치되어 있어야 합니다. Homebrew를 사용하여 쉽게 설치할 수 있습니다.
    ```bash
    brew install node
    ```

## 2. 빠른 설정 (현재 프로젝트 기준)

현재 RSS Reader Extension 프로젝트에 Playwright를 설정합니다.

### 2.1 의존성 설치

```bash
# 프로젝트 루트에서 실행
npm init -y
npm install --save-dev @playwright/test
npx playwright install chromium
```

### 2.2 설정 파일 생성

```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1, // Extension 테스트는 단일 워커 사용
  reporter: 'html',
  
  use: {
    headless: false, // Extension은 headful 모드 필수
    launchOptions: {
      args: [
        `--disable-extensions-except=${path.resolve(__dirname)}`,
        `--load-extension=${path.resolve(__dirname)}`,
        '--no-sandbox'
      ]
    }
  },
});
```

### 2.3 package.json 스크립트 추가

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug"
  }
}
```

## 3. 테스트 실행

모든 설정이 완료되면 다음 명령어를 사용하여 테스트를 실행할 수 있습니다.

### 전체 테스트 실행

```bash
npx playwright test
```

이 명령어는 `tests` 폴더 내의 `*.spec.js` 파일들을 찾아 모든 테스트를 실행합니다.

### 특정 테스트 파일 실행

```bash
npx playwright test tests/e2e.spec.js
```

### UI 모드로 실행 (디버깅에 유용)

Playwright UI 모드를 사용하면 각 테스트 단계를 시각적으로 확인하고 디버깅할 수 있습니다.

```bash
npx playwright test --ui
```

## 4. 테스트 결과 확인

테스트 실행 후, 다음 명령어를 사용하여 상세한 HTML 리포트를 확인할 수 있습니다.

```bash
npx playwright show-report
```

브라우저에 테스트 결과, 각 단계의 스크린샷, 비디오 녹화 등 상세한 정보가 표시됩니다.

## 5. 현재 프로젝트와의 호환성

### 5.1 구현된 기능들과 테스트 시나리오 매핑

현재 RSS Reader Extension의 모든 기능이 구현되어 있어 즉시 테스트 가능합니다:

| 기능 | 구현 상태 | 테스트 파일 |
|------|----------|-------------|
| 피드 추가/삭제 | ✅ 완료 | `tests/options.spec.js` |
| OPML Import/Export | ✅ 완료 | `tests/options.spec.js` |
| 팝업 피드 표시 | ✅ 완료 | `tests/popup.spec.js` |
| 리더 뷰 모달 | ✅ 완료 | `tests/popup.spec.js` |
| 검색/필터링 | ✅ 완료 | `tests/popup.spec.js` |
| Service Worker | ✅ 완료 | `tests/service-worker.spec.js` |

### 5.2 주요 기술적 특징

- **Manifest V3 호환**: Service Worker 기반 백그라운드 처리
- **CDATA 파싱**: BBC, CNN 등 주요 피드 지원
- **이중 파싱 시스템**: DOMParser + Regex 환경별 최적화
- **CSP 준수**: 보안 강화된 구조

### 5.3 테스트 스크립트 작동 방식

Chrome Extension 테스트를 위한 특별한 설정:

- **확장 프로그램 ID 동적 획득**: `chrome://extensions` 페이지에서 자동 감지
- **Service Worker 상태 모니터링**: `chrome://serviceworker-internals` 활용
- **Mock RSS 응답**: 안정적인 테스트를 위한 가짜 피드 데이터
- **Extension Context**: `chrome-extension://` URL 직접 접근

### 5.4 즉시 실행 가능한 테스트들

```bash
# 전체 테스트 실행
npm test

# UI 모드로 디버깅
npm run test:ui

# 특정 테스트만 실행
npx playwright test tests/options.spec.js
```