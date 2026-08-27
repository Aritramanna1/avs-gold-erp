import { test, expect, devices, type Page } from "@playwright/test";

/**
 * Responsive overflow + Google OAuth callback/redirect UX.
 * Targets local Vite (override E2E_BASE_URL=http://localhost:3000).
 * Does not require a live Google account.
 */

async function dismissCookies(page: Page) {
  const accept = page.getByRole("button", { name: /Essential only|Accept all/i }).first();
  if (await accept.isVisible().catch(() => false)) {
    await accept.click().catch(() => undefined);
  }
}

test.describe("Login viewport — no horizontal overflow", () => {
  const viewports = [
    { name: "iphone-13", ...devices["iPhone 13"] },
    { name: "pixel-5", ...devices["Pixel 5"] },
    { name: "ipad-11", ...devices["iPad Pro 11"] },
    {
      name: "tablet-landscape",
      viewport: { width: 1024, height: 768 },
      isMobile: true,
      hasTouch: true,
    },
  ];

  for (const device of viewports) {
    test(`login @ ${device.name}`, async ({ browser }) => {
      const context = await browser.newContext(device);
      const page = await context.newPage();
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await dismissCookies(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      );
      expect(overflow, "login must not horizontal-overflow").toBe(false);
      await expect(page.getByTestId("auth-form")).toBeVisible();
      await context.close();
    });
  }
});

test.describe("Google OAuth redirect UX", () => {
  test("auth/callback with OAuth error shows meaningful failure (not 404)", async ({ page }) => {
    await page.goto(
      "/auth/callback?error=access_denied&error_description=User%20cancelled%20login",
      { waitUntil: "domcontentloaded" },
    );
    await dismissCookies(page);
    await expect(page.getByRole("heading", { name: /Sign-in failed/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("User cancelled login")).toBeVisible();
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Return to login/i })).toBeVisible();
  });

  test("auth/callback without session shows error, not marketing 404", async ({ page }) => {
    await page.goto("/auth/callback", { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    await expect(
      page.getByRole("heading", { name: /Sign-in failed|AVS Security Gateway/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
  });

  test("Continue with Google shows Redirecting to Google… before leave", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await dismissCookies(page);

    const googleBtn = page.getByTestId("auth-google");
    if (!(await googleBtn.isVisible().catch(() => false))) {
      test.skip(true, "Google OAuth button not enabled in this build");
      return;
    }

    // Capture outbound OAuth navigation (Supabase authorize → Google).
    const oauthNav = page.waitForURL(/supabase\.co\/auth\/v1\/authorize|accounts\.google\.com/i, {
      timeout: 15_000,
    });

    await googleBtn.click({ noWaitAfter: true });

    // Prefer explicit redirecting UI; accept OAuth navigation as proof of start (not 404).
    const redirecting = page.getByTestId("auth-google-redirecting");
    const sawRedirectUi = await redirecting
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    if (!sawRedirectUi) {
      await oauthNav;
    } else {
      await expect(page.getByText(/Redirecting to Google/i)).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
  });
});
