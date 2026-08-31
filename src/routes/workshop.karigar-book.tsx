/**
 * Karigar Book hub — Offline Dhadi_jn operational structure on AVS UI.
 * Progressive disclosure: pick karigar → balance strip → history → actions.
 * Transactions still post via Worker Gold Book (same SoT).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { usePeople } from "@/lib/people-store";
import { isKarigarParty } from "@/lib/party-types";
import {
  fetchKarigarBook,
  type KarigarBookResult,
  type KarigarBookSummary,
} from "@/lib/karigar-book-query";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV, thisMonthRange } from "@/lib/report-engine";
import { usePrintEngine } from "@/lib/print-engine";
import {
  BookOpen,
  Download,
  Hammer,
  Printer,
  Search,
  Scale,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/workshop/karigar-book")({
  head: () => ({ meta: [{ title: "Karigar Book · AVS ERP" }] }),
  component: KarigarBookHubPage,
});

function KarigarBookHubPage() {
  const people = usePeople((s) => s.people);
  const month = thisMonthRange();
  const { triggerPrint } = usePrintEngine();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<KarigarBookResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const karigars = useMemo(
    () => people.filter((p) => (isKarigarParty(p) || p.type === "employee") && p.active),
    [people],
  );

  const filteredKarigars = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return karigars;
    return karigars.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        (p.phone || "").includes(q) ||
        (p.addressLine1 || "").toLowerCase().includes(q),
    );
  }, [karigars, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchKarigarBook({
      range: { from, to },
      workerId: selectedId,
    })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load Karigar Book");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, selectedId]);

  const selectedPerson = selectedId ? karigars.find((p) => p.id === selectedId) : null;
  const selectedSummary: KarigarBookSummary | undefined = data?.summaries.find(
    (s) => s.worker_id === selectedId,
  );
  const openingFineMg = selectedPerson?.goldOpeningFineMg ?? 0;
  const pendingFineMg = selectedSummary?.pending_fine_mg ?? 0;
  const runningFineMg = openingFineMg + pendingFineMg;

  const historyRows = useMemo(() => {
    if (!data) return [];
    if (!selectedId) return data.rows;
    return data.rows.filter((r) => r.worker_id === selectedId);
  }, [data, selectedId]);

  function handleCSV() {
    exportToCSV("karigar-book.csv", [
      [
        "Date",
        "Voucher",
        "Karigar",
        "Item",
        "J/N",
        "Gr g",
        "Less g",
        "Add g",
        "Net g",
        "Tanch",
        "Wstg%",
        "Hisob%",
        "Fine g",
        "Plus fine g",
        "Labour ₹",
        "Process",
        "Stamp",
        "Order",
        "Remark",
      ],
      ...historyRows.map((r) => [
        r.date,
        r.entry_no,
        r.worker_name,
        r.particulars,
        r.j_n,
        mgToGrams(r.gross_mg),
        mgToGrams(r.less_mg),
        mgToGrams(r.add_mg),
        mgToGrams(r.net_mg),
        String(r.purity || ""),
        String(r.wastage_pct || ""),
        String(r.hisob_pct || ""),
        mgToGrams(r.fine_mg),
        mgToGrams(r.plus_fine_mg),
        (r.labour_cash_paise / 100).toFixed(2),
        r.process_type,
        r.stamp_code,
        r.order_no,
        r.remark,
      ]),
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Karigar Book"
        subtitle="Offline-shaped custody book — master, opening, issue/return, pending, running balance, settlement & history. Posts use the same gold_ledger + worker_transactions SoT."
        actions={
          <div className="flex flex-wrap gap-2">
            <SourceOfTruthBadge variant="ledger" />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV} disabled={!historyRows.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const mode = selectedId ? `&mode=${selectedId}` : "";
                triggerPrint(
                  `/reports/book-print/karigar_book?from=${from}&to=${to}${mode}`,
                  "Karigar Book · Print",
                );
              }}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 no-print">
        <Button asChild size="sm">
          <Link to="/workshop/gold-book" search={{ mode: "issue" }}>
            <Hammer className="h-4 w-4 mr-1.5" /> Issue (Nave)
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/workshop/gold-book" search={{ mode: "receive" }}>
            Return (Jama)
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/settlement/new">Settlement</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/people" search={{ tab: "karigars" }}>
            <Users className="h-4 w-4 mr-1.5" /> Karigar master
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/reports/dhadi-book">Dhadi report</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/workshop/dhadi-groups">Dhadi groups</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="erp-surface rounded-xl p-4 space-y-3 lg:col-span-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search karigar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`w-full text-left rounded-lg px-3 py-2 text-sm border ${
              !selectedId ? "border-gold bg-gold/10" : "border-transparent hover:bg-muted/40"
            }`}
            onClick={() => setSelectedId(null)}
          >
            All karigars (summary)
          </button>
          <div className="max-h-[28rem] overflow-y-auto space-y-1">
            {filteredKarigars.map((p) => {
              const sum = data?.summaries.find((s) => s.worker_id === p.id);
              const pending = (p.goldOpeningFineMg ?? 0) + (sum?.pending_fine_mg ?? 0);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm border ${
                    selectedId === p.id
                      ? "border-gold bg-gold/10"
                      : "border-transparent hover:bg-muted/40"
                  }`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="font-medium truncate">{p.fullName}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Pending {mgToGrams(pending)} g
                    {sum ? ` · ${sum.entry_count} lines` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading server book…"
                : `${data?.total ?? 0} line(s)${data?.capped ? " (capped page)" : ""}`}
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {selectedPerson ? (
            <div className="erp-surface rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Opening fine</p>
                <p className="font-mono font-semibold">{mgToGrams(openingFineMg)} g</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Cash opening</p>
                <p className="font-mono font-semibold">
                  ₹{((selectedPerson.cashOpeningBalancePaise ?? 0) / 100).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Offline anamat display = cash advance until metal-deposit expert rule
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Issue (period)</p>
                <p className="font-mono font-semibold">
                  {mgToGrams(selectedSummary?.issue_fine_mg ?? 0)} g
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Return (period)</p>
                <p className="font-mono font-semibold">
                  {mgToGrams(selectedSummary?.return_fine_mg ?? 0)} g
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1">
                  <Scale className="h-3 w-3" /> Running
                </p>
                <p className="font-mono font-semibold text-gold">{mgToGrams(runningFineMg)} g</p>
              </div>
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                Opening from party master · period from server RPC · purity books at{" "}
                <Link
                  to="/workshop/worker-book/$workerId"
                  params={{ workerId: selectedPerson.id }}
                  className="text-gold underline"
                >
                  Worker Book
                </Link>
                {" · "}
                <button
                  type="button"
                  className="text-gold underline hover:text-gold/80 cursor-pointer"
                  onClick={async () => {
                    const { usePrintEngine } = await import("@/lib/print-engine");
                    usePrintEngine.getState().triggerPrint(
                      `/workshop/gold-book-print/${selectedPerson.id}`,
                      `Karigar Custody Statement · ${selectedPerson.fullName}`
                    );
                  }}
                >
                  Print custody
                </button>
              </div>
            </div>
          ) : (
            <div className="erp-surface rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="px-3 py-2">Karigar</th>
                    <th className="px-3 py-2 text-right">Issue</th>
                    <th className="px-3 py-2 text-right">Return</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                    <th className="px-3 py-2 text-right">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.summaries ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                        No karigar movements in this period.
                      </td>
                    </tr>
                  ) : (
                    (data?.summaries ?? []).map((s) => (
                      <tr
                        key={s.worker_id}
                        className="border-b border-border/40 cursor-pointer hover:bg-muted/30"
                        onClick={() => setSelectedId(s.worker_id)}
                      >
                        <td className="px-3 py-1.5 font-medium">{s.worker_name}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {mgToGrams(s.issue_fine_mg)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {mgToGrams(s.return_fine_mg)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-gold">
                          {mgToGrams(s.pending_fine_mg)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{s.entry_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="erp-surface rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4 text-gold" />
              History {selectedPerson ? `· ${selectedPerson.fullName}` : "· all"}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Voucher</th>
                    {!selectedId ? <th className="px-3 py-2">Karigar</th> : null}
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">J/N</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Fine</th>
                    <th className="px-3 py-2">Process</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                        No lines in this window.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map((r) => (
                      <tr key={r.id} className="border-b border-border/40">
                        <td className="px-3 py-1.5">{r.date}</td>
                        <td className="px-3 py-1.5 font-mono">{r.entry_no}</td>
                        {!selectedId ? (
                          <td className="px-3 py-1.5">{r.worker_name}</td>
                        ) : null}
                        <td className="px-3 py-1.5">{r.particulars}</td>
                        <td className="px-3 py-1.5">{r.j_n}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{mgToGrams(r.net_mg)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{mgToGrams(r.fine_mg)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {r.process_type || r.stamp_code || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
