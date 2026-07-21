/**
 * Reports — module landing.
 *
 * Kept visible in navigation but showing a professional Coming Soon placeholder
 * until the reporting engine is developed. The individual report routes
 * (`reports.*`) and the shared export engine remain intact — only this landing
 * hub is deferred.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "Reports · AVS Gold ERP" }] }),
  component: ReportsComingSoon,
});

function ReportsComingSoon() {
  return (
    <ModuleComingSoon
      title="Reports"
      message="The Reporting engine is under active development. Consolidated analytics, gold-position reports, and business summaries will land here. The export engine and individual report pages are already in place — this hub is being built."
      icon={BarChart3}
    />
  );
}
