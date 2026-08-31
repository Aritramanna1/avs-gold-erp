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
import { isKarigarParty } from "@/lib/party-types";
import { allowNegativeStock, requireVaultStockLine } from "@/lib/invoice-due";
import { useWorkerGoldBook, WORKER_ISSUE_MATERIALS } from "@/lib/worker-gold-book-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import { issueMaterialToVaultCategory, ISSUE_VAULT_MOVEMENT_TYPE } from "@/lib/material-vault-sync";
import {
  assertMaterialIssueStock,
  availableMaterialStockMg,
  materialStockCaption,
} from "@/lib/material-issue-stock";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { gramsToMg, mgToGrams, COMMON_PURITIES } from "@/lib/gold";
import { assertVaultGoldIssueAvailable } from "@/lib/vault-gold-stock";
import { VaultGoldStockSelect, VaultGoldStockHint } from "@/components/VaultGoldStockSelect";
import { computeFineGold } from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import { PENDING_SYNC_GOLD } from "@/lib/offline/capture-helpers";
import { toast } from "sonner";
import { Hammer, AlertTriangle } from "lucide-react";
import { GoldPurityHelper } from "@/components/gold-purity-helper";

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
  const vaultMovements = useMaterialVault((s) => s.movements);
  const refreshVault = useMaterialVault((s) => s.refresh);

  const balances = useMemo(() => computeBalances(entries), [entries]);
  const vaultMg = balances.buckets.vault;

  const workers = useMemo(() => people.filter((p) => isKarigarParty(p) || p.type === "employee"), [people]);

  const [workerId, setWorkerId] = useState("");
  const [material, setMaterial] = useState("Gold");
  const [vaultStockId, setVaultStockId] = useState("");
  const [vaultStockLine, setVaultStockLine] = useState<
    import("@/lib/vault-gold-stock").VaultGoldPurityLine | null
  >(null);
  const [purityStr, setPurityStr] = useState(String(defaultPurity ?? 916));
  const [weightStr, setWeightStr] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setWorkerId("");
      setMaterial("Gold");
      setVaultStockId("");
      setVaultStockLine(null);
      setPurityStr(String(defaultPurity ?? 916));
      setWeightStr("");
      setRemarks("");
      setError(null);
      void refreshVault();
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, defaultPurity, refreshVault]);

  const isFineBearing =
    material === "Gold" ||
    material === "Filings / Dust" ||
    material === "Filings" ||
    /filing|dust/i.test(material);
  const isGold = material === "Gold";
  const grossMg = (() => {
    const n = Number(weightStr);
    return Number.isFinite(n) && n > 0 ? gramsToMg(n) : 0;
  })();
  const purity = Number(purityStr) || 0;
  const fineMg =
    isFineBearing && purity > 0
      ? computeFineGold(
          {
            module: "karigar_issue",
            grossMg,
            purityPermille: Math.round(purity),
          },
          currentGoldCalculationRules(),
        ).fineMg
      : 0;
  const materialAvailableMg = useMemo(
    () => availableMaterialStockMg(material, purity),
    [material, purity, vaultMovements],
  );
  const willOverdrawMaterial = grossMg > 0 && grossMg > materialAvailableMg;
  const willOverdrawGoldVault =
    isGold &&
    fineMg > 0 &&
    (vaultStockLine ? fineMg > vaultStockLine.availableFineMg : fineMg > vaultMg);

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
    !!workerId &&
    grossMg > 0 &&
    purity > 0 &&
    !saving &&
    !creditLimitExceeded &&
    !(willOverdrawMaterial && !allowNegativeStock()) &&
    !(willOverdrawGoldVault && !allowNegativeStock()) &&
    (!requireVaultStockLine() || !isGold || !!vaultStockLine || allowNegativeStock());

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const worker = people.find((p) => p.id === workerId);
    if (!worker) {
      setError("Select a worker.");
      return;
    }
    if (willOverdrawGoldVault && !allowNegativeStock()) {
      setError(
        vaultStockLine
          ? `Insufficient ${vaultStockLine.purity}‰ vault stock. Requested ${mgToGrams(fineMg)} g fine; available ${mgToGrams(vaultStockLine.availableFineMg)} g.`
          : `Select vault gold stock. Requested ${mgToGrams(fineMg)} g fine; total vault ${mgToGrams(vaultMg)} g.`,
      );
      return;
    }
    if (isGold && !vaultStockLine && !allowNegativeStock()) {
      setError("Select gold stock from the Gold Vault (purity line).");
      return;
    }
    if (isGold && vaultStockLine && purity !== vaultStockLine.purity) {
      setError(`Purity must match selected vault stock (${vaultStockLine.purity}‰).`);
      return;
    }
    try {
      if (isGold && fineMg > 0) {
        assertVaultGoldIssueAvailable({
          entries,
          purityPermille: purity,
          fineMg,
          grossMg,
        });
      }
      assertMaterialIssueStock(material, purity, grossMg);
    } catch (stockErr) {
      setError(stockErr instanceof Error ? stockErr.message : String(stockErr));
      return;
    }
    setSaving(true);
    try {
      const { executeOrEnqueue } = await import("@/lib/offline");
      const ledgerPayload = {
        type: "issue_to_karigar" as const,
        netFineMg: 0,
        deltas: { vault: -fineMg, karigar: fineMg },
        grossMg,
        purity: purity || undefined,
        fineMg,
        reference: orderNo,
        notes: `Issue of ${material} to ${worker.fullName} · Order ${orderNo}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`,
        karigarId: workerId,
      };
      const entryPayload = {
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
        type: "given" as const,
        reference: orderNo,
        orderId,
        orderNo,
        skipGoldLedger: true,
      };

      const run = async () => {
        await appendLedger(ledgerPayload as never);
        await useWorkerGoldBook.getState().addEntry(entryPayload);
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
        await useOrders.getState().appendTimeline(orderId, {
          ts: Date.now(),
          label: "Gold / Material Issue",
          note: `${mgToGrams(grossMg)}g ${material} → ${worker.fullName}`,
        });
      };

      const vaultCategory = issueMaterialToVaultCategory(material);
      const queued = await executeOrEnqueue("issue.gold", run, {
        title: `Issue gold to ${worker.fullName}`,
        summary: `${material} · ${orderNo}`,
        payload: {
          kind: "worker_issue",
          ledger: ledgerPayload,
          entry: entryPayload,
          vault: vaultCategory
            ? {
                category: vaultCategory,
                type: ISSUE_VAULT_MOVEMENT_TYPE,
                deltaMg: -grossMg,
                grossMg,
                purity: purity || undefined,
                reference: orderNo,
                remarks: remarks.trim() || undefined,
                relatedOrderId: orderId,
              }
            : null,
          timeline: {
            orderId,
            label: "Gold / Material Issue",
            note: `${mgToGrams(grossMg)}g ${material} → ${worker.fullName}`,
          },
        },
      });
      if (queued.mode === "queued") {
        toast.message(PENDING_SYNC_GOLD);
        onClose();
        return;
      }

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
            <div className={isGold ? "col-span-2" : ""}>
              <Label>Material *</Label>
              <Select
                value={material}
                onValueChange={(v) => {
                  setMaterial(v);
                  if (v !== "Gold") {
                    setVaultStockId("");
                    setVaultStockLine(null);
                  }
                }}
              >
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
            {!isGold ? (
              <div>
                <Label>Purity *</Label>
                <Select value={purityStr} onValueChange={setPurityStr}>
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
            ) : null}
          </div>

          {isGold ? (
            <div className="space-y-1">
              <Label>Gold Vault stock (purity) *</Label>
              <VaultGoldStockSelect
                value={vaultStockId}
                onChange={(id, line) => {
                  setVaultStockId(id);
                  setVaultStockLine(line);
                  if (line) setPurityStr(String(line.purity));
                }}
              />
              <VaultGoldStockHint line={vaultStockLine} />
            </div>
          ) : null}

          {isGold && purity > 0 ? (
            <div className="text-xs text-muted-foreground font-mono">
              Selected purity: {purity}‰
            </div>
          ) : null}

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

          {isGold ? (
            <GoldPurityHelper
              weightG={weightStr}
              fromPurity={purity || undefined}
              lockedWeight={false}
              lockedFrom={Boolean(purity)}
            />
          ) : null}

          <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Material Vault
            </div>
            <div className="font-mono text-gold">{materialStockCaption(material, purity, grossMg)}</div>
            {isGold && grossMg > 0 && purity > 0 ? (
              <div className="text-xs text-muted-foreground">
                Fine gold {mgToGrams(fineMg)} g · gold vault after issue{" "}
                <span className="font-mono text-foreground">
                  {mgToGrams(Math.max(0, vaultMg - fineMg))} g
                </span>
              </div>
            ) : null}
          </div>

          <div>
            <Label>Narration (optional)</Label>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>

          {willOverdrawMaterial && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Material Vault does not have enough {material} of
              this purity. Available {mgToGrams(materialAvailableMg)} g.
            </div>
          )}
          {willOverdrawGoldVault && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Gold vault does not have enough fine gold for this
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
