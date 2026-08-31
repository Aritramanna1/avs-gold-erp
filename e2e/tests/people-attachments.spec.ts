import { test, expect } from "../fixtures/base";
import { testCustomer } from "../data/test-data";

/**
 * Regression guard for the "uploaded photos disappear after restart" bug.
 *
 * The bug was not in the write — bytes always landed locally. It was that the
 * only reader (data-loader's pullAttachments) queried Supabase and nothing else,
 * so any boot without a live cloud session rehydrated an EMPTY attachments store
 * and every photo/KYC doc looked deleted.
 *
 * A full page reload is the faithful stand-in for closing and reopening the app:
 * it throws away all in-memory Zustand state and forces a cold rehydrate from
 * the local database, which is exactly the code path that was broken.
 */

// A real 1x1 PNG — the vault hashes and encrypts actual bytes, so a fake
// buffer would not exercise the store the way a genuine upload does.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("People — attachment persistence", () => {
  test("uploaded photo survives an app restart", async ({ authedPage }) => {
    const customer = testCustomer();

    await authedPage.goto("/people");
    await authedPage.getByTestId("people-add-button").click();
    await authedPage.getByTestId("people-full-name").fill(customer.fullName);
    await authedPage.getByTestId("people-phone").fill(customer.phone);
    await authedPage.getByTestId("people-save").click();
    await expect(authedPage.getByTestId("people-full-name")).toBeHidden({ timeout: 10_000 });

    // Select the record we just made.
    await authedPage
      .getByPlaceholder(/search/i)
      .first()
      .fill(customer.fullName);
    const row = authedPage.getByRole("tabpanel").getByText(customer.fullName, { exact: true });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.first().click();

    // Upload → Save. KYC slots live behind the Photos / Files dialog.
    await authedPage.getByTestId("people-photos-files").first().click();
    await authedPage.getByTestId("attachment-btn-photo").first().click();
    await authedPage.getByTestId("attachment-file-input").setInputFiles({
      name: "worker-photo.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(authedPage.getByTestId("attachment-preview")).toBeVisible({ timeout: 10_000 });
    await authedPage.getByTestId("attachment-save").click();
    await expect(authedPage.getByTestId("attachment-save")).toBeHidden({ timeout: 15_000 });

    // Close App → Reopen. Fresh JS context: the attachments store starts empty
    // and MUST be rebuilt from the local DB, not from memory and not from cloud.
    await authedPage.reload();

    // Open Record → image still present.
    await authedPage
      .getByPlaceholder(/search/i)
      .first()
      .fill(customer.fullName);
    const rowAfter = authedPage.getByRole("tabpanel").getByText(customer.fullName, { exact: true });
    await expect(rowAfter).toHaveCount(1, { timeout: 10_000 });
    await rowAfter.first().click();

    // The avatar renders only when the bytes were read back out of the vault.
    const avatar = authedPage.getByTestId("person-avatar-img").first();
    await expect(avatar).toBeVisible({ timeout: 15_000 });

    // ...and it must be a real decoded image, not a broken <img> that happens to
    // be in the DOM — a stale/dangling reference would still "be visible".
    await expect
      .poll(
        () =>
          avatar.evaluate(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    // Proves the bytes came off the LOCAL disk and not the cloud. Only the
    // encrypted vault serves an attachment as an object URL — a Supabase-served
    // file would be an https: signed URL, and the old in-row base64 a data: URL.
    // Without this the test would still pass by silently re-fetching from cloud,
    // which is the exact failure mode being fixed.
    await expect
      .poll(() => avatar.evaluate((el) => (el as HTMLImageElement).src.slice(0, 5)), {
        timeout: 15_000,
      })
      .toBe("blob:");

    // The doc slot itself must still read as Filed after the restart.
    await authedPage.getByTestId("people-photos-files").first().click();
    await expect(authedPage.getByTestId("attachment-btn-photo").first()).toContainText(/filed/i, {
      timeout: 10_000,
    });
  });
});
