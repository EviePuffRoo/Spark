import { defineConfig } from "@playwright/test";

// e2e/** runs under Playwright, not vitest (see vitest.config.ts's exclude).
// Both servers are started fresh for the run and torn down after — the
// backend points at a dedicated server/prisma/e2e.db so this never touches
// a developer's own dev.db or the vitest test.db.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5200",
    // This environment pre-installs Chromium at a fixed path/build rather
    // than whatever build the installed @playwright/test version expects —
    // point at it directly instead of downloading a second copy.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  webServer: [
    {
      command: "npm run e2e",
      cwd: "../server",
      port: 4000,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: "npx vite --port 5200",
      port: 5200,
      timeout: 30_000,
      reuseExistingServer: false,
    },
  ],
});
