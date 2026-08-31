import { describe, expect, it, beforeEach } from "vitest";
import { useSettings } from "@/lib/settings-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import {
  hasAssistedSetupCompleted,
  isEstablishedWorkshopTenant,
  shouldRedirectToAssistedSetup,
  markAssistedSetupComplete,
} from "@/lib/identity/onboarding-gate-service";

describe("onboarding-gate-service", () => {
  beforeEach(() => {
    useSettings.setState({
      firm: {
        ...useSettings.getState().firm,
        assisted_setup_completed_at: undefined,
        tenant_migration_status: undefined,
        shopName: "",
      },
      currentUserRole: "owner",
    });
    usePeople.setState({ people: [] });
    useOrders.setState({ orders: [] });
  });

  it("treats assisted_setup_completed_at as done", () => {
    useSettings.getState().setFirm({ assisted_setup_completed_at: "2026-08-30T00:00:00.000Z" });
    expect(hasAssistedSetupCompleted()).toBe(true);
    expect(shouldRedirectToAssistedSetup("/app", "owner")).toBe(false);
  });

  it("treats migration choice as onboarding done", () => {
    useSettings.getState().setFirm({ tenant_migration_status: "SKIPPED" });
    expect(hasAssistedSetupCompleted()).toBe(true);
  });

  it("redirects only brand-new tenants on /app", () => {
    expect(shouldRedirectToAssistedSetup("/app", "owner")).toBe(true);
    expect(shouldRedirectToAssistedSetup("/onboarding", "owner")).toBe(false);
    expect(shouldRedirectToAssistedSetup("/app", "karigar")).toBe(false);
  });

  it("skips redirect when workshop has live data", () => {
    usePeople.setState({
      people: [
        {
          id: "p1",
          name: "Test Party",
          type: "customer",
          branchId: "MAIN",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as never,
      ],
    });
    expect(isEstablishedWorkshopTenant()).toBe(true);
    expect(shouldRedirectToAssistedSetup("/app", "owner")).toBe(false);
  });

  it("markAssistedSetupComplete persists timestamp once", () => {
    markAssistedSetupComplete();
    const ts = useSettings.getState().firm.assisted_setup_completed_at;
    expect(ts).toBeTruthy();
    markAssistedSetupComplete();
    expect(useSettings.getState().firm.assisted_setup_completed_at).toBe(ts);
  });
});
