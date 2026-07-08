import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Digital Job Card", () => {
  test("job card preview renders from a seeded production order with no console errors", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/workshop/job-card/${seedIds.orderId}`);
    await expect(authedPage.getByRole("heading", { name: "Job Card Preview" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("JOB CARD", { exact: true })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: /download job card pdf/i })).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Job Card button on the order page navigates to the preview", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/orders/${seedIds.orderId}`);
    await authedPage.getByRole("link", { name: "Job Card", exact: true }).click();
    await expect(authedPage).toHaveURL(new RegExp(`/workshop/job-card/${seedIds.orderId}`));
    expectNoPageErrors(authedPage);
  });

  test("Download Job Card PDF produces a real PDF file", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/workshop/job-card/${seedIds.orderId}`);
    const [download] = await Promise.all([
      authedPage.waitForEvent("download"),
      authedPage.getByRole("button", { name: /download job card pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/JobCard.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });
});
