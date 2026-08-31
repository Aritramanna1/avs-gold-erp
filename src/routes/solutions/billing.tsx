import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/solutions/billing")({
  component: BillingMarketingPage,
});

function BillingMarketingPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-14 space-y-8">
        <h1 className="font-serif text-4xl">Billing &amp; accounting</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Manufacturing invoices, estimates, delivery challans, credit/debit notes, and gold
          settlement — with GST documents when configured. Cash and gold stay isolated; print
          goes through the Universal Print Engine, not screenshots.
        </p>
        <ul className="space-y-3 text-muted-foreground list-disc pl-5 leading-relaxed">
          <li>Ready-stock and manufacturing billing on the same firm ledger.</li>
          <li>Scale-assisted weights only when the reading is stable.</li>
          <li>Purchase returns and supplier flows on approved RPCs.</li>
        </ul>
        <Link className="text-sm underline underline-offset-2" to="/product">
          Back to product
        </Link>
      </article>
    </MarketingLayout>
  );
}
