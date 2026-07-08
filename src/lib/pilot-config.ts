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

export const RETAIL_ONLY_MODULE_KEYS: ERPModuleKey[] = ["repairs", "loyalty_program"];

export function isPilotHiddenModule(key: ERPModuleKey): boolean {
  return RETAIL_ONLY_MODULE_KEYS.includes(key);
}

export const RETAIL_COMING_SOON_MESSAGE = "Retail Module — Coming in Next Version";
