import { DEFAULT_PLATFORM_SEARCH } from "@/lib/platform-search";
import { createFileRoute, Link } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { MetaControlCentre } from "@/components/platform/MetaControlCentre";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/platform/meta-whatsapp")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Meta / WhatsApp Control · Platform Owner" }] }),
  component: PlatformMetaWhatsAppPage,
});

function PlatformMetaWhatsAppPage() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/platform" search={DEFAULT_PLATFORM_SEARCH}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Platform Console
        </Link>
      </Button>
      <MetaControlCentre />
    </div>
  );
}
