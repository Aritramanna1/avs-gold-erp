/**
 * Gold Settlement Voucher Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/billing/gold-settlement-print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Gold Settlement Voucher · ${shopName}` }],
    };
  },
  component: GoldSettlementPrintComponent,
});

function GoldSettlementPrintComponent() {
  const { id } = useParams({ from: "/billing/gold-settlement-print/$id" });

  return <PrintEngine docType="gold_settlement" recordId={id} backUrl="/billing" />;
}
