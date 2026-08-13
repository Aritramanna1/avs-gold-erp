import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface ReferenceNote {
  id: string;
  entityType: "person" | "order" | "job";
  entityId: string;
  note: string;
  createdAt: number;
  author: string;
}

interface ReferenceNotesState {
  notes: ReferenceNote[];
  refresh: (entityType?: ReferenceNote["entityType"], entityId?: string) => Promise<void>;
  addNote: (
    entityType: ReferenceNote["entityType"],
    entityId: string,
    note: string,
    author?: string,
  ) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  getNotes: (entityType: ReferenceNote["entityType"], entityId: string) => ReferenceNote[];
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `rn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getCurrentFirmId(): Promise<string> {
  const { data, error } = await supabase
    .from("user_profiles" as never)
    .select("firm_id")
    .maybeSingle();
  if (error) throw new Error(`Could not resolve firm for reference note: ${error.message}`);
  const firmId = (data as { firm_id?: string } | null)?.firm_id;
  if (!firmId) throw new Error("Could not resolve firm for reference note.");
  return firmId;
}

function fromRow(row: Record<string, unknown>): ReferenceNote {
  return {
    id: String(row.id),
    entityType: row.entity_type as ReferenceNote["entityType"],
    entityId: String(row.entity_id),
    note: String(row.note ?? ""),
    author: String(row.author ?? "System"),
    createdAt: Date.parse(String(row.created_at ?? "")) || Date.now(),
  };
}

export const useReferenceNotes = create<ReferenceNotesState>()((set, get) => ({
  notes: [],
  async refresh(entityType, entityId) {
    let query = supabase
      .from("reference_notes" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);
    const { data, error } = await query;
    if (error) throw new Error(`Could not read reference notes: ${error.message}`);
    const incoming = ((data ?? []) as Record<string, unknown>[]).map(fromRow);
    set((state) => {
      const scoped =
        entityType && entityId
          ? state.notes.filter((n) => n.entityType !== entityType || n.entityId !== entityId)
          : [];
      return { notes: [...scoped, ...incoming] };
    });
  },
  async addNote(entityType, entityId, note, author = "System") {
    const trimmed = note.trim();
    if (!trimmed) return;
    const record: ReferenceNote = {
      id: makeId(),
      entityType,
      entityId,
      note: trimmed,
      createdAt: Date.now(),
      author,
    };
    const firmId = await getCurrentFirmId();
    const { error } = await supabase.from("reference_notes" as never).insert({
      id: record.id,
      firm_id: firmId,
      entity_type: entityType,
      entity_id: entityId,
      note: trimmed,
      author,
    } as never);
    if (error) throw new Error(`Could not save reference note: ${error.message}`);
    set((state) => ({ notes: [record, ...state.notes] }));
  },
  async removeNote(id) {
    const { error } = await supabase
      .from("reference_notes" as never)
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Could not remove reference note: ${error.message}`);
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
  },
  getNotes(entityType, entityId) {
    return get().notes.filter((n) => n.entityType === entityType && n.entityId === entityId);
  },
}));
