import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const LOCALES = ["en", "hi", "mr", "bn"] as const;

for (const locale of LOCALES) {
  test.describe(`QA-05 Accessibility @ ${locale}`, () => {
    test(`login page passes axe (${locale})`, async ({ page }) => {
      await page.goto(`/login?lang=${locale}`);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  });
}
