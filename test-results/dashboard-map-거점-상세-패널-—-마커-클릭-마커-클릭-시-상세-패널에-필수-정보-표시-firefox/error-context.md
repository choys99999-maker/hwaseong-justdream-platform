# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-map.spec.ts >> 거점 상세 패널 — 마커 클릭 >> 마커 클릭 시 상세 패널에 필수 정보 표시
- Location: e2e/dashboard-map.spec.ts:128:3

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