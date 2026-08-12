import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeBalances, MOVEMENT_LABELS, useLedger, type LedgerEntry } from "@/lib/ledger-store";
import {
  COMMON_PURITIES,
  fineGoldMg,
  GOLD_FORMS,
  gramsToMg,
  mgToGrams,
  parsePurity,
  getCaratLabel,
  type GoldForm,
} from "@/lib/gold";
import {
  CheckCircle2,
  AlertTriangle,
  Scale,
  Hammer,
  Package,
  Users,
  Recycle,
  Printer,
  Download,
  Store,
} from "lucide-react";
import { PrintHeader } from "@/components/print-header";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { MaterialVaultPanel } from "@/components/material-vault-panel";
import { exportToCSV, exportToXLSX } from "@/lib/report-engine";
import { printDocument } from "@/lib/print-document";
import { compileWorkerBooks } from "@/lib/workshop-worker-books";
import { useJobCards, JOB_STATUS_ACTIVE, normalizeJobStatus } from "@/lib/jobcards-store";
import { useOrders, normalizeOrderStatus } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { getPartyGoldBalance, getPartyCashBalance } from "@/lib/customer-account-ledger";
import { paiseToRupees } from "@/lib/billing-store";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/ledger")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Our Gold Stock · AVS Gold ERP" }] }),
  component: LedgerPage,
});

