# Claude Code Context - RSS Reader Chrome Extension

## 🎯 프로젝트 개요

**프로젝트명**: 나만의 RSS 리더 (Chrome Extension)
**목표**: 광고와 추천 알고리즘 없이, 구독한 소스만 깔끔하게 모아보는 개인 맞춤형 RSS 리더

## 💬 커뮤니케이션 스타일

- **언어**: 한국어 반말로 대화 (사용자와 AI 모두 항상 반말 사용)
- **톤**: 간결하고 직접적, 친근한 분위기
- **응답**: 4줄 이내로 간단명료하게 (코드 작성 제외)
- **규칙**: "너"와 "나"로 서로를 지칭하며 편하게 대화

## 🛠️ 기술 스택 및 아키텍처

### 핵심 기술
- **플랫폼**: Chrome Extension Manifest V3
- **언어**: JavaScript (ES6+), 순수 JS (라이브러리 최소화)
- **RSS 파싱**: DOMParser (외부 라이브러리 사용 안 함)
- **테스트**: Playwright E2E 테스트 자동화
- **저장소**: Chrome Storage API (sync/local)
- **백그라운드**: Service Worker

### 아키텍처 원칙
- **테스트 친화적 설계**: Playwright 자동화를 고려한 구조
- **확장성**: 추후 TypeScript, React 도입 가능하게 설계
- **보안**: XSS 방지, CSP 준수
- **성능**: Service Worker 메모리 최소화

## 📁 프로젝트 구조

```
chrome-extension-rss/
├── manifest.json              # 확장 설정, 권한, 고정 키 포함
├── background.js              # Service Worker, RSS 동기화
├── popup.html/js/css          # 툴바 팝업 UI
├── options.html/js/css        # 피드 관리 설정 페이지
├── lib/
│   ├── rss-parser.js         # RSS/Atom 통합 파싱 엔진
│   ├── storage-helper.js     # Chrome Storage 관리
│   └── clickbait-detector.js # 낚시성 콘텐츠 감지
├── tests/
│   ├── helpers/              # 테스트 헬퍼 함수들
│   ├── fixtures/             # Mock 데이터
│   └── *.spec.js            # Playwright E2E 테스트
├── docs/
│   ├── development-plan.md   # 상세 개발 계획
│   ├── test-scenarios.md     # 테스트 시나리오 (11개)
│   ├── playwright-setup-guide.md
│   └── automated-workflow.md
└── package.json              # Playwright 의존성
```

## 🔧 개발 환경 및 워크플로우

### 개발 명령어
```bash
# 테스트 실행
npx playwright test

# 테스트 UI 모드
npx playwright test --ui

# 린트 (설정된 경우)
npm run lint
```

### 사용자 수동 작업
1. **Chrome Extension 고정 키 생성** (최초 1회)
   ```bash
   openssl genrsa -out key.pem 2048
   openssl rsa -in key.pem -pubout -outform DER | base64 -w 0
   ```

2. **Chrome 확장 로드/리로드**
   - `chrome://extensions/` → 개발자 모드 → 압축 해제된 확장 로드
   - 코드 수정 시마다 새로고침 버튼 클릭

### AI 자동화 작업
- 모든 코드 작성 및 수정
- Playwright 테스트 실행 → 오류 분석 → 자동 수정 사이클
- 린트/타입체크 실행 및 오류 수정

## 📝 문서화 규칙

### 진행 상황 관리
- **MVP 체크리스트 업데이트**: 구현 완료할 때마다 CLAUDE.md의 체크리스트 실시간 업데이트
- **기능별 완료 상태**: 각 기능의 구현/테스트/검증 상태를 명확히 표시

### 트러블슈팅 문서화
구현 과정에서 발생하는 모든 문제는 `docs/troubleshooting-log.md`에 기록:

**기록 항목**:
- 문제 상황 개요 (언제, 어떤 상황에서 발생)
- 원인 분석 (왜 발생했는지)
- 대안 후보들 (검토했던 해결 방법들)
- 실제 해결 방식 (최종 선택한 방법과 이유)
- 난이도 평가 (1-5점, 재발 시 해결 소요 시간)
- 학습 내용 (다음에 비슷한 문제 방지 방법)

## 🎯 핵심 기능 (MVP)

