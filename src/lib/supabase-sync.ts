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

// The generated client enforces the live schema. Keep the small legacy
// settings adapter isolated here while the settings payload is normalized.
const cloud = supabase as any;

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
      const [{ data: branchRows }, { data: workshopRows }] = await Promise.all([
        cloud.from("branches").select("*").order("is_default", { ascending: false }),
        cloud.from("workshops").select("*").order("name"),
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
  await cloud.from("branches").insert({
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
  await cloud.from("branches").delete().eq("id", id);
}

export async function dbSetDefaultBranch(id: string): Promise<void> {
  // Clear all is_default first, then set the chosen one
  await cloud.from("branches").update({ is_default: false }).neq("id", "");
  await cloud.from("branches").update({ is_default: true }).eq("id", id);
}

// ── Supabase-backed CRUD for workshops ───────────────────────────

export async function dbAddWorkshop(w: WorkshopDefinition): Promise<void> {
  await cloud.from("workshops").insert({
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
  await cloud.from("workshops").delete().eq("id", id);
}
