import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/lib/settings-store";
import {
  useFinancialLocks,
  loadFinancialLocks,
  type FinancialLockPeriod,
} from "@/lib/financial-lock-store";
import { supabase } from "@/integrations/supabase/client";
import { Lock, LockOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/month-end-close")({
  head: () => ({ meta: [{ title: "Month-End Close · MTJ ERP" }] }),
  component: MonthEndClosePage,
});

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

function MonthEndClosePage() {
  const branches = useSettings((s) => s.branches);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const locks = useFinancialLocks((s) => s.locks);
  const [branchId, setBranchId] = useState(selectedBranchId || "MAIN");
  const [period, setPeriod] = useState(thisMonth());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadFinancialLocks();
  }, []);

  const months = useMemo(() => lastNMonths(12), []);
  const lockFor = (b: string, p: string) => locks.find((l) => l.branchId === b && l.period === p);

  async function actor() {
    const { data } = await supabase.auth.getSession();
    return { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null };
  }

  async function handleLock() {
    setBusy(true);
    try {
      const who = await actor();
      await useFinancialLocks.getState().lock(branchId, period, who, reason || undefined);
      toast.success(`${period} locked for ${branchId}. No dated postings allowed inside it.`);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to lock period");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(l: FinancialLockPeriod) {
    setBusy(true);
    try {
      const who = await actor();
      await useFinancialLocks.getState().unlock(l.branchId, l.period, who);
      toast.success(`${l.period} unlocked for ${l.branchId}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unlock period");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Month-End Close"
        subtitle="Lock a financial period once close-out is verified. Locked periods block dated postings."
      />

      <div className="rounded-2xl border border-border bg-card p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <Label>Branch</Label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-lg border border-border bg-background p-2 text-sm h-10 min-w-40"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Period</Label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-border bg-background p-2 text-sm h-10 min-w-32"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <Label>Reason / close-out note (optional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Daily close reconciled, all vouchers posted" />
        </div>
        <Button onClick={handleLock} disabled={busy || !!lockFor(branchId, period)} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Lock Period
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3">Branch</th>
              <th className="p-3">Period</th>
              <th className="p-3">Locked At</th>
              <th className="p-3">Locked By</th>
              <th className="p-3">Reason</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {locks.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No locked periods yet.
                </td>
              </tr>
            )}
            {locks
              .slice()
              .sort((a, b) => b.lockedAt - a.lockedAt)
              .map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="p-3">{l.branchId}</td>
                  <td className="p-3">
                    <Badge variant="secondary">{l.period}</Badge>
                  </td>
                  <td className="p-3">{new Date(l.lockedAt).toLocaleString()}</td>
                  <td className="p-3">{l.lockedByEmail ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{l.reason ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => handleUnlock(l)} disabled={busy} className="gap-1">
                      <LockOpen className="h-3.5 w-3.5" /> Unlock
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
