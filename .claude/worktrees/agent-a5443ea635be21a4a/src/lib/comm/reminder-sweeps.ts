/**
 * Reminder sweeps (Plan 1 Step 9).
 *
 * IMPORTANT BUSINESS RULE (updated): financial/gold-settlement
 * communications must NEVER fire automatically. The ERP records and keeps
 * outstanding balances visible (compileCustomerLedger, getWorkerBalance —
 * both already pure, always-live queries, unaffected by this change), but
 * actually SENDING a "please clear your gold/cash dues" message requires a
 * human to explicitly trigger it. Only genuinely operational events (order
 * confirmed/ready/delivered, repair/manufacturing updates — see
 * comm-automation.ts's other event keys) may still fire automatically when
 * their automation rule is enabled.
 *
 * This file used to register these as daily scheduled jobs. It no longer
 * does — the three `sendXxxRemindersNow()` functions below exist so a UI
 * "Send Reminders" button can invoke the exact same escalation-tiered
 * logic on demand, but nothing here runs on a timer anymore.
 */
import { escalate, resolveEscalation } from "./escalation";
import { useBilling } from "@/lib/billing-store";
import { usePeople } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";

export interface PendingReminder {
  entityId: string;
  name: string;
  phone?: string;
  email?: string;
}

/** Data-only — "prepare reminders" per the business rule: never sends anything, just lists who currently has an outstanding cash balance. */
export function getPendingOutstandingBalanceReminders(): PendingReminder[] {
  const people = usePeople.getState().people;
  return useBilling
    .getState()
    .invoices.filter((inv) => inv.balancePaise > 0)
    .map((inv) => {
      const person = people.find((p) => p.id === (inv as any).customerId);
      return { entityId: inv.id, name: inv.customerName, phone: inv.customerPhone, email: person?.email };
    });
}

/** Data-only — lists workers with a pending gold balance, never sends anything. */
export function getPendingWorkerGoldSettlementReminders(): PendingReminder[] {
  const { entries, getWorkerBalance } = useWorkerGoldBook.getState();
  const people = usePeople.getState().people;
  const workerIds = Array.from(new Set(entries.map((e) => e.workerId)));
  return workerIds
    .filter((id) => getWorkerBalance(id).pendingFine > 0)
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ entityId: p.id, name: p.fullName, phone: p.phone, email: p.email }));
}

/** Data-only — lists customers with an outstanding gold credit balance, never sends anything. */
export function getPendingCustomerGoldCreditReminders(): PendingReminder[] {
  return usePeople
    .getState()
    .people.filter((p) => p.type === "customer" && compileCustomerLedger(p.id).goldCreditOwedMg > 0)
    .map((p) => ({ entityId: p.id, name: p.fullName, phone: p.phone, email: p.email }));
}

/**
 * Manually triggered (a "Send Reminders Now" button, never a timer). Sends
 * the invoice-outstanding-balance reminder for every invoice still owing,
 * via the same escalation ladder as before — the ladder logic (Day 1/3/7/15
 * -> responsible/manager/owner) is preserved for whenever a human decides
 * to run it, only the automatic timer is gone.
 */
export async function sendOutstandingBalanceRemindersNow(): Promise<void> {
  const allInvoices = useBilling.getState().invoices;
  const people = usePeople.getState().people;
  for (const inv of allInvoices) {
    if (inv.balancePaise <= 0) {
      await resolveEscalation("invoice_outstanding", inv.id);
      continue;
    }
    const person = people.find((p) => p.id === (inv as any).customerId);
    await escalate(
      "invoice_outstanding",
      inv.id,
      "outstanding_reminder",
      { name: inv.customerName, phone: inv.customerPhone, email: person?.email },
      { branchId: inv.branchId ?? "default", linkedType: "invoice" },
    );
  }
}

/** Manually triggered — see sendOutstandingBalanceRemindersNow's docs. */
export async function sendWorkerGoldSettlementRemindersNow(): Promise<void> {
  const { entries, getWorkerBalance } = useWorkerGoldBook.getState();
  const people = usePeople.getState().people;
  const workerIds = Array.from(new Set(entries.map((e) => e.workerId)));

  for (const workerId of workerIds) {
    const balance = getWorkerBalance(workerId);
    if (balance.pendingFine <= 0) {
      await resolveEscalation("worker_gold_settlement", workerId);
      continue;
    }
    const person = people.find((p) => p.id === workerId);
    if (!person) continue;
    await escalate(
      "worker_gold_settlement",
      workerId,
      "gold_settlement_reminder",
      { name: person.fullName, phone: person.phone, email: person.email },
      { branchId: "default", linkedType: "job" },
    );
  }
}

/** Manually triggered — see sendOutstandingBalanceRemindersNow's docs. */
export async function sendCustomerGoldCreditRemindersNow(): Promise<void> {
  const people = usePeople.getState().people.filter((p) => p.type === "customer");

  for (const person of people) {
    const summary = compileCustomerLedger(person.id);
    if (summary.goldCreditOwedMg <= 0) {
      await resolveEscalation("customer_gold_credit", person.id);
      continue;
    }
    await escalate(
      "customer_gold_credit",
      person.id,
      "gold_settlement_reminder",
      { name: person.fullName, phone: person.phone, email: person.email },
      { branchId: "default", linkedType: "invoice" },
    );
  }
}

/**
 * No-op today — kept so __root.tsx's existing wiring doesn't need to
 * change. Financial/gold reminders no longer run on a timer (see file
 * docstring); operational-event automation (order/repair/manufacturing
 * updates) is handled entirely by comm-automation.ts's event triggers,
 * which already fire from real store actions, not from a sweep.
 */
export function registerReminderSweeps(): void {}
