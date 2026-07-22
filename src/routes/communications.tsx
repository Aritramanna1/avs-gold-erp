import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { guardRoute } from "@/lib/permissions";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";

// RC stabilization (Workshop V1): Communications Hub / CRM is deferred to a
// future release. Nested routes (communications.index.tsx, etc.) stay in the
// repo untouched — this layout returns ModuleComingSoon instead of <Outlet />.
export const Route = createFileRoute("/communications")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Communications · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title="Communications (Coming Soon)"
      message="The Communications Hub / CRM is planned for a future manufacturing release."
      icon={MessageSquare}
    />
  ),
});
