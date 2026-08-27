import { describe, expect, it } from "vitest";
import { featureRequiredForPath, pathAllowedByEntitlements } from "@/lib/entitlement-route-map";

describe("entitlement-route-map", () => {
  it("maps manufacturing and billing paths", () => {
    expect(featureRequiredForPath("/billing")).toBe("billing");
    expect(featureRequiredForPath("/workshop/gold-book")).toBe("manufacturing");
    expect(featureRequiredForPath("/melt")).toBe("melt_account");
    expect(featureRequiredForPath("/app")).toBeNull();
    expect(featureRequiredForPath("/mtg")).toBeNull();
    expect(featureRequiredForPath("/settings")).toBeNull();
  });

  it("denies deep links when feature off after load", () => {
    const has = (k: string) => k === "billing";
    expect(pathAllowedByEntitlements("/billing", has, true)).toBe(true);
    expect(pathAllowedByEntitlements("/manufacturing", has, true)).toBe(false);
    expect(pathAllowedByEntitlements("/manufacturing", has, false)).toBe(true);
  });

  it("MTG allowlist blocks full-ERP chrome paths", () => {
    const hasAll = () => true;
    expect(pathAllowedByEntitlements("/mtg", hasAll, true, { isMtg: true })).toBe(true);
    expect(pathAllowedByEntitlements("/workshop/gold-book", hasAll, true, { isMtg: true })).toBe(
      true,
    );
    expect(pathAllowedByEntitlements("/catalog", hasAll, true, { isMtg: true })).toBe(false);
    expect(pathAllowedByEntitlements("/barcode", hasAll, true, { isMtg: true })).toBe(false);
    expect(pathAllowedByEntitlements("/branches", hasAll, true, { isMtg: true })).toBe(false);
  });
});
