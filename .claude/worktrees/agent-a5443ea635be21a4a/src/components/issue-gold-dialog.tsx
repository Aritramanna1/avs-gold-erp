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
import { Badge } from "@/components/ui/badge";
import { useJobCards, type JobCard, type GoldIssueRecord } from "@/lib/jobcards-store";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { usePeople, kycComplete, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { AlertTriangle, Hammer, Search, User, Check } from "lucide-react";

function makeSlipNo(prefix: string) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Date.now()).slice(-4);
  return `${prefix}-${ymd}-${rand}`;
}

export function IssueGoldDialog({
  open,
  onClose,
  job,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  job: JobCard | null;
  onIssued?: (rec: GoldIssueRecord) => void;
}) {
  const setGoldIssue = useJobCards((s) => s.setGoldIssue);
  const appendLedger = useLedger((s) => s.append);
  const entries = useLedger((s) => s.entries);
  const people = usePeople((s) => s.people);

  const karigars = useMemo(
    () =>
      people.filter(
        (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
      ),
    [people],
  );

  const balances = useMemo(() => computeBalances(entries), [entries]);
  const vaultMg = balances.buckets.vault;

  const [karigarId, setKarigarId] = useState<string>(job?.karigarId ?? "");
  const [grossStr, setGrossStr] = useState<string>(job ? mgToGrams(job.targetGrossMg) : "0.000");
  const [purity, setPurity] = useState<number>(job?.purity ?? 916);
  const [issuedBy, setIssuedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Overdraft spec states
  const [showOverdraftConfirm, setShowOverdraftConfirm] = useState(false);
  const [overdraftReason, setOverdraftReason] = useState("");
  const [overdraftAuthorizedBy, setOverdraftAuthorizedBy] = useState("");
  const [overdraftError, setOverdraftError] = useState<string | null>(null);

  // re-sync when job changes
  useEffect(() => {
    if (job) {
      setKarigarId(job.karigarId ?? "");
      setGrossStr(mgToGrams(job.targetGrossMg));
      setPurity(job.purity);
      setError(null);
      setOverdraftReason("");
      setOverdraftAuthorizedBy("");
      setOverdraftError(null);
      setShowOverdraftConfirm(false);
    }
  }, [job]);

  const grossMg = (() => {
    try {
      return gramsToMg(grossStr);
    } catch {
      return 0;
    }
  })();
  const fineMg = grossMg > 0 && purity > 0 ? fineGoldMg(grossMg, purity) : 0;
  const willOverdraw = fineMg > vaultMg;
  const additional = !!job?.goldIssue;

  async function confirm() {
    if (!job) return;
    setError(null);
    if (!karigarId) return setError("Pick a karigar.");
    const karigar = people.find((p) => p.id === karigarId);
    if (karigar && !kycComplete(karigar)) {
      return setError(
        `Cannot issue gold: ${karigar.fullName} (${PERSON_TYPE_LABELS[karigar.type] ?? "Worker"}) does not have a complete KYC. Please complete their photo and Aadhaar front/back first in Settings or Directory.`,
      );
    }
    if (grossMg <= 0) return setError("Enter gross weight in grams.");
    if (purity <= 0 || purity > 999) return setError("Purity must be 1–999.");

    if (willOverdraw) {
      // Trigger our custom MTJ high-fidelity Overdraft Dialog rather than a destructive alert or window.confirm
      setShowOverdraftConfirm(true);
      return;
    }

    const entry = await appendLedger({
      type: "issue_to_karigar",
      netFineMg: 0,
      deltas: { vault: -fineMg, karigar: fineMg },
      grossMg,
      purity,
      fineMg,
      reference: job.jobNo,
      notes: `Issue to ${karigar?.fullName ?? "karigar"} · ${job.jobNo}`,
    });

    // Mirror to Worker Gold Book
    useWorkerGoldBook.getState().addEntry({
      workerId: karigarId,
      workerName: karigar?.fullName || "Karigar",
      particulars: job.itemName || "KDM",
      grossMg,
      lessMg: 0,
      netMg: grossMg,
      purity,
      fineMg,
      quantity: 1,
      notes: `Issued for job ${job.jobNo}. ${notes.trim()}`.trim(),
      givenBy: issuedBy.trim() || "Vault Manager",
      receivedBy: karigar?.fullName || "Karigar",
      type: "given",
      reference: job.jobNo,
    });

    const rec: GoldIssueRecord = {
      id: entry.id,
      slipNo: makeSlipNo("GI"),
      ts: Date.now(),
      source: "vault",
      grossMg,
      purity,
      fineMg,
      issuedBy: issuedBy.trim() || undefined,
      notes: notes.trim() || undefined,
      ledgerEntryId: entry.id,
    };

    await useJobCards.getState().update(job.id, {
      karigarId,
      karigarName: karigar?.fullName,
    });
    await setGoldIssue(job.id, rec);
    onIssued?.(rec);
    onClose();
  }

  async function handleOverdraftConfirmSubmit() {
    if (!job) return;
    setOverdraftError(null);
    const cleanReason = overdraftReason.trim();
    const cleanAuth = overdraftAuthorizedBy.trim();

    if (!cleanReason) {
      setOverdraftError("Reason for overdraft is required.");
      return;
    }
    if (!cleanAuth) {
      setOverdraftError("Authorized by/current user is required.");
      return;
    }

    const karigar = people.find((p) => p.id === karigarId);

    // 1. Issue standard issue_to_karigar ledger entry to move metal (creating standard overdraft ledger state)
    const issueEntry = await appendLedger({
      type: "issue_to_karigar",
      netFineMg: 0,
      deltas: { vault: -fineMg, karigar: fineMg },
      grossMg,
      purity,
      fineMg,
      reference: job.jobNo,
      notes: `Issue with Overdraft to ${karigar?.fullName ?? "karigar"} · ${job.jobNo}`,
    });

    // Mirror to Worker Gold Book with overdraft note
    useWorkerGoldBook.getState().addEntry({
      workerId: karigarId,
      workerName: karigar?.fullName || "Karigar",
      particulars: job.itemName || "KDM",
      grossMg,
      lessMg: 0,
      netMg: grossMg,
      purity,
      fineMg,
      quantity: 1,
      notes:
        `OVERDRAFT ISSUE for job ${job.jobNo}. Reason: ${cleanReason}. Authorized by: ${cleanAuth}. ${notes.trim()}`.trim(),
      givenBy: cleanAuth,
      receivedBy: karigar?.fullName || "Karigar",
      type: "given",
      reference: job.jobNo,
    });

    // 2. Insert specialized gold_overdraft_issue audit/gold ledger entry as required
    await appendLedger({
      type: "gold_overdraft_issue",
      netFineMg: 0,
      deltas: {}, // audit log / tracer style
      fineMg: fineMg - vaultMg, // shortage fine gold
      reference: job.jobNo,
      notes: `Overdraft authorized by ${cleanAuth}. Reason: ${cleanReason}. Available: ${mgToGrams(vaultMg)}g, Required: ${mgToGrams(fineMg)}g, Shortage: ${mgToGrams(fineMg - vaultMg)}g`,
    });

    const rec: GoldIssueRecord = {
      id: issueEntry.id,
      slipNo: makeSlipNo("GI"),
      ts: Date.now(),
      source: "vault",
      grossMg,
      purity,
      fineMg,
      issuedBy: cleanAuth,
      notes:
        `OVERDRAFT ISSUE: ${notes.trim() || ""}. Reason: ${cleanReason}. Authorized by: ${cleanAuth}`.trim(),
      ledgerEntryId: issueEntry.id,
    };

    await useJobCards.getState().update(job.id, {
      karigarId,
      karigarName: karigar?.fullName,
    });
    await setGoldIssue(job.id, rec);
    onIssued?.(rec);
    setShowOverdraftConfirm(false);
    onClose();
  }

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-gold" /> Issue Gold to Karigar
          </DialogTitle>
          <DialogDescription>
            {job.jobNo} · {job.orderNo} · {job.customerName} · {job.itemName}
            {additional && (
              <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-300">
                Additional Issue
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-3">
          <Stat label="Vault fine gold" value={`${mgToGrams(vaultMg)} g`} accent />
          <Stat label="Target fine" value={`${mgToGrams(job.targetFineMg)} g`} />
          <Stat label="Already issued" value={`${mgToGrams(job.goldIssue?.fineMg ?? 0)} g`} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div>
            <Label>Karigar *</Label>
            <Select value={karigarId} onValueChange={setKarigarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select karigar…" />
              </SelectTrigger>
              <SelectContent>
                {karigars.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.fullName}
                    {k.workType ? ` · ${k.workType}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Source</Label>
            <Input value="Vault" readOnly />
          </div>
          <div>
            <Label>Gross weight to issue (g) *</Label>
            <Input
              value={grossStr}
              onChange={(e) => setGrossStr(e.target.value)}
              placeholder="10.000"
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Purity / Touch *</Label>
            <Select value={String(purity)} onValueChange={(v) => setPurity(Number(v))}>
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
          </div>
          <div className="sm:col-span-2 rounded-lg border border-gold/30 bg-gold/5 p-3 flex items-center justify-between">
            <div className="text-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Fine gold (auto)
              </div>
              <div className="font-mono text-gold text-lg">{mgToGrams(fineMg)} g</div>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              Vault after issue:
              <br />
              <span className="font-mono text-foreground">
                {mgToGrams(Math.max(0, vaultMg - fineMg))} g
              </span>
            </div>
          </div>
          <div>
            <Label>Issued by</Label>
            <Input
              value={issuedBy}
              onChange={(e) => setIssuedBy(e.target.value)}
              placeholder="Manager name (optional)"
            />
          </div>
          <div>
            <Label>Date / Time</Label>
            <Input value={new Date().toLocaleString("en-IN")} readOnly />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>
        </div>

        {willOverdraw && (
          <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" /> Vault does not have enough fine gold for this
            issue.
          </div>
        )}
        {error && (
          <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={fineMg <= 0 || !karigarId}
            className={`gap-2 ${willOverdraw ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-500/30" : ""}`}
          >
            <Hammer className="h-4 w-4" />
            {willOverdraw ? "Authorize Overdraft" : "Confirm Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* High-fidelity custom MTJ Gold Overdraft Authorization and Audit dialog */}
      <Dialog
        open={showOverdraftConfirm}
        onOpenChange={(openState) => !openState && setShowOverdraftConfirm(false)}
      >
        <DialogContent className="max-w-md border-amber-500/30 bg-card/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500 font-serif">
              <AlertTriangle className="h-5 w-5 animate-pulse" /> Gold Vault Overdraft Authorization
            </DialogTitle>
            <DialogDescription>
              Job card {job?.jobNo} requires more fine gold than is currently available in the
              vault.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 font-mono">
              <div className="text-muted-foreground">Available Gold:</div>
              <div className="text-right text-foreground font-semibold">
                {mgToGrams(vaultMg)} g fine
              </div>

              <div className="text-muted-foreground">Required Gold:</div>
              <div className="text-right text-foreground font-semibold">
                {mgToGrams(fineMg)} g fine
              </div>

              <div className="border-t border-amber-500/20 col-span-2 my-1" />

              <div className="text-amber-400 font-semibold">Shortage Weight:</div>
              <div className="text-right text-amber-400 font-bold">
                {mgToGrams(fineMg - vaultMg)} g fine
              </div>

              <div className="text-muted-foreground">Source Vault:</div>
              <div className="text-right text-foreground font-semibold">Main Vault</div>

              <div className="text-muted-foreground">Timestamp:</div>
              <div className="text-right text-foreground">{new Date().toLocaleString("en-IN")}</div>
            </div>

            <div className="p-2.5 rounded border border-yellow-600/30 bg-yellow-950/20 text-xs text-yellow-200 leading-relaxed font-medium">
              <strong>CLEAR WARNING:</strong> This will create an explicit gold overdraft entry in
              the system audits and must be reconciled later.
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="overdraft-reason" className="text-xs font-semibold text-amber-300">
                  Reason for Overdraft * (Required)
                </Label>
                <Input
                  id="overdraft-reason"
                  placeholder="e.g. Urgent customer order delivery date commit"
                  value={overdraftReason}
                  onChange={(e) => setOverdraftReason(e.target.value)}
                  className="mt-1 border-amber-500/20 focus-visible:ring-amber-500/30 font-medium"
                />
              </div>

              <div>
                <Label htmlFor="overdraft-auth" className="text-xs font-semibold text-amber-300">
                  Authorized By * (Required)
                </Label>
                <Input
                  id="overdraft-auth"
                  placeholder="Manager / Owner name"
                  value={overdraftAuthorizedBy}
                  onChange={(e) => setOverdraftAuthorizedBy(e.target.value)}
                  className="mt-1 border-amber-500/20 focus-visible:ring-amber-500/30 font-medium"
                />
              </div>
            </div>

            {overdraftError && (
              <div className="rounded border border-red-500/30 bg-red-950/20 p-2 text-xs text-red-300">
                {overdraftError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="ghost" onClick={() => setShowOverdraftConfirm(false)}>
              Back
            </Button>
            <Button
              onClick={handleOverdraftConfirmSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white border border-amber-500/30"
            >
              Confirm and Log Overdraft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
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
