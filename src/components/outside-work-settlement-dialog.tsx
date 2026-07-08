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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLedger } from "@/lib/ledger-store";
import { useOutsideWork, computeOutsideWorkPosition } from "@/lib/outside-work-store";
import {
  useOutsideWorkLabour,
  computeOutsideWorkLabourPosition,
} from "@/lib/outside-work-labour-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { gramsToMg, mgToGrams } from "@/lib/gold";
import { rupeesToPaise, paiseToRupees } from "@/lib/orders-store";
import { Scale, Wallet, AlertTriangle } from "lucide-react";

const PAY_MODES = ["cash", "upi", "bank", "cheque"] as const;

/**
 * Formal Settlement — closes out Gold or Labour outstanding for one outside
 * jeweller and writes a permanent record to the SAME gold_settlements
 * engine the rest of the app already uses (gold-settlement-store.ts),
 * rather than a parallel settlement table. Nothing here overwrites a past
 * settlement; every settlement is its own row, forever.
 *
 * Gold Settlement here is specifically for closing a shortfall/wastage that
 * will never come back as physical metal (normal physical returns already
 * go through OutsideWorkReceiveDialog) — it posts a `wastage` Gold Ledger
 * entry so the vault-vs-outstanding books balance, then logs the
 * write-off as a settlement record.
 *
 * Labour Settlement pairs a real payment (so the outstanding actually
 * clears) with a formal settlement record for the statement/history view.
 */
