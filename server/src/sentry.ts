import * as Sentry from "@sentry/node";

// Optional — error reporting is fully functional without this; it just
// stays disabled (every Sentry.* call below becomes a silent no-op) until
// SENTRY_DSN is set. Imported first thing in index.ts, before any other
// module, per Sentry's own guidance for Node instrumentation.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Error tracking only — no performance/tracing overhead.
    tracesSampleRate: 0,
  });
}