### 필수 기능
- [ ] 피드 구독 관리 (추가/삭제)
- [ ] 15분마다 자동 동기화 (chrome.alarms)
- [ ] 툴바 팝업으로 글 목록 표시
- [ ] 읽음/안읽음 상태 관리
- [ ] 검색 및 필터링 (제목, 도메인)
- [ ] 카테고리 태그 시스템
- [ ] 배지 알림 (읽지 않은 글 개수)
- [ ] 기본 피드 제공 (설치 시)

### 고급 기능
- [ ] OPML Import/Export
- [ ] 리더 뷰 (Readability.js 활용)
- [ ] 낚시성 콘텐츠 감지 및 필터링
- [ ] 정렬 기능 (날짜, 점수별)

## 🧪 테스트 전략

### Playwright 테스트 고려사항
- **Extension ID 문제**: manifest.json에 고정 키 사용
- **Service Worker 생명주기**: 테스트 시 ping으로 활성화 확인
- **네트워크 Mock**: RSS 피드 요청을 route.fulfill()로 처리
- **저장소 격리**: 각 테스트마다 storage.clear() 실행

### 테스트 시나리오 (11개)
1. 새 피드 추가/중복 방지/삭제
2. OPML Import/Export
3. 팝업 피드 로드 및 기사 클릭
4. 리더 뷰 모달
5. 검색 기능
6. 정렬 기능 (날짜, 점수)
7. Unread only 필터

## 📊 개발 진행 상황

### 현재 상태
- [x] 요구사항 분석 완료
- [x] RSS 파싱 방식 결정 (DOMParser)
- [x] 구현 계획 수립
- [x] Playwright 테스트 전략 수립
- [x] 개발 문서 작성

### 다음 단계
- [ ] OpenSSL 키 생성 (사용자)
- [ ] manifest.json 작성 (AI)
- [ ] 기본 프로젝트 구조 생성 (AI)

## 🔍 주요 기술적 결정사항

### RSS 파싱 방식
**선택**: 순수 JavaScript + DOMParser
**이유**: 
- 외부 라이브러리 불필요 (번들 크기 최소화)
- RSS 2.0 / Atom 1.0 모두 지원
- Chrome Extension 환경에 최적화

### 저장소 구조
```javascript
// chrome.storage.sync (동기화 데이터)
{
  feeds: [
    { url: "...", title: "...", category: "IT" }
  ],
  settings: { updateInterval: 15 }
}

// chrome.storage.local (로컬 캐시)
{
  feedItems: [
    { 
      id: "...", 
      title: "...", 
      url: "...", 
      read: false, 
      feedUrl: "...",
      pubDate: "...",
      score: 0  // 낚시성 점수
    }
  ],
  lastUpdate: timestamp,
  testMode: boolean
}
```

### 테스트 친화적 설계
- 테스트 모드 분리 (실제 네트워크 vs Mock)
- Service Worker 메시지 핸들러로 테스트 제어
- DOM 요소에 안정적인 ID/클래스 부여

## ⚠️ 알려진 문제 및 해결책

### 1. Chrome Extension ID 동적 할당
**문제**: 개발 모드에서 확장 로드마다 새로운 ID 생성
**해결**: manifest.json에 고정 key 필드 추가

### 2. Service Worker 생명주기
**문제**: 테스트 시 Service Worker 비활성 상태
**해결**: 테스트에서 ping 메시지로 활성화 확인

### 3. CORS 및 네트워크 불안정성
**문제**: 실제 RSS 피드 요청 시 테스트 불안정
**해결**: Playwright route.fulfill()로 Mock 응답

## 🎬 프로젝트 컨텍스트

### Git 저장소 정보
- **Repository URL**: https://github.com/neisii/rss-reader-with-claude.git
- **현재 브랜치**: feature/clickbait-scoring
- **메인 브랜치**: main

### Git 상태
- 이전에 reader-view, clickbait-scoring 기능 브랜치 존재
- 현재는 새로운 구현 계획으로 전면 재개발 진행

### 개발 철학
- **필터 버블 완화**: 다양한 소스 혼합
- **콘텐츠 집중**: 리더 뷰 중심 설계
- **"읽음 0"의 즐거움**: 효율적인 읽음 상태 관리

---

**문서 작성일**: 2024-10-06  
**마지막 업데이트**: Phase 1 계획 수립 완료  
**다음 액션**: OpenSSL 키 생성 후 manifest.json 작성