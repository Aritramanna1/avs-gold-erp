/**
 * Saved Filters & Custom Views (Priority 5) — a generic, reusable
 * mechanism any list screen can use to let a user save "the filters I keep
 * re-applying" (e.g. "Overdue invoices for Branch A", "Karigars with
 * pending gold"). Deliberately generic: `viewKey` identifies which screen
 * a saved filter belongs to (e.g. "billing.index", "people.index"), and
 * `criteria` is an opaque JSON blob that screen defines and interprets
 * itself — this module only stores/retrieves, it has no opinion about
 * what any screen's filters look like.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { getCloudDataClient } from "./providers/data-provider";

export interface SavedFilter {
  id: string;
  viewKey: string;
  name: string;
  criteria: Record<string, unknown>;
  createdById: string | null;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SavedFiltersState {
  filters: SavedFilter[];
  refresh: () => Promise<void>;
  save: (
    f: Omit<SavedFilter, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => Promise<SavedFilter>;
  remove: (id: string) => Promise<void>;
  forView: (viewKey: string) => SavedFilter[];
  setDefault: (viewKey: string, id: string) => Promise<void>;
  reset: () => void;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `filt_${crypto.randomUUID()}`;
  return `filt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const filterRepository = createRepository<SavedFilter>("saved_filters");

function pickSavedFilter(row: { data?: Partial<SavedFilter> | null }): SavedFilter | null {
  const data = row.data;
  if (!data?.id || !data.viewKey || !data.name) return null;
  return data as SavedFilter;
}

async function fetchSavedFilters(): Promise<SavedFilter[]> {
  const db = getCloudDataClient();
  const { data, error } = await (db as any)
    .from("saved_filters")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(error.message ?? "Could not load saved filters.");
  return ((data ?? []) as Array<{ data?: Partial<SavedFilter> | null }>)
    .map(pickSavedFilter)
    .filter((row): row is SavedFilter => !!row);
}

export const useSavedFilters = create<SavedFiltersState>()((set, get) => ({
  filters: [],
  refresh: async () => {
    set({ filters: await fetchSavedFilters() });
  },
  save: async (input) => {
    const now = Date.now();
    const existing = input.id ? get().filters.find((f) => f.id === input.id) : undefined;
    const filter: SavedFilter = {
      id: input.id ?? makeId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...input,
    };
    await filterRepository.save(filter);
    set((s) => ({
      filters: existing
        ? s.filters.map((f) => (f.id === filter.id ? filter : f))
        : [filter, ...s.filters],
    }));
    return filter;
  },
  remove: async (id) => {
    await filterRepository.delete(id);
    set((s) => ({ filters: s.filters.filter((f) => f.id !== id) }));
  },
  forView: (viewKey) => get().filters.filter((f) => f.viewKey === viewKey),
  setDefault: async (viewKey, id) => {
    const viewFilters = get().filters.filter((f) => f.viewKey === viewKey);
    for (const f of viewFilters) {
      if (f.isDefault && f.id !== id) {
        const updated = { ...f, isDefault: false, updatedAt: Date.now() };
        await filterRepository.save(updated);
        set((s) => ({ filters: s.filters.map((x) => (x.id === f.id ? updated : x)) }));
      }
    }
    const target = get().filters.find((f) => f.id === id);
    if (target && !target.isDefault) {
      const updated = { ...target, isDefault: true, updatedAt: Date.now() };
      await filterRepository.save(updated);
      set((s) => ({ filters: s.filters.map((x) => (x.id === id ? updated : x)) }));
    }
  },
  reset: () => set({ filters: [] }),
}));
