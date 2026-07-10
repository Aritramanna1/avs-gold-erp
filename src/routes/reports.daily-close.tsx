import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { useOrders } from "@/lib/orders-store";
import { useJobCards, karigarCustodySummaries } from "@/lib/jobcards-store";
import { useStock } from "@/lib/stock-store";
import { useBilling, paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { useWorkers } from "@/lib/workers-store";
import { useDailyCloses, type DailyCloseSnapshot } from "@/lib/dailyclose-store";
import { useFinancialLocks, loadFinancialLocks, isPeriodLocked } from "@/lib/financial-lock-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV } from "@/lib/report-engine";
import { migrateAllToCloud } from "@/lib/cloud-migrate";
import { hasLocalDiverged, getLastMigrationAt } from "@/lib/db-status";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/daily-close")({
  head: () => ({ meta: [{ title: "Daily Close · AVS Gold ERP" }] }),
  component: DailyClosePage,
});

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DailyClosePage() {
  const navigate = useNavigate();
  const ledger = useLedger((s) => s.entries);
  const orders = useOrders((s) => s.orders);
  const jobs = useJobCards((s) => s.jobs);
  const stockItems = useStock((s) => s.items);
  const invoices = useBilling((s) => s.invoices);
  const repairs = useRepairs((s) => s.repairs);
  const workers = useWorkers((s) => s);
  const addClose = useDailyCloses((s) => s.add);
  const closes = useDailyCloses((s) => s.closes);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  useFinancialLocks((s) => s.locks); // subscribe so isPeriodLocked() below re-evaluates on lock/unlock
  useEffect(() => {
    void loadFinancialLocks();
  }, []);

  const [date, setDate] = useState(todayStr());
  const [physCashStr, setPhysCashStr] = useState("");
  const [notes, setNotes] = useState("");
  const [manager, setManager] = useState("");
  const [owner, setOwner] = useState("");
  const [cashCounted, setCashCounted] = useState(false);
  const [goldChecked, setGoldChecked] = useState(false);
  const [pendingOrdersReviewed, setPendingOrdersReviewed] = useState(false);
  const [karigarCustodyReviewed, setKarigarCustodyReviewed] = useState(false);
  const [printReportsSaved, setPrintReportsSaved] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [syncMsg, setSyncMsg] = useState<string>("");
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const diverged = hasLocalDiverged();
  const lastMig = getLastMigrationAt();

  const dayStart = new Date(date + "T00:00:00").getTime();
  const dayEnd = new Date(date + "T23:59:59").getTime();
  const isToday = (ts: number) => ts >= dayStart && ts <= dayEnd;

  const snapshot: DailyCloseSnapshot = useMemo(() => {
    const balance = computeBalances(ledger);
    const balanceBefore = computeBalances(ledger.filter((e) => e.createdAt < dayStart));
    const todaysLedger = ledger.filter((e) => isToday(e.createdAt));
    const sum = (pred: (t: string) => boolean) =>
      todaysLedger
        .filter((e) => pred(e.type))
        .reduce((s, e) => s + (e.fineMg ?? Math.abs(e.netFineMg)), 0);

    const goldIssuedMg = todaysLedger
      .filter((e) => e.type === "issue_to_karigar")
      .reduce((s, e) => s + (e.deltas.karigar ?? 0), 0);
    const goldReceivedMg = todaysLedger
      .filter((e) => e.type === "receive_from_karigar" || e.type === "finished_item_created")
      .reduce((s, e) => s + Math.max(0, -(e.deltas.karigar ?? 0)), 0);
    const finishedCreatedMg = todaysLedger
      .filter((e) => e.type === "finished_item_created")
      .reduce((s, e) => s + (e.deltas.finished ?? 0), 0);
    const scrapReturnedMg = todaysLedger
      .filter((e) => e.type === "scrap_returned")
      .reduce((s, e) => s + (e.deltas.scrap ?? 0), 0);
    const soldFineMg = -todaysLedger
      .filter((e) => e.type === "sale")
      .reduce((s, e) => s + (e.deltas.finished ?? 0), 0);
    const custody = karigarCustodySummaries(jobs).reduce((s, c) => s + c.outstandingMg, 0);

    const invToday = invoices.filter((i) => isToday(i.createdAt) && i.status !== "cancelled");
    let cash = 0,
      upi = 0,
      bank = 0,
      card = 0,
      outstanding = 0,
      gstTotal = 0,
      salesTotal = 0;
    for (const inv of invToday) {
      salesTotal += inv.subtotalPaise + inv.gstPaise;
      gstTotal += inv.gstPaise;
      for (const p of inv.payments) {
        if (!isToday(p.ts)) continue;
        if (p.mode === "cash") cash += p.amountPaise;
        else if (p.mode === "upi") upi += p.amountPaise;
        else if (p.mode === "bank") bank += p.amountPaise;
        else if (p.mode === "card") card += p.amountPaise;
        else if (p.mode === "outstanding") outstanding += p.amountPaise;
      }
    }
    // include repair payments
    let repairPay = 0;
    for (const r of repairs) {
      if (isToday(r.createdAt)) repairPay += r.advancePaise;
      for (const p of r.payments) {
        if (isToday(p.ts) && p.mode !== "outstanding") {
          repairPay += p.amountPaise;
          if (p.mode === "cash") cash += p.amountPaise;
          else if (p.mode === "upi") upi += p.amountPaise;
          else if (p.mode === "bank") bank += p.amountPaise;
          else if (p.mode === "card") card += p.amountPaise;
        }
      }
    }
    const workerWithdrawals = workers.withdrawals
      .filter((w) => w.date === date)
      .reduce((s, w) => s + w.amountPaise, 0);

    return {
      openingVaultMg: balanceBefore.buckets.vault,
      goldIssuedMg: Math.abs(goldIssuedMg),
      goldReceivedMg,
      finishedCreatedMg,
      scrapReturnedMg,
      soldFineMg,
      closingVaultMg: balance.buckets.vault,
      karigarOutstandingMg: custody,
      balanceSheetBalanced: balance.balanced,
      discrepancyMg: balance.discrepancyMg,
      invoiceCount: invToday.length,
      salesTotalPaise: salesTotal,
      cashTotalPaise: cash,
      upiTotalPaise: upi,
      bankTotalPaise: bank,
      cardTotalPaise: card,
      outstandingTotalPaise: outstanding,
      repairPaymentsPaise: repairPay,
      workerWithdrawalsPaise: workerWithdrawals,
      gstCollectedPaise: gstTotal,
      jobCardsCreated: jobs.filter((j) => isToday(j.createdAt)).length,
      jobCardsClosed: jobs.filter((j) => isToday(j.updatedAt) && j.status === "closed").length,
      repairsCreated: repairs.filter((r) => isToday(r.createdAt)).length,
      repairsDelivered: repairs.filter((r) => r.deliveredAt && isToday(r.deliveredAt)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, invoices, jobs, repairs, workers.withdrawals, date]);

  const physCash = rupeesToPaise(physCashStr || 0);
  const expectedCash = snapshot.cashTotalPaise;
  const cashVariance = physCash - expectedCash;

  const runSyncAndPrint = async (closeId: string) => {
    setSyncState("running");
    setSyncMsg("Pushing today's data to Lovable Cloud…");
    try {
      const res = await migrateAllToCloud((p) => {
        if (!p.ok) return;
        setSyncMsg(`Syncing ${p.table} (${p.inserted}/${p.total})…`);
      });
      if (res.ok) {
        setSyncState("ok");
        setSyncMsg("Daily Close synced to cloud.");
        navigate({ to: "/reports/dailyclose-print/$id", params: { id: closeId } });
      } else {
        setSyncState("error");
        setSyncMsg("Cloud sync failed — printable close blocked. " + res.errors.join("; "));
      }
    } catch (e) {
      setSyncState("error");
      setSyncMsg(
        "Cloud sync error — printable close blocked. " +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  const onSave = async () => {
    if (isPeriodLocked(selectedBranchId || "MAIN", date)) {
      toast.error(
        `${date.slice(0, 7)} is locked for month-end close on this branch — unlock it in Month-End Close first.`,
      );
      return;
    }
    const c = addClose({
      date,
      snapshot,
      checklist: {
        cashCounted,
        goldChecked,
        pendingOrdersReviewed,
        karigarCustodyReviewed,
        printReportsSaved,
      },
      physicalCashCountedPaise: physCash,
      expectedCashPaise: expectedCash,
      cashVariancePaise: cashVariance,
      notes,
      managerSignature: manager,
      ownerSignature: owner,
    });
    setLastSavedId(c.id);
    // Auto-push pilot data to Lovable Cloud at end of day so nothing is missed.
    await runSyncAndPrint(c.id);
  };

  const onReprint = async (id: string) => {
    // If local diverges from last cloud snapshot, force a re-sync before allowing print.
    if (hasLocalDiverged()) {
      setLastSavedId(id);
      await runSyncAndPrint(id);
      return;
    }
    navigate({ to: "/reports/dailyclose-print/$id", params: { id } });
  };

  const todaysCloses = closes.filter((c) => c.date === date);

  function handleCSV() {
    const header = [
      "Date",
      "Saved At",
      "Balanced",
      "Discrepancy (g)",
      "Sales Total",
      "Invoices",
      "Closing Vault (g)",
      "Karigar Outstanding (g)",
    ];
    const data = closes.map((c) => [
      c.date,
      new Date(c.createdAt).toLocaleString("en-IN"),
      c.snapshot.balanceSheetBalanced ? "Yes" : "No",
      mgToGrams(c.snapshot.discrepancyMg),
      paiseToRupees(c.snapshot.salesTotalPaise),
      c.snapshot.invoiceCount,
      mgToGrams(c.snapshot.closingVaultMg),
      mgToGrams(c.snapshot.karigarOutstandingMg),
    ]);
    exportToCSV("daily-close-history.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/reports">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Button>
        </Link>
      </div>
      <PageHeader
        title="Daily Close"
        subtitle="End-of-day reconciliation and shop summary."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <Download className="h-4 w-4" /> Export History CSV
          </Button>
        }
      />

      {!snapshot.balanceSheetBalanced && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 mb-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <b>Gold difference found.</b> Please reconcile before closing. Discrepancy:{" "}
            {mgToGrams(snapshot.discrepancyMg)} g.
          </div>
        </div>
      )}

      {isPeriodLocked(selectedBranchId || "MAIN", date) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <b>{date.slice(0, 7)} is locked for month-end close.</b> Saving a new close for this
            date is blocked until it's unlocked in{" "}
            <Link to="/reports/month-end-close" className="underline">
              Month-End Close
            </Link>
            .
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Close Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {todaysCloses.length > 0 && (
            <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30">
              {todaysCloses.length} close{todaysCloses.length > 1 ? "s" : ""} already saved for this
              date
            </Badge>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Gold Summary">
          <Row k="Opening Vault" v={`${mgToGrams(snapshot.openingVaultMg)} g`} />
          <Row k="Gold Issued Today" v={`${mgToGrams(snapshot.goldIssuedMg)} g`} />
          <Row k="Gold Received Today" v={`${mgToGrams(snapshot.goldReceivedMg)} g`} />
          <Row k="Finished Created" v={`${mgToGrams(snapshot.finishedCreatedMg)} g`} />
          <Row k="Scrap Returned" v={`${mgToGrams(snapshot.scrapReturnedMg)} g`} />
          <Row k="Sold (fine)" v={`${mgToGrams(snapshot.soldFineMg)} g`} />
          <Row k="Closing Vault" v={`${mgToGrams(snapshot.closingVaultMg)} g`} bold />
          <Row k="Karigar Outstanding" v={`${mgToGrams(snapshot.karigarOutstandingMg)} g`} />
          <div className="mt-2">
            <Badge
              variant="outline"
              className={
                snapshot.balanceSheetBalanced
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-red-500/15 text-red-300 border-red-500/30"
              }
            >
              {snapshot.balanceSheetBalanced
                ? "BALANCED"
                : `DIFFERENCE ${mgToGrams(snapshot.discrepancyMg)} g`}
            </Badge>
          </div>
        </Section>

        <Section title="Cash / Payments">
          <Row k="Invoices" v={String(snapshot.invoiceCount)} />
          <Row k="Sales Total" v={`₹ ${paiseToRupees(snapshot.salesTotalPaise)}`} />
          <Row k="Cash" v={`₹ ${paiseToRupees(snapshot.cashTotalPaise)}`} />
          <Row k="UPI" v={`₹ ${paiseToRupees(snapshot.upiTotalPaise)}`} />
          <Row k="Bank" v={`₹ ${paiseToRupees(snapshot.bankTotalPaise)}`} />
          <Row k="Card" v={`₹ ${paiseToRupees(snapshot.cardTotalPaise)}`} />
          <Row k="Outstanding" v={`₹ ${paiseToRupees(snapshot.outstandingTotalPaise)}`} />
          <Row k="GST Collected" v={`₹ ${paiseToRupees(snapshot.gstCollectedPaise)}`} />
          <Row k="Repair Payments" v={`₹ ${paiseToRupees(snapshot.repairPaymentsPaise)}`} />
          <Row k="Worker Withdrawals" v={`₹ ${paiseToRupees(snapshot.workerWithdrawalsPaise)}`} />
        </Section>

        <Section title="Workshop / Orders / Repair">
          <Row k="Job Cards Created" v={String(snapshot.jobCardsCreated)} />
          <Row k="Job Cards Closed" v={String(snapshot.jobCardsClosed)} />
          <Row k="Orders Today" v={String(orders.filter((o) => isToday(o.createdAt)).length)} />
          <Row k="Repairs Created" v={String(snapshot.repairsCreated)} />
          <Row k="Repairs Delivered" v={String(snapshot.repairsDelivered)} />
          <Row k="Stock Items (total)" v={String(stockItems.length)} />
        </Section>

        <Section title="Checklist">
          <Check label="Cash counted" checked={cashCounted} onChange={setCashCounted} />
          <Check label="Gold checked" checked={goldChecked} onChange={setGoldChecked} />
          <Check
            label="Pending orders reviewed"
            checked={pendingOrdersReviewed}
            onChange={setPendingOrdersReviewed}
          />
          <Check
            label="Karigar custody reviewed"
            checked={karigarCustodyReviewed}
            onChange={setKarigarCustodyReviewed}
          />
          <Check
            label="Print reports saved"
            checked={printReportsSaved}
            onChange={setPrintReportsSaved}
          />
        </Section>

        <Section title="Cash Reconciliation">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Physical Cash (₹)</Label>
              <Input
                value={physCashStr}
                onChange={(e) => setPhysCashStr(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Expected Cash (₹)</Label>
              <Input value={paiseToRupees(expectedCash)} disabled />
            </div>
          </div>
          <div
            className={`mt-2 text-sm ${cashVariance === 0 ? "text-emerald-300" : "text-amber-300"}`}
          >
            Variance: ₹ {paiseToRupees(cashVariance)}
          </div>
        </Section>

        <Section title="Signatures & Notes">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to record about today"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <Label>Manager Signature (name)</Label>
              <Input value={manager} onChange={(e) => setManager(e.target.value)} />
            </div>
            <div>
              <Label>Owner Signature (name)</Label>
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
            </div>
          </div>
        </Section>
      </div>

      {(diverged || !lastMig) && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2 text-xs text-amber-200">
          <CloudOff className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <b>Local data differs from cloud.</b> Saving the Daily Close will auto-migrate
            everything to Lovable Cloud first. The printable close opens only after sync succeeds.
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {syncState !== "idle" && (
          <div
            className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded-md border ${
              syncState === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : syncState === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {syncState === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {syncState === "ok" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {syncState === "error" && <XCircle className="h-3.5 w-3.5" />}
            <span>{syncMsg}</span>
          </div>
        )}
        {syncState === "error" && lastSavedId && (
          <Button variant="outline" onClick={() => runSyncAndPrint(lastSavedId)} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry Sync
          </Button>
        )}
        <Link to="/reports">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          data-testid="dailyclose-save"
          onClick={onSave}
          disabled={syncState === "running"}
          className="gap-2"
        >
          {syncState === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Daily Close & Sync
        </Button>
      </div>

      {todaysCloses.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 mt-4">
          <h3 className="font-serif text-gold mb-3">Saved Closes — {date}</h3>
          <ul className="space-y-2 text-sm">
            {todaysCloses.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between border-t border-border pt-2"
              >
                <span>
                  {new Date(c.createdAt).toLocaleString("en-IN")} · ₹{" "}
                  {paiseToRupees(c.snapshot.salesTotalPaise)}
                </span>
                <Button
                  data-testid="dailyclose-print"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => onReprint(c.id)}
                  disabled={syncState === "running"}
                >
                  <Printer className="h-3 w-3" /> Reprint
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-serif text-gold mb-3">{title}</h3>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-gold" : ""}`}>
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{label}</span>
    </label>
  );
}
