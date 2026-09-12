import { Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowRight, Hammer, Layers, Package, Scale, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeBalances, useLedger } from "@/lib/ledger-store";
import { DEFAULT_FINENESS_BASIS, mgToGrams } from "@/lib/gold";
import {
  DEFAULT_MATERIAL_CATEGORIES,
  computeCategoryBalance,
  useMaterialVault,
} from "@/lib/material-vault-store";
import type { StockHubTabId } from "./StockHubTabs";
import type { ReactNode } from "react";

/**
 * Non-Gold / non-Ready stock hub tabs — summaries + deep links to existing routes.
 * No new routes invented (MVP-STOCK / AVS-32).
 */
export function StockSatellitePanel({ tab }: { tab: Exclude<StockHubTabId, "gold" | "ready"> }) {
  const basis = DEFAULT_FINENESS_BASIS;
  const entries = useLedger((s) => s.entries);
  const refreshLedger = useLedger((s) => s.refresh);
  const movements = useMaterialVault((s) => s.movements);
  const refreshVault = useMaterialVault((s) => s.refresh);

  useEffect(() => {
    void refreshLedger();
    void refreshVault();
  }, [refreshLedger, refreshVault]);

  const balance = useMemo(() => computeBalances(entries), [entries]);
  const goldCats = useMemo(
    () => DEFAULT_MATERIAL_CATEGORIES.filter((c) => c.group === "gold"),
    [],
  );

  if (tab === "raw") {
    return (
      <SatelliteShell
        title="Raw gold & material forms"
        description="Raw / fine / old gold balances from the material vault (existing vault movements)."
      >
        <ul className="divide-y rounded-md border border-border">
          {goldCats.map((cat) => {
            const mg = computeCategoryBalance(movements, cat.key);
            return (
              <li key={cat.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium">{cat.label}</span>
                <span className="font-mono text-sm font-bold text-gold tabular-nums">
                  {mgToGrams(mg)} g @{basis}
                </span>
              </li>
            );
          })}
        </ul>
        <CtaRow to="/ledger" label="Open material vault" icon={Scale} />
      </SatelliteShell>
    );
  }

  if (tab === "wip") {
    return (
      <SatelliteShell
        title="Work in progress"
        description="Gold still in jobs / finished-goods pipeline. Primary custody numbers come from the gold ledger."
      >
        <MetricRow label="Finished jewellery (ledger)" fineMg={balance.buckets.finished} basis={basis} />
        <MetricRow label="With karigar" fineMg={balance.buckets.karigar} basis={basis} />
        <div className="flex flex-wrap gap-2">
          <CtaRow to="/orders" label="Open jobs / orders" icon={Layers} />
          <CtaRow to="/workshop" label="Workshop" icon={Hammer} />
        </div>
      </SatelliteShell>
    );
  }

  if (tab === "karigar") {
    return (
      <SatelliteShell
        title="Karigar custody"
        description="Gold currently with karigars. Give metal / get back stays on the gold book."
      >
        <MetricRow label="With karigar" fineMg={balance.buckets.karigar} basis={basis} />
        <CtaRow to="/workshop/gold-book" label="Open karigar gold book" icon={Hammer} />
      </SatelliteShell>
    );
  }

  if (tab === "branch") {
    return (
      <SatelliteShell
        title="Branch / box locations"
        description="Box & tray locations for ready stock. No new branch-stock route in this PR."
      >
        <div className="flex flex-wrap gap-2">
          <CtaRow to="/stock/boxes" label="Open boxes & trays" icon={Package} />
          <CtaRow to="/stock" search={{ tab: "ready" }} label="Ready stock list" icon={Package} />
        </div>
      </SatelliteShell>
    );
  }

  if (tab === "transfers") {
    return (
      <SatelliteShell
        title="Stock transfers"
        description="Move ready stock between locations using the existing transfers screen."
      >
        <CtaRow to="/stock/transfers" label="Open transfers" icon={Truck} />
      </SatelliteShell>
    );
  }

  return (
    <SatelliteShell
      title="Items"
      description="Catalogue / designs are second after Gold. Ready tagged pieces stay under Ready."
    >
      <div className="flex flex-wrap gap-2">
        <CtaRow to="/catalog" label="Open catalogue" icon={Layers} />
        <CtaRow to="/stock" search={{ tab: "ready" }} label="Ready stock" icon={Package} />
      </div>
    </SatelliteShell>
  );
}

function SatelliteShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="erp-surface space-y-4 rounded-md p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricRow({
  label,
  fineMg,
  basis,
}: {
  label: string;
  fineMg: number;
  basis: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-bold text-gold tabular-nums">
        {mgToGrams(fineMg)}
        <span className="ml-1 text-xs font-sans font-semibold">g @{basis}</span>
      </span>
    </div>
  );
}

function CtaRow({
  to,
  label,
  icon: Icon,
  search,
}: {
  to: string;
  label: string;
  icon: typeof Package;
  search?: Record<string, string>;
}) {
  return (
    <Button asChild variant="outline" className="min-h-12 gap-2">
      <Link to={to as never} search={search as never}>
        <Icon className="h-4 w-4 text-gold" />
        {label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}
