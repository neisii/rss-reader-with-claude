# Chrome Extension RSS Reader - 수동 테스트 체크리스트

**결론**: 자동화 테스트가 macOS/Linux 모두에서 실패함 → 수동 테스트로 전환

---

## 🔴 자동화 실패 이유

**ERR_BLOCKED_BY_CLIENT** - Chrome이 자동화 도구에서 Extension 로딩 차단
- ❌ Playwright (macOS)
- ❌ Puppeteer (macOS)  
- ❌ Puppeteer + Xvfb (Linux CI)
- ❌ GitHub Actions

**근본 원인**: Chrome의 보안 정책 (자동화 감지 시 Extension API 차단)

---

## ✅ 수동 테스트 체크리스트

### 설치 및 초기 설정

- [ ] **Extension 로드**
  - `chrome://extensions/` 접속
  - 개발자 모드 활성화
  - "압축 해제된 확장 로드" → 프로젝트 폴더 선택
  - Extension 아이콘이 툴바에 나타남

- [ ] **기본 피드 확인**
  - Extension 아이콘 클릭
  - 기본 피드 2-3개가 이미 등록되어 있음
  - 피드 아이템이 표시됨

---

### 피드 관리 (Options 페이지)

- [ ] **Options 페이지 열기**
  - Extension 아이콘 우클릭 → "옵션"
  - 또는 Popup에서 "설정" 버튼 클릭

- [ ] **새 피드 추가**
  - URL 입력: `https://news.ycombinator.com/rss`
  - 카테고리: `IT`
  - "추가" 버튼 클릭
  - 피드 목록에 추가됨

- [ ] **중복 피드 방지**
  - 같은 URL 다시 입력
  - 에러 메시지 표시: "이미 등록된 피드입니다"

- [ ] **잘못된 URL 처리**
  - 잘못된 URL 입력: `https://invalid-url`
  - 에러 메시지 표시

- [ ] **피드 삭제**
  - 피드 옆 "삭제" 버튼 클릭
  - 목록에서 제거됨

---

### 피드 동기화

- [ ] **자동 동기화**
  - Extension 설치 후 15분 대기
  - Badge 카운트 업데이트 확인
  - 새 글이 Popup에 나타남

- [ ] **수동 동기화**
  - Options 페이지에서 "지금 동기화" 버튼 클릭
  - 로딩 표시
  - 완료 메시지

---

### Popup 표시

- [ ] **Popup 열기**
  - Extension 아이콘 클릭
  - 피드 아이템 목록 표시

- [ ] **아이템 클릭**
  - 아이템 클릭
  - 새 탭에서 링크 열림
  - 아이템이 "읽음" 상태로 변경 (회색으로 표시)

- [ ] **읽음 상태 확인**
  - 읽은 글은 다른 색상으로 표시
  - Badge 카운트 감소

---

### 검색 및 필터

- [ ] **제목 검색**
  - 검색창에 "React" 입력
  - "React" 포함된 글만 표시

- [ ] **도메인 필터**
  - 검색창에 "ycombinator.com" 입력
  - 해당 도메인 글만 표시

- [ ] **카테고리 필터**
  - "IT" 카테고리 선택
  - IT 카테고리 피드만 표시

- [ ] **읽지 않음 필터**
  - "읽지 않음만" 체크박스 선택
  - 안읽은 글만 표시

---

### 배지 알림

- [ ] **읽지 않은 글 카운트**
  - 안읽은 글이 있으면 Extension 아이콘에 숫자 표시
  - 예: `5`

- [ ] **카운트 업데이트**
  - 글 읽으면 카운트 감소
  - 모두 읽으면 배지 사라짐

---

### OPML Import/Export (선택 기능)

- [ ] **OPML Export**
  - Options → "Export OPML" 버튼
  - `feeds.opml` 파일 다운로드
  - 파일 내용 확인 (XML 형식)

- [ ] **OPML Import**
  - `feeds.opml` 파일 선택
  - "Import OPML" 버튼
  - 피드 목록에 추가됨

---

### Service Worker

- [ ] **Service Worker 활성화 확인**
  - `chrome://extensions/` → RSS Reader
  - "Service Worker" 링크 클릭
  - Console 로그 확인: "RSS Reader background service worker started"

- [ ] **메시지 핸들러 동작**
  - Popup에서 피드 추가
  - Service Worker Console에 로그 확인

---

### 에러 처리

- [ ] **네트워크 오류**
  - 인터넷 연결 끊기
  - 동기화 실행
  - 에러 메시지 표시

- [ ] **잘못된 RSS 형식**
  - 일반 웹페이지 URL 추가
  - 에러 메시지: "유효한 RSS 피드가 아닙니다"

---

### 성능

- [ ] **100개 피드 테스트**
  - 여러 피드 추가 (최대 100개)
  - Popup 로딩 시간 측정 (< 2초)

- [ ] **1000개 아이템 테스트**
  - 많은 아이템 누적
  - 스크롤 성능 확인

---

### 브라우저 호환성

- [ ] **Chrome 최신 버전**
  - Extension 정상 작동

- [ ] **Edge 브라우저** (선택)
  - Extension 로드 및 작동 확인

---

## 📝 버그 발견 시

### 기록 항목
1. **재현 단계**
2. **예상 동작**
3. **실제 동작**
4. **스크린샷** (있으면)
5. **Console 에러** (F12 → Console)

### 예시
```markdown
## Bug: 피드 삭제 후 Popup에 여전히 표시됨

**재현 단계**:
1. Options에서 피드 삭제
2. Popup 열기
3. 삭제한 피드 아이템이 여전히 표시됨

**예상**: 삭제한 피드 아이템 안 보임
**실제**: 여전히 표시됨

**Console 에러**: 
```
ERROR: Feed not found in storage
```

**해결**: Storage 동기화 로직 수정 필요
```

---

## 🎯 필수 테스트 (최소한)

매 릴리스마다 **반드시** 확인:

1. ✅ Extension 로드
2. ✅ 피드 추가
3. ✅ 피드 삭제
4. ✅ 동기화 (수동)
5. ✅ Popup에서 아이템 클릭
6. ✅ 검색 기능
7. ✅ 읽음 상태 관리

**소요 시간**: 약 10분

---

**작성일**: 2025-10-07  
**상태**: 자동화 포기, 수동 테스트로 전환
