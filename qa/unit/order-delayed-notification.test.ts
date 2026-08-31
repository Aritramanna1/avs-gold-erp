import { describe, it, expect, beforeEach, vi } from "vitest";
import { isOrderDelayed, sendOrderDelayNotification, checkAndNotifyDelayedOrders } from "@/lib/comm/order-delay-monitor";
import { renderEmailTemplate } from "@/lib/comm/email-templates";
import { clearAutomaticCommDedupeCache } from "@/lib/comm/automatic-communication-engine";
import { useOrders, type Order } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useEmailConfigStore } from "@/lib/comm/email-config-store";

// Mock email service transport
vi.mock("@/lib/email-service", () => ({
  sendGenericEmail: vi.fn().mockImplementation(async () => {
    return {
      success: true,
      emailId: `mock_eml_${Date.now()}`,
    };
  }),
}));

describe("Order Delay Apology Email System", () => {
  const dummyOrder: Order = {
    id: "ord-test-delay-1",
    orderNo: "ORD-2026-099",
    createdAt: Date.now() - 7 * 86400000,
    updatedAt: Date.now(),
    type: "custom",
    status: "in_production",
    customerId: "cust-1",
    expectedDelivery: "2026-08-20", // Past date
    priority: "high",
    source: "walk_in",
    design: {},
    items: [
      {
        itemName: "22K Bridal Gold Necklace",
        category: "necklace",
        quantity: 1,
        metal: "gold",
        metalColor: "yellow",
        purity: 916,
        grossMg: 45000,
        lessMg: 0,
        netMg: 45000,
        fineMg: 41220,
        expectedWastagePct: 35,
        expectedWastageMg: 1575,
      },
    ],
    item: {
      itemName: "22K Bridal Gold Necklace",
      category: "necklace",
      quantity: 1,
      metal: "gold",
      metalColor: "yellow",
      purity: 916,
      grossMg: 45000,
      lessMg: 0,
      netMg: 45000,
      fineMg: 41220,
      expectedWastagePct: 35,
      expectedWastageMg: 1575,
    },
    advance: {
      cashPaise: 5000000,
      goldGrossMg: 0,
      goldFineMg: 0,
    },
    timeline: [],
  };

  beforeEach(() => {
    clearAutomaticCommDedupeCache();
    useOrders.setState({
      orders: [{ ...dummyOrder, timeline: [] }],
    });
    usePeople.setState({
      people: [
        {
          id: "cust-1",
          fullName: "Priya Sharma",
          email: "priya@example.com",
          phone: "+919876543210",
          type: "customer",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });
    useEmailConfigStore.setState({
      autoEmailEnabled: true,
      eventToggles: {
        ...useEmailConfigStore.getState().eventToggles,
        order_delayed: true,
      },
    });
  });

  it("identifies delayed orders correctly based on expected delivery date and status", () => {
    // Past date & active status -> delayed
    expect(isOrderDelayed(dummyOrder, "2026-08-31")).toBe(true);

    // Future date -> not delayed
    const futureOrder = { ...dummyOrder, expectedDelivery: "2026-09-15" };
    expect(isOrderDelayed(futureOrder, "2026-08-31")).toBe(false);

    // Past date but delivered -> not delayed
    const deliveredOrder = { ...dummyOrder, status: "delivered" as const };
    expect(isOrderDelayed(deliveredOrder, "2026-08-31")).toBe(false);

    // Past date but cancelled -> not delayed
    const cancelledOrder = { ...dummyOrder, status: "cancelled" as const };
    expect(isOrderDelayed(cancelledOrder, "2026-08-31")).toBe(false);

    // No expected delivery set -> not delayed
    const noDateOrder = { ...dummyOrder, expectedDelivery: undefined };
    expect(isOrderDelayed(noDateOrder, "2026-08-31")).toBe(false);
  });

  it("renders apology email template with exact required wording and variable substitutions", () => {
    const rendered = renderEmailTemplate("order_delayed", {
      recipientName: "Priya Sharma",
      recipientEmail: "priya@example.com",
      firmName: "Maa Tara Jewellers",
      productName: "AVS ERP",
      documentNumber: "ORD-2026-099",
      revisedDate: "2026-09-05",
      reasonText: "Final gold filigree setting underway",
      actionUrl: "https://maatarajewellers.shop/portal/order/ORD-2026-099",
    });

    expect(rendered.subject).toContain("Order ORD-2026-099 Delayed");
    expect(rendered.html).toContain("We are deeply sorry that your order has been delayed");
    expect(rendered.html).toContain("deliver your order to you as soon as possible");
    expect(rendered.html).toContain("2026-09-05");
    expect(rendered.html).toContain("Final gold filigree setting underway");
    expect(rendered.html).toContain("Priya Sharma");
    expect(rendered.html).toContain("Maa Tara Jewellers");
    expect(rendered.text).toContain("We are sorry that your order ORD-2026-099 is delayed");
  });

  it("sendOrderDelayNotification updates order timeline upon dispatch", async () => {
    const result = await sendOrderDelayNotification(dummyOrder, {
      revisedDate: "2026-09-05",
      reasonText: "Expediting handcrafting",
    });

    expect(result.ok).toBe(true);

    const updatedOrder = useOrders.getState().orders.find((o) => o.id === dummyOrder.id);
    expect(updatedOrder?.timeline.length).toBeGreaterThan(0);
    expect(updatedOrder?.timeline[0].label).toBe("Delay Apology Email Sent");
    expect(updatedOrder?.timeline[0].note).toContain("Original Due: 2026-08-20");
    expect(updatedOrder?.timeline[0].note).toContain("Revised: 2026-09-05");
  });

  it("checkAndNotifyDelayedOrders sweeps orders and avoids double-notifying", async () => {
    const sweep1 = await checkAndNotifyDelayedOrders();
    expect(sweep1.delayedCount).toBe(1);
    expect(sweep1.notifiedCount).toBe(1);

    // Second sweep should detect already-notified timeline entry and skip
    const sweep2 = await checkAndNotifyDelayedOrders();
    expect(sweep2.delayedCount).toBe(1);
    expect(sweep2.notifiedCount).toBe(0);
  });
});
