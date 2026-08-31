import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/solutions/security")({
  component: SecurityMarketingPage,
});

function SecurityMarketingPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-14 space-y-8">
        <h1 className="font-serif text-4xl">Security / multi-tenant SaaS</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          AVS ERP is designed for hundreds of jewellery firms on one platform. Tenant data is scoped
          by firm_id with PostgreSQL RLS as the security boundary. Platform operators and firm
          Owners have distinct roles; portals cannot escape into another firm&apos;s books by ID
          guessing.
        </p>
        <ul className="space-y-3 text-muted-foreground list-disc pl-5 leading-relaxed">
          <li>Indexed firm query paths and paginated list loads for large tenants.</li>
          <li>RPCs and storage policies audited alongside table RLS.</li>
          <li>In-app ERP Audit Report for PASS / FAIL / BLOCKED health with evidence.</li>
        </ul>
        <Link className="text-sm underline underline-offset-2" to="/product">
          Back to product
        </Link>
      </article>
    </MarketingLayout>
  );
}
