import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPendingOutstandingBalanceReminders,
  getPendingWorkerGoldSettlementReminders,
  getPendingCustomerGoldCreditReminders,
  sendOutstandingBalanceRemindersNow,
  sendWorkerGoldSettlementRemindersNow,
  sendCustomerGoldCreditRemindersNow,
  type PendingReminder,
} from "@/lib/comm/reminder-sweeps";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { useSettings } from "@/lib/settings-store";
import { useFinancialLocks, loadFinancialLocks } from "@/lib/financial-lock-store";
import { Send, Loader2, AlertTriangle, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/reminders")({
  head: () => ({ meta: [{ title: "Payment & Gold Reminders · AVS Gold ERP" }] }),
  component: RemindersPage,
});

/**
 * Financial/gold reminders never send automatically (a deliberate business
 * rule — see reminder-sweeps.ts). This page is the human-in-the-loop: it
 * shows exactly who would be reminded and lets a manager trigger the send
 * explicitly, one category at a time.
 */
/** "YYYY-MM" for the month before `d`. */
function previousPeriod(d: Date): string {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function RemindersPage() {
  const paymentReminderDays = useWorkflowEngine((s) => s.config.paymentReminderDays);
  const [sending, setSending] = useState<string | null>(null);
  const branches = useSettings((s) => s.branches);
  const locks = useFinancialLocks((s) => s.locks);
  const isLocked = useFinancialLocks((s) => s.isLocked);

  useEffect(() => {
    void loadFinancialLocks();
  }, []);

  const outstanding = getPendingOutstandingBalanceReminders();
  const workerGold = getPendingWorkerGoldSettlementReminders();
  const customerGold = getPendingCustomerGoldCreditReminders();

  // Monthly Reminder: once we're a few days into a new month, every active
  // branch should have last month's period locked (Month-End Close). This
  // reuses financial-lock-store.ts's own isLocked() check — not a new
  // "is it closed" computation — just surfaced proactively instead of only
  // being visible if someone happens to open Month-End Close.
  const overdueMonthEndBranches = useMemo(() => {
    const now = new Date();
    if (now.getDate() < 5) return []; // grace period for the first few days of the month
    const period = previousPeriod(now);
    return branches
      .filter((b) => b.active && !isLocked(b.id, period))
      .map((b) => ({ ...b, period }));
  }, [branches, locks, isLocked]);

  async function handleSend(kind: "outstanding" | "worker" | "customer") {
    setSending(kind);
    try {
      if (kind === "outstanding") await sendOutstandingBalanceRemindersNow();
      if (kind === "worker") await sendWorkerGoldSettlementRemindersNow();
      if (kind === "customer") await sendCustomerGoldCreditRemindersNow();
      toast.success("Reminders sent — see Communication History for delivery status.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminders");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Payment & Gold Reminders"
        subtitle={`Nothing here sends automatically. Outstanding balances shown are due for at least ${paymentReminderDays} day(s) — change this in Settings → Workflow.`}
      />

      {overdueMonthEndBranches.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-serif text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-400" /> Monthly Reminder: Month-End Close Due
              <Badge variant="secondary">{overdueMonthEndBranches.length}</Badge>
            </h3>
            <Link to="/reports/month-end-close">
              <Button size="sm" variant="outline">
                Open Month-End Close
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdueMonthEndBranches.map((b) => (
              <Badge key={b.id} variant="outline" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {b.name} — {b.period} not locked
              </Badge>
            ))}
          </div>
        </div>
      )}

      <ReminderSection
        title="Outstanding Cash Balance"
        list={outstanding}
        busy={sending === "outstanding"}
        onSend={() => handleSend("outstanding")}
      />
      <ReminderSection
        title="Worker Gold Settlement Pending"
        list={workerGold}
        busy={sending === "worker"}
        onSend={() => handleSend("worker")}
      />
      <ReminderSection
        title="Customer Gold Credit Owed"
        list={customerGold}
        busy={sending === "customer"}
        onSend={() => handleSend("customer")}
      />
    </div>
  );
}

function ReminderSection({
  title,
  list,
  busy,
  onSend,
}: {
  title: string;
  list: PendingReminder[];
  busy: boolean;
  onSend: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">
          {title} <Badge variant="secondary">{list.length}</Badge>
        </h3>
        <Button size="sm" onClick={onSend} disabled={busy || list.length === 0} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Reminders Now
        </Button>
      </div>
      {list.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nobody currently qualifies.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((r) => (
            <Badge key={r.entityId} variant="outline" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {r.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
