import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Manufacturing Bills", () => {
  test("manufacturing module loads with production lifecycle view", async ({ authedPage }) => {
    await authedPage.goto("/manufacturing");
    // getByText("Manufacturing", {exact:true}) is ambiguous — it also matches
    // the sidebar nav link, not just the page heading (strict-mode violation).
    await expect(authedPage.getByRole("heading", { name: "Manufacturing" })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("gold-first Manufacturing Bill creation shows Gold Position before Charges, computes Total Manufacturing Cost, and finalises", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/manufacturing/bill/new/${seedIds.jobId}`);
    await expect(authedPage.getByText("Gold Position — Primary Accounting Unit")).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);

    // Gold-first display order: the Gold Position bar's bounding position in
    // the DOM must come before the Charges card's.
    const goldBarY = await authedPage
      .getByText("Gold Position — Primary Accounting Unit")
      .evaluate((el) => el.getBoundingClientRect().top);
    const chargesY = await authedPage
      .getByRole("heading", { name: "Charges" })
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(goldBarY).toBeLessThan(chargesY);

    // Fill an Other Charge and confirm Total Manufacturing Cost picks it up
    // (proves calcNetMfgCost is actually wired into the live UI, not just a
    // static display).
    await authedPage.getByTestId("mfg-bill-other-charges-input").fill("500");
    await expect(authedPage.getByText("Total Manufacturing Cost:").locator("..")).toContainText(
      "500",
      { timeout: 5_000 },
    );

    await authedPage.getByRole("button", { name: "Finalise Bill" }).click();
    await authedPage.getByRole("button", { name: "Finalise Now" }).click();
    await expect(
      authedPage.getByText(/finalised successfully|Manufacturing Bill finalised/i).first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    expectNoPageErrors(authedPage);
  });
});
