import { createFileRoute } from "@tanstack/react-router";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/coming-soon/meena-book")({
  head: () => ({ meta: [{ title: "Meena Book · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title="Meena Book (COMING SOON)"
      message="Meena issue, return, custody, and per-purity book workflows are planned for a future manufacturing release."
      icon={BookOpen}
    />
  ),
});
