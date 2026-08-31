import { test, expect, expectNoPageErrors } from "../fixtures/base";
import { testWorker } from "../data/test-data";

test.describe("Workers (People module — CRUD + duplicate prevention)", () => {
  test("create, view, edit and delete a karigar without duplicate rows", async ({ authedPage }) => {
    const worker = testWorker();
    await authedPage.goto("/people");
    await expect(authedPage.locator("h1")).toBeVisible();

    // ── Create ──────────────────────────────────────────────────────────
    await authedPage.getByTestId("people-add-karigar").click();
    await authedPage.getByTestId("people-full-name").fill(worker.fullName);
    await authedPage.getByTestId("people-phone").fill(worker.phone);
    await authedPage.getByTestId("people-work-role").fill(worker.workType);

    const saveBtn = authedPage.getByTestId("people-save");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // ── Duplicate-submit prevention: the dialog closes and the button
    // cannot be double-clicked into creating two records — verify only one
    // *list row* with this exact name exists afterwards. Scoped to the tab
    // panel (not the whole page) since a newly created/selected record's
    // name is also echoed in the detail sidebar next to the list.
    await expect(authedPage.getByTestId("people-full-name")).toBeHidden({ timeout: 10_000 });

    const karigarTab = authedPage.getByRole("tab", { name: /karigar/i });
    if (await karigarTab.isVisible().catch(() => false)) {
      await karigarTab.click();
    }
    await authedPage
      .getByPlaceholder(/search/i)
      .first()
      .fill(worker.fullName);
    const rows = authedPage.getByRole("tabpanel").getByText(worker.fullName, { exact: true });
    await expect(rows).toHaveCount(1, { timeout: 10_000 });

    // ── Edit ────────────────────────────────────────────────────────────
    await rows.first().click();
    await expect(authedPage.getByTestId("people-selected-card")).toBeVisible();
    await authedPage
      .getByTestId("people-selected-card")
      .getByRole("button", { name: /edit/i })
      .click();
    const updatedName = `${worker.fullName} Updated`;
    await authedPage.getByTestId("people-full-name").fill(updatedName);
    await authedPage.getByTestId("people-save").click();
    await expect(authedPage.getByText(updatedName).first()).toBeVisible({ timeout: 10_000 });

    // ── Delete ──────────────────────────────────────────────────────────
    authedPage.once("dialog", (d) => d.accept());
    await authedPage.getByTestId("people-delete").first().click();
    await expect(authedPage.getByText(updatedName)).toHaveCount(0, { timeout: 10_000 });

    expectNoPageErrors(authedPage);
  });

  test("rapid double-click on Save never creates two records for the same worker", async ({
    authedPage,
  }) => {
    const worker = testWorker();
    await authedPage.goto("/people");
    await authedPage.getByTestId("people-add-karigar").click();
    await authedPage.getByTestId("people-full-name").fill(worker.fullName);
    await authedPage.getByTestId("people-phone").fill(worker.phone);
    await authedPage.getByTestId("people-work-role").fill(worker.workType);

    // Simulate an impatient double-click: click Save, then immediately try
    // clicking it again. The second click is expected to either hit a
    // disabled button or find the dialog already closed — both are fine;
    // what matters is that it never results in a second record being saved.
    const saveBtn = authedPage.getByTestId("people-save");
    await saveBtn.click();
    await saveBtn.click({ timeout: 2_000 }).catch(() => {});

    const karigarTab = authedPage.getByRole("tab", { name: /karigar/i });
    if (await karigarTab.isVisible().catch(() => false)) {
      await karigarTab.click();
    }
    await authedPage
      .getByPlaceholder(/search/i)
      .first()
      .fill(worker.fullName);
    await expect(
      authedPage.getByRole("tabpanel").getByText(worker.fullName, { exact: true }),
    ).toHaveCount(1, { timeout: 10_000 });
  });
});
