# Playwright 환경 구성 및 테스트 실행 가이드 (macOS)

이 문서는 macOS 환경에서 Playwright를 설정하고, 이 프로젝트의 E2E(End-to-End) 테스트를 실행하는 방법을 안내합니다.

## 1. 사전 준비

-   **Node.js 및 npm**이 설치되어 있어야 합니다. Homebrew를 사용하여 쉽게 설치할 수 있습니다.
    ```bash
    brew install node
    ```

## 2. Playwright 설치

프로젝트의 루트 디렉토리에서 다음 명령어를 실행하여 Playwright를 설치합니다.

1.  **package.json 생성 (없는 경우)**

    ```bash
    npm init -y
    ```

2.  **Playwright 라이브러리 설치**

    ```bash
    npm install --save-dev @playwright/test
    ```

3.  **Playwright용 브라우저 설치**

    Playwright는 테스트를 위해 자체 브라우저(Chromium, Firefox, WebKit)를 사용합니다. 다음 명령어로 설치합니다.

    ```bash
    npx playwright install
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

## 참고: 테스트 스크립트 작동 방식

작성된 `tests/e2e.spec.js` 스크립트는 Chrome 확장 프로그램을 테스트하기 위해 다음과 같은 특별한 로직을 포함합니다.

-   **확장 프로그램 ID 확보**: 테스트 시작 전에 Electron을 일시적으로 실행하여 로드된 확장 프로그램의 동적 ID를 가져옵니다. 이는 `chrome-extension://{id}/`와 같은 URL에 접근하기 위해 필수적입니다.
-   **브라우저 컨텍스트 설정**: 각 테스트마다 `--load-extension` 인자와 함께 새로운 브라우저 컨텍스트를 생성하여 항상 깨끗한 환경에서 테스트를 시작합니다.
-   **페이지 제어**: `options.html`과 `popup.html`에 직접 접근하여 UI 요소를 조작하고, `expect` 함수를 통해 결과를 검증합니다.