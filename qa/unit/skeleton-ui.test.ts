import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const SKELETON_FILES = [
  "src/components/module-skeleton.tsx",
  "src/components/app-boot-skeleton.tsx",
  "src/components/dashboard/HomeDashboardSkeleton.tsx",
  "src/components/staged-load-panel.tsx",
];

describe("Phase 8b skeleton UI tokens", () => {
  for (const rel of SKELETON_FILES) {
    it(`${rel} uses AVS design tokens`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      const hasPanelToken =
        src.includes("ornexa-panel") ||
        src.includes("erp-surface") ||
        src.includes("border-gold");
      expect(hasPanelToken).toBe(true);
      expect(src).not.toContain("w-64 shrink-0"); // obsolete desktop sidebar rail
    });
  }

  it("app boot skeleton matches header shell (h-14 not h-16 sidebar layout)", () => {
    const src = readFileSync(resolve(ROOT, "src/components/app-boot-skeleton.tsx"), "utf8");
    expect(src).toContain("h-14");
    expect(src).not.toContain("w-64");
  });
});
