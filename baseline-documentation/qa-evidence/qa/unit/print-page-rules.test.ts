/**
 * Guards the two ways a printed document can silently lose the paper the user
 * chose: an @page rule appended after the document's own, and the app-shell
 * hiding rules reaching inside the printed document.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { printPageRule } from "@/lib/print-document";
import type { PrinterProfile } from "@/lib/settings-store";

const a5Profile: PrinterProfile = {
  id: "p1",
  name: "Invoice printer",
  type: "laser",
  paperSize: "A5",
  orientation: "portrait",
  margins: { top: 10, right: 12, bottom: 12, left: 12 },
  colorMode: "bw",
  defaultCopies: 1,
  quality: "normal",
  archivalMode: false,
  templateMapping: ["Invoice"],
};

describe("printable document @page rule", () => {
  it("emits nothing when no printer profile applies, leaving the document's own paper intact", () => {
    // `size: auto` discards the paper size entirely, so A5/A6/thermal would all
    // print as whatever the printer defaults to.
    expect(printPageRule(undefined)).toBe("");
  });

  it("emits the profile's paper and margins when one is configured", () => {
    const rule = printPageRule(a5Profile);
    expect(rule).toContain("size: A5");
    expect(rule).toContain("margin: 10mm 12mm 12mm 12mm");
  });

  it("carries orientation into the page size", () => {
    expect(printPageRule({ ...a5Profile, orientation: "landscape" })).toContain(
      "size: A5 landscape",
    );
  });
});

describe("global print stylesheet scoping", () => {
  const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
  const printBlock = css.slice(css.indexOf("@media print"));

  // In the print window the <body> is the document itself, so an unscoped
  // element/role selector hides the document's own content.
  it.each([
    "header",
    "aside",
    "button",
    "input",
    "select",
    '[class*="sidebar"]',
    '[role="button"]',
  ])("scopes %s away from print-layout-root descendants", (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(printBlock).toMatch(
      new RegExp(`${escaped}:not\\(\\[data-testid="print-layout-root"\\] \\*\\)`),
    );

    const unscoped = printBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line === `${selector},` || line === `${selector} {`);
    expect(unscoped).toEqual([]);
  });
});
