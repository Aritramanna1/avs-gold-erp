/**
 * Stamp / Purity master — firm-scoped fineness registry for gold, silver, platinum.
 * Master Reference: docs/JWELLY_REFERENCE_MASTER.md
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type MetalType = "gold" | "silver" | "platinum";

const FALLBACK_GOLD_OPTIONS = [
  { label: "999 · Fine", value: 999 },
  { label: "995", value: 995 },
  { label: "916 · 22K", value: 916 },
  { label: "875 · 21K", value: 875 },
  { label: "750 · 18K", value: 750 },
  { label: "585 · 14K", value: 585 },
];

export interface PurityGrade {
  id: string;
  metalType: MetalType;
  karatLabel: string;
  touchPermille: number;
  hallmarkSeal?: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  notes?: string;
}

interface PurityGradeRow {
  id: string;
  metal_type: string;
  karat_label: string;
  touch_permille: number;
  hallmark_seal: string | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  notes: string | null;
}

const DEFAULT_GOLD_GRADES: Omit<PurityGrade, "id">[] = [
  {
    metalType: "gold",
    karatLabel: "999 · Fine",
    touchPermille: 999,
    isActive: true,
    isSystem: true,
    sortOrder: 10,
  },
  {
    metalType: "gold",
    karatLabel: "995",
    touchPermille: 995,
    isActive: true,
    isSystem: true,
    sortOrder: 20,
  },
  {
    metalType: "gold",
    karatLabel: "916 · 22K",
    touchPermille: 916,
    isActive: true,
    isSystem: true,
    sortOrder: 30,
  },
  {
    metalType: "gold",
    karatLabel: "875 · 21K",
    touchPermille: 875,
    isActive: true,
    isSystem: true,
    sortOrder: 40,
  },
  {
    metalType: "gold",
    karatLabel: "750 · 18K",
    touchPermille: 750,
    isActive: true,
    isSystem: true,
    sortOrder: 50,
  },
  {
    metalType: "gold",
    karatLabel: "585 · 14K",
    touchPermille: 585,
    isActive: true,
    isSystem: true,
    sortOrder: 60,
  },
];

const DEFAULT_SILVER_GRADES: Omit<PurityGrade, "id">[] = [
  {
    metalType: "silver",
    karatLabel: "999 · Fine Silver",
    touchPermille: 999,
    isActive: true,
    isSystem: true,
    sortOrder: 10,
  },
  {
    metalType: "silver",
    karatLabel: "925 · Sterling",
    touchPermille: 925,
    isActive: true,
    isSystem: true,
    sortOrder: 20,
  },
];

const DEFAULT_PLATINUM_GRADES: Omit<PurityGrade, "id">[] = [
  {
    metalType: "platinum",
    karatLabel: "950 · Pt",
    touchPermille: 950,
    isActive: true,
    isSystem: true,
    sortOrder: 10,
  },
];

function fromRow(row: PurityGradeRow): PurityGrade {
  return {
    id: row.id,
    metalType: row.metal_type as MetalType,
    karatLabel: row.karat_label,
    touchPermille: row.touch_permille,
    hallmarkSeal: row.hallmark_seal ?? undefined,
    isActive: row.is_active,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
    notes: row.notes ?? undefined,
  };
}

async function seedDefaultGrades(): Promise<void> {
  const defaults = [...DEFAULT_GOLD_GRADES, ...DEFAULT_SILVER_GRADES, ...DEFAULT_PLATINUM_GRADES];
  for (const grade of defaults) {
    const { error } = await supabase.from("purity_grades" as never).insert({
      metal_type: grade.metalType,
      karat_label: grade.karatLabel,
      touch_permille: grade.touchPermille,
      is_active: grade.isActive,
      is_system: grade.isSystem,
      sort_order: grade.sortOrder,
    } as never);
    if (error) {
      if (error.code === "42501" || error.message.includes("violates row-level security policy")) {
        // Table is RLS restricted for current role; fallback in-memory grades will be used
        return;
      }
      if (!error.message.includes("duplicate")) {
        console.warn("[purity-grades] seed:", error.message);
      }
    }
  }
}

interface PurityGradesState {
  grades: PurityGrade[];
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  activeGrades: (metalType?: MetalType) => PurityGrade[];
  findByTouch: (touch: number, metalType?: MetalType) => PurityGrade | undefined;
  addGrade: (input: Omit<PurityGrade, "id" | "isSystem">) => Promise<PurityGrade | null>;
  updateGrade: (id: string, patch: Partial<PurityGrade>) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  removeGrade: (id: string) => Promise<boolean>;
}

export const usePurityGradesStore = create<PurityGradesState>()((set, get) => ({
  grades: [],
  loading: false,
  hydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("purity_grades" as never)
        .select(
          "id,metal_type,karat_label,touch_permille,hallmark_seal,is_active,is_system,sort_order,notes",
        )
        .order("sort_order", { ascending: true });
      if (error) throw error;

      let rows = (data ?? []) as unknown as PurityGradeRow[];
      if (rows.length === 0) {
        await seedDefaultGrades();
        const retry = await supabase
          .from("purity_grades" as never)
          .select(
            "id,metal_type,karat_label,touch_permille,hallmark_seal,is_active,is_system,sort_order,notes",
          )
          .order("sort_order", { ascending: true });
        if (retry.error) throw retry.error;
        rows = (retry.data ?? []) as unknown as PurityGradeRow[];
      }

      set({ grades: rows.map(fromRow), hydrated: true, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load purity grades";
      console.warn("[purity-grades] hydrate failed:", message);
      const fallback: PurityGrade[] = DEFAULT_GOLD_GRADES.map((g, i) => ({
        ...g,
        id: `fallback_gold_${i}`,
      }));
      set({ grades: fallback, hydrated: true, loading: false });
    }
  },

  activeGrades: (metalType = "gold") =>
    get()
      .grades.filter((g) => g.isActive && g.metalType === metalType)
      .sort((a, b) => a.sortOrder - b.sortOrder),

  findByTouch: (touch, metalType) =>
    get().grades.find(
      (g) => g.touchPermille === touch && (!metalType || g.metalType === metalType),
    ),

  addGrade: async (input) => {
    const { data, error } = await supabase
      .from("purity_grades" as never)
      .insert({
        metal_type: input.metalType,
        karat_label: input.karatLabel,
        touch_permille: input.touchPermille,
        hallmark_seal: input.hallmarkSeal ?? null,
        is_active: input.isActive,
        is_system: false,
        sort_order: input.sortOrder,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .select(
        "id,metal_type,karat_label,touch_permille,hallmark_seal,is_active,is_system,sort_order,notes",
      )
      .single();
    if (error) return null;
    const grade = fromRow(data as unknown as PurityGradeRow);
    set({ grades: [...get().grades, grade].sort((a, b) => a.sortOrder - b.sortOrder) });
    return grade;
  },

  updateGrade: async (id, patch) => {
    const existing = get().grades.find((g) => g.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch };
    const { error } = await supabase
      .from("purity_grades" as never)
      .update({
        metal_type: next.metalType,
        karat_label: next.karatLabel,
        touch_permille: next.touchPermille,
        hallmark_seal: next.hallmarkSeal ?? null,
        is_active: next.isActive,
        sort_order: next.sortOrder,
        notes: next.notes ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) throw error;
    set({ grades: get().grades.map((g) => (g.id === id ? next : g)) });
  },

  toggleActive: async (id) => {
    const grade = get().grades.find((g) => g.id === id);
    if (!grade) return;
    await get().updateGrade(id, { isActive: !grade.isActive });
  },

  removeGrade: async (id) => {
    const grade = get().grades.find((g) => g.id === id);
    if (!grade || grade.isSystem) return false;
    const { error } = await supabase
      .from("purity_grades" as never)
      .delete()
      .eq("id", id);
    if (error) return false;
    set({ grades: get().grades.filter((g) => g.id !== id) });
    return true;
  },
}));

let hydrateOnce: Promise<void> | null = null;

export function ensurePurityGradesLoaded(): Promise<void> {
  if (!hydrateOnce) hydrateOnce = usePurityGradesStore.getState().hydrate();
  return hydrateOnce;
}

/** Purity dropdown options — uses firm master when loaded, else built-in defaults. */
export function getPurityOptions(
  metalType: MetalType = "gold",
): { label: string; value: number }[] {
  const active = usePurityGradesStore.getState().activeGrades(metalType);
  if (active.length > 0) {
    return active.map((g) => ({ label: g.karatLabel, value: g.touchPermille }));
  }
  if (metalType === "gold") {
    return FALLBACK_GOLD_OPTIONS;
  }
  return [];
}
