import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  addNote: (entityType: ReferenceNote["entityType"], entityId: string, note: string, author?: string) => void;
  removeNote: (id: string) => void;
  getNotes: (entityType: ReferenceNote["entityType"], entityId: string) => ReferenceNote[];
}

export const useReferenceNotes = create<ReferenceNotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      addNote: (entityType, entityId, note, author = "System") => {
        set((state) => ({
          notes: [
            ...state.notes,
            {
              id: crypto.randomUUID(),
              entityType,
              entityId,
              note,
              createdAt: Date.now(),
              author,
            },
          ],
        }));
      },
      removeNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        }));
      },
      getNotes: (entityType, entityId) => {
        return get().notes.filter((n) => n.entityType === entityType && n.entityId === entityId);
      },
    }),
    {
      name: "mtj-reference-notes-store",
    }
  )
);
