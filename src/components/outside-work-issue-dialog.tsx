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
import { usePeople } from "@/lib/people-store";
import { isKarigarParty, isSupplierParty } from "@/lib/party-types";
import { useOrders } from "@/lib/orders-store";
import { useOutsideWork, COMMON_OUTSIDE_WORK_MATERIALS } from "@/lib/outside-work-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import {
  isOutsideWorkFineBearingMaterial,
  outsideWorkIssueGoldLedgerDeltas,
  outsideWorkShouldSyncMaterialVault,
} from "@/lib/outside-work-custody";
import {
  outsideWorkIssueMaterialToVaultCategory,
  OUTSIDE_WORK_ISSUE_VAULT_MOVEMENT_TYPE,
} from "@/lib/material-vault-sync";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { gramsToMg, mgToGrams, COMMON_PURITIES } from "@/lib/gold";
import { fineGoldMgConfigured } from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import { allowNegativeStock, requireVaultStockLine } from "@/lib/invoice-due";
import { vaultGoldPurityOptionsForIssue } from "@/lib/vault-gold-stock";
import { VaultGoldStockSelect } from "@/components/VaultGoldStockSelect";
import { Truck, AlertTriangle } from "lucide-react";
import { GoldPurityHelper } from "@/components/gold-purity-helper";

/**
 * "Issue to Outside Jeweller" — a transaction-based form, not a workflow
 * engine. Saving appends a Gold Ledger entry, the Outside Work Ledger
 * (outside-work-store.ts's transaction log), and — if a Production Order
 * was selected — a timeline entry on that order.
 */
