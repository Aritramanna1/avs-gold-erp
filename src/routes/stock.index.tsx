/**
 * Ready Stock — module landing.
 *
 * Renamed from "Stock" to "Ready Stock". Kept visible in navigation but showing
 * a professional Coming Soon placeholder until development begins. The
 * underlying architecture stays ready: the stock store, item/lot/stone/hallmark
 * routes and stock print/import remain intact — only this landing is deferred.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { Package } from "lucide-react";

export const Route = createFileRoute("/stock/")({
  head: () => ({ meta: [{ title: "Ready Stock · AVS Gold ERP" }] }),
  component: ReadyStockComingSoon,
});

function ReadyStockComingSoon() {
  return (
    <ModuleComingSoon
      title="Ready Stock"
      message="The Ready Stock workspace is under active development. Finished-inventory tracking, tagging, and stock movements will land here. The stock data model and printing paths are already in place — this workspace is being built."
      icon={Package}
    />
  );
}
