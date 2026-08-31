/**
 * Resolve the operational branch id for writes/filters.
 * Trial firms use real ids like `br_…` with code MAIN; stale UI state often
 * still holds the literal string "MAIN", which hides every person/order row.
 */
import { useSettings } from "@/lib/settings-store";

const LEGACY_PLACEHOLDERS = new Set(["MAIN", "WORKSHOP"]);

export function resolveOperationalBranchId(preferred?: string | null): string {
  const state = useSettings.getState();
  const branches = (state.branches ?? []).filter((b) => b.active !== false);
  const raw = String(preferred ?? state.selectedBranchId ?? "").trim();

  if (raw && !LEGACY_PLACEHOLDERS.has(raw) && branches.some((b) => b.id === raw)) {
    return raw;
  }

  if (raw && !LEGACY_PLACEHOLDERS.has(raw) && branches.length === 0) {
    return raw;
  }

  const byCode =
    branches.find((b) => b.isDefault) ||
    branches.find((b) => String(b.code || "").toUpperCase() === "MAIN") ||
    branches[0];

  if (byCode?.id) return byCode.id;
  return raw || "MAIN";
}

/** True when selectedBranchId is a stale placeholder not present in pulled branches. */
export function selectedBranchNeedsRemap(): boolean {
  const state = useSettings.getState();
  const id = String(state.selectedBranchId ?? "").trim();
  if (!id || !LEGACY_PLACEHOLDERS.has(id)) {
    if (!id) return true;
    return !(state.branches ?? []).some((b) => b.id === id);
  }
  return true;
}
