import type { Page, ConsoleMessage } from "@playwright/test";

/**
 * Attaches console/pageerror listeners and returns a getter for accumulated
 * errors so tests can assert "no console errors / no uncaught exceptions"
 * without missing anything that happened before the assertion runs.
 */
export function collectPageErrors(page: Page) {
  const errors: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore noisy, non-actionable browser/extension warnings unrelated to app code.
      if (/ResizeObserver loop|Extension context invalidated/i.test(text)) return;
      errors.push(`console.error: ${text}`);
    }
  };
  const onPageError = (err: Error) => {
    errors.push(`uncaught exception: ${err.message}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  return {
    errors,
    dispose: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}
