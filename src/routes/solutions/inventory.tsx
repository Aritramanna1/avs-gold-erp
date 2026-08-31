import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/solutions/inventory")({
  component: InventoryMarketingPage,
});

function InventoryMarketingPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-14 space-y-8">
        <h1 className="font-serif text-4xl">Inventory / Gold &amp; material</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Gold Vault is the accounting source of truth. Fine metal is stored as integer milligrams
          and purity as per-mille. Material vault movements for filings and findings dual-post to
          the ledger when they carry gold. Ready stock tags do not invent a second gold book.
        </p>
        <ul className="space-y-3 text-muted-foreground list-disc pl-5 leading-relaxed">
          <li>Vault opening, issue, return, melt recovery, and conversion on one ledger.</li>
          <li>Scrap / filings custody separate from finished ready stock.</li>
          <li>Configurable fine methods (Hisob /999 / touch) frozen in formula snapshots on post.</li>
        </ul>
        <Link className="text-sm underline underline-offset-2" to="/product">
          Back to product
        </Link>
      </article>
    </MarketingLayout>
  );
}
