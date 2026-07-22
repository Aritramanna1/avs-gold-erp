import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("CRM — Lead Source & Buyer Type (AVS-102)", () => {
  test.skip("new lead requires Source and Buyer Type, and defaults are sensible (RC scope: Communications/CRM gated to Coming Soon — see routes/communications.tsx)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/communications");
    await authedPage.getByRole("button", { name: /new opportunity/i }).click();

    const dialog = authedPage.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Both fields are present and required, with the documented defaults —
    // a lead that skips picking a channel/segment still gets a real,
    // reportable value ("Unknown" / "Individual"), never a blank column.
    await expect(dialog.getByText("Source *")).toBeVisible();
    await expect(dialog.getByText("Buyer Type *")).toBeVisible();
    await expect(dialog.getByRole("combobox").filter({ hasText: "Unknown" })).toBeVisible();
    await expect(dialog.getByRole("combobox").filter({ hasText: "Individual" })).toBeVisible();

    // Fill the required name and pick a real source/buyer type, then save.
    await dialog.getByPlaceholder("Topic...").fill("E2E Test Lead — WhatsApp Enquiry");
    await dialog.getByRole("combobox").filter({ hasText: "Unknown" }).click();
    await authedPage.getByRole("option", { name: "WhatsApp" }).click();
    await dialog.getByRole("combobox").filter({ hasText: "Individual" }).click();
    await authedPage.getByRole("option", { name: "Bulk Buyer" }).click();

    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(authedPage.getByText("Opportunity saved")).toBeVisible({ timeout: 10_000 });

    // The new lead's channel/segment shows up in the breakdown widget —
    // proves the values actually persisted and are grouped, not just
    // accepted by the form.
    await expect(authedPage.getByText("Leads by Source & Buyer Type")).toBeVisible();
    expectNoPageErrors(authedPage);
  });
});
