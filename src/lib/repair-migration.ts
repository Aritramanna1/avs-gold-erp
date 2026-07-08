import { supabase } from "@/integrations/supabase/client";
import { saveDirect } from "@/lib/supabase-write";
import { useRepairs } from "@/lib/repair-store";
import { useOrders, type Order, type OrderType, type OrderStatus } from "@/lib/orders-store";
import { fineGoldMg } from "@/lib/gold";
import { toast } from "sonner";

export async function migrateLegacyRepairsToOrders() {
  const repairs = useRepairs.getState().repairs;
  if (!repairs || repairs.length === 0) return;

  let migratedCount = 0;
  for (const r of repairs) {
    try {
      // 1. Map status
      let orderStatus: OrderStatus = "confirmed";
      if (r.status === "pending") orderStatus = "confirmed";
      else if (r.status === "in_work") orderStatus = "in_production";
      else if (r.status === "ready") orderStatus = "ready_for_delivery";
      else if (r.status === "delivered") orderStatus = "delivered";
      else if (r.status === "cancelled") orderStatus = "cancelled";

      // 2. Map type
      const orderType: OrderType = r.kind === "polishing" ? "polishing" : "repair";

      // 3. Create the order item
      const purity = r.purity ?? 916;
      const grossMg = r.receivedGrossMg ?? 0;
      const fineMg = fineGoldMg(grossMg, purity);

      const order: Order = {
        id: r.id, // preserve the same ID to prevent double insertion and keep attachments/linked tables working
        orderNo: r.repairNo, // preserve original repair number
        createdAt: r.createdAt ?? Date.now(),
        updatedAt: r.updatedAt ?? Date.now(),
        type: orderType,
        status: orderStatus,
        customerId: r.customerId,
        karigarId: r.workerId || undefined,
        expectedDelivery: r.expectedDelivery || undefined,
        priority: "normal",
        source: "manual",
        design: {
          notes: r.itemDescription || r.itemType || "Legacy Repair Item",
        },
        item: {
          itemName: r.itemType || "Jewellery Item",
          category: "Other",
          quantity: 1,
          metal: "Gold",
          metalColor: "Yellow",
          purity: purity,
          grossMg: grossMg,
          lessMg: 0,
          netMg: grossMg,
          fineMg: fineMg,
          expectedWastagePct: 0,
          expectedWastageMg: 0,
          remarks: r.conditionNotes || r.stoneFittingNotes || undefined,
        },
        advance: {
          cashPaise: r.advancePaise ?? 0,
          cashMode: (r.advanceMode as "cash" | "upi" | "bank" | "card" | undefined) ?? "cash",
          goldGrossMg: 0,
          goldFineMg: 0,
        },
        timeline: r.timeline || [
          { ts: r.createdAt ?? Date.now(), label: "Repair migrated to order" },
        ],
      };

      // 4. Save to orders table
      await saveDirect("orders", order.id, order);

      // 5. Delete from repairs table in Supabase
      await supabase.from("repairs").delete().eq("id", r.id);

      migratedCount++;
    } catch (err) {
      console.error(`[repair-migration] Failed to migrate repair ID ${r.id}:`, err);
    }
  }

  if (migratedCount > 0) {
    toast.success(`Migrated ${migratedCount} repair records to normal orders successfully!`);

    // Clear legacy local repairs store
    useRepairs.setState({ repairs: [] });

    // Refresh orders store so they appear instantly
    await useOrders.getState().refresh();
  }
}
