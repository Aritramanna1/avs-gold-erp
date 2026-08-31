/**
 * Canonical Route: /control/print-profiles
 * Universal Document Engine & Millimeter-Calibrated Print Profiles
 * Master Reference: docs/MASTER/DOCUMENT_TEMPLATE_ENGINE.md & PRINT_PROFILE_MASTER.md
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PrintProfileDesigner } from "@/components/customization/PrintProfileDesigner";

export const Route = createFileRoute("/control/print-profiles")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Print Profiles & Templates · Ornexa ERP" }] }),
  component: ControlPrintProfilesPage,
});

function ControlPrintProfilesPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Physical Print Profiles & Hardware Calibration"
          subtitle="Millimeter-calibrated margins, scale percentages, paper sizes, and document routing."
        />
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/control/customization">
            <ArrowLeft className="h-4 w-4" /> Back to Customization Hub
          </Link>
        </Button>
      </div>

      <PrintProfileDesigner />
    </div>
  );
}
