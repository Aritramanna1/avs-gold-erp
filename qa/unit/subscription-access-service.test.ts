import { describe, expect, it } from "vitest";
import {
  isSubscriptionAccessGranted,
  type SubscriptionAccessSnapshot,
} from "@/lib/identity/subscription-access-service";

function snap(partial: Partial<SubscriptionAccessSnapshot>): SubscriptionAccessSnapshot {
  return {
    access: "denied",
    status: "EXPIRED",
    valid: false,
    message: null,
    organizationId: null,
    productId: "ORNEXA",
    trialEndsAt: null,
    expiry: null,
    daysRemaining: null,
    edition: null,
    planCode: null,
    planName: null,
    features: {},
    limits: {},
    lastCheckedAt: null,
    ...partial,
  };
}

describe("isSubscriptionAccessGranted", () => {
  it("grants active subscription", () => {
    expect(isSubscriptionAccessGranted(snap({ access: "granted", status: "ACTIVE", valid: true }))).toBe(
      true,
    );
  });

  it("grants trial subscription", () => {
    expect(
      isSubscriptionAccessGranted(snap({ access: "granted", status: "TRIAL_ACTIVE", valid: true })),
    ).toBe(true);
  });

  it("grants limited access tier", () => {
    expect(
      isSubscriptionAccessGranted(snap({ access: "granted_limited", status: "GRACE_PERIOD", valid: false })),
    ).toBe(true);
  });

  it("grants platform owner bypass", () => {
    expect(
      isSubscriptionAccessGranted(snap({ access: "denied", status: "PLATFORM_OWNER", valid: false })),
    ).toBe(true);
  });

  it("denies subscription_required", () => {
    expect(
      isSubscriptionAccessGranted(
        snap({ access: "subscription_required", status: "NO_SUBSCRIPTION", valid: false }),
      ),
    ).toBe(false);
  });

  it("denies expired without valid flag", () => {
    expect(isSubscriptionAccessGranted(snap({ access: "denied", status: "EXPIRED", valid: false }))).toBe(
      false,
    );
  });
});

describe("production throttle constants (source guard)", () => {
  it("does not reintroduce aggressive 10/400 production blanket throttle", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve("src/lib/supabase-fetch-throttle.ts"),
      "utf8",
    );
    expect(src).toMatch(/MAX_REQUESTS_PER_WINDOW = relaxedEgress \? 80 : 10/);
    expect(src).toMatch(/MIN_REQUEST_GAP_MS = relaxedEgress \? 0 : 400/);
    expect(src).toContain("devLiveSupabaseEnabled");
    expect(src).not.toMatch(/MAX_REQUESTS_PER_WINDOW = import\.meta\.env\.PROD \? 10/);
    expect(src).not.toMatch(/MIN_REQUEST_GAP_MS = import\.meta\.env\.PROD \? 400/);
  });
});

describe("pullCritical timeout (source guard)", () => {
  it("uses staged-load 45s budget not 28s", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(path.resolve("src/lib/data-loader.ts"), "utf8");
    expect(src).toContain("STAGED_LOAD_THRESHOLDS_MS.fail");
    expect(src).not.toMatch(/CRITICAL_PULL_TIMEOUT_MS = 28_000/);
  });
});
