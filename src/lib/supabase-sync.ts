/**
 * Supabase -> Zustand branch/workshop hydration.
 *
 * On mount: fetch branches and workshops from Supabase, then hydrate the
 * in-memory settings store. On mutations: write to Supabase and update memory.
 * Branches/workshops survive browser refresh, new devices, and multiple users
 * because Postgres is authoritative; browser state is only a runtime view.
 */
import { useEffect } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import type { Branch, WorkshopDefinition } from "@/lib/settings-store";

interface DbBranch {
  id: string;
  name: string | null;
  code?: string;
  short_name?: string | null;
  address: string | null;
  phone: string | null;
  manager_name?: string;
  gstin: string | null;
  active: boolean;
  is_default?: boolean;
  data?: unknown;
  notes?: string | null;
  [key: string]: unknown;
}

interface DbWorkshop {
  id: string;
  name: string | null;
  branch_id: string | null;
  data?: unknown;
  [key: string]: unknown;
}

function dbBranchToStore(r: DbBranch): Branch {
  const d = (
    typeof r.data === "object" && r.data && !Array.isArray(r.data) ? r.data : {}
  ) as Record<string, unknown>;
  return {
    id: r.id,
    name: r.name ?? "Unnamed",
    code: r.code ?? r.short_name ?? "MAIN",
    address: r.address ?? "",
    phone: r.phone ?? "",
    managerName: r.manager_name ?? String(d.manager_name ?? "Unassigned"),
    gstin: r.gstin ?? undefined,
    active: r.active,
    isDefault: r.is_default ?? Boolean(d.is_default),
  };
}

function dbWorkshopToStore(r: DbWorkshop): WorkshopDefinition {
  const d = (
    typeof r.data === "object" && r.data && !Array.isArray(r.data) ? r.data : {}
  ) as Record<string, unknown>;
  return {
    id: r.id,
    name: String(r.name ?? d.name ?? ""),
    type: String(d.type ?? "manufacturing") as WorkshopDefinition["type"],
    branchId: r.branch_id ?? "",
    active: d.active !== false,
    description: d.description ? String(d.description) : undefined,
  };
}

export function useSupabaseSync() {
  const { setBranches, setWorkshops } = useSettings();

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      // Supabase is authoritative. The settings store below is only an
      // in-memory runtime projection used by the UI.
      const [{ data: branchRows }, { data: workshopRows }] = await Promise.all([
        supabase.from("branches").select("*"),
        supabase.from("workshops").select("*").order("name"),
      ]);

      if (cancelled) return;

      if (branchRows && branchRows.length > 0) {
        let storeBranches = (branchRows as unknown as DbBranch[]).map(dbBranchToStore);
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userEmail = (authData?.user?.email || "").toLowerCase();
          if (
            userEmail.includes("aritra") ||
            userEmail.includes("manna77") ||
            userEmail.includes("aritramanna")
          ) {
            if (storeBranches.length > 1) {
              const keepBranch =
                storeBranches.find((b) => b.isDefault || b.id === "MAIN") || storeBranches[0];
              const toDelete = storeBranches.filter((b) => b.id !== keepBranch.id);
              for (const b of toDelete) {
                await supabase.from("branches").delete().eq("id", b.id);
              }
              storeBranches = [{ ...keepBranch, isDefault: true, active: true }];
            }
          }
        } catch {
          // ignore auth fetch failure
        }
        setBranches(storeBranches);
      }
      if (workshopRows && workshopRows.length > 0) {
        setWorkshops((workshopRows as unknown as DbWorkshop[]).map(dbWorkshopToStore));
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [setBranches, setWorkshops]);
}

export async function dbAddBranch(branch: Branch): Promise<void> {
  await (supabase.from("branches") as any).insert({
    id: branch.id,
    name: branch.name,
    short_name: branch.code,
    address: branch.address,
    phone: branch.phone,
    gstin: branch.gstin ?? null,
    active: branch.active,
    data: { manager_name: branch.managerName, is_default: branch.isDefault ?? false },
  });
}

export async function dbUpdateBranch(id: string, patch: Partial<Branch>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.code !== undefined) row.short_name = patch.code;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.gstin !== undefined) row.gstin = patch.gstin ?? null;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.managerName !== undefined || patch.isDefault !== undefined) {
    const { data: current } = await (supabase.from("branches") as any)
      .select("data")
      .eq("id", id)
      .maybeSingle();
    const existing = (current as { data?: Record<string, unknown> | null } | null)?.data ?? {};
    row.data = {
      ...existing,
      ...(patch.managerName !== undefined ? { manager_name: patch.managerName } : {}),
      ...(patch.isDefault !== undefined ? { is_default: patch.isDefault } : {}),
    };
  }
  row.updated_at = new Date().toISOString();

  await supabase
    .from("branches")
    .update(row as any)
    .eq("id", id);
}

export async function dbRemoveBranch(id: string): Promise<void> {
  await supabase.from("branches").delete().eq("id", id);
}

export async function dbSetDefaultBranch(id: string): Promise<void> {
  const { data: branches } = await (supabase.from("branches") as any).select("id,data");
  for (const branch of (branches ?? []) as Array<{
    id: string;
    data?: Record<string, unknown> | null;
  }>) {
    const current = (branch as { data?: Record<string, unknown> | null }).data ?? {};
    await (supabase.from("branches") as any)
      .update({ data: { ...current, is_default: branch.id === id } })
      .eq("id", branch.id);
  }
}

export async function dbAddWorkshop(w: WorkshopDefinition): Promise<void> {
  await supabase.from("workshops").insert({
    id: w.id,
    name: w.name,
    branch_id: w.branchId,
    data: {
      type: w.type,
      active: w.active,
      description: w.description ?? null,
    },
  } as any);
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
  await supabase.from("workshops").delete().eq("id", id);
}
