import { describe, expect, it } from "vitest";
import { dedupedPull, resetPullDedupeForTests } from "@/lib/pull-dedupe";

describe("dedupedPull", () => {
  it("coalesces concurrent pulls for the same key", async () => {
    resetPullDedupeForTests();
    let runs = 0;
    const slow = dedupedPull("orders", async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 20));
    });
    const parallel = dedupedPull("orders", async () => {
      runs += 1;
    });
    await Promise.all([slow, parallel]);
    expect(runs).toBe(1);
  });
});
