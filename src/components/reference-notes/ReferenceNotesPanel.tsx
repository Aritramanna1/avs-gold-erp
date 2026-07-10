import { useState } from "react";
import { useReferenceNotes } from "@/lib/reference-notes-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";

interface Props {
  entityType: "person" | "order" | "job";
  entityId: string;
}

export function ReferenceNotesPanel({ entityType, entityId }: Props) {
  const store = useReferenceNotes();
  const notes = store.getNotes(entityType, entityId).sort((a, b) => b.createdAt - a.createdAt);
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    if (!draft.trim()) return;
    store.addNote(entityType, entityId, draft.trim());
    setDraft("");
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
          <Button size="sm" onClick={handleAdd} disabled={!draft.trim()}>
            Post Note
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-xl">
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
                onClick={() => store.removeNote(note.id)}
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
