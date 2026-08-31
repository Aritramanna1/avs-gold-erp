import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { useLedger } from "@/lib/ledger-store";
import { gramsToMg, parsePurity, fineGoldMg } from "@/lib/gold";
import { toast } from "sonner";
import { Users } from "lucide-react";

export const Route = createFileRoute("/utilities/opening-fine-cash")({
  head: () => ({ meta: [{ title: "Opening Fine / Cash · AVS ERP" }] }),
  component: OpeningFineCashPage,
});

function OpeningFineCashPage() {
  const append = useLedger((s) => s.append);
  const [step, setStep] = useState(0);
  const [grossG, setGrossG] = useState("");
  const [purity, setPurity] = useState("999");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function postOpeningVault(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const grossMg = gramsToMg(grossG);
      const p = parsePurity(purity);
      if (grossMg <= 0) throw new Error("Gross weight must be greater than 0 g.");
      const fineMg = fineGoldMg(grossMg, p);
      await append({
        type: "opening_vault",
        netFineMg: fineMg,
        deltas: { vault: fineMg },
        grossMg,
        purity: p,
        fineMg,
        notes: notes.trim() || undefined,
        reference: "Opening Vault",
        source: "opening_fine_cash",
      });
      toast.success(`Opening vault posted — fine ${fineMg} mg.`);
      setGrossG("");
      setNotes("");
      setStep(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Opening vault failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
      <PageHeader
        title="Opening Fine / Cash"
        subtitle="Wizard — vault opening via gold ledger, then party openings in People"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <div className="flex gap-2 text-xs no-print">
        <span className={step === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}>
          1. Opening vault
        </span>
        <span className="text-muted-foreground">→</span>
        <span className={step === 1 ? "text-foreground font-semibold" : "text-muted-foreground"}>
          2. Party openings
        </span>
      </div>

      {step === 0 ? (
        <form onSubmit={postOpeningVault} className="erp-surface rounded-xl p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Post physical gold into the vault as an opening entry. Cash openings for parties are
            maintained on the party master (People), not a second cash book.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="gross">Gross weight (g)</Label>
            <Input
              id="gross"
              className="font-mono"
              value={grossG}
              onChange={(e) => setGrossG(e.target.value)}
              placeholder="100.000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purity">Purity (‰)</Label>
            <Input
              id="purity"
              className="font-mono"
              value={purity}
              onChange={(e) => setPurity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Posting…" : "Post opening vault"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Skip to party openings
            </Button>
          </div>
        </form>
      ) : (
        <div className="erp-surface rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Set party opening fine / cash on the party master (gold opening fine mg and related
              fields). Open People, edit the party, and save openings there — they remain linked to
              the same party books.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/people">Open People (party openings)</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/ledger">Gold Vault</Link>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              Back to vault step
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
