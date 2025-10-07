# GitHub Actions CI/CD 템플릿

이 문서는 RSS Reader Chrome Extension을 위한 GitHub Actions 워크플로우 템플릿을 제공합니다.

## 📁 파일 구조

```
.github/
└── workflows/
    ├── test.yml           # 테스트 실행
    ├── release.yml        # 릴리스 배포
    └── security.yml       # 보안 검사
```

## 🧪 테스트 워크플로우

### `.github/workflows/test.yml`

```yaml
name: 🧪 Test Chrome Extension

on:
  push:
    branches: [ main, develop, feature/* ]
  pull_request:
    branches: [ main, develop ]

env:
  NODE_VERSION: '18'

jobs:
  test:
    name: 🔍 E2E Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: 🔧 Install dependencies
        run: npm ci

      - name: 🌐 Setup Chrome for Testing
        uses: browser-actions/setup-chrome@v1
        with:
          install-chromedriver: true

      - name: 🎭 Install Playwright
        run: npx playwright install chromium

      - name: 🔍 Run Playwright tests
        run: npm run test
        env:
          CI: true

      - name: 📊 Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: 📈 Upload coverage reports
        uses: codecov/codecov-action@v3
        if: always()
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: chrome-extension-coverage

  lint:
    name: 🔍 Code Quality
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: 🔧 Install dependencies
        run: npm ci

      - name: 🔍 Run ESLint
        run: npm run lint

      - name: 🔍 Check TypeScript (if applicable)
        run: npm run typecheck
        continue-on-error: true

  security:
    name: 🔒 Security Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 🔒 Run security audit
        run: npm audit --audit-level=moderate

      - name: 🔍 Check for sensitive files
        run: |
          if find . -name "*.pem" -o -name "*.key" -o -name ".env" | grep -q .; then
            echo "⚠️ Sensitive files found!"
            exit 1
          fi

  extension-validation:
    name: 📋 Extension Validation
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 📋 Validate manifest.json
        run: |
          if ! jq empty manifest.json; then
            echo "❌ Invalid manifest.json"
            exit 1
          fi
          echo "✅ manifest.json is valid"

      - name: 🔍 Check required files
        run: |
          required_files=("manifest.json" "background.js" "popup.html" "options.html")
          for file in "${required_files[@]}"; do
            if [[ ! -f "$file" ]]; then
              echo "❌ Required file missing: $file"
              exit 1
            fi
          done
          echo "✅ All required files present"

      - name: 📏 Check extension size
        run: |
          size=$(du -sk . | cut -f1)
          if [[ $size -gt 51200 ]]; then  # 50MB limit
            echo "⚠️ Extension size ($size KB) exceeds Chrome Web Store limit"
            exit 1
          fi
          echo "✅ Extension size OK ($size KB)"
```

## 🚀 릴리스 워크플로우

### `.github/workflows/release.yml`

```yaml
name: 🚀 Release Chrome Extension

on:
  push:
    tags:
      - 'v*'

env:
  NODE_VERSION: '18'

jobs:
  test:
    name: 🧪 Pre-release Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: 🔧 Install dependencies
        run: npm ci

      - name: 🌐 Setup Chrome for Testing
        uses: browser-actions/setup-chrome@v1

      - name: 🎭 Install Playwright
        run: npx playwright install chromium

      - name: 🔍 Run all tests
        run: npm test

  build:
    name: 🏗️ Build Extension
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: 🔧 Install dependencies
        run: npm ci

      - name: 🏗️ Build extension
        run: npm run build
        if: ${{ always() }}  # Build even if no build script

      - name: 📦 Create extension package
        run: |
          # Remove development files
          rm -rf node_modules tests .github docs
          rm -f package*.json playwright.config.js
          
          # Create zip package
          zip -r extension-${{ github.ref_name }}.zip . \
            -x "*.git*" "*.DS_Store" "*.vscode*" "CLAUDE.md"

      - name: 📊 Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension-package
          path: extension-${{ github.ref_name }}.zip

  publish-chrome-store:
    name: 🌐 Publish to Chrome Web Store
    runs-on: ubuntu-latest
    needs: build
    if: startsWith(github.ref, 'refs/tags/v') && !contains(github.ref, 'beta')
    
    steps:
      - name: 📥 Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: extension-package

      - name: 🌐 Publish to Chrome Web Store
        uses: chrome-extension-upload-action@v1
        with:
          app-id: ${{ secrets.CHROME_APP_ID }}
          refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}
          client-id: ${{ secrets.CHROME_CLIENT_ID }}
          client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          file-path: extension-${{ github.ref_name }}.zip
          publish: true

  create-github-release:
    name: 📝 Create GitHub Release
    runs-on: ubuntu-latest
    needs: build
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 📥 Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: extension-package

      - name: 📝 Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: RSS Reader ${{ github.ref_name }}
          body: |
            ## 🎉 RSS Reader Chrome Extension ${{ github.ref_name }}
            
            ### ✨ New Features
            - Add new features here
            
            ### 🐛 Bug Fixes
            - Add bug fixes here
            
            ### 🔧 Technical Improvements
            - Add technical improvements here
            
            ### 📥 Installation
            1. Download the extension-${{ github.ref_name }}.zip file
            2. Extract the contents
            3. Load unpacked extension in Chrome Developer Mode
            
            Or install from Chrome Web Store: [Coming Soon]
            
          draft: false
          prerelease: ${{ contains(github.ref, 'beta') || contains(github.ref, 'alpha') }}

      - name: 📎 Upload Release Asset
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: extension-${{ github.ref_name }}.zip
          asset_name: extension-${{ github.ref_name }}.zip
          asset_content_type: application/zip
```

