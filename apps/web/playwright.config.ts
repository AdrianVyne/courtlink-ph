import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const isCI = !!process.env.CI;

const webServer = process.env.E2E_BASE_URL
  ? undefined
  : {
      command: isCI
        ? `pnpm start --hostname 127.0.0.1 --port ${port}`
        : `pnpm dev --hostname 127.0.0.1 --port ${port}`,
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: isCI ? 120_000 : 30_000,
    };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(webServer ? { webServer } : {}),
});
