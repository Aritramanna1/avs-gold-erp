/**
 * MTJ ERP — Supabase ↔ Zustand sync layer
 *
 * On mount: fetches branches, workshops from Supabase → hydrates settings store.
 * On mutations: writes to Supabase AND updates the local store.
 *
 * This makes branches/workshops survive browser refresh, new devices, and
 * multiple users — they are the source of truth in Postgres, not localStorage.
 */
import { useEffect } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import type { Branch, WorkshopDefinition } from "@/lib/settings-store";
import { isOfflineMode } from "@/lib/deployment-mode";

// ── Row shapes from Supabase (snake_case) ────────────────────────

interface DbBranch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  manager_name: string;
  gstin: string | null;
  active: boolean;
  is_default: boolean;
  notes: string | null;
}

interface DbWorkshop {
  id: string;
  name: string;
  type: string;
  branch_id: string | null;
  active: boolean;
  description: string | null;
}

// ── Converters ────────────────────────────────────────────────────

function dbBranchToStore(r: DbBranch): Branch {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    address: r.address ?? "",
    phone: r.phone ?? "",
    managerName: r.manager_name ?? "Unassigned",
    gstin: r.gstin ?? undefined,
    active: r.active,
    isDefault: r.is_default,
  };
}

function dbWorkshopToStore(r: DbWorkshop): WorkshopDefinition {
  return {
    id: r.id,
    name: r.name,
    type: r.type as WorkshopDefinition["type"],
    branchId: r.branch_id ?? "",
    active: r.active,
    description: r.description ?? undefined,
  };
}

// ── Hook: call once at app root ───────────────────────────────────

export function useSupabaseSync() {
  const { setBranches, setWorkshops } = useSettings();

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      // Offline mode never touches Supabase — branches/workshops come from the
      // local settings store (localStorage-cached), which is the source of truth.
      if (isOfflineMode()) return;
      const [{ data: branchRows }, { data: workshopRows }] = await Promise.all([
        supabase.from("branches").select("*").order("is_default", { ascending: false }),
        supabase.from("workshops").select("*").order("name"),
      ]);

      if (cancelled) return;

      if (branchRows && branchRows.length > 0) {
        setBranches(branchRows.map(dbBranchToStore));
      }
      if (workshopRows && workshopRows.length > 0) {
        setWorkshops(workshopRows.map(dbWorkshopToStore));
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [setBranches, setWorkshops]);
}

// ── Supabase-backed CRUD for branches ────────────────────────────

export async function dbAddBranch(branch: Branch): Promise<void> {
  if (isOfflineMode()) return;
  await supabase.from("branches").insert({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    phone: branch.phone,
    manager_name: branch.managerName,
    gstin: branch.gstin ?? null,
    active: branch.active,
    is_default: branch.isDefault ?? false,
  });
}

export async function dbUpdateBranch(id: string, patch: Partial<Branch>): Promise<void> {
  if (isOfflineMode()) return;
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.code !== undefined) row.code = patch.code;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.managerName !== undefined) row.manager_name = patch.managerName;
  if (patch.gstin !== undefined) row.gstin = patch.gstin ?? null;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  row.updated_at = new Date().toISOString();

  await supabase
    .from("branches")
    .update(row as any)
    .eq("id", id);
}

export async function dbRemoveBranch(id: string): Promise<void> {
  if (isOfflineMode()) return;
  await supabase.from("branches").delete().eq("id", id);
}

export async function dbSetDefaultBranch(id: string): Promise<void> {
  if (isOfflineMode()) return;
  // Clear all is_default first, then set the chosen one
  await supabase.from("branches").update({ is_default: false }).neq("id", "");
  await supabase.from("branches").update({ is_default: true }).eq("id", id);
}

// ── Supabase-backed CRUD for workshops ───────────────────────────

export async function dbAddWorkshop(w: WorkshopDefinition): Promise<void> {
  if (isOfflineMode()) return;
  await supabase.from("workshops").insert({
    id: w.id,
    name: w.name,
    type: w.type,
    branch_id: w.branchId,
    active: w.active,
    description: w.description ?? null,
  });
}

export async function dbUpdateWorkshop(
  id: string,
  patch: Partial<WorkshopDefinition>,
): Promise<void> {
  if (isOfflineMode()) return;
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.branchId !== undefined) row.branch_id = patch.branchId;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.description !== undefined) row.description = patch.description ?? null;

  await supabase
    .from("workshops")
    .update(row as any)
    .eq("id", id);
}

export async function dbRemoveWorkshop(id: string): Promise<void> {
  if (isOfflineMode()) return;
  await supabase.from("workshops").delete().eq("id", id);
}
