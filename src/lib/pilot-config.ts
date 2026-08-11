/**
 * Pilot Phase 1 — Manufacturing Mode only.
 *
 * This is a single, explicit switch for which ERP_MODULES (see module-store.ts)
 * are forced off for the pilot regardless of per-branch module_states in
 * Supabase — so the pilot doesn't depend on seeding every branch's DB row
 * correctly, and reverting for the next version is a one-line change here
 * instead of hunting down every gate. Nothing behind these keys is deleted;
 * see RETAIL_ONLY_MODULE_KEYS' consumers (Sidebar, repair.tsx) for where the
 * gate is actually enforced.
 */
import type { ERPModuleKey } from "./module-store";

export const RETAIL_ONLY_MODULE_KEYS: ERPModuleKey[] = ["loyalty_program"];

/**
 * Workshop V1.1 scope — first production release. Attendance & Payroll
 * (daily tracking, salary rules, settlement, loans, wastage) isn't ready for
 * production; gated the same way as RETAIL_ONLY_MODULE_KEYS above so it's a
 * one-line revert for V1.2 instead of hunting down every gate.
 */
export const V1_1_COMING_SOON_MODULE_KEYS: ERPModuleKey[] = [];

export function isPilotHiddenModule(key: ERPModuleKey): boolean {
  return RETAIL_ONLY_MODULE_KEYS.includes(key) || V1_1_COMING_SOON_MODULE_KEYS.includes(key);
}

export const RETAIL_COMING_SOON_MESSAGE = "Retail Module — Coming in Next Version";
export const ATTENDANCE_COMING_SOON_MESSAGE = "Attendance & Payroll — Coming in Next Version";
export const ATTENDANCE_COMING_SOON_DETAIL =
  "This ERP is running Workshop V1.1 for the current release. Attendance, salary rules, settlement, and wastage tracking remain in the codebase and will return in a future version.";

export const CRM_PIPELINE_COMING_SOON_MESSAGE = "Sales Pipeline — Coming in Next Version";
export const CRM_PIPELINE_COMING_SOON_DETAIL =
  "Lead/opportunity pipeline tracking remains in the codebase and will return in a future version.";

export const MARKETING_CAMPAIGNS_COMING_SOON_MESSAGE = "Bulk Campaigns — Coming in Next Version";
export const MARKETING_CAMPAIGNS_COMING_SOON_DETAIL =
  "Bulk marketing campaign tools remain in the codebase and will return in a future version.";

/**
 * Workshop V1.1 ships WhatsApp (Deep Link + self-hosted OpenWA) as the
 * production communication channel. Email delivery — provider config,
 * per-event automation, bulk campaigns — stays in the codebase intact but
 * off in the UI until a future version; nothing here deletes the Email
 * provider, service.ts path, or send-email edge function.
 */
export const EMAIL_AUTOMATION_COMING_SOON_MESSAGE = "Email Automation — Coming in Next Version";
export const EMAIL_AUTOMATION_COMING_SOON_DETAIL =
  "Email delivery remains in the codebase and will return in a future version. WhatsApp (Deep Link + OpenWA) is fully available.";

export interface TrialTenantConfig {
  tenantId: string;
  tenantName: string;
  plan: "trial_14_day" | "standard" | "premium";
  trialStartsAt: string;
  trialEndsAt: string;
  daysRemaining: number;
  isExpired: boolean;
  sampleDataLoaded: boolean;
}

export function createTrialConfig(tenantId: string, tenantName: string): TrialTenantConfig {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

  return {
    tenantId,
    tenantName,
    plan: "trial_14_day",
    trialStartsAt: startsAt.toISOString(),
    trialEndsAt: endsAt.toISOString(),
    daysRemaining: 14,
    isExpired: false,
    sampleDataLoaded: false,
  };
}
