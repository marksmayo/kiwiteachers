import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": r("./src"),
      "server-only": r("./test/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text-summary", "text", "html", "json-summary"],
      // Ratchet: thresholds only ever go up. `autoUpdate` rewrites them when coverage improves.
      // Target is 95% across the board (see TESTING.md).
      thresholds: {
        // Local runs raise the floor; CI only enforces it.
        autoUpdate: !process.env.CI,
        lines: 72.56,
        functions: 60.62,
        branches: 69.42,
        statements: 73.7,
        // Business and security logic is held to a higher bar.
        "src/lib/**": {
          lines: 98.75,
          functions: 96.89,
          branches: 95.18,
          statements: 97.91,
        },
      },
    },
  },
});
