# RSS Reader Chrome Extension 개발 실행 계획

## 📋 개요

이 문서는 Chrome Extension RSS Reader 개발을 위한 구체적인 실행 계획과 단계별 작업 방법을 정리합니다.

## 🎯 개발 목표

- Chrome Extension Manifest V3 기반 RSS 리더 구현
- Playwright를 이용한 E2E 테스트 자동화
- 순수 JavaScript + DOMParser를 이용한 RSS/Atom 파싱
- 테스트 친화적 구조 설계

## 🛠️ 기술 스택

- **플랫폼**: Chrome Extension Manifest V3
- **언어**: JavaScript (ES6+)
- **RSS 파싱**: 순수 JavaScript + DOMParser
- **테스트**: Playwright
- **저장소**: Chrome Storage API (sync/local)
- **백그라운드**: Service Worker

## 📋 전체 실행 계획

### Phase 1: 기본 구조 설정 (1-2일)

#### 1.1 사용자 수동 작업
```bash
# Chrome Extension 고정 ID를 위한 키 생성
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -pubout -outform DER | base64 -w 0
```
- 생성된 base64 문자열 보관 (manifest.json에 사용)

#### 1.2 AI 자동화 작업
- [ ] `manifest.json` 작성 (고정 키 포함)
- [ ] 기본 프로젝트 구조 생성
- [ ] `package.json` 설정 및 Playwright 의존성 추가
- [ ] 기본 HTML/CSS 파일 생성

**출력물**:
```
├── manifest.json
├── background.js (기본 구조)
├── popup.html/js/css
├── options.html/js/css
├── package.json
└── tests/ (기본 구조)
```

### Phase 2: 핵심 기능 구현 (3-4일)

#### 2.1 RSS 파싱 엔진 구현
- [ ] RSS 2.0 파서 구현
- [ ] Atom 1.0 파서 구현
- [ ] 통합 파싱 함수 구현
- [ ] 에러 핸들링 및 유효성 검사

```javascript
// 구현할 핵심 함수들
function parseRSSFeed(xmlText) { /* RSS/Atom 통합 파싱 */ }
function validateFeedURL(url) { /* URL 유효성 검사 */ }
function sanitizeContent(content) { /* XSS 방지 */ }
```

#### 2.2 백그라운드 서비스 구현
- [ ] Service Worker 기본 구조
- [ ] 피드 동기화 로직
- [ ] Chrome Alarms API 연동 (15분 주기)
- [ ] 테스트 모드 지원

#### 2.3 저장소 관리 구현
```javascript
// 저장소 구조 설계
chrome.storage.sync: {
  feeds: [{ url, title, category }],
  settings: { updateInterval: 15 }
}

chrome.storage.local: {
  feedItems: [{ id, title, url, read, feedUrl, pubDate, score }],
  lastUpdate: timestamp,
  testMode: boolean
}
```

### Phase 3: UI 구현 (2-3일)

#### 3.1 Popup UI 구현
- [ ] 피드 아이템 목록 표시
- [ ] 검색 및 필터링 기능
- [ ] 읽음/안읽음 상태 관리
- [ ] 정렬 기능 (날짜, 점수별)

#### 3.2 Options 페이지 구현
- [ ] 피드 추가/삭제 기능
- [ ] 카테고리 관리
- [ ] OPML Import/Export
- [ ] 설정 관리

#### 3.3 리더 뷰 구현
- [ ] 모달 기반 리더 뷰
- [ ] Readability.js 연동 (선택적)
- [ ] 테스트 모드에서 Mock 콘텐츠 지원

### Phase 4: 테스트 구현 (2-3일)

#### 4.1 테스트 친화적 구조 추가
- [ ] Service Worker 테스트 헬퍼 메시지 핸들러
- [ ] 테스트 모드 감지 및 Mock 데이터 지원
- [ ] 저장소 초기화 API

#### 4.2 Playwright 테스트 작성
- [ ] Extension ID 동적 탐지 헬퍼
- [ ] Service Worker 활성화 헬퍼
- [ ] 네트워크 요청 Mock 설정
- [ ] 테스트 시나리오 구현 (11개 시나리오)

#### 4.3 테스트 자동화 검증
- [ ] 전체 테스트 스위트 실행
- [ ] CI/CD 파이프라인 준비 (선택적)

### Phase 5: 고급 기능 및 최적화 (2-3일)

