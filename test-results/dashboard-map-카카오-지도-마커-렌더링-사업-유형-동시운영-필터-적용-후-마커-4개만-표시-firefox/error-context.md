# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-map.spec.ts >> 카카오 지도 마커 렌더링 >> 사업 유형=동시운영 필터 적용 후 마커 4개만 표시
- Location: e2e/dashboard-map.spec.ts:98:3

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