function LedgerPage() {
  const entries = useLedger((s) => s.entries);
  const balance = useMemo(() => computeBalances(entries), [entries]);
  const people = usePeople((s) => s.people);
  // This dashboard was fine-gold-only — a real dual-currency ERP shows cash
  // alongside metal, not metal alone (see JWELLY_COMPLETE_ERP_AUDIT.md §9).
  // Per-party cash/gold already exists on the People detail page; this is
  // the aggregate across every party for the vault-level summary here.
  const totalOutstandingCashPaise = useMemo(
    () => people.reduce((sum, p) => sum + getPartyCashBalance(p.id).outstandingPaise, 0),
    [people],
  );

  function handleCSV() {
    const header = [
      "Date",
      "Type",
      "Net Fine (g)",
      "Gross (g)",
      "Purity",
      "Form",
      "Reference",
      "Notes",
    ];
    const data = entries.map((e) => [
      new Date(e.createdAt).toLocaleString("en-IN"),
      MOVEMENT_LABELS[e.type] ?? e.type,
      mgToGrams(e.netFineMg),
      e.grossMg ? mgToGrams(e.grossMg) : "",
      e.purity ?? "",
      e.form ?? "",
      e.reference ?? "",
      e.notes ?? "",
    ]);
    exportToCSV("gold-material-ledger.csv", [header, ...data]);
  }

  return (
    <div
      data-testid="print-layout-root"
      className="p-4 md:p-8 max-w-6xl mx-auto print:p-0 print:m-0 print:bg-white print:text-black"
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>
      <div className="hidden print:block">
        <PrintHeader title="Gold & Material Vault Report" />
      </div>

      <PageHeader
        title="Our Gold Stock"
        subtitle="Management overview of all gold and manufacturing materials owned or managed by the company. Click a card to drill down. Movements are recorded in their operational modules — this dashboard reflects them in real time."
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void printDocument("Gold Material Ledger", "Ledger")}
            >
              <Printer className="h-4 w-4" /> Print Ledger
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="balance" className="space-y-6">
        <TabsList className="bg-card border border-border no-print flex-wrap h-auto">
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
          <TabsTrigger value="material-vault" data-testid="tab-material-vault">
            Material Vault
          </TabsTrigger>
          <TabsTrigger value="opening">Opening Vault</TabsTrigger>
          <TabsTrigger value="movements">Gold Movements ({entries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="balance">
          <BalanceSheetView
            balance={balance}
            totalOutstandingCashPaise={totalOutstandingCashPaise}
          />
        </TabsContent>

        <TabsContent value="material-vault">
          <MaterialVaultPanel />
        </TabsContent>

        <TabsContent value="opening">
          <OpeningVaultForm />
        </TabsContent>

        <TabsContent value="movements">
          <MovementsList entries={entries} />
        </TabsContent>
      </Tabs>

      <div className="hidden print:block mt-8">
        <AvsPrintFooter />
      </div>
    </div>
  );
}

import { type BucketBreakdown, type Bucket } from "@/lib/ledger-store";

function BucketCard({
  label,
  breakdown,
  icon: Icon,
  onOpen,
}: {
  label: string;
  breakdown: BucketBreakdown;
  icon: React.ComponentType<{ className?: string }>;
  onOpen?: () => void;
}) {
  const puritiesList = Object.values(breakdown?.purities || {}).filter(
    (p) => p.grossMg !== 0 || p.fineMg !== 0,
  );

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => onOpen && (e.key === "Enter" || e.key === " ") && onOpen()}
      className={`rounded-2xl border border-border bg-card p-5 shadow-elegant flex flex-col justify-between ${
        onOpen ? "cursor-pointer hover:border-gold/50 transition-colors no-print" : ""
      }`}
    >
      <div>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="font-serif text-3xl text-gold mt-2 truncate">
              {mgToGrams(breakdown?.fineMg || 0)}{" "}
              <span className="text-sm text-muted-foreground">g fine</span>
            </div>
            {breakdown?.grossMg !== breakdown?.fineMg && (
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                Physical: {mgToGrams(breakdown?.grossMg || 0)} g gross
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-accent/60 grid place-items-center shrink-0 ml-2">
            <Icon className="h-5 w-5 text-gold" />
          </div>
        </div>

        {puritiesList.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/60 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
              Breakdown by Purity
            </div>
            {puritiesList.map((p) => (
              <div key={p.purity} className="flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground truncate mr-2">
                  {getCaratLabel(p.purity)}:
                </span>
                <span className="text-foreground font-medium shrink-0">
                  {mgToGrams(p.grossMg)} g{" "}
                  <span className="text-[10px] text-muted-foreground">
                    ({mgToGrams(p.fineMg)} g fine)
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {onOpen && (
        <div className="mt-3 pt-2 text-[11px] font-semibold text-gold/80">View details →</div>
      )}
    </div>
  );
}

function BalanceSheetView({
  balance,
  totalOutstandingCashPaise,
}: {
  balance: ReturnType<typeof computeBalances>;
  totalOutstandingCashPaise: number;
}) {
  const [drill, setDrill] = useState<Bucket | null>(null);
  const {
    buckets,
    bucketBreakdowns,
    totalUnderManagement,
    totalPhysicalUnderManagement,
    ledgerTotal,
    discrepancyMg,
    balanced,
    entryCount,
  } = balance;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-2xl border p-5 flex items-center gap-4 ${
          balanced ? "border-success/40 bg-success/5" : "border-destructive/50 bg-destructive/5"
        }`}
      >
        {balanced ? (
          <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-serif text-xl">
            {balanced ? "Gold Balance Sheet — Balanced" : "Gold Balance Sheet — Unbalanced"}
          </div>
          <div className="text-sm text-muted-foreground">
            Discrepancy:{" "}
            <span className={balanced ? "text-success" : "text-destructive"}>
              {discrepancyMg === 0
                ? "0 mg"
                : `${mgToGrams(discrepancyMg, { sign: true })} g (${discrepancyMg} mg)`}
            </span>
            {" · "}
            {entryCount} ledger {entryCount === 1 ? "entry" : "entries"}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border p-5 flex items-center gap-4">
        <Store className="h-8 w-8 text-gold shrink-0" />
        <div>
          <div className="text-sm text-muted-foreground">
            Total Outstanding Cash (all customers)
          </div>
          <div className="font-serif text-xl">₹{paiseToRupees(totalOutstandingCashPaise)}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BucketCard
          label="Gold Held"
          breakdown={bucketBreakdowns.vault}
          icon={Scale}
          onOpen={() => setDrill("vault")}
        />
        <BucketCard
          label="Gold with Karigars"
          breakdown={bucketBreakdowns.karigar}
          icon={Hammer}
          onOpen={() => setDrill("karigar")}
        />
        <BucketCard
          label="Finished Jewellery Stock"
          breakdown={bucketBreakdowns.finished}
          icon={Package}
          onOpen={() => setDrill("finished")}
        />
        <BucketCard
          label="Advance Gold / Customer Gold Held"
          breakdown={bucketBreakdowns.customer}
          icon={Users}
          onOpen={() => setDrill("customer")}
        />
        <BucketCard
          label="Gold With Jewellers"
          breakdown={bucketBreakdowns.jeweller}
          icon={Store}
          onOpen={() => setDrill("jeweller")}
        />
        <BucketCard label="Scrap / Dust Gold" breakdown={bucketBreakdowns.scrap} icon={Recycle} />
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5 shadow-gold flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-gold font-semibold">
              Total Under Management
            </div>
            <div className="font-serif text-3xl text-gold mt-2">
              {mgToGrams(totalUnderManagement)} <span className="text-sm">g fine</span>
            </div>
            {totalPhysicalUnderManagement !== totalUnderManagement && (
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                Total gross: {mgToGrams(totalPhysicalUnderManagement)} g gross
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-3 font-mono pt-3 border-t border-gold/20">
              Ledger total: {mgToGrams(ledgerTotal)} g fine
            </div>
          </div>
        </div>
      </div>

      {entryCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/40 p-6 text-center text-sm text-muted-foreground">
          No gold recorded yet. Open the <span className="text-gold">Opening Vault</span> tab to
          record your first entry.
        </div>
      ) : null}

      {drill && <DrillDownPanel bucket={drill} balance={balance} onClose={() => setDrill(null)} />}
    </div>
  );
}

interface DrillTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Per-purity holdings of a single bucket → inventory rows. */
function purityRows(breakdown: BucketBreakdown): (string | number)[][] {
  return Object.values(breakdown?.purities || {})
    .filter((p) => p.grossMg !== 0 || p.fineMg !== 0)
    .sort((a, b) => b.purity - a.purity)
    .map((p) => [getCaratLabel(p.purity), p.purity, mgToGrams(p.grossMg), mgToGrams(p.fineMg)]);
}

/**
 * Builds the summary table for a bucket drill-down. Each pulls from the module
 * that owns the detail — worker books, orders, customer ledgers — so this stays
 * an overview, never a second source of truth.
 */
function buildDrillTable(bucket: Bucket, balance: ReturnType<typeof computeBalances>): DrillTable {
  switch (bucket) {
    case "karigar": {
      const jobs = useJobCards
        .getState()
        .jobs.filter((j) => JOB_STATUS_ACTIVE.includes(normalizeJobStatus(j.status)));
      const activeByWorker = new Map<string, number>();
      for (const j of jobs)
        if (j.karigarId)
          activeByWorker.set(j.karigarId, (activeByWorker.get(j.karigarId) ?? 0) + 1);
      const rows: (string | number)[][] = [];
      for (const wb of compileWorkerBooks()) {
        for (const pb of wb.purityBooks) {
          if (pb.currentBalanceMg === 0) continue;
          rows.push([
            wb.worker.fullName,
            pb.label,
            mgToGrams(pb.currentBalanceMg),
            mgToGrams(pb.currentBalanceMg),
            activeByWorker.get(wb.worker.id) ?? 0,
          ]);
        }
      }
      return {
        title: "Gold With Karigar — Summary",
        columns: ["Worker", "Purity", "Gold Held (g)", "Fine Equivalent (g)", "Active Jobs"],
        rows,
      };
    }
    case "customer": {
      const FINISHED = new Set(["customer", "firm_customer"]);
      const rows: (string | number)[][] = [];
      for (const p of usePeople.getState().people) {
        if (!FINISHED.has(p.type)) continue;
        const bal = getPartyGoldBalance(p.id);
        if (bal.receivedFineMg === 0 && bal.outstandingFineMg === 0) continue;
        rows.push([
          p.fullName,
          mgToGrams(bal.receivedFineMg),
          mgToGrams(bal.returnedFineMg),
          mgToGrams(bal.outstandingFineMg),
        ]);
      }
      return {
        title: "Advance Gold / Customer Gold Held — Summary",
        columns: ["Customer", "Gold Received (g)", "Gold Returned (g)", "Remaining Balance (g)"],
        rows,
      };
    }
    case "finished": {
      const FINISHED_STATUSES = new Set([
        "partially_ready",
        "ready_for_delivery",
        "ready",
        "ready_billing",
      ]);
      const rows: (string | number)[][] = [];
      for (const o of useOrders.getState().orders) {
        if (!FINISHED_STATUSES.has(normalizeOrderStatus(o.status))) continue;
        const items = o.items ?? (o.item ? [o.item] : []);
        const isStock = o.type === "ready_stock" || !o.customerId;
        const customer =
          usePeople.getState().people.find((p) => p.id === o.customerId)?.fullName ?? "—";
        for (const it of items) {
          rows.push([
            it.itemName,
            o.orderNo,
            isStock ? "—" : customer,
            isStock ? "Yes" : "No",
            mgToGrams(it.grossMg || 0),
            mgToGrams(it.netMg || 0),
            it.quantity || 1,
            normalizeOrderStatus(o.status),
          ]);
        }
      }
      return {
        title: "Finished Jewellery Stock — Overview",
        columns: [
          "Jewellery",
          "Order No",
          "Customer",
          "Stock Item",
          "Gross (g)",
          "Net (g)",
          "Qty",
          "Status",
        ],
        rows,
      };
    }
    default: {
      // vault (Gold Held), jeweller, scrap — per-purity inventory view.
      const titles: Partial<Record<Bucket, string>> = {
        vault: "Gold Held — Raw Gold Inventory",
        jeweller: "Gold With Jewellers — Summary",
        scrap: "Scrap / Dust Gold — Summary",
      };
      return {
        title: titles[bucket] ?? "Holdings",
        columns: ["Purity", "Touch (‰)", "Weight (g)", "Fine Equivalent (g)"],
        rows: purityRows(balance.bucketBreakdowns[bucket]),
      };
    }
  }
}

function DrillDownPanel({
  bucket,
  balance,
  onClose,
}: {
  bucket: Bucket;
  balance: ReturnType<typeof computeBalances>;
  onClose: () => void;
}) {
  const table = useMemo(() => buildDrillTable(bucket, balance), [bucket, balance]);

  function exportXlsx() {
    void exportToXLSX(`${table.title.replace(/[^\w]+/g, "-").toLowerCase()}.xlsx`, {
      Summary: [table.columns, ...table.rows],
    });
  }

  return (
    <div className="rounded-2xl border border-gold/40 bg-card shadow-elegant overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <h3 className="font-serif text-lg text-gold">{table.title}</h3>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportXlsx}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void printDocument(table.title, "Ledger")}
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="no-print">
            Close
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/60 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              {table.columns.map((c, i) => (
                <th key={c} className={`px-4 py-3 ${i === 0 ? "text-left" : "text-right"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.columns.length}
                  className="px-4 py-10 text-center text-muted-foreground italic"
                >
                  Nothing currently held in this category.
                </td>
              </tr>
            ) : (
              table.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-4 py-3 tabular-nums ${ci === 0 ? "text-left" : "text-right"}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpeningVaultForm() {
  const append = useLedger((s) => s.append);
  const [gross, setGross] = useState("");
  const [purity, setPurity] = useState("916");
  const [form, setForm] = useState<GoldForm>("bar");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ fineMg: number } | null>(null);

  let previewFineMg: number | null = null;
  let previewError: string | null = null;
  try {
    if (gross.trim() && purity.trim()) {
      const g = gramsToMg(gross);
      const p = parsePurity(purity);
      previewFineMg = fineGoldMg(g, p);
    }
  } catch (e) {
    previewError = (e as Error).message;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const grossMg = gramsToMg(gross);
      const p = parsePurity(purity);
      if (grossMg <= 0) throw new Error("Gross weight must be greater than 0 g.");
      const fineMg = fineGoldMg(grossMg, p);
      append({
        type: "opening_vault",
        netFineMg: fineMg,
        deltas: { vault: fineMg },
        grossMg,
        purity: p,
        fineMg,
        form,
        notes: notes.trim() || undefined,
        reference: "Opening Vault",
      });
      setSuccess({ fineMg });
      setGross("");
      setNotes("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-border bg-card p-6 shadow-elegant space-y-5"
      >
        <div>
          <h2 className="font-serif text-xl text-gold">Record Opening Vault Gold</h2>
          <p className="text-sm text-muted-foreground mt-1">
            One-time or periodic opening entry of physical gold in the vault. Fine gold is
            calculated as gross × purity ÷ 999 (this shop's touch convention).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gross">Gross weight (g)</Label>
            <Input
              id="gross"
              inputMode="decimal"
              placeholder="100.000"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Up to 3 decimal places (mg precision).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purity">Purity / Touch (per-mille)</Label>
            <div className="flex gap-2">
              <Input
                id="purity"
                inputMode="numeric"
                placeholder="916"
                value={purity}
                onChange={(e) => setPurity(e.target.value)}
                required
                className="flex-1"
              />
              <Select value={purity} onValueChange={(v) => setPurity(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Standard" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_PURITIES.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="form">Form</Label>
            <Select value={form} onValueChange={(v) => setForm(v as GoldForm)}>
              <SelectTrigger id="form">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOLD_FORMS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g. opening stock counted on 19-Jun-2026 by owner"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Vault credited with <strong>{mgToGrams(success.fineMg)} g</strong> fine gold. Balance
              sheet updated.
            </span>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" className="bg-primary text-primary-foreground hover:opacity-90">
            Add to Vault
          </Button>
        </div>
      </form>

      <aside className="rounded-2xl border border-gold/30 bg-gradient-to-br from-card to-background p-6 shadow-elegant">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Live preview
        </div>
        <div className="mt-2">
          <div className="text-sm text-muted-foreground">Fine gold</div>
          <div className="font-serif text-4xl text-gold mt-1">
            {previewError ? "—" : previewFineMg !== null ? mgToGrams(previewFineMg) : "—"}
            <span className="text-base text-muted-foreground"> g</span>
          </div>
        </div>
        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Gross</span>
            <span>{gross || "—"} g</span>
          </div>
          <div className="flex justify-between">
            <span>Purity</span>
            <span>{purity || "—"} /1000</span>
          </div>
          <div className="flex justify-between">
            <span>Form</span>
            <span className="capitalize">{form.replace("_", " ")}</span>
          </div>
        </div>
        {previewError ? (
          <div className="mt-4 text-[11px] text-destructive">{previewError}</div>
        ) : null}
        <div className="mt-6 pt-4 border-t border-border text-[11px] text-muted-foreground">
          Formula: fine = gross × purity ÷ 999, rounded to nearest mg. All math runs on integer
          milligrams to avoid floating-point error.
        </div>
      </aside>
    </div>
  );
}

function MovementsList({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/40 p-10 text-center text-sm text-muted-foreground">
        No ledger movements yet.
      </div>
    );
  }
  // newest first
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/60 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">When</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Gross (g)</th>
              <th className="text-right px-4 py-3">Purity</th>
              <th className="text-right px-4 py-3">Fine (g)</th>
              <th className="text-right px-4 py-3">Net to system</th>
              <th className="text-left px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[11px] text-gold">
                    {MOVEMENT_LABELS[e.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {e.grossMg != null ? mgToGrams(e.grossMg) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{e.purity ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gold">
                  {e.fineMg != null ? mgToGrams(e.fineMg) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {mgToGrams(e.netFineMg, { sign: true })}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.notes ?? e.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
