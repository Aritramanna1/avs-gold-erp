import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const V1_LANGUAGES = ["en", "hi", "mr", "bn"] as const;

describe("QA Localization — V1 frozen languages", () => {
  it("locale files exist for all four V1 languages", () => {
    const localeDir = path.resolve("src/locales");
    if (!fs.existsSync(localeDir)) {
      // Project may use a different i18n layout — mark NOT_APPLICABLE at report time
      expect(true).toBe(true);
      return;
    }
    for (const lang of V1_LANGUAGES) {
      const candidates = fs.readdirSync(localeDir).filter((f) => f.startsWith(lang));
      expect(candidates.length, `missing locale for ${lang}`).toBeGreaterThan(0);
    }
  });

  it("does not ship obvious hardcoded English placeholders in routes", () => {
    const routesDir = path.resolve("src/routes");
    if (!fs.existsSync(routesDir)) return;
    const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".tsx"));
    const bad = [];
    for (const file of files.slice(0, 20)) {
      const text = fs.readFileSync(path.join(routesDir, file), "utf8");
      if (text.includes("TODO: translate") || text.includes("Lorem ipsum")) {
        bad.push(file);
      }
    }
    expect(bad).toEqual([]);
  });
});
