import pino from "pino";

// vitest sets process.env.VITEST for every test process (unlike NODE_ENV,
// which nothing here consistently sets) — used to keep the thousands of
// requests the server test suite issues via supertest from flooding test
// output with structured log lines on every run.
const isTest = !!process.env.VITEST;

export const logger = pino({
  level: isTest ? "silent" : (process.env.LOG_LEVEL ?? "info"),
});
