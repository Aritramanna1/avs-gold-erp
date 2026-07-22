import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Digital Job Card", () => {
  test("job card preview renders from a seeded production order with no console errors", async ({
    authedPage,
    seedIds,
  }) => {
    // A hard page.goto() re-pays the real app's boot-overlay delay (see
    // auth-invitation.spec.ts's note).
    await authedPage.goto(`/workshop/job-card/${seedIds.orderId}`);
    await expect(authedPage.getByRole("heading", { name: "Job Card Preview" })).toBeVisible({
      timeout: 45_000,
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
    await authedPage
      .getByRole("link", { name: "Job Card", exact: true })
      .click({ timeout: 45_000 });
    await expect(authedPage).toHaveURL(/\/workshop\/job-card\/[0-9a-fA-F-]{36}/);
    expectNoPageErrors(authedPage);
  });

  test("Download Job Card PDF produces a real PDF file", async ({ authedPage, seedIds }) => {
    await authedPage.goto(`/workshop/job-card/${seedIds.orderId}`);
    const [download] = await Promise.all([
      authedPage.waitForEvent("download", { timeout: 45_000 }),
      authedPage.getByRole("button", { name: /download job card pdf/i }).click({ timeout: 45_000 }),
    ]);
    // Filenames come from the shared generateDocumentPdf pipeline (branded
    // "<shop>_job_card_<no>.pdf"), not a "JobCard*.pdf" convention.
    expect(download.suggestedFilename()).toMatch(/job_card.*\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    expectNoPageErrors(authedPage);
  });
});
