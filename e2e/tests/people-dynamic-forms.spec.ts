import { test, expect } from "../fixtures/base";
import { testCustomer } from "../data/test-data";

/**
 * The Dynamic Forms contract for the People module: a custom field created in
 * Settings must appear in the People form, save, survive a restart, be editable,
 * be searchable, and reach the printed record.
 */

test.describe("People — dynamic custom fields", () => {
  test("a field created in Settings flows through People end to end", async ({ authedPage }) => {
    const customer = testCustomer();
    // Unique per run: definitions persist, so a fixed name would collide with
    // leftovers from an earlier run and make the assertions ambiguous.
    const stamp = Date.now().toString().slice(-6);
    const fieldName = `licenseNo${stamp}`;
    const fieldLabel = `Licence No ${stamp}`;
    const formDisplayName = `Workshop Licence ${stamp}`;
    const licenceValue = `LIC-${stamp}`;

    // --- Create the custom field in Settings -------------------------------
    await authedPage.goto("/settings");
    await authedPage.getByRole("tab", { name: /dynamic forms/i }).click();

    await authedPage.getByLabel(/form display name/i).fill(formDisplayName);
    await authedPage.getByPlaceholder(/panNo/i).fill(fieldName);
    await authedPage.getByPlaceholder(/Enter PAN Card/i).fill(fieldLabel);
    await authedPage.getByRole("button", { name: /append field to form layout/i }).click();
    await authedPage.getByRole("button", { name: /register schema/i }).click();

    await expect(authedPage.getByText(formDisplayName).first()).toBeVisible({ timeout: 10_000 });

    // --- It must appear in the People form immediately ----------------------
    await authedPage.goto("/people");
    await authedPage.getByTestId("people-add-button").click();

    const customInput = authedPage.getByTestId(`custom-field-${fieldName}`);
    await expect(customInput).toBeVisible({ timeout: 10_000 });

    await authedPage.getByTestId("people-full-name").fill(customer.fullName);
    await authedPage.getByTestId("people-phone").fill(customer.phone);
    await customInput.fill(licenceValue);
    await authedPage.getByTestId("people-save").click();
    await expect(authedPage.getByTestId("people-full-name")).toBeHidden({ timeout: 10_000 });

    // --- Restart: definition AND value must both survive --------------------
    await authedPage.reload();

    // Searchable: find the person by the custom field's value, not their name.
    await authedPage
      .getByPlaceholder(/search/i)
      .first()
      .fill(licenceValue);
    const row = authedPage.getByRole("tabpanel").getByText(customer.fullName, { exact: true });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await row.first().click();

    // Editable: the saved value is loaded back into the form, and can be changed.
    await authedPage
      .getByTestId("people-selected-card")
      .getByRole("button", { name: /edit/i })
      .click();
    const editInput = authedPage.getByTestId(`custom-field-${fieldName}`);
    await expect(editInput).toHaveValue(licenceValue, { timeout: 10_000 });

    const updatedValue = `${licenceValue}-B`;
    await editInput.fill(updatedValue);
    await authedPage.getByTestId("people-save").click();
    await expect(authedPage.getByTestId("people-full-name")).toBeHidden({ timeout: 10_000 });

    // --- Printable ----------------------------------------------------------
    await authedPage
      .getByPlaceholder(/search/i)
      .first()
      .fill(updatedValue);
    const updatedRow = authedPage
      .getByRole("tabpanel")
      .getByText(customer.fullName, { exact: true });
    await expect(updatedRow).toHaveCount(1, { timeout: 15_000 });
    await updatedRow.first().click();

    await authedPage.getByTestId("people-print").first().click();
    await expect(authedPage.getByText(fieldLabel).first()).toBeVisible({ timeout: 15_000 });
    await expect(authedPage.getByText(updatedValue).first()).toBeVisible({ timeout: 10_000 });
  });
});
