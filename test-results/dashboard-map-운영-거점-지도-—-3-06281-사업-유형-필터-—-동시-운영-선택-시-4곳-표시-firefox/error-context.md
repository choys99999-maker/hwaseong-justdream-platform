# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-map.spec.ts >> 운영 거점 지도 — 39곳 마커 및 필터 >> 사업 유형 필터 — 동시 운영 선택 시 4곳 표시
- Location: e2e/dashboard-map.spec.ts:45:3

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