export function OutsideWorkSettlementDialog({
  open,
  onClose,
  jewellerId,
  jewellerName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  jewellerId: string;
  jewellerName: string;
  onSaved?: () => void;
}) {
  const appendLedger = useLedger((s) => s.append);
  const transactions = useOutsideWork((s) => s.transactions);
  const addOutsideWork = useOutsideWork((s) => s.add);
  const charges = useOutsideWorkLabour((s) => s.charges);
  const payments = useOutsideWorkLabour((s) => s.payments);
  const addPayment = useOutsideWorkLabour((s) => s.addPayment);
  const addSettlement = useGoldSettlement((s) => s.addSettlement);
  const config = useWorkflowEngine((s) => s.config);

  const jewellerTxns = useMemo(
    () => transactions.filter((t) => t.jewellerId === jewellerId),
    [transactions, jewellerId],
  );
  const goldPosition = useMemo(() => computeOutsideWorkPosition(jewellerTxns), [jewellerTxns]);

  const jewellerCharges = useMemo(
    () => charges.filter((c) => c.jewellerId === jewellerId),
    [charges, jewellerId],
  );
  const jewellerPayments = useMemo(
    () => payments.filter((p) => p.jewellerId === jewellerId),
    [payments, jewellerId],
  );
  const labourPosition = useMemo(
    () => computeOutsideWorkLabourPosition(jewellerCharges, jewellerPayments),
    [jewellerCharges, jewellerPayments],
  );
  // With approval required, only APPROVED bills can be settled — an
  // unapproved charge is still owed (shows in the ledger's Outstanding
  // stat) but can't be closed out here until someone approves it.
  const settleableOutstandingPaise = config.outsideWorkApprovalRequired
    ? labourPosition.approvedOutstandingPaise
    : labourPosition.outstandingPaise;
  const hasUnapprovedOutstanding =
    config.outsideWorkApprovalRequired &&
    labourPosition.outstandingPaise > settleableOutstandingPaise;

  const [tab, setTab] = useState<"gold" | "labour">("gold");
  const [goldGramsStr, setGoldGramsStr] = useState("");
  const [goldRateStr, setGoldRateStr] = useState("");
  const [goldNotes, setGoldNotes] = useState("");
  const [labourAmountStr, setLabourAmountStr] = useState("");
  const [labourMode, setLabourMode] = useState<(typeof PAY_MODES)[number]>("cash");
  const [labourNotes, setLabourNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(goldPosition.pendingGoldFineMg > 0 ? "gold" : "labour");
      setGoldGramsStr(
        goldPosition.pendingGoldFineMg > 0 ? mgToGrams(goldPosition.pendingGoldFineMg) : "",
      );
      setGoldRateStr("");
      setGoldNotes("");
      setLabourAmountStr(
        settleableOutstandingPaise > 0 ? (settleableOutstandingPaise / 100).toFixed(2) : "",
      );
      setLabourMode("cash");
      setLabourNotes("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const goldFineMg = gramsToMg(goldGramsStr || "0");
  const goldRatePaisePerGram = rupeesToPaise(goldRateStr || "0");
  const goldCashEquivalentPaise = Math.round((goldFineMg / 1000) * goldRatePaisePerGram);
  const canSubmitGold = goldFineMg > 0 && goldFineMg <= goldPosition.pendingGoldFineMg && !saving;

  const labourAmountPaise = rupeesToPaise(labourAmountStr || "0");
  const canSubmitLabour =
    labourAmountPaise > 0 && labourAmountPaise <= settleableOutstandingPaise && !saving;

  async function submitGold() {
    if (!canSubmitGold) return;
    setError(null);
    setSaving(true);
    try {
      const ledgerEntry = await appendLedger({
        type: "wastage",
        netFineMg: -goldFineMg,
        deltas: { karigar: -goldFineMg },
        fineMg: goldFineMg,
        reference: jewellerName,
        notes: `Outside work gold settlement write-off · ${jewellerName}${goldNotes.trim() ? ` · ${goldNotes.trim()}` : ""}`,
      });

      // Close the pending-gold figure the same way a physical return would
      // (one transaction log, no parallel bookkeeping) — marked distinctly
      // via remarks so the ledger page can tell a write-off apart from a
      // real physical receive.
      await addOutsideWork({
        type: "receive",
        jewellerId,
        jewellerName,
        materialType: "Gold",
        purity: 999,
        grossMg: goldFineMg,
        fineMg: goldFineMg,
        remarks: `Settled (write-off) — not a physical return${goldNotes.trim() ? ` · ${goldNotes.trim()}` : ""}`,
        ledgerEntryId: ledgerEntry.id,
      });

      await addSettlement({
        party_type: "vendor",
        party_id: jewellerId,
        settlement_type: "outside_work_gold_settlement",
        purity: 999,
        gross_mg: goldFineMg,
        net_mg: goldFineMg,
        wastage_mg: goldFineMg,
        rate_per_gram_paise: goldRatePaisePerGram,
        amount_paise: goldCashEquivalentPaise,
        notes: goldNotes.trim() || undefined,
        gold_entry_mg: -goldFineMg,
        direction: "Naam",
        link_use: "outside_work_gold_settlement",
      });

      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record gold settlement.");
    } finally {
      setSaving(false);
    }
  }

  async function submitLabour() {
    if (!canSubmitLabour) return;
    setError(null);
    setSaving(true);
    try {
      const settlement = await addSettlement({
        party_type: "vendor",
        party_id: jewellerId,
        settlement_type: "outside_work_labour_settlement",
        purity: 0,
        gross_mg: 0,
        net_mg: 0,
        wastage_mg: 0,
        rate_per_gram_paise: 0,
        amount_paise: labourAmountPaise,
        payment_mode: labourMode,
        notes: labourNotes.trim() || undefined,
        labour_component_paise: labourAmountPaise,
        cash_entry_paise: -labourAmountPaise,
        direction: "Naam",
        link_use: "outside_work_labour_settlement",
      });

      await addPayment({
        jewellerId,
        jewellerName,
        amountPaise: labourAmountPaise,
        mode: labourMode,
        notes: `Labour settlement ${settlement.id}${labourNotes.trim() ? ` · ${labourNotes.trim()}` : ""}`,
        settlementId: settlement.id,
      });

      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record labour settlement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-gold" /> Settlement
          </DialogTitle>
          <DialogDescription>{jewellerName}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "gold" | "labour")}>
          <TabsList className="mb-2">
            <TabsTrigger value="gold" className="gap-1.5" data-testid="outside-settlement-gold-tab">
              <Scale className="h-3.5 w-3.5" /> Gold
            </TabsTrigger>
            <TabsTrigger
              value="labour"
              className="gap-1.5"
              data-testid="outside-settlement-labour-tab"
            >
              <Wallet className="h-3.5 w-3.5" /> Labour
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gold" className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Pending Gold</span>
              <span className="font-mono text-gold">
                {mgToGrams(goldPosition.pendingGoldFineMg)} g fine
              </span>
            </div>
            {goldPosition.pendingGoldFineMg === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nothing pending — no gold to settle.
              </div>
            ) : (
              <>
                <div>
                  <Label>Fine Gold to Write Off (g) *</Label>
                  <Input
                    value={goldGramsStr}
                    onChange={(e) => setGoldGramsStr(e.target.value)}
                    inputMode="decimal"
                    data-testid="outside-settlement-gold-grams-input"
                  />
                </div>
                <div>
                  <Label>Cash-equivalent Rate (₹/g fine, optional)</Label>
                  <Input
                    value={goldRateStr}
                    onChange={(e) => setGoldRateStr(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                {goldRatePaisePerGram > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Cash equivalent: ₹{paiseToRupees(goldCashEquivalentPaise)}
                  </div>
                )}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={2}
                    value={goldNotes}
                    onChange={(e) => setGoldNotes(e.target.value)}
                  />
                </div>
                {goldFineMg > goldPosition.pendingGoldFineMg && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" /> Cannot settle more than the pending
                    amount.
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="labour" className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Settleable Outstanding</span>
              <span className="font-mono text-gold">
                ₹{paiseToRupees(settleableOutstandingPaise)}
              </span>
            </div>
            {hasUnapprovedOutstanding && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" /> ₹
                {paiseToRupees(labourPosition.outstandingPaise - settleableOutstandingPaise)} more
                is owed on bills pending approval — approve them from the ledger to include in this
                settlement.
              </div>
            )}
            {settleableOutstandingPaise === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nothing approved &amp; outstanding — no labour to settle.
              </div>
            ) : (
              <>
                <div>
                  <Label>Amount to Settle (₹) *</Label>
                  <Input
                    value={labourAmountStr}
                    onChange={(e) => setLabourAmountStr(e.target.value)}
                    inputMode="decimal"
                    data-testid="outside-settlement-labour-amount-input"
                  />
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select
                    value={labourMode}
                    onValueChange={(v) => setLabourMode(v as typeof labourMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAY_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m[0].toUpperCase() + m.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={2}
                    value={labourNotes}
                    onChange={(e) => setLabourNotes(e.target.value)}
                  />
                </div>
                {labourAmountPaise > settleableOutstandingPaise && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" /> Cannot settle more than the settleable
                    amount.
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {tab === "gold" ? (
            <Button
              onClick={submitGold}
              disabled={!canSubmitGold}
              className="gap-2"
              data-testid="outside-settlement-gold-submit"
            >
              <Scale className="h-4 w-4" /> {saving ? "Settling…" : "Settle Gold"}
            </Button>
          ) : (
            <Button
              onClick={submitLabour}
              disabled={!canSubmitLabour}
              className="gap-2"
              data-testid="outside-settlement-labour-submit"
            >
              <Wallet className="h-4 w-4" /> {saving ? "Settling…" : "Settle Labour"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
