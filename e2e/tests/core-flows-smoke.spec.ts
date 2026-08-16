import { test, expect } from "../fixtures/base";

/**
 * Disposable-account smoke test: create a real invitation using the app's own
 * Settings → Users flow, accept it as a signed-out visitor, sign in, and hit
 * each core module route once. This avoids fake production data and validates
 * the real invite contract end-to-end.
 */
const MODULE_ROUTES = [
  "/",
  "/orders",
  "/workshop",
  "/people",
  "/stock",
  "/billing",
  "/reports",
  "/settings",
];

async function createRealInvite(authedPage: any, email: string) {
  await authedPage.goto("/settings");
  await authedPage.getByRole("tab", { name: /users.*roles|users.*role/i }).click();
  await expect(authedPage.getByRole("button", { name: /send invite/i })).toBeVisible({
    timeout: 30_000,
  });

  await authedPage.getByPlaceholder("e.g. staff@maatarajewellers.com").fill(email);
  const roleSelect = authedPage.locator('div:has(> label:text-is("Assigned Role")) select');
  const firstRole = await roleSelect.locator("option").first().textContent();
  await roleSelect.selectOption(firstRole?.trim() || "Branch Manager");
  await authedPage.getByRole("button", { name: /send invite/i }).click();

  await expect
    .poll(
      async () => authedPage.evaluate(() => (window as any).__lastInviteLink as string | undefined),
      { timeout: 45_000 },
    )
    .toContain("/invite/accept?");

  const inviteLink = await authedPage.evaluate(() => {
    const value = (window as any).__lastInviteLink as string | undefined;
    return value || "";
  });

  expect(inviteLink, "Invite was not generated through the app UI").toContain("/invite/accept?");

  const url = new URL(inviteLink);
  return {
    code: url.searchParams.get("code") || "",
    email: decodeURIComponent(url.searchParams.get("email") || ""),
    url: inviteLink,
  };
}

test.describe("Core module smoke test (signed out -> disposable account)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(120_000);

  test("accept a disposable staff invite, then load every core module route without crashing", async ({
    page,
    authedPage,
  }) => {
    const inviteEmail = `e2e-staff-${Date.now()}@example.com`;
    const invite = await createRealInvite(authedPage, inviteEmail);

    await page.goto(invite.url);
    await expect(page.locator("#invite-name")).toBeVisible({ timeout: 20_000 });
    await page.locator("#invite-name").fill("E2E Staff Test");
    await page.locator("#invite-password").fill("TestPass!2026");
    await page.locator("#invite-confirm-password").fill("TestPass!2026");
    await page.getByRole("button", { name: /activate account/i }).click();
    await expect(page.getByText(/welcome to/i).first()).toBeVisible({ timeout: 25_000 });

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[console] ${m.text()}`);
    });

    const results: Record<string, string> = {};
    for (const route of MODULE_ROUTES) {
      errors.length = 0;
      try {
        await page.goto(route, { timeout: 20_000, waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1_500);
        const bodyText = await page
          .locator("body")
          .innerText()
          .catch(() => "");
        const blank = bodyText.trim().length < 20;
        results[route] = blank
          ? `BLANK (${bodyText.length} chars)`
          : errors.length > 0
            ? `ERRORS: ${errors.slice(0, 3).join(" | ")}`
            : "OK";
      } catch (e) {
        results[route] = `NAV FAILED: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    console.log("MODULE SMOKE RESULTS:\n" + JSON.stringify(results, null, 2));

    const failures = Object.entries(results).filter(([, v]) => v !== "OK");
    expect(failures, `Failing routes: ${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });
});
