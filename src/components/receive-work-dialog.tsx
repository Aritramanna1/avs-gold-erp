import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
// (Badge not needed here)
import { useJobCards, type JobCard, type WorkReceiptRecord } from "@/lib/jobcards-store";
import { useLedger } from "@/lib/ledger-store";
import { useStock } from "@/lib/stock-store";
import { usePeople, kycComplete } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { AlertTriangle, PackageCheck } from "lucide-react";

function safeMg(s: string): number {
  try {
    return gramsToMg(s || "0");
  } catch {
    return 0;
  }
}
function makeSlipNo(prefix: string) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${ymd}-${String(Date.now()).slice(-4)}`;
}

export function ReceiveWorkDialog({
  open,
  onClose,
  job,
  onReceived,
}: {
  open: boolean;
  onClose: () => void;
  job: JobCard | null;
  onReceived?: (rec: WorkReceiptRecord) => void;
}) {
  const setWorkReceipt = useJobCards((s) => s.setWorkReceipt);
  const appendLedger = useLedger((s) => s.append);
  const addStock = useStock((s) => s.add);

  const [finishedGrossStr, setFinishedGrossStr] = useState("0.000");
  const [finishedPurity, setFinishedPurity] = useState<number>(job?.purity ?? 916);
  // Scrap is NOT captured here. Scrap and wastage are settled against the
  // worker's own account in the Worker Gold Book / worker ledger, where they
  // belong: this screen records what came back for THIS job. Capturing scrap in
  // two places is how the same gold gets counted twice.
  const [filingsGrossStr, setFilingsGrossStr] = useState("0.000");
  const [filingsPurity, setFilingsPurity] = useState<number>(job?.purity ?? 916);
  const [dustStr, setDustStr] = useState("0.000");
  const [wastagePct, setWastagePct] = useState<number>(job?.expectedWastagePct ?? 5);
  const [qa, setQa] = useState({
    finishOk: true,
    weightChecked: true,
    stoneChecked: true,
    readyForStock: true,
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (job) {
      setFinishedPurity(job.purity);
      setFilingsPurity(job.purity);
      setWastagePct(job.expectedWastagePct ?? 5);
      setError(null);
    }
  }, [job]);

  if (!job) {
    if (!open) return null;
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-gold" /> Receive Work from Karigar
            </DialogTitle>
            <DialogDescription>Job Card Details</DialogDescription>
          </DialogHeader>
          <div className="p-6 text-center text-muted-foreground text-sm">
            Job card details are currently unavailable or loading.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const finishedGrossMg = safeMg(finishedGrossStr);
  const finishedFineMg = finishedGrossMg > 0 ? fineGoldMg(finishedGrossMg, finishedPurity) : 0;
  const filingsGrossMg = safeMg(filingsGrossStr);
  const filingsFineMg = filingsGrossMg > 0 ? fineGoldMg(filingsGrossMg, filingsPurity) : 0;
  const dustFineMg = safeMg(dustStr);

  async function confirm() {
    if (!job || saving) return;
    setError(null);
    const karigar = usePeople.getState().people.find((p) => p.id === job.karigarId);
    if (karigar && !kycComplete(karigar)) {
      return setError(
        `Cannot receive work: selected worker ${karigar.fullName} does not have a complete KYC. Please complete their photo and Aadhaar first in Settings or Directory.`,
      );
    }
    if (finishedFineMg <= 0) return setError("Finished weight is required.");

    setSaving(true);
    try {
      await confirmInternal(job);
      onClose();
    } catch (err) {
      // A partial failure here (e.g. a closed financial period, or a network
      // blip mid-sequence) previously left ledger/stock/gold-book writes in
      // an inconsistent state with zero feedback — the dialog just silently
      // did nothing. Surface it instead of swallowing it.
      setError(err instanceof Error ? err.message : "Failed to record work receipt.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmInternal(job: JobCard) {
    const ledgerIds: string[] = [];

    // finished item created: karigar -> finished
    if (finishedFineMg > 0) {
      const e = await appendLedger({
        type: "finished_item_created",
        netFineMg: 0,
        deltas: { karigar: -finishedFineMg, finished: finishedFineMg },
        grossMg: finishedGrossMg,
        purity: finishedPurity,
        fineMg: finishedFineMg,
        reference: job.jobNo,
        notes: `Finished ${job.itemName} · ${job.jobNo}`,
      });
      ledgerIds.push(e.id);
    }
    if (filingsFineMg > 0) {
      const e = await appendLedger({
        type: "worker_wastage_gold_return",
        netFineMg: 0,
        deltas: { karigar: -filingsFineMg, scrap: filingsFineMg },
        grossMg: filingsGrossMg,
        purity: filingsPurity,
        fineMg: filingsFineMg,
        reference: job.jobNo,
        notes: `Filings returned · ${job.jobNo}`,
      });
      ledgerIds.push(e.id);
    }
    if (dustFineMg > 0) {
      const e = await appendLedger({
        type: "dust_returned",
        netFineMg: 0,
        deltas: { karigar: -dustFineMg, scrap: dustFineMg },
        fineMg: dustFineMg,
        reference: job.jobNo,
        notes: `Dust/sweepings returned · ${job.jobNo}`,
      });
      ledgerIds.push(e.id);
    }

    // Create finished stock item (non-double-counting: finished bucket already counts it)
    let stockId: string | undefined;
    if (finishedFineMg > 0) {
      const item = await addStock({
        itemName: job.itemName,
        category: job.category,
        purity: finishedPurity,
        grossMg: finishedGrossMg,
        netMg: finishedGrossMg,
        status: qa.readyForStock ? "available" : "reserved",
        location: "vault",
        linkedOrderId: job.orderId,
        linkedJobId: job.id,
        linkedCustomerId: job.customerId,
        notes: `Auto-created from ${job.jobNo}`,
      });
      stockId = item.id;
    }

    const rec: WorkReceiptRecord = {
      id: ledgerIds[0] ?? `r_${Date.now()}`,
      slipNo: makeSlipNo("GR"),
      ts: Date.now(),
      finishedGrossMg,
      finishedPurity,
      finishedFineMg,
      // Retained at zero on the persisted record so receipts written before
      // scrap moved to the Worker Gold Book still read back unchanged.
      scrapGrossMg: 0,
      scrapPurity: finishedPurity,
      scrapFineMg: 0,
      filingsGrossMg,
      filingsPurity,
      filingsFineMg,
      dustFineMg,
      expectedWastagePct: wastagePct,
      expectedLossMg: 0,
      actualLossMg: 0,
      overlossMg: 0,
      qa,
      notes: notes.trim() || undefined,
      finishedStockId: stockId,
      ledgerEntryIds: ledgerIds,
    };

    // Mirror to Worker Gold Book
    const workerId = job.karigarId;
    const workerName = job.karigarName || "Karigar";
    if (workerId) {
      if (finishedFineMg > 0) {
        await useWorkerGoldBook.getState().addEntry({
          workerId,
          workerName,
          particulars: `Finished: ${job.itemName}`,
          grossMg: finishedGrossMg,
          lessMg: 0,
          netMg: finishedGrossMg,
          purity: finishedPurity,
          fineMg: finishedFineMg,
          quantity: 1,
          notes: `Finished ornaments for job ${job.jobNo}. ${notes.trim()}`.trim(),
          givenBy: workerName,
          receivedBy: "Staff",
          type: "return",
          reference: job.jobNo,
        });
      }
      if (filingsFineMg > 0) {
        await useWorkerGoldBook.getState().addEntry({
          workerId,
          workerName,
          particulars: "Filings Returned",
          grossMg: filingsGrossMg,
          lessMg: 0,
          netMg: filingsGrossMg,
          purity: filingsPurity,
          fineMg: filingsFineMg,
          quantity: 1,
          notes: `Filings return for job ${job.jobNo}`,
          givenBy: workerName,
          receivedBy: "Staff",
          type: "return",
          reference: job.jobNo,
        });
      }
      if (dustFineMg > 0) {
        await useWorkerGoldBook.getState().addEntry({
          workerId,
          workerName,
          particulars: "Dust/Sweepings Returned",
          grossMg: 0,
          lessMg: 0,
          netMg: 0,
          purity: 0,
          fineMg: dustFineMg,
          quantity: 1,
          notes: `Dust return for job ${job.jobNo}`,
          givenBy: workerName,
          receivedBy: "Staff",
          type: "return",
          reference: job.jobNo,
        });
      }
    }

    setWorkReceipt(job.id, rec);
    onReceived?.(rec);
  }

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-gold" /> Receive Work from Karigar
          </DialogTitle>
          <DialogDescription>
            {job?.jobNo} · {job?.karigarName ?? "karigar"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <Stat
            label="Returned fine"
            value={`${mgToGrams(finishedFineMg + filingsFineMg + dustFineMg)} g`}
          />
        </div>

        <Section title="Finished">
          <Grid3>
            <Field label="Gross (g) *">
              <Input
                value={finishedGrossStr}
                onChange={(e) => setFinishedGrossStr(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Purity">
              <PuritySelect value={finishedPurity} onChange={setFinishedPurity} />
            </Field>
            <Field label="Fine (auto)">
              <Mono>{mgToGrams(finishedFineMg)} g</Mono>
            </Field>
          </Grid3>
        </Section>

        <Section title="Filings Returned">
          <Grid3>
            <Field label="Gross (g)">
              <Input
                value={filingsGrossStr}
                onChange={(e) => setFilingsGrossStr(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Purity">
              <PuritySelect value={filingsPurity} onChange={setFilingsPurity} />
            </Field>
            <Field label="Fine (auto)">
              <Mono>{mgToGrams(filingsFineMg)} g</Mono>
            </Field>
          </Grid3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Filings credit karigar custody and add to scrap/dust bucket.
          </p>
        </Section>

        <Section title="Dust / Sweeping (optional, fine g)">
          <Input
            value={dustStr}
            onChange={(e) => setDustStr(e.target.value)}
            inputMode="decimal"
            className="max-w-xs"
          />
        </Section>

        <Section title="QA Checklist">
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {(
              [
                ["finishOk", "Finish OK"],
                ["weightChecked", "Weight Checked"],
                ["stoneChecked", "Stone / Fitting Checked"],
                ["readyForStock", "Ready for Stock"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <Checkbox
                  checked={qa[k]}
                  onCheckedChange={(v) => setQa((q) => ({ ...q, [k]: !!v }))}
                />
                {label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Notes">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
          />
        </Section>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={finishedFineMg <= 0 || saving} className="gap-2">
            <PackageCheck className="h-4 w-4" /> {saving ? "Saving…" : "Confirm Receive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}
function Grid3({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-3 gap-3">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mt-1 rounded-md border border-gold/20 bg-gold/5 px-2 py-1.5 font-mono text-sm text-gold ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
function PuritySelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {COMMON_PURITIES.map((p) => (
          <SelectItem key={p.value} value={String(p.value)}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}
