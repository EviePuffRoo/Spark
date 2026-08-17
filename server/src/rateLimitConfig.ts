// Rate limits are effectively disabled under the test runner (vitest.config.ts
// sets NODE_ENV=test) so a single integration test file making many
// sequential requests doesn't trip a limiter meant to catch real abuse.
// Production behavior is completely unchanged.
export function testAwareLimit(limit: number): number {
  return process.env.NODE_ENV === "test" ? 1_000_000 : limit;
}
