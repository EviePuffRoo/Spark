import * as Sentry from "@sentry/react";

// Optional — error reporting is fully functional without this; it just
// stays disabled (every Sentry.* call becomes a silent no-op) until
// VITE_SENTRY_DSN is set at build time. Also auto-installs global
// window.onerror / unhandledrejection listeners, catching crashes outside
// React's render tree (event handlers, async code) that ErrorBoundary.tsx
// can't see.
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? "production" : "development",
    // Error tracking only — no performance/tracing overhead.
    tracesSampleRate: 0,
  });
}
