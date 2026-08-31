import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_DOCUMENT_HOSTING_DAYS,
  MIN_DOCUMENT_HOSTING_DAYS,
  MAX_DOCUMENT_HOSTING_DAYS,
  canUseDocumentHosting,
} from "../../src/lib/document-shares";
import { useSubscriptionAccess } from "../../src/lib/identity/subscription-access-service";

describe("document hosting retention constants", () => {
  it("default retention is at least one year", () => {
    expect(DEFAULT_DOCUMENT_HOSTING_DAYS).toBeGreaterThanOrEqual(365);
  });

  it("max retention allows multi-year plans", () => {
    expect(MAX_DOCUMENT_HOSTING_DAYS).toBeGreaterThan(DEFAULT_DOCUMENT_HOSTING_DAYS);
  });

  it("min retention is positive", () => {
    expect(MIN_DOCUMENT_HOSTING_DAYS).toBeGreaterThan(0);
  });
});

describe("document hosting entitlements", () => {
  beforeEach(() => {
    useSubscriptionAccess.setState({
      status: "ACTIVE",
      features: {},
    } as ReturnType<typeof useSubscriptionAccess.getState>);
  });

  it("allows hosting when features not yet provisioned (backward compat)", () => {
    expect(canUseDocumentHosting()).toBe(true);
  });

  it("allows hosting for platform owner", () => {
    useSubscriptionAccess.setState({
      status: "PLATFORM_OWNER",
      features: { document_hosting: false },
    } as ReturnType<typeof useSubscriptionAccess.getState>);
    expect(canUseDocumentHosting()).toBe(true);
  });

  it("denies hosting when plan explicitly lacks feature", () => {
    useSubscriptionAccess.setState({
      status: "ACTIVE",
      features: { document_hosting: false, business_core: true },
    } as ReturnType<typeof useSubscriptionAccess.getState>);
    expect(canUseDocumentHosting()).toBe(false);
  });

  it("allows hosting when plan includes document_hosting", () => {
    useSubscriptionAccess.setState({
      status: "ACTIVE",
      features: { document_hosting: true },
    } as ReturnType<typeof useSubscriptionAccess.getState>);
    expect(canUseDocumentHosting()).toBe(true);
  });
});
