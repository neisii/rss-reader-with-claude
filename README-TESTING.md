# RSS Reader Chrome Extension - Testing Guide

## 🎯 개요

이 문서는 RSS Reader Chrome Extension을 위해 구현된 Playwright 기반 E2E 테스트 자동화 시스템의 사용 방법을 안내합니다.

## 📊 구현 완료 현황

### ✅ **테스트 자동화 구현 완료!**

- **총 테스트 수**: 20개
- **커버리지**: 모든 핵심 기능 (TC-01 ~ TC-11 + 추가 테스트)
- **테스트 파일**: 3개 (options, popup, service-worker)
- **실행 환경**: Chrome Extension Manifest V3 호환

## 🧪 테스트 목록

### Options 페이지 테스트 (7개)
1. **TC-01**: 새 피드 추가 성공
2. **TC-02**: 중복 피드 추가 방지
3. **TC-03**: 피드 삭제 성공
4. **TC-04**: OPML 파일 가져오기
5. **TC-05**: OPML 파일 내보내기
6. **TC-05b**: 잘못된 피드 URL 처리
7. **TC-05c**: 네트워크 오류 처리

### Popup 페이지 테스트 (7개)
8. **TC-06**: 팝업 피드 로딩 확인
9. **TC-07**: 기사 읽음 상태 처리
10. **TC-08**: 리더 뷰 모달 기능
11. **TC-09**: 검색 기능
12. **TC-10**: 정렬 기능
13. **TC-11**: 읽지 않은 글 필터
14. **TC-11b**: 설정 버튼 네비게이션

### Service Worker 테스트 (6개)
15. **SW-01**: Service Worker 활성화 및 라이프사이클
16. **SW-02**: Service Worker 중단 처리
17. **SW-03**: 백그라운드 동기화 및 알람
18. **SW-04**: 확장 프로그램 저장소 및 데이터 지속성
19. **SW-05**: 확장 프로그램 권한 및 보안
20. **SW-06**: 오류 처리 및 복원력

## 🚀 빠른 시작

### 1. 테스트 실행
```bash
# 전체 테스트 실행
npm test

# UI 모드로 실행 (디버깅용)
npm run test:ui

# 헤드풀 모드로 실행
npm run test:headed

# 특정 테스트 파일만 실행
npx playwright test tests/options.spec.js
npx playwright test tests/popup.spec.js
npx playwright test tests/service-worker.spec.js
```

### 2. 테스트 결과 확인
```bash
# HTML 리포트 보기
npm run test:report

# 디버그 모드로 실행
npm run test:debug
```

### 3. 브라우저 설치 (처음만)
```bash
npm run test:install
```

## 🔧 테스트 설정

### 주요 설정 파일
- `playwright.config.js`: Playwright 메인 설정
- `package.json`: 스크립트 및 의존성
- `tests/helpers/extension-helper.js`: 확장 프로그램 전용 헬퍼

### 테스트 환경 특징
- **Headful 모드**: 확장 프로그램 테스트를 위해 필수
- **단일 워커**: 확장 프로그램 간섭 방지
- **Mock RSS 피드**: 안정적인 테스트를 위한 가짜 데이터
- **자동 스크린샷**: 실패 시 자동 캡처

## 📁 파일 구조

```
/
├── package.json                 # 의존성 및 스크립트
├── playwright.config.js         # Playwright 설정
├── tests/
│   ├── helpers/
│   │   └── extension-helper.js  # 확장 프로그램 헬퍼 유틸리티
│   ├── options.spec.js          # Options 페이지 테스트
│   ├── popup.spec.js            # Popup 페이지 테스트
│   └── service-worker.spec.js   # Service Worker 테스트
├── test-results/                # 테스트 결과 (자동 생성)
└── playwright-report/           # HTML 리포트 (자동 생성)
```

## 🛠️ 고급 사용법

### 특정 테스트만 실행
```bash
# 패턴으로 필터링
npx playwright test --grep "TC-01"
npx playwright test --grep "Service Worker"

# 태그로 필터링 (향후 구현)
npx playwright test --grep "@smoke"
```

### 병렬 실행 (주의: 확장 프로그램 특성상 권장하지 않음)
```bash
# 워커 수 지정 (기본값: 1)
npx playwright test --workers=1
```

### 디버깅
```bash
# 특정 테스트 디버깅
npx playwright test tests/options.spec.js --debug

# 브라우저를 열어둔 채로 실행
npx playwright test --headed --timeout=0
```

### 환경 변수
```bash
# CI 환경에서 실행
CI=true npm test

# 디버그 모드 활성화
DEBUG=true npm run test:headed
```

## 🧩 헬퍼 유틸리티 사용법