export function OutsideWorkIssueDialog({
  open,
  onClose,
  defaultJewellerId,
  defaultOrderId,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  defaultJewellerId?: string;
  defaultOrderId?: string;
  onIssued?: (txn: { orderId?: string }) => void;
}) {
  const appendLedger = useLedger((s) => s.append);
  const entries = useLedger((s) => s.entries);
  const people = usePeople((s) => s.people);
  const orders = useOrders((s) => s.orders);
  const addOutsideWork = useOutsideWork((s) => s.add);
  const appendVault = useMaterialVault((s) => s.append);

  const jewellers = useMemo(
    () => people.filter((p) => isKarigarParty(p) || isSupplierParty(p)),
    [people],
  );
  const balances = useMemo(() => computeBalances(entries), [entries]);
  const vaultMg = balances.buckets.vault;

  const [jewellerId, setJewellerId] = useState("");
  const [orderId, setOrderId] = useState("none");
  const [materialType, setMaterialType] = useState("Filings / Dust");
  const [purityStr, setPurityStr] = useState("916");
  const [vaultStockId, setVaultStockId] = useState("");
  const [weightStr, setWeightStr] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setJewellerId(defaultJewellerId ?? "");
      setOrderId(defaultOrderId ?? "none");
      setMaterialType("Filings / Dust");
      setPurityStr("916");
      setVaultStockId("");
      setWeightStr("");
      setExpectedReturnDate("");
      setRemarks("");
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, defaultJewellerId, defaultOrderId]);

  const isFineBearing = isOutsideWorkFineBearingMaterial(materialType);
  const isGold = isFineBearing;
  const grossMg = (() => {
    const n = Number(weightStr);
    return Number.isFinite(n) && n > 0 ? gramsToMg(n) : 0;
  })();
  const purity = isFineBearing ? Number(purityStr) || 0 : 0;
  const fineMg =
    isFineBearing && purity > 0
      ? fineGoldMgConfigured(grossMg, purity, currentGoldCalculationRules())
      : grossMg;
  const vaultGoldLines = useMemo(
    () => vaultGoldPurityOptionsForIssue(entries),
    [entries],
  );
  const vaultStockLine = useMemo(
    () => vaultGoldLines.find((l) => l.id === vaultStockId) ?? null,
    [vaultGoldLines, vaultStockId],
  );

  // Auto-pick first vault stock line when opening a gold issue — operators
  // still can change it; prevents submit stuck with empty vaultStockId.
  useEffect(() => {
    if (!open || !isOutsideWorkFineBearingMaterial(materialType)) return;
    if (vaultStockId) return;
    const first = vaultGoldLines[0];
    if (!first) return;
    setVaultStockId(first.id);
    setPurityStr(String(first.purity));
  }, [open, materialType, vaultGoldLines, vaultStockId]);

  const willOverdraw =
    isFineBearing &&
    fineMg > 0 &&
    (vaultStockLine
      ? fineMg > vaultStockLine.availableFineMg
      : fineMg > vaultMg);

  const canSubmit =
    !!jewellerId &&
    grossMg > 0 &&
    (!isGold || purity > 0) &&
    !saving &&
    !(willOverdraw && !allowNegativeStock()) &&
    (!isGold || !requireVaultStockLine() || !!vaultStockLine || allowNegativeStock());

  async function submit() {
    if (!canSubmit) return;
    if (willOverdraw && !allowNegativeStock()) {
      setError("Insufficient vault gold. Enable allow negative stock in Customization, or reduce the issue.");
      return;
    }
    setError(null);
    const jeweller = people.find((p) => p.id === jewellerId);
    if (!jeweller) {
      setError("Select an outside jeweller.");
      return;
    }
    const order = orderId !== "none" ? orders.find((o) => o.id === orderId) : undefined;
    setSaving(true);
    try {
      if (isFineBearing && fineMg > 0) {
        const { assertTransactionGoldIssueFromLedger } = await import(
          "@/lib/transaction-ledger-guards"
        );
        assertTransactionGoldIssueFromLedger({
          entries,
          purityPermille: purity,
          fineMg,
          grossMg,
          vaultStockLineId: vaultStockId,
        });
      }

      // Fine-bearing (gold/filings): Gold Vault ↔ karigar.
      // Components (chain/ball/wire/…): Material Vault only — never drain Gold Vault.
      const deltas = outsideWorkIssueGoldLedgerDeltas({
        materialType,
        fineMg: isFineBearing ? fineMg : 0,
      });
      const ledgerEntry = await appendLedger({
        type: "issue_to_karigar",
        netFineMg: 0,
        deltas,
        grossMg,
        purity: purity || undefined,
        fineMg: isFineBearing ? fineMg : 0,
        reference: order?.orderNo ?? jeweller.fullName,
        notes: isFineBearing
          ? `Issue of ${materialType} to outside jeweller ${jeweller.fullName}${order ? ` · Order ${order.orderNo}` : ""}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`
          : `Outside issue (material only, vault gold unchanged): ${materialType} → ${jeweller.fullName}${order ? ` · Order ${order.orderNo}` : ""}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`,
        karigarId: jewellerId,
      } as never);

      const txn = await addOutsideWork({
        type: "issue",
        jewellerId,
        jewellerName: jeweller.fullName,
        orderId: order?.id,
        orderNo: order?.orderNo,
        materialType,
        purity,
        grossMg,
        fineMg: isFineBearing ? fineMg : 0,
        expectedReturnDate: expectedReturnDate || undefined,
        remarks: remarks.trim() || undefined,
        ledgerEntryId: ledgerEntry.id,
      });

      // Material Vault for components / filings forms — not pure Gold (Gold Ledger SoT).
      const vaultCategory = outsideWorkIssueMaterialToVaultCategory(materialType);
      if (vaultCategory && outsideWorkShouldSyncMaterialVault(materialType)) {
        const { data } = await supabase.auth.getSession();
        try {
          await appendVault({
            category: vaultCategory,
            type: OUTSIDE_WORK_ISSUE_VAULT_MOVEMENT_TYPE,
            deltaMg: -grossMg,
            grossMg,
            purity: purity || undefined,
            reference: order?.orderNo ?? jeweller.fullName,
            remarks: remarks.trim() || undefined,
            relatedOrderId: order?.id,
            actorId: data.session?.user.id ?? null,
            actorEmail: data.session?.user.email ?? null,
          });
        } catch (mvErr: unknown) {
          // Components may leave shop without a prior Material Vault booking.
          // Fine-bearing metal still fails closed via Gold Vault assert above.
          if (isFineBearing) throw mvErr;
          console.warn(
            "[outside-work] Material Vault debit skipped:",
            mvErr instanceof Error ? mvErr.message : mvErr,
          );
        }
      }

      if (order) {
        await useOrders.getState().appendTimeline(order.id, {
          ts: Date.now(),
          label: "Outside work issued",
          note: `${materialType} · ${mgToGrams(grossMg)} g → ${jeweller.fullName}`,
        });
        const { markOrderJobsOutsideProcessing } = await import("@/lib/jobcards-store");
        await markOrderJobsOutsideProcessing(
          order.id,
          `Outside work issued · ${materialType} → ${jeweller.fullName}`,
          "outside",
        );
      }

      onIssued?.({ orderId: order?.id });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record issue.");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    // Enter alone: global enter-advance moves fields. Ctrl/Cmd+Enter submits.
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-gold" /> Issue to Outside Jeweller
          </DialogTitle>
          <DialogDescription>Records a transaction — not a manufacturing job.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Outside Jeweller *</Label>
            <Select value={jewellerId} onValueChange={setJewellerId}>
              <SelectTrigger ref={firstFieldRef as any} data-testid="outside-issue-jeweller-select">
                <SelectValue placeholder="Select outside jeweller…" />
              </SelectTrigger>
              <SelectContent>
                {jewellers.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Production Order (optional)</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger data-testid="outside-issue-order-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked order</SelectItem>
                {orders.slice(0, 200).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Material Type *</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger data-testid="outside-issue-material-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_OUTSIDE_WORK_MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={isGold ? "col-span-2" : ""}>
              <Label>{isGold ? "Issue from Gold Vault *" : "Purity (n/a)"}</Label>
              {isGold ? (
                <VaultGoldStockSelect
                  value={vaultStockId}
                  onChange={(id, line) => {
                    setVaultStockId(id);
                    if (line) setPurityStr(String(line.purity));
                  }}
                />
              ) : (
                <Select value={purityStr} onValueChange={setPurityStr} disabled>
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
              )}
            </div>
          </div>

          <div>
            <Label>Weight (g) *</Label>
            <Input
              value={weightStr}
              onChange={(e) => setWeightStr(e.target.value)}
              placeholder="10.000"
              inputMode="decimal"
              data-testid="outside-issue-weight-input"
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
            <Label>Expected Return Date</Label>
            <Input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </div>

          {isGold ? (
            <GoldPurityHelper
              weightG={weightStr}
              fromPurity={Number(purityStr) || undefined}
              lockedWeight={false}
              lockedFrom={Boolean(Number(purityStr))}
            />
          ) : null}

          <div>
            <Label>Narration (optional)</Label>
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
            data-testid="outside-issue-submit"
          >
            <Truck className="h-4 w-4" /> {saving ? "Issuing…" : "Issue (Ctrl+Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
