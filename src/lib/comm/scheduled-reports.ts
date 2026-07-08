/**
 * Daily / Weekly / Monthly business report jobs (Plan 1 Step 9).
 *
 * Registers with the scheduler (scheduler.ts) — these are real report jobs
 * computing actual figures from useBilling's live invoice data, not
 * placeholders. What's intentionally NOT built yet: exhaustive report
 * content (inventory summary, manufacturing summary, profit summary, gold
 * reconciliation) — only an invoice/revenue summary, since that's what's
 * cheaply and correctly computable from existing store data without new
 * aggregation logic elsewhere in the ERP. Expanding report content is a
 * documented follow-up, not silently claimed complete here.
 */
import { registerJob } from "./scheduler";
import { emitBusinessEvent } from "./comm-automation";
import { useAutomationSettings } from "./automation-settings-store";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";

function invoicesInWindow(sinceMs: number) {
  return useBilling.getState().invoices.filter((inv) => inv.createdAt >= sinceMs);
}

function summarize(windowLabel: string, sinceMs: number): string {
  const invoices = invoicesInWindow(sinceMs);
  const count = invoices.length;
  const totalPaise = invoices.reduce((s, inv) => s + inv.subtotalPaise + inv.gstPaise, 0);
  const outstandingPaise = invoices.reduce((s, inv) => s + inv.balancePaise, 0);
  return [
    `${windowLabel} Business Summary`,
    `Invoices created: ${count}`,
    `Total billed: Rs ${paiseToRupees(totalPaise)}`,
    `Outstanding balance: Rs ${paiseToRupees(outstandingPaise)}`,
  ].join("\n");
}

async function sendReport(
  eventKey: "daily_summary" | "weekly_business_report" | "monthly_business_report",
  title: string,
  sinceMs: number,
) {
  const { useBusinessRules } = await import("@/lib/business-rules-store");
  if (!useBusinessRules.getState().isEnabled("enable_automatic_reports")) return;

  const recipientEmail = useAutomationSettings.getState().reportRecipientEmail;
  if (!recipientEmail) return; // No recipient configured — nothing to send, not an error.
  const branchId = useSettings.getState().selectedBranchId ?? "default";
  await emitBusinessEvent(eventKey, {
    branchId,
    recipient: { name: "Management", email: recipientEmail },
    linkedId: `report-${eventKey}-${sinceMs}`,
    linkedType: "invoice",
    variables: { reportTitle: title, reportBody: summarize(title, sinceMs) },
  });
}

export function registerScheduledReportJobs(): void {
  registerJob({
    key: "daily_business_summary",
    cadence: "daily",
    run: () => sendReport("daily_summary", "Daily", Date.now() - 24 * 60 * 60 * 1000),
  });
  registerJob({
    key: "weekly_business_report",
    cadence: "weekly",
    run: () => sendReport("weekly_business_report", "Weekly", Date.now() - 7 * 24 * 60 * 60 * 1000),
  });
  registerJob({
    key: "monthly_business_report",
    cadence: "monthly",
    run: () =>
      sendReport("monthly_business_report", "Monthly", Date.now() - 30 * 24 * 60 * 60 * 1000),
  });
}
