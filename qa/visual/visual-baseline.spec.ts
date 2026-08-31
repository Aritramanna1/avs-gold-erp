import { test, expect } from "@playwright/test";

/**
 * QA-04 Visual regression — baselines under qa/visual/baselines/.
 * Set QA_UPDATE_SNAPSHOTS=1 to intentionally refresh baselines after PO review.
 */
const STABLE_SCREENS = [
  { name: "login", path: "/login", tag: "@visual-only" },
  { name: "help", path: "/help", tag: "@visual-only" },
];

for (const screen of STABLE_SCREENS) {
  test(`visual: ${screen.name} desktop ${screen.tag}`, async ({ page }) => {
    test.skip(!process.env.QA_VISUAL_ENABLED, "Set QA_VISUAL_ENABLED=1 to run visual suite");
    await page.goto(screen.path);
    await expect(page).toHaveScreenshot(`${screen.name}-desktop.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
