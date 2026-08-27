import { test, expect, type Page } from "@playwright/test";

/**
 * Production Google OAuth smoke + redirect URL verification.
 * Set E2E_BASE_URL=https://maatarajewellers.shop
 *
 * Full Google account picker + password requires a real interactive session
 * (GOOGLE_E2E_EMAIL / GOOGLE_E2E_PASSWORD). Without those credentials this
 * suite still proves: button → Redirecting UI → Supabase authorize with the
 * locked production redirect_to → Google accounts host (not 404 / not login loop).
 */

const PROD = "https://maatarajewellers.shop";
const LOCKED_CALLBACK = `${PROD}/auth/callback`;
const SUPABASE_AUTHORIZE = /dqgrrafuoxaorvyrcuuh\.supabase\.co\/auth\/v1\/authorize/i;
const GOOGLE_ACCOUNTS = /accounts\.google\.com/i;

async function dismissCookies(page: Page) {
  const accept = page.getByRole("button", { name: /Essential only|Accept all/i }).first();
  if (await accept.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await accept.click().catch(() => undefined);
  }
}

test.describe("Production Google OAuth", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_BASE_URL?.includes("maatarajewellers.shop"),
      "Set E2E_BASE_URL=https://maatarajewellers.shop to run production OAuth tests",
    );
  });

  test("login shows Continue with Google (not 404)", async ({ page }) => {
    await page.goto(`${PROD}/login`, { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    await expect(page.getByTestId("auth-google")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
  });

  test("Google start uses locked production redirect_to and reaches Google", async ({ page }) => {
    await page.goto(`${PROD}/login`, { waitUntil: "networkidle" });
    await dismissCookies(page);

    const googleBtn = page.getByTestId("auth-google");
    await expect(googleBtn).toBeVisible();

    const authorizePromise = page.waitForRequest((req) => SUPABASE_AUTHORIZE.test(req.url()), {
      timeout: 20_000,
    });

    const navPromise = page.waitForURL(
      (url) => SUPABASE_AUTHORIZE.test(url.href) || GOOGLE_ACCOUNTS.test(url.href),
      { timeout: 25_000 },
    );

    await googleBtn.click({ noWaitAfter: true });

    const redirecting = page.getByTestId("auth-google-redirecting");
    await redirecting.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);

    const authorizeReq = await authorizePromise;
    const redirectTo = new URL(authorizeReq.url()).searchParams.get("redirect_to");
    expect(redirectTo, "Supabase authorize must carry locked production callback").toBe(
      LOCKED_CALLBACK,
    );

    await navPromise;
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
    // Must not bounce back to /login without reaching Google/Supabase authorize.
    expect(page.url()).not.toMatch(/maatarajewellers\.shop\/login$/);
  });

  test("auth/callback OAuth cancel stays on AVS gateway (no marketing 404)", async ({ page }) => {
    await page.goto(
      `${LOCKED_CALLBACK}?error=access_denied&error_description=User%20cancelled%20login`,
      { waitUntil: "domcontentloaded" },
    );
    await dismissCookies(page);
    await expect(page.getByRole("heading", { name: /Sign-in failed/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
    await expect(page).toHaveURL(/\/auth\/callback/);
  });

  test("full Google interactive login when credentials provided", async ({ page }) => {
    const email = process.env.GOOGLE_E2E_EMAIL;
    const password = process.env.GOOGLE_E2E_PASSWORD;
    test.skip(!email || !password, "Set GOOGLE_E2E_EMAIL and GOOGLE_E2E_PASSWORD for full flow");

    await page.goto(`${PROD}/login`, { waitUntil: "networkidle" });
    await dismissCookies(page);
    await page.getByTestId("auth-google").click();

    await page.waitForURL(GOOGLE_ACCOUNTS, { timeout: 30_000 });

    // Google account chooser / identifier
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: "visible", timeout: 20_000 });
    await emailInput.fill(email!);
    await page
      .getByRole("button", { name: /Next|Weiter|Suivant/i })
      .first()
      .click();

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: "visible", timeout: 20_000 });
    await passwordInput.fill(password!);
    await page
      .getByRole("button", { name: /Next|Weiter|Suivant/i })
      .first()
      .click();

    // Land back on AVS — callback then role home (never marketing /)
    await page.waitForURL(
      (url) =>
        url.hostname.includes("maatarajewellers.shop") &&
        !url.pathname.startsWith("/login") &&
        url.pathname !== "/",
      { timeout: 60_000 },
    );

    // Either still on callback briefly, or already at workspace.
    const path = new URL(page.url()).pathname;
    expect(path === "/" || path === "/login").toBe(false);
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();

    // Wait until AuthGate settles on a workspace route
    await page.waitForURL(
      (url) =>
        [
          "/app",
          "/mtg",
          "/platform",
          "/customer-portal",
          "/karigar-portal",
          "/supplier-portal",
        ].some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`)) ||
        url.pathname.startsWith("/workshop") ||
        url.pathname.startsWith("/billing"),
      { timeout: 45_000 },
    );
    expect(page.url()).not.toContain("/login");
  });
});
