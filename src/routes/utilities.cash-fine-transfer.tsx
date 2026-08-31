import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { postCashFineTransfer, type CashFineDirection } from "@/lib/cash-fine-transfer";
import { usePeople } from "@/lib/people-store";
import { gramsToMg } from "@/lib/gold";
import { toast } from "sonner";

export const Route = createFileRoute("/utilities/cash-fine-transfer")({
  head: () => ({ meta: [{ title: "Cash ↔ Fine Transfer · AVS ERP" }] }),
  component: CashFineTransferPage,
});

function CashFineTransferPage() {
  const people = usePeople((s) => s.people);
  const [partyId, setPartyId] = useState("");
  const [direction, setDirection] = useState<CashFineDirection>("cash_to_fine");
  const [fineG, setFineG] = useState("");
  const [rateRs, setRateRs] = useState("");
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    let fineMg = 0;
    try {
      fineMg = gramsToMg(fineG);
    } catch {
      toast.error("Enter fine weight in grams (up to 3 decimals).");
      return;
    }
    const ratePerGramPaise = Math.round(parseFloat(rateRs || "0") * 100);
    if (!partyId) {
      toast.error("Select a party.");
      return;
    }
    setSaving(true);
    try {
      const result = await postCashFineTransfer({
        partyId,
        direction,
        fineMg,
        ratePerGramPaise,
        narration: narration.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cash ↔ Fine transfer posted.");
      setFineG("");
      setNarration("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setSaving(false);
    }
  }

  const previewPaise =
    (() => {
      try {
        const mg = gramsToMg(fineG || "0");
        const rate = Math.round(parseFloat(rateRs || "0") * 100);
        return Math.round((mg / 1000) * rate);
      } catch {
        return 0;
      }
    })();

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
      <PageHeader
        title="Cash ↔ Fine Transfer"
        subtitle="Offline types 21/22 — money voucher + gold vault adjustment"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <form onSubmit={onSubmit} className="erp-surface rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="party">Party</Label>
          <select
            id="party"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
          >
            <option value="">Select party…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dir">Direction</Label>
          <select
            id="dir"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={direction}
            onChange={(e) => setDirection(e.target.value as CashFineDirection)}
          >
            <option value="cash_to_fine">Cash → Fine</option>
            <option value="fine_to_cash">Fine → Cash</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fine">Fine gold (g)</Label>
          <Input
            id="fine"
            className="font-mono"
            value={fineG}
            onChange={(e) => setFineG(e.target.value)}
            placeholder="10.000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rate">Rate ₹ / g</Label>
          <Input
            id="rate"
            className="font-mono"
            value={rateRs}
            onChange={(e) => setRateRs(e.target.value)}
            placeholder="6500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="narr">Narration</Label>
          <Input id="narr" value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>
        <p className="text-sm font-mono text-muted-foreground">
          Amount ≈ ₹ {(previewPaise / 100).toFixed(2)}
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? "Posting…" : "Post transfer"}
        </Button>
      </form>
    </div>
  );
}
