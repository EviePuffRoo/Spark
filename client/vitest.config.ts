import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // e2e/** runs under Playwright, not vitest.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
