import { defineConfig } from "@playwright/test";

// The showcase rig — a second Playwright config that drives the real app to
// record it, rather than to assert on it.
//
// Kept entirely apart from playwright.config.ts on purpose. These files live
// in demo/ (not e2e/) and end in .demo.ts (not .spec.ts), so neither the CI
// e2e suite nor vitest can pick them up: a segment that stalls waiting for a
// nice-looking pause must never be able to fail somebody's PR.
//
// Everything else matches the e2e config, including the dedicated
// server/prisma/e2e.db — a recording session never touches a developer's
// dev.db or the vitest test.db.
export default defineConfig({
  testDir: "./demo",
  testMatch: "**/*.demo.ts",
  // Segments are minutes of real-time footage, and a shot that has to wait
  // out an animation is doing its job, not hanging.
  timeout: 6 * 60_000,
  expect: { timeout: 20_000 },
  // One at a time, always: two segments recording at once would fight over
  // the same world's live encounter, and the machine's frame pacing shows up
  // directly in the footage.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  // Not test-results/ — Playwright wipes that directory at the start of
  // every run, which would take the footage with it.
  outputDir: "./showcase-out/_pw",
  use: {
    baseURL: "http://localhost:5200",
    // Without this, a locator action waits until the whole test times out —
    // so one selector that stops matching costs six minutes and reports the
    // wrong line. Same reasoning as the e2e suite's short per-test timeouts
    // (CLAUDE.md): a long timeout doesn't make a bad selector pass, it just
    // makes you wait to find out.
    actionTimeout: 20_000,
    // Segments open their own contexts so they can set per-view video paths
    // (the live-combat segment records two at once); nothing should be
    // recorded off the default fixtures.
    video: "off",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  // Ordered, and every segment depends on the seed. The seed is idempotent —
  // it reuses the world recorded in showcase-out/demo-world.json when that
  // world still resolves — so re-shooting one segment is cheap and lands on
  // exactly the content the other segments were shot against.
  projects: [
    { name: "seed", testMatch: "**/seed.demo.ts" },
    { name: "generation", testMatch: "**/01-generation.demo.ts", dependencies: ["seed"] },
    { name: "map-builder", testMatch: "**/02-map-builder.demo.ts", dependencies: ["seed"] },
    { name: "live-combat", testMatch: "**/03-live-combat.demo.ts", dependencies: ["seed"] },
  ],
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
