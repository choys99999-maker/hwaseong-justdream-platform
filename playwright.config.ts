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
    // JupyterHub 프록시 환경에서는 vite base 가 /user/.../proxy/... 로 바뀐다.
    // 그러면 baseURL('/') 과 라우터 경로가 어긋나므로 테스트용 서버는 항상 base='/' 로 띄운다.
    command: 'JUPYTERHUB_SERVICE_PREFIX= npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
