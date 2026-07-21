/**
 * Manufacturing — module landing.
 *
 * The module is kept visible in navigation but shows a professional Coming Soon
 * placeholder until development begins. The underlying architecture stays ready:
 * the manufacturing-bill store (`@/lib/manufacturing-bill-store`) and the bill
 * routes (`manufacturing.bill.$id`, `manufacturing.bill.new.$jobId`) are intact
 * and still reachable from Billing / Job Cards — only this dashboard is deferred.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { Hammer } from "lucide-react";

export const Route = createFileRoute("/manufacturing/")({
  head: () => ({ meta: [{ title: "Manufacturing · AVS Gold ERP" }] }),
  component: ManufacturingComingSoon,
});

function ManufacturingComingSoon() {
  return (
    <ModuleComingSoon
      title="Manufacturing"
      message="The Manufacturing workspace is under active development. Job-card intake, work-in-progress tracking, and manufacturing bills will land here. The data model and billing flow are already in place — this dashboard is being built."
      icon={Hammer}
    />
  );
}
