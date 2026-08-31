import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

/** P0 report routes — print/export selectors must exist for deterministic QA (no Playwright). */
const REPORT_CHAINS: Array<{
  routeFile: string;
  printTestId?: string;
  exportTestId?: string;
}> = [
  {
    routeFile: "src/routes/reports.delivery-summary.tsx",
    printTestId: "report-print-source",
  },
  {
    routeFile: "src/routes/reports.gold-loss.tsx",
    printTestId: "report-print-source",
  },
  {
    routeFile: "src/routes/reports.gst-returns.tsx",
    exportTestId: "report-export-gstr3b",
  },
  {
    routeFile: "src/routes/reports.ledgers.tsx",
    printTestId: "report-print-source",
  },
  {
    routeFile: "src/routes/reports.ledgers-print-all.tsx",
    printTestId: "report-print-source",
  },
  {
    routeFile: "src/routes/reports.tally-export.tsx",
    exportTestId: "report-export-tally-xml",
  },
  {
    routeFile: "src/routes/reports.gold-ledger.tsx",
    printTestId: "report-print-source",
  },
];

describe("report print/export chain selectors", () => {
  for (const chain of REPORT_CHAINS) {
    const label = chain.routeFile.replace("src/routes/", "");
    it(`${label} exposes required test hooks`, () => {
      const path = resolve(ROOT, chain.routeFile);
      expect(existsSync(path), `${chain.routeFile} missing`).toBe(true);
      const src = readFileSync(path, "utf8");
      if (chain.printTestId) {
        expect(src).toContain(`data-testid="${chain.printTestId}"`);
      }
      if (chain.exportTestId) {
        expect(src).toContain(`data-testid="${chain.exportTestId}"`);
      }
    });
  }
});
