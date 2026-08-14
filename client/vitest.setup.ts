import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without vitest.config.ts's `globals: true` (deliberately not set — tests
// import describe/it/expect explicitly), Testing Library's own auto-cleanup
// doesn't register itself, so unmounted components from a previous test
// would otherwise still be in the DOM for the next one.
afterEach(() => cleanup());

// jsdom doesn't implement matchMedia — several components (useTheme.ts) call
// it to detect the OS color-scheme preference.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
