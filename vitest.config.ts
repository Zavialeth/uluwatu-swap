import { defineConfig } from "vitest/config";

// Vitest configuration
// - globals: exposes Jest-style globals (test, expect, describe) if you also import them in setup
// - environment: jsdom for React DOM tests
// - setupFiles: puts our polyfills and RTL matchers in place
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    include: [
      "src/**/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "src/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}"
    ],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