### ExtensionHelper 클래스
```javascript
import { ExtensionHelper, MOCK_RSS_FEEDS } from './helpers/extension-helper.js';

const extensionHelper = new ExtensionHelper(page);

// 확장 프로그램 ID 획득
const id = await extensionHelper.getExtensionId();

// 페이지 네비게이션
await extensionHelper.goToOptionsPage();
await extensionHelper.goToPopupPage();

// 저장소 관리
await extensionHelper.clearStorage();

// 피드 관리
await extensionHelper.addTestFeed('https://example.com/feed.xml');
await extensionHelper.forceFeedSync();

// 상태 확인
const feedStatus = await extensionHelper.waitForFeedsToLoad();
const feedCount = await extensionHelper.getFeedCount();
```

### Mock 데이터 사용
```javascript
// 유효한 RSS 피드
MOCK_RSS_FEEDS.VALID_RSS.content

// CDATA가 포함된 피드
MOCK_RSS_FEEDS.CDATA_RSS.content

// Atom 피드
MOCK_RSS_FEEDS.ATOM_FEED.content

// 잘못된 피드
MOCK_RSS_FEEDS.INVALID_RSS.content
```

## 🔍 문제 해결

### 일반적인 문제들

#### 1. "Extension not found" 오류
```bash
# 확장 프로그램이 올바르게 로드되었는지 확인
chrome://extensions/

# Developer mode가 활성화되어 있는지 확인
# 확장 프로그램을 다시 로드
```

#### 2. Service Worker 관련 오류
```bash
# Service Worker 상태 확인
chrome://serviceworker-internals/

# 확장 프로그램 재시작
chrome://extensions/ → 새로고침 버튼
```

#### 3. 테스트 시간 초과
```javascript
// playwright.config.js에서 타임아웃 증가
timeout: 60000, // 60초
```

#### 4. Mock 데이터 문제
```javascript
// 네트워크 라우트가 올바르게 설정되었는지 확인
await page.route('**/test-feed.xml', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/rss+xml',
    body: MOCK_RSS_FEEDS.VALID_RSS.content
  });
});
```

### 로그 및 디버깅

#### 콘솔 로그 확인
```javascript
// 테스트에서 콘솔 로그 캡처
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
```

#### 네트워크 요청 모니터링
```javascript
// 네트워크 요청 로깅
page.on('request', request => console.log('REQUEST:', request.url()));
page.on('response', response => console.log('RESPONSE:', response.url(), response.status()));
```

## 📈 테스트 최적화

### 성능 향상 팁
1. **Mock 데이터 사용**: 실제 네트워크 요청 대신 Mock 사용
2. **적절한 대기 시간**: `waitForTimeout` 최소화, `waitForSelector` 활용
3. **병렬 실행 제한**: 확장 프로그램 특성상 단일 워커 유지
4. **선택적 테스트**: 개발 중에는 특정 테스트만 실행

### CI/CD 최적화
```yaml
# GitHub Actions 예시
- name: Run tests
  run: npm test
  env:
    CI: true
```

## 🔮 향후 개선 계획

### 추가 예정 기능
- [ ] **시각적 회귀 테스트**: 스크린샷 비교
- [ ] **성능 테스트**: 로딩 시간, 메모리 사용량
- [ ] **접근성 테스트**: a11y 검증
- [ ] **크로스 브라우저 테스트**: Firefox, Edge 지원

### 고급 기능
- [ ] **커스텀 리포터**: 더 상세한 테스트 리포트
- [ ] **테스트 데이터 팩토리**: 동적 테스트 데이터 생성
- [ ] **API 모킹**: Service Worker API 완전 모킹
- [ ] **테스트 태그**: @smoke, @regression 등

## 📚 참고 자료

### 공식 문서
- [Playwright 공식 문서](https://playwright.dev/docs/intro)
- [Chrome Extensions 테스트 가이드](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- [Manifest V3 문서](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

### 프로젝트 문서
- `docs/testing-automation-analysis.md`: 테스트 자동화 분석
- `docs/testing-implementation-guide.md`: 상세 구현 가이드
- `docs/github-actions-template.md`: CI/CD 템플릿
- `docs/test-scenarios.md`: 원본 테스트 시나리오

---

## 🎉 결론

RSS Reader Chrome Extension의 완전한 E2E 테스트 자동화가 성공적으로 구현되었습니다!

### 주요 성과
- ✅ **20개 테스트** 모든 핵심 기능 커버
- ✅ **Manifest V3 호환** Service Worker 테스트 포함
- ✅ **현실적인 시나리오** 실제 사용자 워크플로우 재현
- ✅ **안정적인 실행** Mock 데이터로 신뢰성 확보

이제 확신을 가지고 개발하고, 자동화된 테스트를 통해 품질을 보장할 수 있습니다! 🚀