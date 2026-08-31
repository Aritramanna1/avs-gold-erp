import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/solutions/crm")({
  component: CrmMarketingPage,
});

function CrmMarketingPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-14 space-y-8">
        <h1 className="font-serif text-4xl">CRM / customer</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          People master covers customers, jewellers, and related parties with KYC attachments and
          party gold/cash ledgers. CRM opportunities and tasks sit on the same firm — never a
          separate customer database.
        </p>
        <Link className="text-sm underline underline-offset-2" to="/product">
          Back to product
        </Link>
      </article>
    </MarketingLayout>
  );
}
