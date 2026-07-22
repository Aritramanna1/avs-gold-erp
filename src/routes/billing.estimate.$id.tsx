import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/billing/estimate/$id")({
  head: () => ({ meta: [{ title: "Estimate · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title="Estimate (COMING SOON)"
      message="The estimation workflow is being refined and will be available in a future update."
      icon={FileText}
    />
  ),
});
