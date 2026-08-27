import { test, expect } from "@playwright/test";

function isLocalOrDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    );
  } catch {
    return true;
  }
}

test.describe("Public QR / verify routes", () => {
  test("local origin detector", () => {
    expect(isLocalOrDevOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrDevOrigin("https://maatarajewellers.shop")).toBe(false);
  });

  test("verify deep-link page accepts payload query without 404", async ({ page }) => {
    await page.goto(
      "/verify?payload=" + encodeURIComponent("AVS|retail_invoice|TEST-001|rec-1|deadbeef"),
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
    await expect(page.getByText(/Verify|Scan|payload|document|Receipt/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("doc token route does not show marketing 404 for missing token", async ({ page }) => {
    await page.goto("/doc/invalid-token-for-qa", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "404" })).not.toBeVisible();
  });
});
