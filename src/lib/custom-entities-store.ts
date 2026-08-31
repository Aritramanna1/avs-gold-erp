/**
 * Custom Business Entities Store — Supabase-backed
 * Master Reference: docs/CUSTOM_FIELDS_AND_FORMS_MASTER.md
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";
import { toast } from "sonner";

export interface CustomEntityField {
  id: string;
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean" | "textarea";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface CustomEntityDefinition {
  id: string;
  code: string;
  name: string;
  category: "counterparty" | "inventory" | "workshop" | "custom";
  description?: string;
  fields: CustomEntityField[];
  recordsCount: number;
  isActive: boolean;
}

export interface CustomEntityRecord {
  id: string;
  entityDefinitionId: string;
  entityCode: string;
  recordCode: string;
  primaryName: string;
  phone?: string;
  email?: string;
  attributes: Record<string, unknown>;
  createdAt: string;
}

interface DefinitionRow {
  id: string;
  entity_code: string;
  entity_name: string;
  category: string;
  description: string | null;
  fields_schema: CustomEntityField[] | null;
  is_active: boolean;
}

interface RecordRow {
  id: string;
  entity_definition_id: string;
  entity_code: string;
  record_code: string;
  primary_name: string;
  phone: string | null;
  email: string | null;
  attributes: Record<string, unknown> | null;
  created_at: string;
}

const SEED_DEFINITIONS: Omit<CustomEntityDefinition, "id" | "recordsCount">[] = [
  {
    code: "STONE_CONTRACTOR",
    name: "Stone Setting Contractor",
    category: "counterparty",
    description:
      "Specialist diamond and gemstone setter with per-stone / per-carat rate contracts.",
    fields: [
      {
        id: "f_st_1",
        name: "stone_type",
        label: "Specialist Stone Type",
        type: "select",
        options: ["Micro Pave Diamond", "Solitaire", "Colored Gemstones", "Kundan/Polki"],
        required: true,
      },
      {
        id: "f_st_2",
        name: "labour_rate_per_stone",
        label: "Setting Rate (₹/Stone)",
        type: "number",
        required: true,
      },
      {
        id: "f_st_3",
        name: "outstanding_balance_paise",
        label: "Initial Balance (₹)",
        type: "number",
        required: false,
      },
      { id: "f_st_4", name: "notes", label: "Contractor Notes", type: "textarea", required: false },
    ],
    isActive: true,
  },
  {
    code: "REFINERY_ASSAYER",
    name: "Refinery & Fire Assay Partner",
    category: "counterparty",
    description: "Government-accredited melting, cupellation, and XRF assay lab.",
    fields: [
      {
        id: "f_rf_1",
        name: "nptl_license_no",
        label: "BIS / NABL Lab License No",
        type: "text",
        required: true,
      },
      {
        id: "f_rf_2",
        name: "turnaround_hours",
        label: "Assay Turnaround (Hours)",
        type: "number",
        required: false,
      },
      {
        id: "f_rf_3",
        name: "melt_loss_tolerance_pct",
        label: "Max Loss Allowance (%)",
        type: "number",
        required: true,
      },
    ],
    isActive: true,
  },
];

function fromDefinitionRow(row: DefinitionRow, recordsCount: number): CustomEntityDefinition {
  return {
    id: row.id,
    code: row.entity_code,
    name: row.entity_name,
    category: (row.category as CustomEntityDefinition["category"]) || "custom",
    description: row.description ?? undefined,
    fields: Array.isArray(row.fields_schema) ? row.fields_schema : [],
    recordsCount,
    isActive: row.is_active,
  };
}

function fromRecordRow(row: RecordRow): CustomEntityRecord {
  return {
    id: row.id,
    entityDefinitionId: row.entity_definition_id,
    entityCode: row.entity_code,
    recordCode: row.record_code,
    primaryName: row.primary_name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    attributes: row.attributes ?? {},
    createdAt: row.created_at,
  };
}

interface CustomEntitiesState {
  entities: CustomEntityDefinition[];
  records: CustomEntityRecord[];
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addEntity: (
    input: Omit<CustomEntityDefinition, "id" | "recordsCount">,
  ) => Promise<CustomEntityDefinition | null>;
  updateEntity: (id: string, patch: Partial<CustomEntityDefinition>) => Promise<void>;
  deleteEntity: (id: string) => Promise<boolean>;
  addRecord: (
    entityId: string,
    input: {
      primaryName: string;
      phone?: string;
      email?: string;
      attributes?: Record<string, unknown>;
    },
  ) => Promise<CustomEntityRecord | null>;
  deleteRecord: (id: string) => Promise<void>;
  recordsForEntity: (entityCode: string) => CustomEntityRecord[];
}

async function seedDefaultDefinitions(): Promise<void> {
  for (const seed of SEED_DEFINITIONS) {
    const { error } = await supabase.from("custom_entity_definitions" as never).insert({
      entity_code: seed.code,
      entity_name: seed.name,
      category: seed.category,
      description: seed.description ?? null,
      fields_schema: seed.fields,
      search_fields: ["primary_name", "phone", "email"],
      is_active: seed.isActive,
    } as never);
    if (error && !error.message.includes("duplicate")) {
      console.warn("[custom-entities] Seed definition failed:", error.message);
    }
  }
}

export const useCustomEntitiesStore = create<CustomEntitiesState>()((set, get) => ({
  entities: [],
  records: [],
  loading: false,
  hydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const { data: defs, error: defErr } = await supabase
        .from("custom_entity_definitions" as never)
        .select("id,entity_code,entity_name,category,description,fields_schema,is_active")
        .order("entity_name", { ascending: true });
      if (defErr) throw defErr;

      let definitions = (defs ?? []) as unknown as DefinitionRow[];
      if (definitions.length === 0) {
        await seedDefaultDefinitions();
        const retry = await supabase
          .from("custom_entity_definitions" as never)
          .select("id,entity_code,entity_name,category,description,fields_schema,is_active")
          .order("entity_name", { ascending: true });
        if (retry.error) throw retry.error;
        definitions = (retry.data ?? []) as unknown as DefinitionRow[];
      }

      const firmId = await resolveFirmIdForQuery();
      let recordsQuery = supabase
        .from("custom_entity_records" as never)
        .select(
          "id,entity_definition_id,entity_code,record_code,primary_name,phone,email,attributes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (firmId) {
        recordsQuery = withFirmScope(recordsQuery, firmId) as typeof recordsQuery;
      }
      const { data: recs, error: recErr } = await recordsQuery;
      if (recErr) throw recErr;

      const records = ((recs ?? []) as unknown as RecordRow[]).map(fromRecordRow);
      const countByCode = records.reduce<Record<string, number>>((acc, r) => {
        acc[r.entityCode] = (acc[r.entityCode] ?? 0) + 1;
        return acc;
      }, {});

      const entities = definitions.map((d) =>
        fromDefinitionRow(d, countByCode[d.entity_code] ?? 0),
      );

      set({ entities, records, hydrated: true, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load custom entities";
      console.warn("[custom-entities] hydrate failed:", message);
      toast.error(message);
      set({ loading: false, hydrated: true });
    }
  },

  addEntity: async (input) => {
    const { data, error } = await supabase
      .from("custom_entity_definitions" as never)
      .insert({
        entity_code: input.code,
        entity_name: input.name,
        category: input.category,
        description: input.description ?? null,
        fields_schema: input.fields,
        search_fields: input.fields.map((f) => f.name),
        is_active: input.isActive,
      } as never)
      .select("id,entity_code,entity_name,category,description,fields_schema,is_active")
      .single();
    if (error) {
      toast.error(error.message ?? "Could not create entity definition.");
      return null;
    }
    const created = fromDefinitionRow(data as unknown as DefinitionRow, 0);
    set((s) => ({ entities: [...s.entities, created] }));
    toast.success(`Custom entity "${created.name}" created.`);
    return created;
  },

  updateEntity: async (id, patch) => {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.entity_name = patch.name;
    if (patch.code !== undefined) payload.entity_code = patch.code;
    if (patch.category !== undefined) payload.category = patch.category;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.fields !== undefined) payload.fields_schema = patch.fields;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;

    const { error } = await supabase
      .from("custom_entity_definitions" as never)
      .update(payload as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not update entity.");
      return;
    }
    set((s) => ({
      entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
    toast.success("Entity definition updated.");
  },

  deleteEntity: async (id) => {
    const entity = get().entities.find((e) => e.id === id);
    if (!entity) return false;
    if (entity.recordsCount > 0) {
      toast.error("Cannot delete an entity that still has records.");
      return false;
    }
    const { error } = await supabase
      .from("custom_entity_definitions" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not delete entity.");
      return false;
    }
    set((s) => ({ entities: s.entities.filter((e) => e.id !== id) }));
    toast.success("Entity definition removed.");
    return true;
  },

  addRecord: async (entityId, input) => {
    const entity = get().entities.find((e) => e.id === entityId);
    if (!entity) {
      toast.error("Entity not found.");
      return null;
    }
    const existing = get().records.filter((r) => r.entityCode === entity.code);
    const recordCode = `${entity.code.substring(0, 3)}-${(existing.length + 1).toString().padStart(3, "0")}`;

    const { data, error } = await supabase
      .from("custom_entity_records" as never)
      .insert({
        entity_definition_id: entityId,
        entity_code: entity.code,
        record_code: recordCode,
        primary_name: input.primaryName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        attributes: input.attributes ?? {},
        is_active: true,
      } as never)
      .select(
        "id,entity_definition_id,entity_code,record_code,primary_name,phone,email,attributes,created_at",
      )
      .single();
    if (error) {
      toast.error(error.message ?? "Could not save record.");
      return null;
    }
    const created = fromRecordRow(data as unknown as RecordRow);
    set((s) => ({
      records: [created, ...s.records],
      entities: s.entities.map((e) =>
        e.id === entityId ? { ...e, recordsCount: e.recordsCount + 1 } : e,
      ),
    }));
    toast.success(`Record "${created.primaryName}" saved.`);
    return created;
  },

  deleteRecord: async (id) => {
    const record = get().records.find((r) => r.id === id);
    if (!record) return;
    const { error } = await supabase
      .from("custom_entity_records" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message ?? "Could not delete record.");
      return;
    }
    set((s) => ({
      records: s.records.filter((r) => r.id !== id),
      entities: s.entities.map((e) =>
        e.code === record.entityCode ? { ...e, recordsCount: Math.max(0, e.recordsCount - 1) } : e,
      ),
    }));
    toast.success("Record removed.");
  },

  recordsForEntity: (entityCode) => get().records.filter((r) => r.entityCode === entityCode),
}));

let hydrateOnce: Promise<void> | null = null;

export function ensureCustomEntitiesLoaded(): Promise<void> {
  if (!hydrateOnce) hydrateOnce = useCustomEntitiesStore.getState().hydrate();
  return hydrateOnce;
}
