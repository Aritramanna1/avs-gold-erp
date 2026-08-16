import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_PLATFORM_SEARCH } from "@/lib/platform-search";
import { guardRoute } from "@/lib/permissions";
import { CommercialPricingPanel } from "@/components/platform/CommercialPricingPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/platform/commercial-pricing")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Commercial Pricing · Platform Owner" }] }),
  component: PlatformCommercialPricingPage,
});

function PlatformCommercialPricingPage() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/platform" search={DEFAULT_PLATFORM_SEARCH}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Platform Console
        </Link>
      </Button>
      <CommercialPricingPanel />
    </div>
  );
}
