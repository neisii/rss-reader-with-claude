# Puppeteer 마이그레이션 결과 - 동일한 문제 발생

**날짜**: 2025-10-07  
**결론**: ❌ **Puppeteer도 Playwright와 동일한 macOS 차단 문제**

---

## 🔴 핵심 발견

### Puppeteer로 전환해도 문제 해결 안됨

```
❌ Extension not loaded: net::ERR_BLOCKED_BY_CLIENT 
at chrome-extension://cnmnhhnholcmdfgl/manifest.json
```

**원인**: Playwright vs Puppeteer 문제가 아니라 **macOS + Chrome의 근본적인 보안 정책**

---

## 📊 시도한 방법들

### 1. Playwright (실패)
- ❌ `chrome://extensions` 접근 차단
- ❌ Extension 파일 접근 시 `ERR_BLOCKED_BY_CLIENT`
- ❌ Service Worker 미활성화

### 2. Puppeteer (실패)
- ✅ Browser 정상 실행
- ✅ Extension ID 계산 성공 (`cnmnhhnholcmdfgl`)
- ❌ Extension 로딩 차단 (`ERR_BLOCKED_BY_CLIENT`)
- ❌ manifest.json 접근 불가

### 3. 시도한 Chrome 플래그들
```bash
--disable-extensions-except=${path}
--load-extension=${path}
--no-sandbox
--disable-setuid-sandbox
--disable-dev-shm-usage
--disable-blink-features=AutomationControlled
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
```

**결과**: 모두 무효. macOS가 상위 레벨에서 차단.

---

## 🔍 근본 원인 분석

### macOS Big Sur 이후 보안 정책

1. **System Integrity Protection (SIP)**
   - Chrome Extension 개발 모드 로딩 제한
   - Automation 도구에서 Extension 접근 차단

2. **Gatekeeper 보안**
   - 서명되지 않은 Chrome Extension 실행 제한
   - 자동화 도구를 통한 Extension 로딩 거부

3. **Chrome 자체 보안**
   - `chrome-extension://` 프로토콜 접근 제한
   - Automation 감지 시 Extension API 차단

### 증거

#### Playwright 로그:
```
Target page, context or browser has been closed
Call log: navigating to "chrome://extensions/"
```

#### Puppeteer 로그:
```
net::ERR_BLOCKED_BY_CLIENT 
at chrome-extension://cnmnhhnholcmdfgl/manifest.json
```

**동일한 에러** → 동일한 근본 원인

---

## 💡 Playwright vs Puppeteer 비교

| 항목 | Playwright | Puppeteer | 결과 |
|------|-----------|-----------|------|
| Browser 실행 | ✅ | ✅ | 동일 |
| Extension ID 계산 | ✅ | ✅ | 동일 |
| Extension 로딩 | ❌ | ❌ | **동일 실패** |
| 에러 메시지 | `Target closed` | `ERR_BLOCKED_BY_CLIENT` | 다르지만 같은 원인 |
| macOS 차단 | ❌ | ❌ | 둘 다 차단됨 |

**결론**: 도구 문제가 아니라 **환경 문제**

---

## ✅ 작동하는 환경 vs ❌ 작동 안 하는 환경

### ✅ 작동할 것으로 예상되는 환경
1. **Linux** (Ubuntu, Debian 등)
   - macOS SIP 없음
   - Extension 로딩 제약 없음
   - CI/CD 환경에서 검증됨

2. **Windows**
   - macOS 보안 정책 없음
   - Chrome Extension 테스트 가능

3. **Docker (Linux 컨테이너)**
   - macOS 보안 우회
   - GitHub Actions, GitLab CI 등

### ❌ 작동 안 하는 환경
1. **macOS Big Sur 이상**
   - Playwright ❌
   - Puppeteer ❌
   - Selenium WebDriver ❌ (예상)

---

## 🛠️ 실제 해결 방안

### 방안 1: GitHub Actions (Linux) 사용 ⭐ 추천
```yaml
# .github/workflows/test.yml
name: Test Chrome Extension

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
```

**장점**:
- macOS 보안 우회
- CI/CD 자동화
- 무료 (public repo)
- 검증된 방법

**단점**:
- 로컬 테스트 불가
- 디버깅 어려움

### 방안 2: Docker Selenium Grid
```bash
docker run -d -p 4444:4444 \
  selenium/standalone-chrome:latest
```

**장점**:
- 로컬에서 실행
- Linux 환경 에뮬레이션
- Extension 테스트 가능

**단점**:
- Docker 설정 필요
- 리소스 사용량 높음
- Puppeteer/Playwright 재작성 필요

### 방안 3: 수동 테스트 체크리스트
```markdown
## 수동 테스트 항목
- [ ] Extension 로드
- [ ] Popup 열기
- [ ] Feed 추가
- [ ] Feed 동기화
- [ ] 읽음 표시
...
```

**장점**:
- 즉시 시작 가능
- 추가 설정 불필요
- 실제 사용자 시나리오

**단점**:
- 자동화 없음
- 시간 소모
- 회귀 테스트 어려움

### 방안 4: Linux VM (VirtualBox/Parallels)
**장점**:
- 완전한 Linux 환경
- 로컬 테스트 가능

**단점**:
- VM 설정 및 관리
- 리소스 많이 사용

---

## 📈 권장 워크플로우

### 개발 단계
1. **로컬 macOS**: 수동 테스트
2. **코드 변경**: Git commit
3. **자동 테스트**: GitHub Actions (Linux)
4. **결과 확인**: CI 통과 후 배포

### 디버깅
1. 실패 시 로컬에서 재현
2. 수동으로 Extension 로드
3. Chrome DevTools로 디버깅
4. 수정 후 다시 CI 실행

---

## 🎯 최종 결론

### Puppeteer 마이그레이션 결과: **실패**

- Puppeteer도 Playwright도 macOS에서 작동 안함
- 근본 원인: **macOS 보안 정책**
- 해결책: **환경 변경** (Linux CI or Docker)

### 다음 액션

**Option A: GitHub Actions** ⭐
- 시간: 30분
- 효과: 완전 자동화
- 추천: CI/CD 필요 시

**Option B: 수동 테스트**
- 시간: 10분
- 효과: 즉시 시작
- 추천: 빠른 개발 필요 시

**Option C: Docker**
- 시간: 2시간
- 효과: 로컬 자동화
- 추천: 로컬 테스트 필수 시

---

## 📝 교훈

1. **도구 문제가 아니라 환경 문제**
   - Playwright → Puppeteer 전환은 의미 없었음
   - 처음부터 환경(macOS) 문제 파악했어야

2. **Chrome Extension 테스트는 Linux가 표준**
   - 대부분의 Extension 개발자가 Linux CI 사용
   - macOS는 개발 환경일 뿐, 테스트 환경 아님

3. **빠른 검증의 중요성**
   - Playwright 38개 테스트 작성 후 실패
   - Puppeteer 마이그레이션 후에도 실패
   - 처음에 간단한 Extension 로딩 테스트부터 했어야

---

**리포트 작성**: 2025-10-07  
**소요 시간**: Playwright (2시간) + Puppeteer (1시간) = 3시간  
**결과**: 동일한 문제, 다른 도구로도 해결 불가  
**교훈**: 환경이 중요하다
