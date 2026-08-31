import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      {
        title: "AVS ERP Product — Jewellery Manufacturing ERP",
        description:
          "AVS ERP is AVS jewellery manufacturing ERP: Gold Vault custody, karigar books, GST documents, and portals on one Supabase-backed system.",
      },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-14 space-y-10">
        <header className="space-y-4">
          <p className="text-sm font-medium text-amber-800/80 tracking-wide">AVS ERP by Arivahly Venture Sphere</p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight text-foreground">
            Jewellery manufacturing ERP with gold custody you can audit
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            AVS ERP is not a retail POS. It is a factory system for gold vault accounting,
            karigar issue and return, manufacturing job cards, GST documents, ready-stock tags,
            and customer / karigar / supplier portals — all on the same authenticated Supabase
            data plane for web, desktop, and Android.
          </p>
        </header>

        <section className="space-y-3 border-t border-border/70 pt-8">
          <h2 className="font-serif text-2xl">How work moves through AVS ERP</h2>
          <ol className="space-y-3 text-muted-foreground list-decimal pl-5 leading-relaxed">
            <li>
              <span className="text-foreground font-medium">Master</span> — people, purity grades,
              alloy formulas, print profiles, barcode symbology.
            </li>
            <li>
              <span className="text-foreground font-medium">Transaction</span> — vault movements,
              karigar issue/return, melt, conversion, orders, billing.
            </li>
            <li>
              <span className="text-foreground font-medium">Ledger</span> — Gold Vault remains the
              accounting source of truth (integer milligrams, per-mille purity).
            </li>
            <li>
              <span className="text-foreground font-medium">Stock</span> — ready-stock tags with
              GW/NW/HUID; HUID stays a distinct hallmark field.
            </li>
            <li>
              <span className="text-foreground font-medium">Billing &amp; reports</span> — invoices,
              settlements, and the ERP Audit Report for PASS/FAIL/BLOCKED health checks.
            </li>
          </ol>
        </section>

        <section className="flex flex-wrap gap-3 pt-2">
          <Button asChild className="bg-amber-700 hover:bg-amber-800 text-white">
            <Link to="/request-access">Request access</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/workflows">See workflows</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/contact" search={{ intent: "demo" }}>
              Book a demo
            </Link>
          </Button>
        </section>
      </div>
    </MarketingLayout>
  );
}
