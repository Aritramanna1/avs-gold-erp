/**
 * Communication Automation Settings (Plan 1 Step 9).
 *
 * Every automated business-event communication is gated behind an explicit,
 * independently-configurable toggle here — nothing in comm-automation.ts
 * fires unless its event key is enabled. Mirrors comm-settings-store.ts's
 * persistence pattern (Supabase app_settings).
 */
import { create } from "zustand";
import { createRepository } from "@/lib/repositories/base-repository";

export type AutomationEventKey =
  | "invoice_created"
  | "invoice_paid"
  | "payment_received"
  | "payment_reminder"
  | "order_confirmation"
  | "order_ready"
  | "order_delivered"
  | "manufacturing_update"
  | "repair_update"
  | "gold_settlement_reminder"
  | "outstanding_reminder"
  | "daily_summary"
  | "weekly_business_report"
  | "monthly_business_report"
  | "monthly_ledger_statement";

export interface AutomationRule {
  eventKey: AutomationEventKey;
  label: string;
  enabled: boolean;
  channels: Array<"email" | "whatsapp">;
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    eventKey: "invoice_created",
    label: "Auto-send invoice",
    enabled: false,
    channels: ["email", "whatsapp"],
  },
  {
    eventKey: "invoice_paid",
    label: "Auto-send payment confirmation",
    enabled: false,
    channels: ["email", "whatsapp"],
  },
  {
    eventKey: "payment_received",
    label: "Auto-send receipt",
    enabled: false,
    channels: ["email", "whatsapp"],
  },
  {
    eventKey: "payment_reminder",
    label: "Auto-send payment reminder",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "order_confirmation",
    label: "Auto-send order confirmation",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "order_ready",
    label: "Auto-notify order ready",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "order_delivered",
    label: "Auto-send delivery confirmation",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "manufacturing_update",
    label: "Auto-notify manufacturing updates",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "repair_update",
    label: "Auto-notify repair updates",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "gold_settlement_reminder",
    label: "Auto-remind gold settlement pending",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "outstanding_reminder",
    label: "Auto-remind outstanding balance",
    enabled: false,
    channels: ["whatsapp"],
  },
  {
    eventKey: "daily_summary",
    label: "Auto-send daily business summary",
    enabled: false,
    channels: ["email"],
  },
  {
    eventKey: "weekly_business_report",
    label: "Auto-send weekly business report",
    enabled: false,
    channels: ["email"],
  },
  {
    eventKey: "monthly_business_report",
    label: "Auto-send monthly business report",
    enabled: false,
    channels: ["email"],
  },
  {
    eventKey: "monthly_ledger_statement",
    label: "Auto-send monthly ledger statement",
    enabled: false,
    channels: ["email"],
  },
];

const appSettingsRepository = createRepository<{ id: string } & Record<string, unknown>>(
  "app_settings",
);

function persistToDb(payload: { rules: AutomationRule[]; reportRecipientEmail: string }): void {
  void appSettingsRepository.saveAs("comm_automation_rules", {
    id: "comm_automation_rules",
    ...payload,
  });
}

interface AutomationSettingsState {
  rules: AutomationRule[];
  /** Recipient for daily/weekly/monthly business reports (management summaries have no single "customer" to address). */
  reportRecipientEmail: string;
  refresh(): Promise<void>;
  isEnabled(eventKey: AutomationEventKey): boolean;
  channelsFor(eventKey: AutomationEventKey): Array<"email" | "whatsapp">;
  setRule(eventKey: AutomationEventKey, patch: Partial<Omit<AutomationRule, "eventKey">>): void;
  setReportRecipientEmail(email: string): void;
}

export const useAutomationSettings = create<AutomationSettingsState>()((set, get) => ({
  rules: DEFAULT_RULES,
  reportRecipientEmail: "",

  async refresh() {
    const saved = await appSettingsRepository.read("comm_automation_rules").catch(() => null);
    const savedRules = Array.isArray(saved?.rules) ? (saved.rules as AutomationRule[]) : [];
    const byKey = new Map(savedRules.map((rule) => [rule.eventKey, rule]));
    set({
      rules: DEFAULT_RULES.map((rule) => ({ ...rule, ...byKey.get(rule.eventKey) })),
      reportRecipientEmail:
        typeof saved?.reportRecipientEmail === "string" ? saved.reportRecipientEmail : "",
    });
  },

  isEnabled(eventKey) {
    return get().rules.find((r) => r.eventKey === eventKey)?.enabled ?? false;
  },

  channelsFor(eventKey) {
    return get().rules.find((r) => r.eventKey === eventKey)?.channels ?? [];
  },

  setRule(eventKey, patch) {
    set((s) => {
      const next = s.rules.map((r) => (r.eventKey === eventKey ? { ...r, ...patch } : r));
      persistToDb({ rules: next, reportRecipientEmail: s.reportRecipientEmail });
      return { rules: next };
    });
  },

  setReportRecipientEmail(email) {
    set((s) => {
      persistToDb({ rules: s.rules, reportRecipientEmail: email });
      return { reportRecipientEmail: email };
    });
  },
}));
