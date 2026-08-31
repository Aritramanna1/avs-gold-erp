import { useEffect, useMemo, useState } from "react";
import { useReferenceNotes } from "@/lib/reference-notes-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  entityType: "person" | "order" | "job";
  entityId: string;
}

export function ReferenceNotesPanel({ entityType, entityId }: Props) {
  const allNotes = useReferenceNotes((s) => s.notes);
  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => n.entityType === entityType && n.entityId === entityId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [allNotes, entityType, entityId],
  );
  const addNote = useReferenceNotes((s) => s.addNote);
  const removeNote = useReferenceNotes((s) => s.removeNote);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void useReferenceNotes
      .getState()
      .refresh(entityType, entityId)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not load reference notes"),
      );
  }, [entityType, entityId]);

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await addNote(entityType, entityId, draft.trim());
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save reference note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="Add a new reference note..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="resize-none"
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={!draft.trim() || saving}>
            Post Note
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
            No reference notes attached to this record yet.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-lg border bg-card/50 text-sm flex gap-3 relative group"
            >
              <div className="pt-1 text-muted-foreground shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">{note.author}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(note.createdAt, "PP p")}
                  </span>
                </div>
                <div className="whitespace-pre-wrap">{note.note}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-destructive"
                onClick={() =>
                  void removeNote(note.id).catch((error) =>
                    toast.error(
                      error instanceof Error ? error.message : "Could not remove reference note",
                    ),
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
