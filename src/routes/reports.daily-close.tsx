import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { useDailyCloses, type DailyCloseSnapshot } from "@/lib/dailyclose-store";
import { fetchDailyCloseSnapshot } from "@/lib/daily-close-query";
import { useFinancialLocks, loadFinancialLocks, isPeriodLocked } from "@/lib/financial-lock-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV } from "@/lib/report-engine";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
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

const EMPTY_SNAPSHOT: DailyCloseSnapshot = {
  openingVaultMg: 0,
  goldIssuedMg: 0,
  goldReceivedMg: 0,
  finishedCreatedMg: 0,
  scrapReturnedMg: 0,
  soldFineMg: 0,
  closingVaultMg: 0,
  karigarOutstandingMg: 0,
  balanceSheetBalanced: true,
  discrepancyMg: 0,
  invoiceCount: 0,
  salesTotalPaise: 0,
  cashTotalPaise: 0,
  upiTotalPaise: 0,
  bankTotalPaise: 0,
  cardTotalPaise: 0,
  outstandingTotalPaise: 0,
  repairPaymentsPaise: 0,
  workerWithdrawalsPaise: 0,
  gstCollectedPaise: 0,
  jobCardsCreated: 0,
  jobCardsClosed: 0,
  repairsCreated: 0,
  repairsDelivered: 0,
};

function DailyClosePage() {
  const navigate = useNavigate();
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
  const [snapshot, setSnapshot] = useState<DailyCloseSnapshot | null>(null);
  const [ordersToday, setOrdersToday] = useState(0);
  const [stockItemsTotal, setStockItemsTotal] = useState(0);
  const [snapshotCapped, setSnapshotCapped] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSnapshotLoading(true);
    setSnapshotError(null);
    fetchDailyCloseSnapshot(date, selectedBranchId || "MAIN")
      .then((result) => {
        if (!live) return;
        setSnapshot(result.snapshot);
        setOrdersToday(result.ordersToday);
        setStockItemsTotal(result.stockItemsTotal);
        setSnapshotCapped(result.capped);
      })
      .catch((error: any) => {
        if (live) setSnapshotError(error?.message ?? "Could not load daily close snapshot.");
      })
      .finally(() => {
        if (live) setSnapshotLoading(false);
      });
    return () => {
      live = false;
    };
  }, [date, selectedBranchId]);
  const closeSnapshot = snapshot ?? EMPTY_SNAPSHOT;

  const physCash = rupeesToPaise(physCashStr || 0);
  const expectedCash = closeSnapshot.cashTotalPaise;
  const cashVariance = physCash - expectedCash;

  const runSyncAndPrint = async (closeId: string) => {
    setSyncState("ok");
    setSyncMsg("Daily Close saved in Supabase. Opening print view.");
    navigate({ to: "/reports/dailyclose-print/$id", params: { id: closeId } });
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
      snapshot: closeSnapshot,
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
    await runSyncAndPrint(c.id);
  };

  const onReprint = async (id: string) => {
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

      {snapshotLoading && (
        <div className="rounded-md border border-border bg-card p-4 mb-4 text-sm text-muted-foreground">
          Loading Daily Close snapshot from Supabase...
        </div>
      )}

      {snapshotError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 mb-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <b>Daily Close snapshot could not load.</b> {snapshotError}
          </div>
        </div>
      )}

      {snapshotCapped && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 mb-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            This close is showing a capped Supabase preview. Full-history aggregate RPC evidence is
            still required before Daily Close can be release PASS.
          </div>
        </div>
      )}

      {!closeSnapshot.balanceSheetBalanced && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 mb-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <b>Gold difference found.</b> Please reconcile before closing. Discrepancy:{" "}
            {mgToGrams(closeSnapshot.discrepancyMg)} g.
          </div>
        </div>
      )}

      {isPeriodLocked(selectedBranchId || "MAIN", date) && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 mb-4 flex items-start gap-3 text-sm">
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

      <div className="rounded-md border border-border bg-card p-5 mb-4">
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
          <Row k="Opening Vault" v={`${mgToGrams(closeSnapshot.openingVaultMg)} g`} />
          <Row k="Gold Issued Today" v={`${mgToGrams(closeSnapshot.goldIssuedMg)} g`} />
          <Row k="Gold Received Today" v={`${mgToGrams(closeSnapshot.goldReceivedMg)} g`} />
          <Row k="Finished Created" v={`${mgToGrams(closeSnapshot.finishedCreatedMg)} g`} />
          <Row k="Scrap Returned" v={`${mgToGrams(closeSnapshot.scrapReturnedMg)} g`} />
          <Row k="Sold (fine)" v={`${mgToGrams(closeSnapshot.soldFineMg)} g`} />
          <Row k="Closing Vault" v={`${mgToGrams(closeSnapshot.closingVaultMg)} g`} bold />
          <Row k="Karigar Outstanding" v={`${mgToGrams(closeSnapshot.karigarOutstandingMg)} g`} />
          <div className="mt-2">
            <Badge
              variant="outline"
              className={
                closeSnapshot.balanceSheetBalanced
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-red-500/15 text-red-300 border-red-500/30"
              }
            >
              {closeSnapshot.balanceSheetBalanced
                ? "BALANCED"
                : `DIFFERENCE ${mgToGrams(closeSnapshot.discrepancyMg)} g`}
            </Badge>
          </div>
        </Section>

        <Section title="Cash / Payments">
          <Row k="Invoices" v={String(closeSnapshot.invoiceCount)} />
          <Row k="Sales Total" v={`₹ ${paiseToRupees(closeSnapshot.salesTotalPaise)}`} />
          <Row k="Cash" v={`₹ ${paiseToRupees(closeSnapshot.cashTotalPaise)}`} />
          <Row k="UPI" v={`₹ ${paiseToRupees(closeSnapshot.upiTotalPaise)}`} />
          <Row k="Bank" v={`₹ ${paiseToRupees(closeSnapshot.bankTotalPaise)}`} />
          <Row k="Card" v={`₹ ${paiseToRupees(closeSnapshot.cardTotalPaise)}`} />
          <Row k="Outstanding" v={`₹ ${paiseToRupees(closeSnapshot.outstandingTotalPaise)}`} />
          <Row k="GST Collected" v={`₹ ${paiseToRupees(closeSnapshot.gstCollectedPaise)}`} />
          <Row k="Repair Payments" v={`₹ ${paiseToRupees(closeSnapshot.repairPaymentsPaise)}`} />
          <Row
            k="Worker Withdrawals"
            v={`₹ ${paiseToRupees(closeSnapshot.workerWithdrawalsPaise)}`}
          />
        </Section>

        <Section title="Workshop / Orders / Repair">
          <Row k="Job Cards Created" v={String(closeSnapshot.jobCardsCreated)} />
          <Row k="Job Cards Closed" v={String(closeSnapshot.jobCardsClosed)} />
          <Row k="Orders Today" v={String(ordersToday)} />
          <Row k="Repairs Created" v={String(closeSnapshot.repairsCreated)} />
          <Row k="Repairs Delivered" v={String(closeSnapshot.repairsDelivered)} />
          <Row k="Stock Items (total)" v={String(stockItemsTotal)} />
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
        <div className="rounded-md border border-border bg-card p-5 mt-4">
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
    <div className="rounded-md border border-border bg-card p-5">
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
