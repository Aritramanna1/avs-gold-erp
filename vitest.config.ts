import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "qa/unit/**/*.test.ts",
      "qa/database/**/*.test.ts",
      "qa/payments/**/*.test.ts",
      "qa/localization/**/*.test.ts",
    ],
    reporters: ["default", "junit"],
    outputFile: { junit: "qa/reports-output/junit-vitest.xml" },
    coverage: {
      provider: "v8",
      reportsDirectory: "qa/reports-output/coverage",
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.d.ts", "**/routeTree.gen.ts"],
    },
    testTimeout: 30_000,
    env: {
      VITE_SUPABASE_URL: "https://dqgrrafuoxaorvyrcuuh.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_test_key",
      VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_test_key",
      VITE_APP_URL: "https://erp.arivahly.in",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
