/**
 * Mobile Gold Stock hub — summary → filters → list → drill-down.
 * Answers: how much / purity / where / who holds / process. Vault/inventory SoT via Assistant tools.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  MobileFilterChips,
  MobileListCard,
  MobilePageScaffold,
} from "@/components/mobile/MobilePageScaffold";
import { usePhoneChrome } from "@/hooks/use-device-class";
import { toolGetWhereIsMyGold, toolGetGoldPosition } from "@/lib/assistant/assistant-tool-registry";
import type { ERPActionCard } from "@/lib/assistant/assistant-types";
import { MobileInlineError } from "@/components/mobile/MobileInlineError";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mobile/gold-stock")({
  head: () => ({ meta: [{ title: "Gold Stock · AVS ERP" }] }),
  component: MobileGoldStockPage,
});

type FilterId = "all" | "vault" | "showroom" | "karigar" | "ready";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "vault", label: "Vault" },
  { id: "showroom", label: "Showroom" },
  { id: "karigar", label: "Karigar" },
  { id: "ready", label: "Ready stock" },
];

function MobileGoldStockPage() {
  const isMobile = usePhoneChrome();
  const [filter, setFilter] = useState<FilterId>("all");
  const [whereCard, setWhereCard] = useState<ERPActionCard | null>(null);
  const [positionCard, setPositionCard] = useState<ERPActionCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [where, pos] = await Promise.all([toolGetWhereIsMyGold(), toolGetGoldPosition()]);
      setWhereCard(where);
      setPositionCard(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load gold position");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const table = whereCard?.tableRows ?? [];
    if (filter === "all") return table;
    return table.filter((r) => {
      const loc = String(r.location ?? "").toLowerCase();
      if (filter === "vault") return loc.includes("vault");
      if (filter === "showroom") return loc.includes("showroom") || loc.includes("tray");
      if (filter === "karigar") return loc.includes("karigar") || loc.includes("wip");
      if (filter === "ready") return loc.includes("ready") || loc.includes("stock");
      return true;
    });
  }, [whereCard, filter]);

  if (!isMobile) {
    return <Navigate to="/ledger" replace />;
  }

  return (
    <MobilePageScaffold
      title="Gold Stock"
      subtitle="How much gold, which purity, where it is, who holds it."
      leading={
        <Link
          to="/mobile/work"
          className="p-2 -ml-2 text-muted-foreground min-h-[var(--touch-target)] min-w-[var(--touch-target)] flex items-center"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      }
      trailing={
        <button
          type="button"
          onClick={() => void load()}
          className="p-2 text-muted-foreground min-h-[var(--touch-target)]"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      }
      stickyAction={
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1 min-h-[var(--touch-target)]">
            <Link to="/workshop/gold-book">Issue gold</Link>
          </Button>
          <Button asChild className="flex-1 min-h-[var(--touch-target)] bg-gold text-black hover:bg-gold/90">
            <Link to="/workshop/gold-book">Receive gold</Link>
          </Button>
        </div>
      }
    >
      {error ? (
        <MobileInlineError message={error} onRetry={() => void load()} />
      ) : null}

      <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 mb-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Firm gold (live)
        </p>
        <p className="text-sm font-semibold leading-snug">
          {loading ? "Loading…" : whereCard?.summary ?? positionCard?.summary ?? "No gold data"}
        </p>
      </div>

      <MobileFilterChips
        options={FILTERS}
        value={filter}
        onChange={(id) => setFilter(id as FilterId)}
      />

      <div className="mt-3 space-y-2">
        {loading && !whereCard ? (
          <p className="text-xs text-muted-foreground">Loading locations…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No rows for this filter. Check Vault, Karigar book, or Ready Stock.
          </p>
        ) : (
          rows.map((r, i) => (
            <MobileListCard
              key={`${r.location}-${i}`}
              title={String(r.location ?? "Location")}
              subtitle={`Fine ${r.fineGrams ?? "—"} g · Gross ${r.grossGrams ?? "—"} g`}
              meta={r.share ? `Share ${r.share}` : undefined}
            />
          ))
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/ledger"
          className="rounded-lg border border-border bg-card p-3 text-xs font-semibold text-center min-h-[var(--touch-target)] flex items-center justify-center"
        >
          Gold ledger
        </Link>
        <Link
          to="/stock"
          className="rounded-lg border border-border bg-card p-3 text-xs font-semibold text-center min-h-[var(--touch-target)] flex items-center justify-center"
        >
          Ready stock
        </Link>
        <Link
          to="/workshop/gold-book"
          className="rounded-lg border border-border bg-card p-3 text-xs font-semibold text-center min-h-[var(--touch-target)] flex items-center justify-center col-span-2"
        >
          Worker gold book (who holds it)
        </Link>
      </div>
    </MobilePageScaffold>
  );
}