#### 5.1 낚시성 콘텐츠 감지
- [ ] 키워드 기반 점수 계산
- [ ] 제목 분석 알고리즘
- [ ] 점수별 정렬 및 필터링

#### 5.2 성능 최적화
- [ ] 피드 캐싱 최적화
- [ ] 메모리 사용량 최적화
- [ ] 배치 처리 구현

#### 5.3 기본 피드 설정
- [ ] 유명 RSS 피드 목록 수집
- [ ] 설치 시 기본 피드 자동 추가

## 🔄 개발 워크플로우

### 일반적인 개발 사이클

1. **AI가 코드 구현**
   ```bash
   # AI가 자동 실행
   npm run lint
   npm run typecheck  # (TypeScript 사용시)
   ```

2. **사용자가 확장 리로드**
   ```
   chrome://extensions/ → 새로고침 버튼 클릭
   ```

3. **AI가 테스트 실행 및 수정**
   ```bash
   # AI가 자동 실행
   npx playwright test
   # 실패시 자동 분석 및 수정 반복
   ```

### 문제 해결 전략

#### Chrome Extension ID 문제
- **1차**: manifest.json에 고정 키 사용
- **2차**: 동적 ID 탐지 헬퍼 함수 사용
- **3차**: 테스트에서 확장 관리 페이지 파싱

#### Service Worker 생명주기 문제
- **방법**: 테스트 시작 전 ping 메시지로 활성화 확인
- **대안**: 확장 페이지 방문으로 강제 활성화

#### 네트워크 요청 불안정성
- **해결**: Playwright route.fulfill()로 RSS 응답 Mock
- **장점**: 테스트 속도 향상 및 안정성 보장

## 🧪 테스트 시나리오 매핑

| 기능 | 테스트 파일 | 예상 소요 시간 |
|------|-------------|----------------|
| 피드 추가/삭제 | options.spec.js | 30분 |
| OPML Import/Export | opml.spec.js | 45분 |
| 팝업 피드 표시 | popup.spec.js | 60분 |
| 리더 뷰 | reader.spec.js | 45분 |
| 검색/필터링 | search.spec.js | 60분 |

## 📝 주요 파일별 역할

### 핵심 파일들
```
├── manifest.json          # 확장 설정, 권한, 고정 키
├── background.js           # Service Worker, RSS 동기화
├── popup.js               # 팝업 UI 로직
├── options.js             # 설정 페이지 로직
├── lib/
│   ├── rss-parser.js      # RSS/Atom 파싱 엔진
│   ├── storage-helper.js  # 저장소 관리 유틸리티
│   └── clickbait-detector.js # 낚시성 콘텐츠 감지
└── tests/
    ├── helpers/           # 테스트 헬퍼 함수들
    └── *.spec.js         # 테스트 시나리오들
```

### 설정 파일들
```
├── package.json           # 의존성 및 스크립트
├── playwright.config.js   # Playwright 설정
└── .gitignore            # Git 제외 파일
```

## ⚠️ 주의사항

### 보안 고려사항
- XSS 방지를 위한 콘텐츠 sanitization
- CSP (Content Security Policy) 준수
- 외부 스크립트 실행 금지

### 성능 고려사항
- Service Worker 메모리 사용량 최소화
- 대량 피드 처리 시 배치 작업
- 캐시 무효화 전략

### 호환성 고려사항
- Chrome 최신 버전 지원
- Manifest V3 완전 준수
- 다양한 RSS/Atom 형식 지원

## 🚀 배포 준비

### 개발 완료 체크리스트
- [ ] 모든 Playwright 테스트 통과
- [ ] 수동 테스트 완료
- [ ] 보안 검토 완료
- [ ] 성능 최적화 완료
- [ ] 문서화 완료

### Chrome Web Store 준비 (선택적)
- [ ] 스크린샷 및 아이콘 준비
- [ ] 개인정보 처리방침 작성
- [ ] 스토어 설명 작성

## 📞 연락 및 이슈

개발 중 문제 발생 시:
1. Playwright 테스트 에러 → AI가 자동 분석 및 수정
2. Chrome Extension 로드 오류 → 사용자가 수동 확인 필요
3. RSS 파싱 오류 → AI가 피드 형식 분석 및 파서 수정

---

**최종 업데이트**: 2024-10-06  
**예상 총 개발 기간**: 10-15일  
**핵심 기술**: Chrome Extension V3 + Playwright + Pure JS