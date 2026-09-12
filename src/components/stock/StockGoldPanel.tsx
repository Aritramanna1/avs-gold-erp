import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Scale, Hammer, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeBalances, useLedger } from "@/lib/ledger-store";
import { buildVaultGoldPurityLines } from "@/lib/vault-gold-stock";
import { DEFAULT_FINENESS_BASIS, getCaratLabel, mgToGrams } from "@/lib/gold";

/**
 * MVP-STOCK Gold tab — vault / scrap purity lines from the gold ledger.
 * Fine quantity is shown loud as g @995 (authoritative basis). Does not invent rates.
 */
export function StockGoldPanel() {
  const entries = useLedger((s) => s.entries);
  const refresh = useLedger((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const balance = useMemo(() => computeBalances(entries), [entries]);
  const lines = useMemo(() => buildVaultGoldPurityLines(entries), [entries]);
  const vaultFineMg = balance.buckets.vault;
  const karigarFineMg = balance.buckets.karigar;
  const finishedFineMg = balance.buckets.finished;
  const basis = DEFAULT_FINENESS_BASIS;

  return (
    <div className="space-y-4" data-testid="stock-gold-panel">
      <div className="grid gap-3 sm:grid-cols-3">
        <GoldSummaryCard
          icon={Scale}
          label="Vault gold"
          fineMg={vaultFineMg}
          basis={basis}
        />
        <GoldSummaryCard
          icon={Hammer}
          label="With karigar"
          fineMg={karigarFineMg}
          basis={basis}
        />
        <GoldSummaryCard
          icon={Package}
          label="Finished jewellery"
          fineMg={finishedFineMg}
          basis={basis}
        />
      </div>

      <section className="erp-surface rounded-md p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Gold by purity</h2>
            <p className="text-sm text-muted-foreground">
              Fine metal from the gold ledger. Primary quantity is{" "}
              <span className="font-semibold text-gold">g @{basis}</span> — not a
              cash rate.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/ledger">
              Open gold vault
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {lines.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No vault gold recorded yet. Post opening gold in{" "}
            <Link to="/ledger" className="font-medium text-gold underline-offset-2 hover:underline">
              Our Gold Stock
            </Link>
            , or add ready jewellery under the Ready tab.
          </div>
        ) : (
          <>
            <div className="mt-4 block space-y-2 md:hidden">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{line.location}</div>
                      <div className="text-xs text-muted-foreground">
                        {getCaratLabel(line.purity)} · {line.purity}‰
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-lg font-bold text-gold tabular-nums">
                        {mgToGrams(line.availableFineMg)}
                        <span className="ml-1 text-xs font-sans font-semibold">
                          g @{basis}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {mgToGrams(line.availableGrossMg)} g gross
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden md:block overflow-x-auto">
              <table className="erp-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Location</th>
                    <th className="text-left">Purity</th>
                    <th className="text-right">Fine g @{basis}</th>
                    <th className="text-right">Gross g</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="font-medium">{line.location}</td>
                      <td>
                        {getCaratLabel(line.purity)}{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {line.purity}‰
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono text-base font-bold text-gold tabular-nums">
                          {mgToGrams(line.availableFineMg)}
                        </span>
                        <span className="ml-1 text-xs font-semibold text-gold">
                          g @{basis}
                        </span>
                      </td>
                      <td className="text-right font-mono text-muted-foreground">
                        {mgToGrams(line.availableGrossMg)} g
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function GoldSummaryCard({
  icon: Icon,
  label,
  fineMg,
  basis,
}: {
  icon: typeof Scale;
  label: string;
  fineMg: number;
  basis: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-gold tabular-nums">
            {mgToGrams(fineMg)}
            <span className="ml-1.5 text-sm font-sans font-semibold">g @{basis}</span>
          </div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-gold/10">
          <Icon className="h-5 w-5 text-gold" />
        </div>
      </div>
    </div>
  );
}
