import { describe, expect, it, beforeEach } from "vitest";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { useAppLoading } from "@/lib/app-loading-store";
import { tryBuildDashboardBucketsFromStores } from "@/lib/home-dashboard-query";

describe("home-dashboard-query store buckets", () => {
  beforeEach(() => {
    useAppLoading.setState({
      criticalLoadDone: true,
      initialLoadDone: true,
      criticalLoadFailed: false,
      criticalLoadError: null,
      bootAttempt: 0,
    });
    useOrders.setState({ orders: [] });
    useJobCards.setState({ jobs: [] });
    usePeople.setState({ people: [] });
  });

  it("returns null before initial load completes", () => {
    useAppLoading.setState({ initialLoadDone: false });
    useOrders.setState({
      orders: [
        {
          id: "o1",
          orderNo: "ORD-1",
          status: "confirmed",
          type: "custom",
          customerId: "c1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          priority: "normal",
          source: "walk_in",
          design: {},
          items: [],
          item: { itemName: "Ring" },
        } as never,
      ],
    });
    expect(tryBuildDashboardBucketsFromStores()).toBeNull();
  });

  it("builds buckets from hydrated stores without network", () => {
    useOrders.setState({
      orders: [
        {
          id: "o1",
          orderNo: "ORD-1",
          status: "confirmed",
          type: "custom",
          customerId: "c1",
          expectedDelivery: (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          priority: "normal",
          source: "walk_in",
          design: {},
          items: [],
          item: { itemName: "Ring" },
        } as never,
      ],
    });
    usePeople.setState({
      people: [
        {
          id: "c1",
          fullName: "Test Customer",
          phone: "9999999999",
          type: "customer",
          branchId: "MAIN",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as never,
      ],
    });
    const result = tryBuildDashboardBucketsFromStores();
    expect(result).not.toBeNull();
    expect(result!.buckets.today.length).toBe(1);
    expect(result!.people[0]?.fullName).toBe("Test Customer");
  });
});
