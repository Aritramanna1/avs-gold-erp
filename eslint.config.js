import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules",
      "dist",
      "dist-electron",
      ".output",
      ".vinxi",
      // Local browser-automation profile (Claude in Chrome / Reticle) — tens
      // of thousands of extension/cache files, not project source. Walking
      // this directory (unignored) is what made `eslint .` hang for an hour.
      ".reticle-chrome-profile",
      // Ad-hoc verification scripts from prior sessions — gitignored, not project source.
      ".scratch-verify",
      // Packaged release export bundles — each contains a full duplicate
      // Source Code/ copy of the repo, never meant to be linted in place.
      "release",
      "release-build",
      "build",
      ".agents",
      ".claude",
      ".claude-flow",
      ".codex",
      ".serena",
      ".swarm",
      "claude-obsidian",
      "AVS Gold ERP v1.1 Test Build",
      // Generated Playwright output — bundled vendor assets, not source code
      "e2e/report",
      "e2e/test-results",
      "playwright-report",
      "test-results",
      "blob-report",
      // Same, for the QA harness: qa/**/reports-output holds Playwright's
      // trace viewer bundle (minified codeMirror/xterm megabytes). Linting and
      // Prettier-parsing those is what makes `eslint .` run for tens of
      // minutes; the QA suites themselves under qa/ are still linted.
      "qa/**/reports-output",
      "coverage",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
            {
              name: "@/integrations/supabase/client",
              message:
                "Import the provider-neutral facade from @/lib/providers/data-provider instead.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["e2e/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/lib/test-seed.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  eslintPluginPrettier,
);
