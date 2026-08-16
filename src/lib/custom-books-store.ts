/**
 * Custom Books & Formula Column Definitions — Supabase-backed
 * Master Reference: docs/UNIVERSAL_CUSTOMIZATION_MASTER.md
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";
import type {
  BookColumnConfig,
  CustomBookDefinition,
} from "@/components/customization/CustomBooksDesigner";

interface BookRow {
  id: string;
  book_code: string;
  book_name: string;
  base_source: string;
  description: string | null;
  column_configs: BookColumnConfig[] | null;
  filter_rules: Record<string, unknown> | null;
  is_system: boolean;
  is_active: boolean;
}

export const PRESET_BOOKS: CustomBookDefinition[] = [
  {
    id: "book_mfg_default",
    code: "MFG_ELIGIBLE_BOOK",
    name: "Manufacturing Eligible Weight Book",
    baseSource: "manufacturing",
    description:
      "Workshop production ledger deducting chain and findings weight from artisan remuneration.",
    columns: [
      {
        id: "c1",
        fieldCode: "job_number",
        label: "Job Card No",
        sourceType: "base_field",
        format: "text",
        isVisible: true,
      },
      {
        id: "c2",
        fieldCode: "karigar_name",
        label: "Karigar / Artisan",
        sourceType: "base_field",
        format: "text",
        isVisible: true,
      },
      {
        id: "c3",
        fieldCode: "gross_weight",
        label: "Gross Wt (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "c4",
        fieldCode: "net_weight",
        label: "Net Wt (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "c5",
        fieldCode: "chain_weight",
        label: "Chain / Machine Part (g)",
        sourceType: "base_field",
        format: "weight_g",
        isVisible: true,
      },
      {
        id: "c6",
        fieldCode: "worker_eligible_wt",
        label: "Worker Eligible Wt (g)",
        sourceType: "calculated_formula",
        formulaExpression: "{net_weight} - {chain_weight}",
        format: "weight_g",
        isVisible: true,
        isTotalAggregated: true,
      },
      {
        id: "c7",
        fieldCode: "making_charge_payable",
        label: "Labour Payable (₹)",
        sourceType: "calculated_formula",
        formulaExpression: "({net_weight} - {chain_weight}) * {labour_rate}",
        format: "currency_inr",
        isVisible: true,
        isTotalAggregated: true,
      },
    ],
    isSystem: true,
    isActive: true,
  },
];

function fromRow(row: BookRow): CustomBookDefinition {
  return {
    id: row.id,
    code: row.book_code,
    name: row.book_name,
    baseSource: row.base_source as CustomBookDefinition["baseSource"],
    description: row.description ?? "",
    columns: Array.isArray(row.column_configs) ? row.column_configs : [],
    filterGroup: typeof row.filter_rules?.group === "string" ? row.filter_rules.group : undefined,
    isSystem: row.is_system,
    isActive: row.is_active,
  };
}

async function seedPresetBooks(): Promise<void> {
  for (const book of PRESET_BOOKS) {
    const { error } = await supabase.from("custom_book_definitions" as never).insert({
      book_code: book.code,
      book_name: book.name,
      base_source: book.baseSource,
      description: book.description,
      column_configs: book.columns,
      filter_rules: book.filterGroup ? { group: book.filterGroup } : {},
      is_system: book.isSystem,
      is_active: book.isActive,
    } as never);
    if (error && !error.message.includes("duplicate")) {
      console.warn("[custom-books] seed failed:", error.message);
    }
  }
}

interface CustomBooksState {
  books: CustomBookDefinition[];
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  saveBook: (book: CustomBookDefinition) => Promise<void>;
  addBook: (book: Omit<CustomBookDefinition, "id">) => Promise<CustomBookDefinition | null>;
  deleteBook: (id: string) => Promise<boolean>;
  getBookByCode: (code: string) => CustomBookDefinition | undefined;
}

export const useCustomBooksStore = create<CustomBooksState>()((set, get) => ({
  books: [],
  loading: false,
  hydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("custom_book_definitions" as never)
        .select(
          "id,book_code,book_name,base_source,description,column_configs,filter_rules,is_system,is_active",
        )
        .order("book_name", { ascending: true });
      if (error) throw error;

      let rows = (data ?? []) as unknown as BookRow[];
      if (rows.length === 0) {
        await seedPresetBooks();
        const retry = await supabase
          .from("custom_book_definitions" as never)
          .select(
            "id,book_code,book_name,base_source,description,column_configs,filter_rules,is_system,is_active",
          )
          .order("book_name", { ascending: true });
        if (retry.error) throw retry.error;
        rows = (retry.data ?? []) as unknown as BookRow[];
      }

      set({ books: rows.map(fromRow), hydrated: true, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load custom books";
      console.warn("[custom-books] hydrate failed:", message);
      toast.error(message);
      set({ loading: false, hydrated: true });
    }
  },

  saveBook: async (book) => {
    const payload = {
      book_code: book.code,
      book_name: book.name,
      base_source: book.baseSource,
      description: book.description,
      column_configs: book.columns,
      filter_rules: book.filterGroup ? { group: book.filterGroup } : {},
      is_system: book.isSystem,
      is_active: book.isActive,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("custom_book_definitions" as never)
      .update(payload as never)
      .eq("id", book.id);
    if (error) {
      toast.error(error.message ?? "Could not save book.");
      return;
    }
    set((s) => ({
      books: s.books.map((b) => (b.id === book.id ? book : b)),
    }));
  },

  addBook: async (book) => {
    const { data, error } = await supabase
      .from("custom_book_definitions" as never)
      .insert({
        book_code: book.code,
        book_name: book.name,
        base_source: book.baseSource,
        description: book.description,
        column_configs: book.columns,
        filter_rules: book.filterGroup ? { group: book.filterGroup } : {},
        is_system: book.isSystem,
        is_active: book.isActive,
      } as never)
      .select(
        "id,book_code,book_name,base_source,description,column_configs,filter_rules,is_system,is_active",
      )
      .single();
    if (error) {
      toast.error(error.message ?? "Could not create book.");
      return null;
    }
    const created = fromRow(data as unknown as BookRow);
    set((s) => ({ books: [...s.books, created] }));
    return created;
  },

  deleteBook: async (id) => {
    const book = get().books.find((b) => b.id === id);
    if (!book) return false;
    if (book.isSystem) {
      toast.error("System books cannot be deleted.");
      return false;
    }
    const { error } = await supabase
      .from("custom_book_definitions" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not delete book.");
      return false;
    }
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
    return true;
  },

  getBookByCode: (code) => get().books.find((b) => b.code === code),
}));

let hydrateOnce: Promise<void> | null = null;

export function ensureCustomBooksLoaded(): Promise<void> {
  if (!hydrateOnce) hydrateOnce = useCustomBooksStore.getState().hydrate();
  return hydrateOnce;
}
