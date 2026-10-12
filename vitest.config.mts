import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.ts",
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json", "html", "lcov"],
      include: [
        "src/lib/**/*.ts",
        "src/features/**/*.ts",
        "src/services/**/*.ts",
        "src/repositories/**/*.ts",
      ],
      exclude: [
        "src/**/*.d.ts",
        "src/tests/**",
      ],
    },
  },
});

