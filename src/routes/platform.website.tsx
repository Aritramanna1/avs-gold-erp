import { createFileRoute } from "@tanstack/react-router";
import { PlatformWebsiteManager } from "@/components/platform/PlatformWebsiteManager";
import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/platform/website")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  component: PlatformWebsitePage,
});

function PlatformWebsitePage() {
  return (
    <div className="p-6">
      <PlatformWebsiteManager />
    </div>
  );
}
