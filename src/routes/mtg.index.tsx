import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings-store";
import { hasOrganizationFeature } from "@/lib/identity/feature-gate";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { mgToGrams } from "@/lib/gold";
import { Package, Banknote, ShoppingBag, Users } from "lucide-react";

export const Route = createFileRoute("/mtg/")({
  beforeLoad: () => {
    if (!hasOrganizationFeature("business.mtg_shell")) {
      throw redirect({ to: "/app" });
    }
  },
  head: () => ({ meta: [{ title: "MTG Home · AVS Gold ERP" }] }),
  component: MtgHomePage,
});

function MtgHomePage() {
  const firm = useSettings((s) => s.firm);
  const entries = useLedger((s) => s.entries);
  const balances = computeBalances(entries);
  const finishedMg = balances.buckets.finished ?? 0;
  const cashPaise = balances.totalCashPaise ?? 0;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">MTG Workshop</h1>
        <p className="text-sm text-muted-foreground">
          Simplified manufacturing shell — gold and cash tracked separately.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 space-y-1">
          <div className="flex items-center gap-2 text-gold">
            <Package className="h-5 w-5" />
            <span className="text-sm font-medium">Gold (finished)</span>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{mgToGrams(finishedMg)} g</p>
        </Card>
        <Card className="p-5 space-y-1">
          <div className="flex items-center gap-2 text-emerald-600">
            <Banknote className="h-5 w-5" />
            <span className="text-sm font-medium">Cash position</span>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            ₹{(cashPaise / 100).toLocaleString("en-IN")}
          </p>
          {firm?.shopName ? (
            <p className="text-xs text-muted-foreground">{firm.shopName}</p>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" className="min-h-11 justify-start">
          <Link to="/orders">
            <ShoppingBag className="h-4 w-4 mr-2" /> Orders
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 justify-start">
          <Link to="/people">
            <Users className="h-4 w-4 mr-2" /> Karigar &amp; Customer
          </Link>
        </Button>
      </div>
    </div>
  );
}
