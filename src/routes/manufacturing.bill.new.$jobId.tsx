/**
 * Manufacturing Bill — Creation / Editing
 *
 * Opened from the Manufacturing Dashboard when a Job Card reaches
 * "ready_for_billing". Auto-populates everything from the Job Card.
 * The user reviews, adjusts P entries / MP entries / charges, then clicks
 * "Finalise Manufacturing Bill" which triggers the full cascade.
 */
import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useJobCards } from "@/lib/jobcards-store";
import {
  useMfgBills,
  buildBillFromJobCard,
  calcPEntryFine,
  calcMpEntryFine,
  calcBhavGoldMg,
  autoCollectManufacturingBillData,
  type ManufacturingBill,
  type PEntry,
  type MpEntry,
} from "@/lib/manufacturing-bill-store";
import { calcNetMfgCost } from "@/lib/mfg-costing";
import { fineGoldMg } from "@/lib/gold";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { useCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { useCurrentBranchId } from "@/lib/branch-store";
import { nextDocumentNumber } from "@/lib/document-numbering";
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Trash2,
  AlertTriangle,
  Scale,
  Hammer,
  PackageCheck,
  TrendingDown,
  IndianRupee,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/manufacturing/bill/new/$jobId")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "New Manufacturing Bill · AVS Gold ERP" }] }),
  component: NewMfgBill,
});

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}`;
}

const MG_TO_G = (mg: number) => (mg / 1000).toFixed(3);
const G_TO_MG = (gStr: string) => Math.max(0, Math.round(parseFloat(gStr || "0") * 1000));
/** Clamped wrapper around fineGoldMg() — these fields are free-typed number
 * inputs with no upper bound, and fineGoldMg() throws on out-of-range
 * purity/grossMg; clamp here so a mistyped value (e.g. "150%") can't crash
 * the page instead of just being an obviously-wrong number to correct. */
const safeFineGoldMg = (grossMg: number, purity: number) =>
  fineGoldMg(Math.max(0, Math.round(grossMg)), Math.max(0, Math.min(999, Math.round(purity))));

export default function NewMfgBill() {
  const { jobId } = useParams({ from: "/manufacturing/bill/new/$jobId" });
  const navigate = useNavigate();
  const { jobs } = useJobCards();
  const { bills, saveBill, patchBill, finaliseBill } = useMfgBills();
  const { config: wf } = useWorkflowEngine();
  const goldRatePerGramPaise = useCurrentGoldRatePaise();
  const branchId = useCurrentBranchId();

  const job = jobs.find((j) => j.id === jobId);

  // Check if a draft already exists for this job
  const existingDraft = bills.find((b) => b.jobCardId === jobId && b.status === "draft");

  const [bill, setBill] = useState<ManufacturingBill | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finaliseResult, setFinaliseResult] = useState<{
    ok: boolean;
    warnings: string[];
  } | null>(null);

  const customerLedger = useMemo(
    () => (job?.customerId ? compileCustomerLedger(job.customerId) : null),
    [job?.customerId],
  );

  // Initialise bill from job card or existing draft
  useEffect(() => {
    if (!job) return;
    if (existingDraft) {
      setBill(existingDraft);
      return;
    }
    let cancelled = false;
    (async () => {
      // Atomic, concurrency-safe — same next_document_number() engine every
      // other official document uses, keyed per job so re-running this
      // effect for the same job (e.g. a fast-refresh) can't ever hand out
      // two different bill numbers for one job card.
      const billNo = await nextDocumentNumber(
        `manufacturing_bill:${job.id}`,
        `MFG-${job.jobNo}-`,
        3,
      );
      if (cancelled) return;
      const newBill = buildBillFromJobCard(job, billNo, branchId);
      // Seed bhav rate from settings
      newBill.goldBhavRatePaise = goldRatePerGramPaise;
      // Auto-collect from Order-level Issue/Return/Outside Work/Labour/Polishing
      // — the operator never re-enters what these other modules already
      // recorded. Only unlinked (not-yet-consumed-by-a-bill) records are
      // pulled, so this is safe even if the order already has an older bill.
      Object.assign(newBill, autoCollectManufacturingBillData(job.orderId, job.orderNo));
      setBill(newBill);
      // Auto-save the draft immediately
      saveBill(newBill);
    })();
    return () => {
      cancelled = true;
    };
  }, [job?.id]);

  /** Re-runs auto-collection against whatever is newly available for this
   *  order (e.g. an Outside Work labour bill added after this draft was
   *  created) and merges it in — never overwrites manually-edited charges
   *  or P/MP entries, only the auto-collected fields themselves. */
  function refreshAutoCollected() {
    if (!bill || !job) return;
    const collected = autoCollectManufacturingBillData(job.orderId, job.orderNo);
    patch(collected);
    toast.success("Auto-collected data refreshed from Order/Outside Work/Polishing.");
  }

  // ── Patch helpers ─────────────────────────────────────────────────────────

  const patch = useCallback(
    (diff: Partial<ManufacturingBill>) => {
      setBill((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...diff, updatedAt: Date.now() };
        // Recompute bhav gold
        next.bhavGoldMg = calcBhavGoldMg(next.cashPaymentPaise, next.goldBhavRatePaise);
        // Recompute totals
        const totalPFine = next.pEntries.reduce((s, e) => s + e.fineMg, 0);
        const totalMpFine = next.mpEntries.reduce((s, e) => s + e.fineMg, 0);
        next.totalGoldIssuedFineMg = next.goldIssuedFineMg + totalPFine;
        next.totalGoldReturnedFineMg =
          next.finishedFineMg + next.scrapFineMg + next.filingsFineMg + next.dustFineMg;
        next.actualWastageFineMg = Math.max(
          0,
          next.totalGoldIssuedFineMg - next.totalGoldReturnedFineMg,
        );
        next.actualWastagePct =
          next.totalGoldIssuedFineMg > 0
            ? Math.round((next.actualWastageFineMg / next.totalGoldIssuedFineMg) * 10000) / 100
            : 0;
        next.closingBalanceMg = next.openingBalanceMg - totalPFine + totalMpFine + next.bhavGoldMg;

        // Gold-first outstanding: every fine-gold-out figure minus every
        // fine-gold-back figure, across the Job-Card AND Order-level models.
        const totalOutMg =
          next.totalGoldIssuedFineMg + next.orderIssuedFineMg + next.outsideWorkIssuedFineMg;
        const totalBackMg =
          next.totalGoldReturnedFineMg + next.orderReturnedFineMg + next.outsideWorkReturnedFineMg;
        next.goldOutstandingFineMg = Math.max(0, totalOutMg - totalBackMg);

        // Configurable charges forced to 0 when their toggle is off — the UI
        // hides the field too, but this is the actual enforcement point.
        const effectiveHallmark = wf.mfgChargeHallmarkEnabled ? next.hallmarkChargesPaise : 0;
        const effectiveHuid = wf.mfgChargeHuidEnabled ? next.huidChargesPaise : 0;
        if (!wf.mfgChargeHallmarkEnabled) next.hallmarkChargesPaise = 0;
        if (!wf.mfgChargeHuidEnabled) next.huidChargesPaise = 0;

        const costing = calcNetMfgCost({
          labourChargesPaise:
            next.labourChargesPaise + next.pEntries.reduce((s, e) => s + e.labourPaise, 0),
          makingChargesPaise: next.makingChargesPaise,
          stoneCostPaise: next.stoneChargesPaise + next.stoneSettingPaise,
          hallmarkChargesPaise: effectiveHallmark,
          wastageMg: next.actualWastageFineMg,
          goldRatePaisePerGram: next.goldBhavRatePaise,
          recoveryMg: 0,
          recoveryRatePaisePerGram: 0,
          outsideWorkChargesPaise: next.outsideWorkChargesPaise,
          polishingChargesPaise: next.polishingChargesPaise,
          huidChargesPaise: effectiveHuid,
          otherChargesPaise: next.otherChargesPaise,
        });
        next.netMfgCostPaise = costing.netMfgCostPaise;

        return next;
      });
    },
    [wf],
  );

  // ── P Entry helpers ───────────────────────────────────────────────────────

  function addPEntry() {
    if (!bill) return;
    const idx = bill.pEntries.length;
    const entry: PEntry = {
      id: makeId(),
      ref: `P${idx + 2}`,
      description: "",
      stamp: "",
      grossMg: 0,
      addWtMg: 0,
      netMg: 0,
      tunchPct: 91.6,
      wstgPct: 2.0,
      pcs: 1,
      labourPaise: 0,
      fineMg: 0,
    };
    patch({ pEntries: [...bill.pEntries, entry] });
  }

  function patchPEntry(id: string, diff: Partial<PEntry>) {
    if (!bill) return;
    const entries = bill.pEntries.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...diff };
      next.netMg = next.grossMg + next.addWtMg;
      next.fineMg = calcPEntryFine(next.netMg, next.tunchPct, next.wstgPct);
      return next;
    });
    patch({ pEntries: entries });
  }

  function removePEntry(id: string) {
    if (!bill) return;
    patch({ pEntries: bill.pEntries.filter((e) => e.id !== id) });
  }

  // ── MP Entry helpers ──────────────────────────────────────────────────────

  function addMpEntry(type: MpEntry["entryType"], label: string) {
    if (!bill) return;
    const entry: MpEntry = {
      id: makeId(),
      entryType: type,
      label,
      grossMg: 0,
      tunchPct: 91.6,
      pcs: 1,
      fineMg: 0,
    };
    patch({ mpEntries: [...bill.mpEntries, entry] });
  }

  function patchMpEntry(id: string, diff: Partial<MpEntry>) {
    if (!bill) return;
    const entries = bill.mpEntries.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...diff };
      next.fineMg = calcMpEntryFine(next.grossMg, next.tunchPct);
      return next;
    });
    patch({ mpEntries: entries });
  }

  function removeMpEntry(id: string) {
    if (!bill) return;
    patch({ mpEntries: bill.mpEntries.filter((e) => e.id !== id) });
  }

  // ── Save draft ────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!bill) return;
    setSaving(true);
    try {
      await saveBill(bill);
      toast.success("Draft saved");
    } finally {
      setSaving(false);
    }
  }

  // ── Finalise ──────────────────────────────────────────────────────────────

  async function handleFinalise() {
    if (!bill) return;
    setSaving(true);
    setConfirmOpen(false);
    try {
      await saveBill(bill);
      const result = await finaliseBill(bill.id, { branchId });
      setFinaliseResult({ ok: result.ok, warnings: result.warnings });
      if (result.ok) {
        toast.success("Manufacturing Bill finalised! Production cycle closed.");
        setTimeout(
          () => navigate({ to: "/manufacturing/bill/$id", params: { id: bill.id } }),
          1500,
        );
      } else {
        toast.error(result.errors.join(" · "));
      }
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!job) {
    return (
      <div className="p-8 text-center space-y-2">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="font-semibold">Job Card not found</p>
        <Link to="/manufacturing">
          <Button variant="outline" size="sm">
            ← Back
          </Button>
        </Link>
      </div>
    );
  }

  if (!bill) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const totalPFine = bill.pEntries.reduce((s, e) => s + e.fineMg, 0);
  const totalMpFine = bill.mpEntries.reduce((s, e) => s + e.fineMg, 0);
  const totalLabour =
    bill.pEntries.reduce((s, e) => s + e.labourPaise, 0) + bill.labourChargesPaise;
  // Must mirror manufacturing.bill.$id.tsx's totalCharges exactly — this is
  // what the printed bill actually totals, and this screen's GST preview
  // needs to match what will print, not a narrower subset of charge fields.
  const totalCharges =
    totalLabour +
    bill.makingChargesPaise +
    bill.stoneChargesPaise +
    bill.stoneSettingPaise +
    bill.hallmarkChargesPaise +
    bill.huidChargesPaise +
    bill.outsideWorkChargesPaise +
    bill.polishingChargesPaise +
    bill.otherChargesPaise;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/manufacturing">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <PageHeader
            title={`Manufacturing Bill — ${bill.billNo}`}
            subtitle={`${job.customerName} · Job ${job.jobNo} · ${job.itemName}`}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-amber-400 border-amber-500/30">
            Draft
          </Badge>
          {wf.mfgApprovalRequired && (
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 ${bill.approved ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"}`}
              onClick={() =>
                patch({
                  approved: !bill.approved,
                  approvedAt: !bill.approved ? Date.now() : undefined,
                })
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              {bill.approved ? "Approved" : "Mark Approved"}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refreshAutoCollected}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Auto-Collected
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving}>
            Save Draft
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            onClick={() => setConfirmOpen(true)}
            disabled={saving || (wf.mfgApprovalRequired && !bill.approved)}
            title={
              wf.mfgApprovalRequired && !bill.approved ? "Mark the bill Approved first" : undefined
            }
          >
            <CheckCircle2 className="h-4 w-4" />
            Finalise Bill
          </Button>
        </div>
      </div>

      {/* ── Customer Gold Account Summary ── */}
      {customerLedger && (
        <Card
          title={`Customer Gold Account — ${job.customerName}`}
          icon={Users}
          color="text-amber-400"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryTile
              label="Gold Advance Available"
              value={`${MG_TO_G(customerLedger.goldAdvanceMg)} g`}
              color="text-emerald-400"
            />
            <SummaryTile
              label="Gold We Owe Customer"
              value={`${MG_TO_G(Math.max(0, customerLedger.goldCreditOwedMg))} g`}
              color="text-amber-400"
            />
            <SummaryTile
              label="Gold Customer Owes Us"
              value={`${MG_TO_G(Math.max(0, -customerLedger.goldCreditOwedMg))} g`}
              color="text-rose-400"
            />
            <SummaryTile
              label="Outstanding Gold Balance"
              value={`${MG_TO_G(customerLedger.closingGoldMg)} g`}
              color="text-amber-300"
            />
          </div>
        </Card>
      )}

      {/* ── Gold Position — always visible, gold is the primary accounting
          unit here (cash is only a supporting/reference value). Placed
          before every other section, including Charges, so the karigar's
          outstanding gold position is never buried below cash figures. ── */}
      <GoldPositionBar
        requiredFineMg={bill.totalGoldIssuedFineMg}
        returnedFineMg={bill.totalGoldReturnedFineMg}
        outstandingMg={bill.closingBalanceMg}
        purityPct={bill.goldIssuedPurity / 10}
        wastagePct={bill.actualWastagePct}
      />

      {/* ── Order-Level Gold Position — auto-collected, read-only. Covers
          the newer Order-level Issue/Return/Outside-Work flow, which the
          Job-Card GoldPositionBar above doesn't see. Both can be non-zero
          on the same bill if an order used both flows at different times;
          goldOutstandingFineMg (shown in Charges further down as part of
          Final Gold Position) already sums BOTH sources. ── */}
      {(bill.goldReceivedFromCustomerFineMg > 0 ||
        bill.orderIssuedFineMg > 0 ||
        bill.orderReturnedFineMg > 0 ||
        bill.outsideWorkIssuedFineMg > 0 ||
        bill.outsideWorkReturnedFineMg > 0) && (
        <Card title="Order-Level Gold (Auto-Collected)" icon={Scale} color="text-blue-400">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryTile
              label="Received from Customer"
              value={`${MG_TO_G(bill.goldReceivedFromCustomerFineMg)} g`}
              color="text-blue-400"
            />
            <SummaryTile
              label="Issued (Order-Level)"
              value={`${MG_TO_G(bill.orderIssuedFineMg)} g`}
              color="text-blue-400"
            />
            <SummaryTile
              label="Returned (Order-Level)"
              value={`${MG_TO_G(bill.orderReturnedFineMg)} g`}
              color="text-emerald-400"
            />
            <SummaryTile
              label="Outside Work Issued"
              value={`${MG_TO_G(bill.outsideWorkIssuedFineMg)} g`}
              color="text-amber-400"
            />
            <SummaryTile
              label="Outside Work Returned"
              value={`${MG_TO_G(bill.outsideWorkReturnedFineMg)} g`}
              color="text-emerald-400"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Pulled automatically from Order Gold/Material Issue, Worker Return, and Outside Work —
            nothing here was re-entered manually. Use "Refresh Auto-Collected" above if more
            activity was recorded against this order after this draft was created.
          </p>
        </Card>
      )}

      {/* ── Section 1: Gold Issued (read-only, from Job Card) ─────────────── */}
      <Card title="Gold Issued to Karigar" icon={Scale} color="text-blue-400">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ReadField label="Issue Slip" value={bill.goldIssueSlipNo || "—"} />
          <ReadField label="Karigar" value={bill.karigarName || "—"} />
          <ReadField label="Gross Weight" value={`${MG_TO_G(bill.goldIssuedGrossMg)} g`} mono />
          <ReadField label="Purity" value={`${(bill.goldIssuedPurity / 10).toFixed(1)}%`} mono />
          <ReadField
            label="Fine Gold Issued"
            value={`${MG_TO_G(bill.goldIssuedFineMg)} g`}
            mono
            highlight
          />
        </div>

        {/* Additional P Entries */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Additional Gold Given (P Entries)
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addPEntry}>
              <Plus className="h-3 w-3" /> Add P Entry
            </Button>
          </div>
          {bill.pEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No additional gold issued — only vault issue above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-2">Ref</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-left p-2">Stamp</th>
                    <th className="text-right p-2">Gross (g)</th>
                    <th className="text-right p-2">Add Wt (g)</th>
                    <th className="text-right p-2">Net (g)</th>
                    <th className="text-right p-2">Tunch%</th>
                    <th className="text-right p-2">Wstg%</th>
                    <th className="text-right p-2">Labour ₹</th>
                    <th className="text-right p-2 text-amber-400">Fine (g)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bill.pEntries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="p-2 font-mono text-muted-foreground">{e.ref}</td>
                      <td className="p-2">
                        <Input
                          value={e.description}
                          onChange={(ev) => patchPEntry(e.id, { description: ev.target.value })}
                          className="h-7 text-xs w-32"
                          placeholder="Item name"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={e.stamp}
                          onChange={(ev) => patchPEntry(e.id, { stamp: ev.target.value })}
                          className="h-7 text-xs w-16"
                          placeholder="22K"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={MG_TO_G(e.grossMg)}
                          onChange={(ev) =>
                            patchPEntry(e.id, { grossMg: G_TO_MG(ev.target.value) })
                          }
                          className="h-7 text-xs w-20 text-right"
                          step="0.001"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={MG_TO_G(e.addWtMg)}
                          onChange={(ev) =>
                            patchPEntry(e.id, { addWtMg: G_TO_MG(ev.target.value) })
                          }
                          className="h-7 text-xs w-20 text-right"
                          step="0.001"
                        />
                      </td>
                      <td className="p-2 font-mono text-right text-muted-foreground">
                        {MG_TO_G(e.netMg)}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={e.tunchPct}
                          onChange={(ev) =>
                            patchPEntry(e.id, { tunchPct: parseFloat(ev.target.value) || 0 })
                          }
                          className="h-7 text-xs w-16 text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={e.wstgPct}
                          onChange={(ev) =>
                            patchPEntry(e.id, { wstgPct: parseFloat(ev.target.value) || 0 })
                          }
                          className="h-7 text-xs w-16 text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={(e.labourPaise / 100).toFixed(0)}
                          onChange={(ev) =>
                            patchPEntry(e.id, {
                              labourPaise: Math.round(parseFloat(ev.target.value || "0") * 100),
                            })
                          }
                          className="h-7 text-xs w-20 text-right"
                        />
                      </td>
                      <td className="p-2 font-mono text-right font-bold text-amber-400">
                        {MG_TO_G(e.fineMg)}
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => removePEntry(e.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Total issued */}
        <div className="mt-3 flex justify-end gap-6 text-sm font-semibold border-t border-border pt-3">
          <span className="text-muted-foreground">Total Fine Issued:</span>
          <span className="font-mono text-blue-400">{MG_TO_G(bill.totalGoldIssuedFineMg)} g</span>
        </div>
      </Card>

      {/* ── Section 2: Karigar Returns ─────────────────────────────────────── */}
      <Card
        title="Karigar Returns (from Work Receipt)"
        icon={PackageCheck}
        color="text-emerald-400"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Finished Jewellery */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Finished Jewellery
            </h4>
            <WeightPurityRow
              label="Finished"
              grossMg={bill.finishedGrossMg}
              purity={bill.finishedPurity}
              fineMg={bill.finishedFineMg}
              onGross={(v) => {
                const grossMg = G_TO_MG(v);
                const fineMg = safeFineGoldMg(grossMg, bill.finishedPurity);
                patch({ finishedGrossMg: grossMg, finishedFineMg: fineMg });
              }}
              onPurity={(v) => {
                const purity = Math.round(parseFloat(v || "0") * 10);
                const fineMg = safeFineGoldMg(bill.finishedGrossMg, purity);
                patch({ finishedPurity: purity, finishedFineMg: fineMg });
              }}
            />
          </div>

          {/* Recovery */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Recovery</h4>
            <WeightPurityRow
              label="Scrap"
              grossMg={bill.scrapGrossMg}
              purity={bill.scrapPurity}
              fineMg={bill.scrapFineMg}
              onGross={(v) => {
                const grossMg = G_TO_MG(v);
                const fineMg = safeFineGoldMg(grossMg, bill.scrapPurity);
                patch({ scrapGrossMg: grossMg, scrapFineMg: fineMg });
              }}
              onPurity={(v) => {
                const purity = Math.round(parseFloat(v || "0") * 10);
                const fineMg = safeFineGoldMg(bill.scrapGrossMg, purity);
                patch({ scrapPurity: purity, scrapFineMg: fineMg });
              }}
            />
            <WeightPurityRow
              label="Filings"
              grossMg={bill.filingsGrossMg}
              purity={bill.filingsPurity}
              fineMg={bill.filingsFineMg}
              onGross={(v) => {
                const grossMg = G_TO_MG(v);
                const fineMg = safeFineGoldMg(grossMg, bill.filingsPurity);
                patch({ filingsGrossMg: grossMg, filingsFineMg: fineMg });
              }}
              onPurity={(v) => {
                const purity = Math.round(parseFloat(v || "0") * 10);
                const fineMg = safeFineGoldMg(bill.filingsGrossMg, purity);
                patch({ filingsPurity: purity, filingsFineMg: fineMg });
              }}
            />
            <div className="flex items-center gap-3">
              <Label className="w-24 text-xs text-muted-foreground shrink-0">Dust Fine</Label>
              <Input
                type="number"
                step="0.001"
                value={MG_TO_G(bill.dustFineMg)}
                onChange={(e) => patch({ dustFineMg: G_TO_MG(e.target.value) })}
                className="h-7 w-28 text-xs text-right font-mono"
              />
              <span className="text-xs text-muted-foreground">g fine</span>
            </div>
          </div>
        </div>

        {/* Gold Summary */}
        <div className="mt-4 rounded-xl bg-muted/30 border border-border p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryTile
            label="Total Issued"
            value={`${MG_TO_G(bill.totalGoldIssuedFineMg)} g`}
            color="text-blue-400"
          />
          <SummaryTile
            label="Total Returned"
            value={`${MG_TO_G(bill.totalGoldReturnedFineMg)} g`}
            color="text-emerald-400"
          />
          <SummaryTile
            label="Actual Wastage"
            value={`${MG_TO_G(bill.actualWastageFineMg)} g`}
            color={bill.actualWastagePct > 5 ? "text-red-400" : "text-amber-400"}
            sub={`${bill.actualWastagePct.toFixed(2)}%`}
          />
          <SummaryTile
            label="Expected Wastage"
            value={`${((((job.expectedWastagePct ?? 0) / 100) * bill.goldIssuedFineMg) / 1000).toFixed(3)} g`}
            color="text-muted-foreground"
            sub={`${job.expectedWastagePct ?? 0}%`}
          />
        </div>
      </Card>

      {/* ── Section 3: Charges — every charge here is configurable; Hallmark
          and HUID disappear entirely (and are forced to ₹0, see patch())
          when their Settings → Workflow Engine toggle is off. Outside Work
          and Polishing are auto-collected, read-only. ── */}
      <Card title="Charges" icon={IndianRupee} color="text-gold">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InputField
            label="Manufacturing / Labour Charges (₹)"
            value={(bill.labourChargesPaise / 100).toFixed(0)}
            onChange={(v) => patch({ labourChargesPaise: Math.round(parseFloat(v || "0") * 100) })}
            type="number"
          />
          <InputField
            label="Making Charges (₹)"
            value={(bill.makingChargesPaise / 100).toFixed(0)}
            onChange={(v) => patch({ makingChargesPaise: Math.round(parseFloat(v || "0") * 100) })}
            type="number"
          />
          <InputField
            label="Stone Charges (₹)"
            value={(bill.stoneChargesPaise / 100).toFixed(0)}
            onChange={(v) => patch({ stoneChargesPaise: Math.round(parseFloat(v || "0") * 100) })}
            type="number"
          />
          {wf.mfgChargeHallmarkEnabled && (
            <InputField
              label="Hallmark / BIS Charges (₹)"
              value={(bill.hallmarkChargesPaise / 100).toFixed(0)}
              onChange={(v) =>
                patch({ hallmarkChargesPaise: Math.round(parseFloat(v || "0") * 100) })
              }
              type="number"
            />
          )}
          {wf.mfgChargeHuidEnabled && (
            <InputField
              label="HUID Charges (₹)"
              value={(bill.huidChargesPaise / 100).toFixed(0)}
              onChange={(v) => patch({ huidChargesPaise: Math.round(parseFloat(v || "0") * 100) })}
              type="number"
            />
          )}
          <InputField
            label="Other Charges (₹)"
            value={(bill.otherChargesPaise / 100).toFixed(0)}
            onChange={(v) => patch({ otherChargesPaise: Math.round(parseFloat(v || "0") * 100) })}
            type="number"
            testId="mfg-bill-other-charges-input"
          />
          <ReadField
            label="Outside Work Charges (auto)"
            value={`₹ ${(bill.outsideWorkChargesPaise / 100).toLocaleString("en-IN")}`}
            mono
          />
          <ReadField
            label="Polishing Charges (auto)"
            value={`₹ ${(bill.polishingChargesPaise / 100).toLocaleString("en-IN")}`}
            mono
          />
        </div>

        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">GST on Job Work Charges</Label>
            <Switch
              checked={bill.gstEnabled}
              onCheckedChange={(v) => patch({ gstEnabled: v })}
              data-testid="mfg-bill-gst-switch"
            />
          </div>
          {bill.gstEnabled && (
            <div className="flex items-center gap-2">
              <Input
                value={bill.gstRatePct.toString()}
                onChange={(e) =>
                  patch({ gstRatePct: Math.max(0, parseFloat(e.target.value || "0")) })
                }
                className="w-24"
                inputMode="decimal"
              />
              <span className="text-xs text-muted-foreground">
                % → ₹{((totalCharges * bill.gstRatePct) / 100 / 100).toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-4 text-sm font-semibold border-t border-border pt-3">
          <span className="text-muted-foreground">Total Manufacturing Cost:</span>
          <span className="font-mono text-gold">
            ₹ {(bill.netMfgCostPaise / 100).toLocaleString("en-IN")}
          </span>
        </div>
      </Card>

      {/* ── Final Position — Gold First, Cash Secondary, per the module's
          own display-order rule: never show cash before gold. ── */}
      <Card title="Final Position" icon={Scale} color="text-gold">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider font-bold text-gold">
            Final Gold Position
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gold Outstanding (all sources)</span>
            <span
              className={`font-mono font-bold ${bill.goldOutstandingFineMg > 0 ? "text-amber-400" : "text-emerald-400"}`}
            >
              {MG_TO_G(bill.goldOutstandingFineMg)} g
            </span>
          </div>
        </div>
        <div className="space-y-1 pt-3 border-t border-border mt-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Final Cash Position (secondary / informational)
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Net Manufacturing Cost</span>
            <span className="font-mono">
              ₹ {(bill.netMfgCostPaise / 100).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Selling Price</span>
            <span className="font-mono">
              ₹ {(bill.sellingPricePaise / 100).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </Card>

      {/* ── Section 4: Jeweller Account Settlement ─────────────────────────── */}
      <Card title="Jeweller Account Settlement" icon={TrendingDown} color="text-purple-400">
        <p className="text-xs text-muted-foreground mb-4">
          LB = opening balance from karigar's previous account. P entries increase debit. MP entries
          (gold received back) reduce debit. Cash payment converted to gold equivalent via Bhav
          rate.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
          <InputField
            label="LB — Opening Balance (g, negative = karigar owes)"
            value={MG_TO_G(bill.openingBalanceMg)}
            onChange={(v) => patch({ openingBalanceMg: G_TO_MG(v) })}
            type="number"
            step="0.001"
          />
          <InputField
            label="Cash Payment by Karigar (₹)"
            value={(bill.cashPaymentPaise / 100).toFixed(0)}
            onChange={(v) => patch({ cashPaymentPaise: Math.round(parseFloat(v || "0") * 100) })}
            type="number"
          />
          <InputField
            label="Gold Bhav Rate (₹/g)"
            value={(bill.goldBhavRatePaise / 100).toFixed(0)}
            onChange={(v) => patch({ goldBhavRatePaise: Math.round(parseFloat(v || "0") * 100) })}
            type="number"
          />
        </div>

        {/* MP Entries */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              MP Entries (Gold received from Karigar)
            </span>
            <div className="flex gap-2 flex-wrap">
              {(["fine", "lagad", "scrap", "filings"] as const).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => addMpEntry(type, `MP ${type.toUpperCase()}`)}
                >
                  + {type.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          {bill.mpEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No MP entries — add above if karigar returned gold.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Label</th>
                    <th className="text-right p-2">Gross (g)</th>
                    <th className="text-right p-2">Tunch%</th>
                    <th className="text-right p-2">Pcs</th>
                    <th className="text-right p-2 text-emerald-400">Fine (g)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bill.mpEntries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="p-2">
                        <Badge variant="outline" className="text-[10px]">
                          {e.entryType}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Input
                          value={e.label}
                          onChange={(ev) => patchMpEntry(e.id, { label: ev.target.value })}
                          className="h-7 text-xs w-28"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={MG_TO_G(e.grossMg)}
                          onChange={(ev) =>
                            patchMpEntry(e.id, { grossMg: G_TO_MG(ev.target.value) })
                          }
                          className="h-7 text-xs w-20 text-right"
                          step="0.001"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={e.tunchPct}
                          onChange={(ev) =>
                            patchMpEntry(e.id, { tunchPct: parseFloat(ev.target.value) || 0 })
                          }
                          className="h-7 text-xs w-16 text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={e.pcs}
                          onChange={(ev) =>
                            patchMpEntry(e.id, { pcs: parseInt(ev.target.value) || 1 })
                          }
                          className="h-7 text-xs w-14 text-right"
                        />
                      </td>
                      <td className="p-2 font-mono text-right font-bold text-emerald-400">
                        {MG_TO_G(e.fineMg)}
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => removeMpEntry(e.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Karigar closing balance */}
        <div className="mt-5 rounded-xl bg-muted/30 border border-border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Opening Balance (LB):</span>
            <span className="font-mono">{MG_TO_G(bill.openingBalanceMg)} g</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Less: P Entries Fine:</span>
            <span className="font-mono text-red-400">- {MG_TO_G(totalPFine)} g</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Add: MP Entries Fine:</span>
            <span className="font-mono text-emerald-400">+ {MG_TO_G(totalMpFine)} g</span>
          </div>
          {bill.bhavGoldMg > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Add: Cash ₹{(bill.cashPaymentPaise / 100).toFixed(0)} @ ₹
                {(bill.goldBhavRatePaise / 100).toFixed(0)}/g:
              </span>
              <span className="font-mono text-emerald-400">+ {MG_TO_G(bill.bhavGoldMg)} g</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-2">
            <span>Closing Balance:</span>
            <span
              className={`font-mono text-lg ${bill.closingBalanceMg < 0 ? "text-amber-400" : bill.closingBalanceMg === 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              G {MG_TO_G(bill.closingBalanceMg)}{" "}
              <span className="text-sm font-normal italic">
                {bill.closingBalanceMg < 0
                  ? "Jama (Karigar owes us)"
                  : bill.closingBalanceMg === 0
                    ? "Settled"
                    : "Udhar (We owe karigar)"}
              </span>
            </span>
          </div>
        </div>
      </Card>

      {/* ── Section 5: Item Description & Notes ───────────────────────────── */}
      <Card title="Item Description & Notes" icon={Hammer} color="text-muted-foreground">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <InputField
            label="Reference Design"
            value={bill.referenceDesign ?? ""}
            onChange={(v) => patch({ referenceDesign: v || undefined })}
          />
          <InputField
            label="Product Description"
            value={bill.itemDescription ?? ""}
            onChange={(v) => patch({ itemDescription: v || undefined })}
          />
        </div>
        <Textarea
          value={bill.notes ?? ""}
          onChange={(e) => patch({ notes: e.target.value })}
          className="min-h-20 text-sm"
          placeholder="QC remarks, special instructions, material notes…"
        />
      </Card>

      {/* ── Workflow preview ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs space-y-2">
        <p className="font-bold text-emerald-400 text-sm">
          On Finalise, the following will happen automatically:
        </p>
        <ul className="space-y-1 text-muted-foreground">
          {wf.autoCloseJobCard && (
            <li>
              ✓ Job Card <strong>{job.jobNo}</strong> will be closed
            </li>
          )}
          {wf.autoUpdateOrderStatus && (
            <li>
              ✓ Order <strong>{job.orderNo}</strong> will be marked "Ready for Delivery"
            </li>
          )}
          {wf.finishedStockAutomatic && (
            <li>
              ✓ <strong>{job.itemName}</strong> will move to Finished Stock
            </li>
          )}
          {wf.autoPostGoldLedger && (
            <li>✓ Gold Ledger will be updated (issued, returned, wastage)</li>
          )}
          {wf.autoPostWorkerGoldBook && bill.karigarId && (
            <li>✓ Worker Gold Book will be updated for {bill.karigarName}</li>
          )}
          {wf.autoSendMfgBillComm && (
            <li>✓ Manufacturing Bill will be sent to customer via configured channel</li>
          )}
        </ul>
        <p className="text-muted-foreground pt-1">
          Configure these automations in{" "}
          <Link to="/settings/workflow" className="underline text-foreground hover:text-gold">
            Settings → Workflow Engine
          </Link>
        </p>
      </div>

      {/* ── Finalise Result ───────────────────────────────────────────────── */}
      {finaliseResult && (
        <div
          className={`rounded-xl border p-4 text-sm ${finaliseResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}
        >
          <p className="font-bold mb-2">
            {finaliseResult.ok ? "✓ Finalised successfully" : "Finalisation failed"}
          </p>
          {finaliseResult.warnings.map((w, i) => (
            <p key={i} className="text-amber-400 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalise Manufacturing Bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently close Job Card <strong>{job.jobNo}</strong> and trigger all
              configured automations (stock update, gold ledger, order status, communication). This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Again</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleFinalise}
            >
              Finalise Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Small reusable sub-components ─────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ReadField({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </Label>
      <div
        className={`text-sm ${mono ? "font-mono" : ""} ${highlight ? "font-bold text-gold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  step,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  testId?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm font-mono"
        step={step}
        data-testid={testId}
      />
    </div>
  );
}

function WeightPurityRow({
  label,
  grossMg,
  purity,
  fineMg,
  onGross,
  onPurity,
}: {
  label: string;
  grossMg: number;
  purity: number;
  fineMg: number;
  onGross: (v: string) => void;
  onPurity: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold w-16 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step="0.001"
          value={MG_TO_G(grossMg)}
          onChange={(e) => onGross(e.target.value)}
          className="h-7 w-24 text-xs text-right font-mono"
          placeholder="0.000"
        />
        <span className="text-xs text-muted-foreground">g</span>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step="0.1"
          value={(purity / 10).toFixed(1)}
          onChange={(e) => onPurity(e.target.value)}
          className="h-7 w-16 text-xs text-right font-mono"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <span className="text-xs font-mono font-bold text-emerald-400 w-20">
        = {MG_TO_G(fineMg)} g
      </span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
        {label}
      </div>
      <div className={`font-mono font-bold text-base ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/**
 * Gold-first hero summary — the single always-visible answer to "where does
 * this bill stand in gold?" Cash/charges are a separate, visually smaller
 * section further down; this bar never shows a rupee figure, by design.
 */
function GoldPositionBar({
  requiredFineMg,
  returnedFineMg,
  outstandingMg,
  purityPct,
  wastagePct,
}: {
  requiredFineMg: number;
  returnedFineMg: number;
  outstandingMg: number;
  purityPct: number;
  wastagePct: number;
}) {
  const settled = outstandingMg === 0;
  const weOwe = outstandingMg > 0; // positive closing balance = karigar is owed gold (jama)
  return (
    <div className="rounded-2xl border-2 border-gold/40 bg-gold/5 p-4 md:p-5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gold mb-3">
        Gold Position — Primary Accounting Unit
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryTile
          label="Gold Required"
          value={`${MG_TO_G(requiredFineMg)} g`}
          color="text-blue-400"
        />
        <SummaryTile
          label="Gold Returned"
          value={`${MG_TO_G(returnedFineMg)} g`}
          color="text-emerald-400"
        />
        <SummaryTile
          label="Purity"
          value={`${purityPct.toFixed(1)}%`}
          color="text-muted-foreground"
        />
        <SummaryTile
          label="Outstanding Gold"
          value={`${MG_TO_G(Math.abs(outstandingMg))} g`}
          color={settled ? "text-emerald-400" : weOwe ? "text-amber-400" : "text-red-400"}
          sub={settled ? "Settled" : weOwe ? "Owed to karigar (Jama)" : "Owed by karigar (Udhar)"}
        />
      </div>
      {wastagePct > 0 && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          Wastage so far: <span className="font-mono">{wastagePct.toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}
