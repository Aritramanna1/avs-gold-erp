import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { useSchemeStore } from "@/lib/scheme-store";
import { usePeople } from "@/lib/people-store";
import { toast } from "sonner";

export const Route = createFileRoute("/scheme/accounts")({
  head: () => ({ meta: [{ title: "Scheme Accounts · AVS ERP" }] }),
  component: SchemeAccountsPage,
});

function SchemeAccountsPage() {
  const plans = useSchemeStore((s) => s.plans);
  const accounts = useSchemeStore((s) => s.accounts);
  const hydrate = useSchemeStore((s) => s.hydrate);
  const enrollAccount = useSchemeStore((s) => s.enrollAccount);
  const people = usePeople((s) => s.people);
  const [planId, setPlanId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const party = people.find((p) => p.id === partyId);
    if (!planId || !party || !accountNo.trim()) {
      toast.error("Select plan, party, and enter account number.");
      return;
    }
    setSaving(true);
    try {
      await enrollAccount({
        planId,
        partyId: party.id,
        partyName: party.fullName,
        accountNo,
        startDate,
        notes: notes.trim() || undefined,
      });
      toast.success("Party enrolled in scheme.");
      setAccountNo("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed.");
    } finally {
      setSaving(false);
    }
  }

  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Scheme Accounts"
        subtitle="Enroll a party into a scheme plan"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <form onSubmit={onSubmit} className="erp-surface rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan">Plan</Label>
            <select
              id="plan"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              <option value="">Select plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>
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
            <Label htmlFor="acc">Account no.</Label>
            <Input
              id="acc"
              className="font-mono"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              placeholder="SCH-0001"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start">Start date</Label>
            <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Enrolling…" : "Enroll party"}
        </Button>
      </form>

      <div className="erp-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Party</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No scheme accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono">{a.account_no}</td>
                  <td className="px-3 py-2">{a.party_name || a.party_id}</td>
                  <td className="px-3 py-2">{planName(a.plan_id)}</td>
                  <td className="px-3 py-2 font-mono">{a.start_date}</td>
                  <td className="px-3 py-2">{a.status}</td>
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
          <Link to={"/scheme/receipts"}>Post receipts</Link>
        </Button>
      </div>
    </div>
  );
}
