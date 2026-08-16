/**
 * Tenant-configurable language aliases for Assistant understanding.
 * Managed via Customization → Business Language → Aliases.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type AliasType = "terminology" | "typo" | "hinglish" | "abbreviation" | "party_nickname";

export interface LanguageAlias {
  id: string;
  aliasText: string;
  canonicalText: string;
  aliasType: AliasType;
  language: string;
  contextHint?: string;
  isActive: boolean;
}

interface LanguageAliasesState {
  aliases: LanguageAlias[];
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addAlias: (input: Omit<LanguageAlias, "id" | "isActive">) => Promise<LanguageAlias | null>;
  removeAlias: (id: string) => Promise<void>;
  getAliasMap: () => Record<string, string>;
}

let cachedAliasMap: Record<string, string> | null = null;

export const useLanguageAliasesStore = create<LanguageAliasesState>()((set, get) => ({
  aliases: [],
  loading: false,
  hydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("assistant_language_aliases" as never)
        .select("id,alias_text,canonical_text,alias_type,language,context_hint,is_active")
        .eq("is_active", true)
        .order("alias_text", { ascending: true });
      if (error) throw error;

      const aliases = ((data ?? []) as Record<string, unknown>[]).map((row): LanguageAlias => ({
        id: String(row.id),
        aliasText: String(row.alias_text),
        canonicalText: String(row.canonical_text),
        aliasType: row.alias_type as AliasType,
        language: String(row.language ?? "en-IN"),
        contextHint: row.context_hint ? String(row.context_hint) : undefined,
        isActive: Boolean(row.is_active),
      }));

      cachedAliasMap = Object.fromEntries(
        aliases.map((a) => [a.aliasText.toLowerCase(), a.canonicalText.toLowerCase()]),
      );

      set({ aliases, hydrated: true, loading: false });
    } catch {
      set({ hydrated: true, loading: false });
    }
  },

  addAlias: async (input) => {
    const { data, error } = await supabase
      .from("assistant_language_aliases" as never)
      .insert({
        alias_text: input.aliasText.toLowerCase().trim(),
        canonical_text: input.canonicalText.toLowerCase().trim(),
        alias_type: input.aliasType,
        language: input.language,
        context_hint: input.contextHint ?? null,
        is_active: true,
      } as never)
      .select("id,alias_text,canonical_text,alias_type,language,context_hint,is_active")
      .single();
    if (error) return null;

    const created: LanguageAlias = {
      id: String((data as Record<string, unknown>).id),
      aliasText: String((data as Record<string, unknown>).alias_text),
      canonicalText: String((data as Record<string, unknown>).canonical_text),
      aliasType: (data as Record<string, unknown>).alias_type as AliasType,
      language: String((data as Record<string, unknown>).language ?? "en-IN"),
      contextHint: (data as Record<string, unknown>).context_hint
        ? String((data as Record<string, unknown>).context_hint)
        : undefined,
      isActive: true,
    };

    set((s) => {
      const next = [...s.aliases, created];
      cachedAliasMap = Object.fromEntries(
        next.map((a) => [a.aliasText.toLowerCase(), a.canonicalText.toLowerCase()]),
      );
      return { aliases: next };
    });
    return created;
  },

  removeAlias: async (id) => {
    await supabase
      .from("assistant_language_aliases" as never)
      .delete()
      .eq("id", id);
    set((s) => {
      const next = s.aliases.filter((a) => a.id !== id);
      cachedAliasMap = Object.fromEntries(
        next.map((a) => [a.aliasText.toLowerCase(), a.canonicalText.toLowerCase()]),
      );
      return { aliases: next };
    });
  },

  getAliasMap: () => cachedAliasMap ?? {},
}));

let hydrateOnce: Promise<void> | null = null;

export async function ensureLanguageAliasesLoaded(): Promise<void> {
  if (!hydrateOnce) {
    hydrateOnce = useLanguageAliasesStore.getState().hydrate();
  }
  return hydrateOnce;
}

export async function getTenantAliasMap(): Promise<Record<string, string>> {
  await ensureLanguageAliasesLoaded();
  return useLanguageAliasesStore.getState().getAliasMap();
}
