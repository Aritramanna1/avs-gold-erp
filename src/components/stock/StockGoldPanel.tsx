/**
 * MVP-STOCK Gold tab — Fine g @995 loud; not Ready Stock jewellery.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { Button } from "@/components/ui/button";
import { toolGetWhereIsMyGold } from "@/lib/assistant/assistant-tool-registry";
import type { ERPActionCard } from "@/lib/assistant/assistant-types";

export function StockGoldPanel() {
  const [card, setCard] = useState<ERPActionCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void toolGetWhereIsMyGold()
      .then((result) => {
        if (!cancelled) setCard(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load gold stock");
          setCard(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalFineG =
    card?.data && typeof (card.data as { totalFineMg?: number }).totalFineMg === "number"
      ? ((card.data as { totalFineMg: number }).totalFineMg / 1000).toFixed(3)
      : loading
        ? "..."
        : "0.000";

  return (
    <ModuleWorkspace
      eyebrow="Stock"
      title="Gold"
      description="Firm gold first — Fine g @995 by custody. Ready jewellery is on the Ready tab."
      icon={Package}
      metrics={[
        { label: "Fine g @995", value: `${totalFineG} g` },
        {
          label: "Showroom",
          value: card?.kpis?.[1]?.value ?? (loading ? "..." : "—"),
        },
        {
          label: "Vault",
          value: card?.kpis?.[2]?.value ?? (loading ? "..." : "—"),
        },
        {
          label: "Karigar",
          value: card?.kpis?.[3]?.value ?? (loading ? "..." : "—"),
        },
      ]}
      actions={[
        { label: "Gold vault", to: "/ledger", icon: Package },
        { label: "Give metal", to: "/workshop/gold-book", icon: Package },
        { label: "Raw lots", to: "/stock/lots", icon: Package },
      ]}
    >
      <section className="erp-surface rounded-md p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-lg">
              Fine <span className="text-gold">{totalFineG} g @995</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {card?.summary ?? (loading ? "Loading gold custody…" : "No gold position yet.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/stock/lots">Raw lots</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/workshop">WIP / jobs</Link>
            </Button>
            <Button asChild size="sm" className="bg-gold hover:bg-gold/90 text-white">
              <Link to="/stock" search={{ tab: "ready" } as never}>
                Ready pieces
              </Link>
            </Button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Location / custody</th>
                  <th className="text-right py-2 px-3 font-medium">Gross g</th>
                  <th className="text-right py-2 px-3 font-medium">Fine g @995</th>
                  <th className="text-center py-2 px-3 font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(card?.tableRows ?? []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="py-2 px-3">{String(row.location ?? "—")}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{String(row.grossGrams ?? "—")}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-gold">
                      {String(row.fineGrams ?? "—")}
                    </td>
                    <td className="py-2 px-3 text-center text-muted-foreground">{String(row.share ?? "—")}</td>
                  </tr>
                ))}
                {!loading && (card?.tableRows?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                      No gold custody rows yet. Vault, showroom, and karigar books post here.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ModuleWorkspace>
  );
}