## 🔒 보안 워크플로우

### `.github/workflows/security.yml`

```yaml
name: 🔒 Security Scan

on:
  schedule:
    - cron: '0 6 * * 1'  # Weekly on Monday
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  dependency-check:
    name: 🔍 Dependency Vulnerability Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 🔒 Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  code-scan:
    name: 🔍 CodeQL Analysis
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 🔍 Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript

      - name: 🔍 Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2

  manifest-security:
    name: 🔍 Manifest Security Check
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 🔍 Check dangerous permissions
        run: |
          dangerous_perms=("tabs" "activeTab" "webRequest" "webRequestBlocking" "proxy" "debugger")
          
          for perm in "${dangerous_perms[@]}"; do
            if grep -q "\"$perm\"" manifest.json; then
              echo "⚠️ Potentially dangerous permission found: $perm"
              echo "Please ensure this permission is necessary and properly justified."
            fi
          done

      - name: 🔍 Check CSP settings
        run: |
          if ! grep -q "content_security_policy" manifest.json; then
            echo "⚠️ No Content Security Policy found in manifest.json"
            echo "Consider adding CSP for better security."
          fi

      - name: 🔍 Check host permissions
        run: |
          if grep -q "\"<all_urls>\"" manifest.json; then
            echo "⚠️ Broad host permissions detected"
            echo "Consider restricting to specific domains only."
          fi
```

## 🛠️ 설정 가이드

### 1. Secrets 설정

GitHub 저장소의 Settings > Secrets and variables > Actions에서 다음 secrets를 추가:

```bash
# Chrome Web Store API (릴리스용)
CHROME_APP_ID=your_extension_id
CHROME_CLIENT_ID=your_client_id
CHROME_CLIENT_SECRET=your_client_secret
CHROME_REFRESH_TOKEN=your_refresh_token

# Snyk 보안 스캔 (선택사항)
SNYK_TOKEN=your_snyk_token
```

### 2. Chrome Web Store API 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. Chrome Web Store API 활성화
4. OAuth 2.0 클라이언트 ID 생성
5. Refresh Token 획득

### 3. package.json 스크립트 추가

```json
{
  "scripts": {
    "test": "playwright test",
    "lint": "eslint . --ext .js",
    "typecheck": "tsc --noEmit",
    "build": "echo 'No build step required'",
    "pretest": "npm run lint"
  }
}
```

### 4. Branch Protection 설정

GitHub 저장소의 Settings > Branches에서:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Include administrators

필수 상태 검사:
- `test / E2E Tests`
- `lint / Code Quality`
- `security / Security Scan`

## 📊 워크플로우 모니터링

### 상태 배지 추가

README.md에 추가:

```markdown
![Tests](https://github.com/your-username/rss-reader-with-claude/workflows/Test%20Chrome%20Extension/badge.svg)
![Release](https://github.com/your-username/rss-reader-with-claude/workflows/Release%20Chrome%20Extension/badge.svg)
![Security](https://github.com/your-username/rss-reader-with-claude/workflows/Security%20Scan/badge.svg)
```

### 알림 설정

GitHub 저장소의 Settings > Notifications에서:
- ✅ Actions 워크플로우 실패 시 이메일 알림
- ✅ 보안 경고 즉시 알림

## 🚀 사용법

### 테스트 실행
```bash
# 로컬에서 테스트
npm test

# Push 시 자동 실행
git push origin feature/new-feature
```

### 릴리스 배포
```bash
# 태그 생성으로 자동 배포
git tag v1.1.0
git push origin v1.1.0
```

### 수동 워크플로우 실행
1. GitHub 저장소의 Actions 탭 접속
2. 실행할 워크플로우 선택
3. "Run workflow" 버튼 클릭

이 템플릿을 사용하면 완전 자동화된 CI/CD 파이프라인을 구축할 수 있습니다.