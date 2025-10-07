# macOS Chrome Extension 테스트 보안 차단 해결 가이드

## 🚨 문제 현상
- `chrome://` 페이지 접근 시 "Target page, context or browser has been closed" 오류
- 브라우저가 예기치 않게 종료됨
- Chrome Extension 테스트 시 보안 정책으로 인한 차단

## 🔍 원인 분석
1. **macOS 보안 정책**: 자동화 도구의 Chrome 제어 차단
2. **Chrome 자동화 감지**: `navigator.webdriver` 감지 및 차단
3. **macOS 방화벽**: 네트워크 연결 승인 요청
4. **Chrome 보안 기능**: `HttpsFirstBalancedModeAutoEnable` 등

## 🛠️ 해결책

### 1. macOS 시스템 설정 변경

#### **macOS Sonoma/Ventura (14/13) 사용자**
```bash
# 1. Apple 메뉴 > 시스템 설정
# 2. 좌측 사이드바에서 "개인정보 보호 및 보안" 선택
# 3. "자동화" 클릭
# 4. Chrome 또는 Chromium 찾아서 "다른 앱 제어" 허용
```

#### **macOS Monterey (12) 이하 사용자**
```bash
# 1. Apple 메뉴 > 시스템 환경설정
# 2. "보안 및 개인정보 보호" 클릭
# 3. "자동화" 탭 선택
# 4. Chrome에 대한 권한 허용
```

### 2. Chrome 코드 서명 추가

```bash
# 시스템 Chrome에 코드 서명
sudo codesign --force --deep --sign - /Applications/Google\ Chrome.app

# Playwright Chromium에 코드 서명
sudo codesign --force --deep --sign - ./node_modules/playwright/.local-chromium/*/chrome-mac*/Chromium.app

# 권한 확인
ls -la /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

### 3. macOS 방화벽 설정

```bash
# 방화벽 설정에서 Chrome 허용
# 시스템 설정 > 네트워크 > 방화벽 > 옵션
# Chrome.app을 "들어오는 연결 허용"으로 설정
```

### 4. Playwright 설정 강화 (이미 적용됨)

현재 `playwright.config.js`에 다음 보안 우회 플래그들이 추가되었습니다:

```javascript
// macOS specific security bypass flags
'--disable-web-security',
'--disable-features=VizDisplayCompositor',
'--disable-features=HttpsFirstBalancedModeAutoEnable',
'--disable-blink-features=AutomationControlled',
'--disable-notifications',
'--disable-gpu',
'--disable-ipc-flooding-protection',
'--allow-running-insecure-content',
'--disable-component-extensions-with-background-pages',

// Chrome automation detection bypass
'--test-type',
'--no-default-browser-check',
'--no-first-run',
'--disable-default-apps',
'--disable-popup-blocking',
'--disable-translate',
'--disable-background-networking'
```

### 5. 대안적 접근 방법

#### **시스템 Chrome 사용**
```bash
# 환경 변수로 시스템 Chrome 경로 지정
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 또는 playwright.config.js에서 직접 지정
executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

#### **터미널에서 실행**
```bash
# 터미널에서 직접 실행하면 권한 프롬프트가 올바르게 나타남
cd /Users/neisii/Development/chrome-extension-rss
sudo npm test
```

## 🧪 테스트 검증

새로운 보안 수정 테스트를 만들었습니다:

```bash
# 보안 수정사항 테스트
npx playwright test tests/macos-security-test.spec.js
```

### 테스트 내용:
1. `chrome://version` 페이지 접근
2. `chrome://extensions` 페이지 접근
3. Developer Mode 토글 테스트
4. Extension 목록 확인
5. 자동화 감지 우회 확인

## 🔧 추가 문제해결

### Chrome이 계속 종료되는 경우:
```bash
# Chrome 프로세스 완전 종료
pkill -f Chrome

# 캐시 및 설정 초기화
rm -rf ~/Library/Application\ Support/Google/Chrome/Default
rm -rf ~/Library/Caches/Google/Chrome

# 다시 시도
npm test
```

### SIP (System Integrity Protection) 문제:
```bash
# SIP 상태 확인
csrutil status

# 만약 SIP가 문제가 된다면 (권장하지 않음):
# 복구 모드로 부팅 후 csrutil disable
# 테스트 완료 후 다시 csrutil enable
```

### Rosetta 2 사용자 (Apple Silicon):
```bash
# x86_64 아키텍처로 강제 실행
arch -x86_64 npm test

# 또는 Rosetta 2로 터미널 실행 후 테스트
```

## 📋 검증 체크리스트

- [ ] macOS 시스템 설정에서 Chrome 자동화 권한 허용
- [ ] Chrome에 코드 서명 적용
- [ ] 방화벽에서 Chrome 허용
- [ ] Playwright 설정에 보안 우회 플래그 추가
- [ ] 테스트 실행하여 `chrome://` 페이지 접근 확인

## ⚠️ 주의사항

1. **보안 설정 변경**: 위 설정들은 테스트 목적으로만 사용하세요
2. **시스템 보안**: 테스트 완료 후 필요에 따라 보안 설정을 원래대로 되돌리세요
3. **코드 서명**: `sudo` 권한이 필요하므로 신중하게 실행하세요

## 🎯 예상 결과

위 해결책들을 적용하면:
- ✅ `chrome://extensions` 페이지 정상 접근
- ✅ Extension ID 자동 감지
- ✅ Extension 파일 직접 접근 가능
- ✅ 전체 테스트 스위트 실행 가능

이제 다음 명령어로 보안 수정사항을 테스트해보세요:

```bash
npx playwright test tests/macos-security-test.spec.js --headed
```