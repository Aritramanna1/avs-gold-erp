/**
 * Automatic weekly statements.
 *
 * Registered on the in-app scheduler (scheduler.ts, cadence "weekly"). Once a
 * week it sends:
 *   • Jewellers  → their professional weekly ledger statement (PDF, via the
 *                  Print Engine → WasenderAPI).
 *   • Workers    → a simple message asking them to verify their physical gold
 *                  records and daily slips for the week.
 *
 * Guards (nothing auto-spams):
 *   1. OPT-IN — off unless an admin enables it (meta flag, configurable).
 *   2. Only runs when an actual sending WhatsApp provider is configured. The
 *      deep-link fallback opens a browser tab, which is impossible from a
 *      headless scheduler — so it's skipped (logged), never silently "sent".
 */
import { registerJob } from "./scheduler";
import { useCommSettings } from "./comm-settings-store";
import { sendWhatsAppDocument } from "./send-whatsapp-document";
import { sendWhatsAppText } from "./send-whatsapp-text";
import { usePeople } from "@/lib/people-store";
import { getPartyGoldBalance } from "@/lib/customer-account-ledger";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { getMetaValue, setMetaValue } from "@/lib/local-db";

const FLAG = "weekly_statements_enabled";

export function isWeeklyStatementsEnabled(): boolean {
  return getMetaValue(FLAG) === "1";
}
export function setWeeklyStatementsEnabled(on: boolean): void {
  setMetaValue(FLAG, on ? "1" : "0");
}

/** True when a real sending WhatsApp provider (not the deep-link fallback) is active. */
function hasSendingProvider(): boolean {
  return useCommSettings
    .getState()
    .configs.some(
      (c) =>
        c.channel === "whatsapp" &&
        c.isActive &&
        c.providerType &&
        c.providerType !== "whatsapp_deep_link",
    );
}

async function runWeeklyStatements(): Promise<void> {
  if (!isWeeklyStatementsEnabled()) return;
  if (!hasSendingProvider()) {
    console.info("[weekly-statements] skipped — no auto-sending WhatsApp provider configured.");
    return;
  }

  const people = usePeople.getState().people;

  // Jewellers / customers with an open gold position get a ledger statement PDF.
  for (const p of people) {
    if (p.type !== "customer" && p.type !== "firm_customer") continue;
    if (!p.phone) continue;
    const bal = getPartyGoldBalance(p.id);
    if (bal.receivedFineMg === 0 && bal.outstandingFineMg === 0) continue;
    await sendWhatsAppDocument({
      docType: "customer_ledger_statement",
      recordId: p.id,
      phone: p.phone,
      recipientName: p.fullName,
      caption: `Your weekly ledger statement from us. Please review.`,
      linkedType: "order",
      linkedId: p.id,
    }).catch((e) => console.error("[weekly-statements] jeweller send failed:", p.id, e));
  }

  // Workers with any custody activity get a simple verification reminder.
  const workerIds = new Set(useWorkerGoldBook.getState().entries.map((e) => e.workerId));
  for (const id of workerIds) {
    const w = people.find((x) => x.id === id);
    if (!w?.phone) continue;
    await sendWhatsAppText({
      phone: w.phone,
      message: `Namaste ${w.fullName}, please verify your physical gold records and daily material slips for this week and report any mismatch.`,
      recipientName: w.fullName,
      linkedType: "job",
      linkedId: id,
    }).catch((e) => console.error("[weekly-statements] worker send failed:", id, e));
  }
}

/** Register the weekly-statements job. Called from the app boot scheduler setup. */
export function registerWeeklyStatementJobs(): void {
  registerJob({ key: "weekly_statements", cadence: "weekly", run: runWeeklyStatements });
}
