import { useEffect, useMemo, useRef, useState } from "react";
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
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { useOrders } from "@/lib/orders-store";
import { usePeople, PERSON_TYPE_LABELS, validateMetalCreditLimit } from "@/lib/people-store";
import { useWorkerGoldBook, WORKER_ISSUE_MATERIALS } from "@/lib/worker-gold-book-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import { issueMaterialToVaultCategory, ISSUE_VAULT_MOVEMENT_TYPE } from "@/lib/material-vault-sync";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { getDefaultPurityPermille } from "@/lib/ma-tara-workshop-policy";
import { Hammer, AlertTriangle } from "lucide-react";

/**
 * "Issue Gold/Material to Worker" — order-linked counterpart to
 * WorkerReturnDialog. Saving appends a Gold Ledger entry, a Material Vault
 * movement (for material types the vault tracks), and a Worker Gold Book
 * entry carrying this order's id/no — the structured link
 * manufacturing-barcode-store.ts and manufacturing-bill-store.ts read to
 * determine Worker Return completeness and auto-collect issued-gold cost.
 */
export function WorkerIssueDialog({
  open,
  onClose,
  orderId,
  orderNo,
  defaultPurity,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNo: string;
  defaultPurity?: number;
  onSaved?: (info: { material: string; grossMg: number; workerName: string }) => void;
}) {
  const appendLedger = useLedger((s) => s.append);
  const entries = useLedger((s) => s.entries);
  const people = usePeople((s) => s.people);
  const appendVault = useMaterialVault((s) => s.append);

  const balances = useMemo(() => computeBalances(entries), [entries]);
  const vaultMg = balances.buckets.vault;

  const workers = useMemo(
    () =>
      people.filter(
        (p) =>
          p.type === "karigar" ||
          p.type === "worker" ||
          p.type === "outside_worker" ||
          p.type === "employee",
      ),
    [people],
  );

  const [workerId, setWorkerId] = useState("");
  const [material, setMaterial] = useState("Gold");
  const [purityStr, setPurityStr] = useState(String(defaultPurity ?? getDefaultPurityPermille()));
  const [weightStr, setWeightStr] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setWorkerId("");
      setMaterial("Gold");
      setPurityStr(String(defaultPurity ?? getDefaultPurityPermille()));
      setWeightStr("");
      setRemarks("");
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, defaultPurity]);

  const isGold = material === "Gold";
  const grossMg = (() => {
    const n = Number(weightStr);
    return Number.isFinite(n) && n > 0 ? gramsToMg(n) : 0;
  })();
  const purity = isGold ? Number(purityStr) || 0 : 0;
  const fineMg = isGold && purity > 0 ? fineGoldMg(grossMg, purity) : grossMg;
  const willOverdraw = isGold && fineMg > vaultMg;

  const selectedWorker = useMemo(
    () => people.find((p) => p.id === workerId) ?? null,
    [people, workerId],
  );
  const workerPendingFineMg = useWorkerGoldBook((s) =>
    workerId ? s.getWorkerBalance(workerId).pendingFine : 0,
  );
  const creditCheck = useMemo(
    () =>
      selectedWorker && fineMg > 0
        ? validateMetalCreditLimit(selectedWorker, workerPendingFineMg, fineMg)
        : null,
    [selectedWorker, workerPendingFineMg, fineMg],
  );
  const creditLimitExceeded = creditCheck?.isExceeded ?? false;

  const canSubmit =
    !!workerId && grossMg > 0 && (!isGold || purity > 0) && !saving && !creditLimitExceeded;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const worker = people.find((p) => p.id === workerId);
    if (!worker) {
      setError("Select a worker.");
      return;
    }
    setSaving(true);
    try {
      await appendLedger({
        type: "issue_to_karigar",
        netFineMg: 0,
        deltas: { vault: -fineMg, karigar: fineMg },
        grossMg,
        purity: purity || undefined,
        fineMg,
        reference: orderNo,
        notes: `Issue of ${material} to ${worker.fullName} · Order ${orderNo}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`,
        karigarId: workerId,
      } as any);

      await useWorkerGoldBook.getState().addEntry({
        workerId,
        workerName: worker.fullName,
        particulars: material,
        grossMg,
        lessMg: 0,
        netMg: grossMg,
        purity,
        fineMg,
        quantity: 1,
        notes: remarks.trim() || `Issued for Order ${orderNo}`,
        givenBy: "Vault Manager",
        receivedBy: worker.fullName,
        type: "given",
        reference: orderNo,
        orderId,
        orderNo,
      });

      // Automatic synchronization: one issue action updates the Gold Ledger
      // (above), the Worker Gold Book (above), and — for material types the
      // vault actually tracks — the Gold & Material Vault, mirroring
      // WorkerReturnDialog's return-side sync exactly.
      const vaultCategory = issueMaterialToVaultCategory(material);
      if (vaultCategory) {
        const { data } = await supabase.auth.getSession();
        await appendVault({
          category: vaultCategory,
          type: ISSUE_VAULT_MOVEMENT_TYPE,
          deltaMg: -grossMg,
          grossMg,
          purity: purity || undefined,
          reference: orderNo,
          remarks: remarks.trim() || undefined,
          relatedOrderId: orderId,
          actorId: data.session?.user.id ?? null,
          actorEmail: data.session?.user.email ?? null,
        });
      }

      // Order Timeline entry — mirrors the pattern send-to-polishing-dialog.tsx
      // uses (appendTimeline), so a gold/material issue shows up in the
      // order's own activity history the same way sending to polishing does.
      await useOrders.getState().appendTimeline(orderId, {
        ts: Date.now(),
        label: "Gold / Material Issue",
        note: `${mgToGrams(grossMg)}g ${material} → ${worker.fullName}`,
      });

      onSaved?.({ material, grossMg, workerName: worker.fullName });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record issue.");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-gold" /> Issue to Worker
          </DialogTitle>
          <DialogDescription>Order {orderNo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Worker *</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger ref={firstFieldRef as any} data-testid="issue-worker-select">
                <SelectValue placeholder="Select worker…" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.fullName} · {PERSON_TYPE_LABELS[w.type as keyof typeof PERSON_TYPE_LABELS]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Material *</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger data-testid="issue-material-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_ISSUE_MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purity {isGold ? "*" : "(n/a)"}</Label>
              <Select value={purityStr} onValueChange={setPurityStr} disabled={!isGold}>
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
          </div>

          <div>
            <Label>Weight (g) *</Label>
            <Input
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              placeholder="10.000"
              inputMode="decimal"
              data-testid="issue-weight-input"
            />
          </div>

          {isGold && grossMg > 0 && purity > 0 && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 flex items-center justify-between text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Fine gold (auto)
                </div>
                <div className="font-mono text-gold">{mgToGrams(fineMg)} g</div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                Vault after issue:
                <br />
                <span className="font-mono text-foreground">
                  {mgToGrams(Math.max(0, vaultMg - fineMg))} g
                </span>
              </div>
            </div>
          )}

          <div>
            <Label>Remarks (optional)</Label>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>

          {willOverdraw && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Vault does not have enough fine gold for this
              issue.
            </div>
          )}
          {creditCheck?.isExceeded && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> {creditCheck.message}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel (Esc)
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="gap-2"
            data-testid="issue-submit"
          >
            <Hammer className="h-4 w-4" /> {saving ? "Issuing…" : "Issue (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
