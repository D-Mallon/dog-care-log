import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    // Playwright specs live under e2e/ and must not be collected by Vitest.
    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
});
