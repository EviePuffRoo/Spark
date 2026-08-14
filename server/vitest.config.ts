import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Every test file shares one SQLite test.db (see resetDb.ts) — running
    // files in parallel would mean concurrent writers against the same
    // file, which SQLite doesn't handle gracefully under test load.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-only-jwt-secret",
      // auth.ts reads this once at module load — fixed here rather than
      // mutated mid-test, since ADMIN_USERNAMES is a startup-time config
      // value in the real app too.
      ADMIN_USERNAMES: "admintestuser",
      // billing.test.ts mocks the "stripe" package itself (see
      // tests/billing.test.ts), so these just need to be non-empty to
      // clear billing.ts's "isn't configured" guards.
      STRIPE_SECRET_KEY: "sk_test_mock",
      STRIPE_PRICE_ID: "price_mock",
      STRIPE_WEBHOOK_SECRET: "whsec_mock",
    },
  },
});
