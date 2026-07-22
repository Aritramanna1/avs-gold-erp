import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { FileText } from "lucide-react";

// RC stabilization (Workshop V1): Estimates / Quotations is deferred to a
// future release, matching billing.estimate.$id.tsx's print route. The
// listing/detail logic below stays in the repo untouched, just unreachable.
export const Route = createFileRoute("/billing/estimates/")({
  head: () => ({ meta: [{ title: "Estimates · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title="Estimates / Quotations (Coming Soon)"
      message="The estimation workflow is being refined and will be available in a future update."
      icon={FileText}
    />
  ),
});
