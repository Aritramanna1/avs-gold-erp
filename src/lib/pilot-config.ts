/**
 * Manufacturing-first module scope.
 *
 * This is a single, explicit switch for which ERP_MODULES (see module-store.ts)
 * are forced off for the current production scope regardless of per-branch
 * module_states in Supabase, so release scope is explicit and reversible
 * instead of hunting down every gate. Nothing behind these keys is deleted;
 * see RETAIL_ONLY_MODULE_KEYS' consumers (Sidebar, repair.tsx) for where the
 * gate is actually enforced.
 */
import type { ERPModuleKey } from "./module-store";

export const RETAIL_ONLY_MODULE_KEYS: ERPModuleKey[] = ["loyalty_program"];

/**
 * Scoped module gates. Keep this empty for active modules; add only modules
 * explicitly deferred by Product Owner decision.
 */
export const V1_1_COMING_SOON_MODULE_KEYS: ERPModuleKey[] = [];

export function isPilotHiddenModule(key: ERPModuleKey): boolean {
  return RETAIL_ONLY_MODULE_KEYS.includes(key) || V1_1_COMING_SOON_MODULE_KEYS.includes(key);
}

export const RETAIL_COMING_SOON_MESSAGE = "Retail Module Not Enabled";
export const ATTENDANCE_COMING_SOON_MESSAGE = "Attendance & Payroll Not Enabled";
export const ATTENDANCE_COMING_SOON_DETAIL =
  "Attendance, salary rules, settlement, and wastage tracking must be enabled only after the configured release gate passes.";

export const CRM_PIPELINE_COMING_SOON_MESSAGE = "Sales Pipeline Not Enabled";
export const CRM_PIPELINE_COMING_SOON_DETAIL =
  "Lead/opportunity pipeline tracking is outside the current manufacturing ERP release scope.";

export const MARKETING_CAMPAIGNS_COMING_SOON_MESSAGE = "Bulk Campaigns Not Enabled";
export const MARKETING_CAMPAIGNS_COMING_SOON_DETAIL =
  "Bulk marketing campaign tooling is outside the current manufacturing ERP release scope.";

/**
 * Workshop V1.1 ships WhatsApp (Deep Link + self-hosted OpenWA) as the
 * production communication channel. Email delivery stays in the codebase but
 * must pass provider, audit, retry, attachment, and security gates before
 * being enabled in tenant production UI.
 */
export const EMAIL_AUTOMATION_COMING_SOON_MESSAGE = "Email Automation Not Enabled";
export const EMAIL_AUTOMATION_COMING_SOON_DETAIL =
  "Email delivery requires provider configuration, retry, attachment, and audit verification before production enablement.";

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
