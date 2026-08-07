# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-map.spec.ts >> 거점 상세 패널 — 마커 클릭 >> 읍면동 현황 보기 링크가 실제 라우트로 이동
- Location: e2e/dashboard-map.spec.ts:155:3

# Error details

```
Error: browserType.launch: 
╔══════════════════════════════════════════════════════╗
║ Host system is missing dependencies to run browsers. ║
║ Please install them with the following command:      ║
║                                                      ║
║     sudo npx playwright install-deps                 ║
║                                                      ║
║ Alternatively, use apt:                              ║
║     sudo apt-get install libxcomposite1\             ║
║         libxdamage1\                                 ║
║         libgtk-3-0\                                  ║
║         libatk1.0-0                                  ║
║                                                      ║
║ <3 Playwright Team                                   ║
╚══════════════════════════════════════════════════════╝
```