import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/solutions/portals")({
  component: PortalsMarketingPage,
});

function PortalsMarketingPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-14 space-y-8">
        <h1 className="font-serif text-4xl">Supplier &amp; karigar portals</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          When licensed, customer, karigar, and supplier portals use the same Supabase Auth and RLS
          tenant boundary as the firm ERP. Portal users see only their firm&apos;s allowed rows —
          isolation is enforced server-side, not by hiding menu items.
        </p>
        <Link className="text-sm underline underline-offset-2" to="/solutions/security">
          Security &amp; multi-tenant SaaS
        </Link>
      </article>
    </MarketingLayout>
  );
}
