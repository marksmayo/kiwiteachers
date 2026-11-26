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
    testTimeout: 30_000,
    hookTimeout: 60_000,
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
        lines: 70.62,
        functions: 58.9,
        branches: 67.93,
        statements: 71.92,
        // Business and security logic is held to a higher bar.
        "src/lib/**": {
          lines: 98.6,
          functions: 96.52,
          branches: 94.69,
          statements: 97.68,
        },
      },
    },
  },
});
