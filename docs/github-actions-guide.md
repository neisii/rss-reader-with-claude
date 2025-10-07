# GitHub Actions 테스트 가이드

## 🎯 개요

macOS에서 Chrome Extension 테스트가 보안 정책으로 차단되므로, **GitHub Actions (Linux 환경)**에서 자동으로 테스트를 실행합니다.

---

## 🚀 사용 방법

### 자동 실행 (설정 완료됨)

코드를 push하면 **자동으로** 테스트가 실행됩니다:

```bash
git add .
git commit -m "feat: Add new feature"
git push origin feature/new-feature
```

### 테스트 결과 확인

1. **GitHub 웹사이트 접속**
   - https://github.com/neisii/rss-reader-with-claude/actions

2. **최근 실행 확인**
   - 가장 위의 workflow run 클릭
   - "Chrome Extension Tests" 확인

3. **결과 확인**
   ```
   ✅ All checks have passed (2m 15s)
   또는
   ❌ Some checks failed
   ```

4. **상세 로그 보기**
   - "Run tests" 단계 클릭
   - 각 테스트 결과 확인

---

## 📊 Workflow 실행 트리거

### Push 시 자동 실행
```yaml
on:
  push:
    branches: [ main, feature/* ]
```

다음 브랜치에 push하면 자동 실행:
- `main`
- `feature/*` (예: `feature/new-ui`, `feature/bug-fix`)

### Pull Request 시 자동 실행
```yaml
on:
  pull_request:
    branches: [ main ]
```

`main` 브랜치로 PR 생성 시 자동 실행

---

## 🔧 로컬 vs CI 차이점

### 로컬 (macOS)
```javascript
// ❌ Extension 로딩 차단
executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
headless: false
→ ERR_BLOCKED_BY_CLIENT
```

### CI (Linux)
```javascript
// ✅ Extension 정상 로딩
executablePath: '/usr/bin/google-chrome'
headless: true  // CI는 headless 모드
→ 테스트 성공!
```

**자동 감지**: `process.env.CI` 환경 변수로 구분

---

## 📁 결과물 다운로드

### 테스트 실패 시 스크린샷 저장

1. GitHub Actions 페이지
2. 실패한 workflow run 클릭
3. 하단 **Artifacts** 섹션
4. `failure-screenshots` 다운로드

### 전체 테스트 결과

- `test-results`: 모든 테스트 결과 (7일 보관)
- `failure-screenshots`: 실패 시 스크린샷 (7일 보관)

---

## 🎓 실행 흐름

```
1. 코드 Push
   ↓
2. GitHub Actions 트리거
   ↓
3. Ubuntu 서버 할당
   ↓
4. Node.js 18 설치
   ↓
5. Chrome 설치
   ↓
6. npm ci (의존성 설치)
   ↓
7. npm test (Puppeteer + Jest)
   ↓
8. Extension 로딩 ✅
   ↓
9. 15개 테스트 실행
   ↓
10. 결과 리포트

소요 시간: 약 2-3분
```

---

## ⚙️ 설정 파일

### `.github/workflows/test.yml`
```yaml
name: Chrome Extension Tests

on:
  push:
    branches: [ main, feature/* ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest  # Linux!
    
    steps:
      - Checkout code
      - Setup Node.js
      - Install Chrome (Linux)
      - Run tests
      - Upload results
```

### `tests/helpers/puppeteer-extension-helper.js`
```javascript
// CI 환경 자동 감지
const isCI = process.env.CI === "true";
const executablePath = isCI
  ? "/usr/bin/google-chrome"
  : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

headless: isCI  // CI는 headless
```

---

## 🐛 트러블슈팅

### 테스트가 실행 안 됨
**원인**: workflow 파일 경로 확인
```bash
.github/workflows/test.yml  # ✅ 올바름
.github/workflow/test.yml   # ❌ 틀림 (workflows 아님)
```

### Chrome 설치 실패
**원인**: apt-key deprecated
**해결**: workflow 파일에서 Chrome 설치 스크립트 최신화

### 테스트 타임아웃
**원인**: Extension 로딩 시간 부족
**해결**: `jest.config.js`에서 타임아웃 증가
```javascript
testTimeout: 30000  // 30초
```

### Extension ID 계산 오류
**원인**: `manifest.json`에 `key` 필드 없음
**해결**: 
```bash
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -pubout -outform DER | base64
```

---

## 📈 배지 (Badge)

README.md에 테스트 상태 배지 추가됨:

```markdown
[![Tests](https://github.com/neisii/rss-reader-with-claude/actions/workflows/test.yml/badge.svg)](https://github.com/neisii/rss-reader-with-claude/actions/workflows/test.yml)
```

- ✅ 초록색: 모든 테스트 통과
- ❌ 빨간색: 테스트 실패
- 🟡 노란색: 실행 중

---

## 💡 추가 팁

### 로컬에서 CI 환경 시뮬레이션

```bash
CI=true npm test
```

이러면 로컬에서도 headless 모드로 실행 (하지만 macOS 차단으로 여전히 실패할 수 있음)

### 특정 브랜치만 테스트

```yaml
on:
  push:
    branches: [ main ]  # main만
```

### 수동 실행

GitHub Actions 페이지에서 "Run workflow" 버튼으로 수동 실행 가능

---

**작성일**: 2025-10-07  
**환경**: Ubuntu Latest + Chrome + Puppeteer + Jest
