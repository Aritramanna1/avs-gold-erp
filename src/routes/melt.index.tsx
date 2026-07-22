import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { FlameKindling } from "lucide-react";

export const Route = createFileRoute("/melt/")({
  head: () => ({ meta: [{ title: "Melt Account · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title="Melt Account (Coming Soon)"
      message="Melt job tracking and metal accounting are being refined and will be available in a future update."
      icon={FlameKindling}
    />
  ),
});
