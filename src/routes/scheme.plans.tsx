import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { useSchemeStore } from "@/lib/scheme-store";
import { toast } from "sonner";

export const Route = createFileRoute("/scheme/plans")({
  head: () => ({ meta: [{ title: "Scheme Plans · AVS ERP" }] }),
  component: SchemePlansPage,
});

function SchemePlansPage() {
  const plans = useSchemeStore((s) => s.plans);
  const hydrate = useSchemeStore((s) => s.hydrate);
  const upsertPlan = useSchemeStore((s) => s.upsertPlan);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [months, setMonths] = useState("11");
  const [installmentRs, setInstallmentRs] = useState("");
  const [bonusRs, setBonusRs] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const durationMonths = Math.round(Number(months));
    const installmentPaise = Math.round(parseFloat(installmentRs || "0") * 100);
    const bonusPaise = Math.round(parseFloat(bonusRs || "0") * 100);
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required.");
      return;
    }
    if (durationMonths <= 0 || installmentPaise <= 0) {
      toast.error("Enter valid duration and installment amount.");
      return;
    }
    setSaving(true);
    try {
      await upsertPlan({
        code,
        name,
        durationMonths,
        installmentPaise,
        bonusPaise,
        notes: notes.trim() || undefined,
      });
      toast.success("Scheme plan saved.");
      setCode("");
      setName("");
      setInstallmentRs("");
      setBonusRs("0");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Scheme Plans"
        subtitle="Create installment plan masters (Offline Scheme Master)"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <form onSubmit={onSubmit} className="erp-surface rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="code">Plan code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SCH-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Plan name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="11 Month Gold" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="months">Duration (months)</Label>
            <Input id="months" className="font-mono" value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inst">Installment ₹</Label>
            <Input
              id="inst"
              className="font-mono"
              value={installmentRs}
              onChange={(e) => setInstallmentRs(e.target.value)}
              placeholder="5000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bonus">Bonus ₹</Label>
            <Input id="bonus" className="font-mono" value={bonusRs} onChange={(e) => setBonusRs(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create plan"}
        </Button>
      </form>

      <div className="erp-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Months</th>
              <th className="px-3 py-2 text-right">Installment ₹</th>
              <th className="px-3 py-2 text-right">Bonus ₹</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No plans yet.
                </td>
              </tr>
            ) : (
              plans.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono">{p.code}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 font-mono">{p.duration_months}</td>
                  <td className="px-3 py-2 font-mono text-right">{(p.installment_paise / 100).toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-right">{(p.bonus_paise / 100).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={"/scheme"}>Scheme hub</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={"/scheme/accounts"}>Enroll accounts</Link>
        </Button>
      </div>
    </div>
  );
}
