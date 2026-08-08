import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  // 카카오맵 SDK 는 외부 CDN 이라 네트워크가 막힌 환경에서 실패 판정까지 30초 넘게 걸린다.
  // 기본 30초로는 "SDK 미로드 → skip" 경로를 타기 전에 테스트가 먼저 죽는다.
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
