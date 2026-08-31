import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useItemGroups, type ItemGroup } from "@/lib/item-groups-store";

const EMPTY = {
  group_code: "",
  group_name: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

export function ItemGroupsPanel() {
  const { groups, loading, load, save, remove, hydrated } = useItemGroups();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemGroup | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!hydrated) void load();
  }, [hydrated, load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups.filter(
      (g) =>
        g.group_code.toLowerCase().includes(t) || g.group_name.toLowerCase().includes(t),
    );
  }, [groups, q]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(group: ItemGroup) {
    setEditing(group);
    setForm({
      group_code: group.group_code,
      group_name: group.group_name,
      description: group.description ?? "",
      sort_order: group.sort_order,
      is_active: group.is_active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.group_code.trim() || !form.group_name.trim()) {
      toast.error("Group code and name are required.");
      return;
    }
    try {
      await save({
        ...form,
        description: form.description.trim() || null,
        ...(editing ? { id: editing.id } : {}),
      });
      toast.success(editing ? "Item group updated." : "Item group created.");
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handleDelete(group: ItemGroup) {
    if (!window.confirm(`Delete group "${group.group_name}"?`)) return;
    try {
      await remove(group.id);
      toast.success("Item group deleted.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search groups…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> New Group
        </Button>
      </div>
      {loading && !groups.length ? (
        <p className="text-sm text-muted-foreground">Loading item groups…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No item groups yet. Create groups like Gold Ornaments, Silver Utensils, Bullion Bars.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {filtered.map((group) => (
            <li key={group.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <div className="font-medium">
                  {group.group_name}{" "}
                  <span className="text-muted-foreground font-normal">({group.group_code})</span>
                  {!group.is_active ? (
                    <Badge variant="secondary" className="ml-2">
                      Inactive
                    </Badge>
                  ) : null}
                </div>
                {group.description ? (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(group)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => void handleDelete(group)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Item Group" : "New Item Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Group code *</Label>
              <Input
                value={form.group_code}
                onChange={(e) => setForm((f) => ({ ...f, group_code: e.target.value }))}
                placeholder="GOLD-ORN"
              />
            </div>
            <div>
              <Label>Group name *</Label>
              <Input
                value={form.group_name}
                onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))}
                placeholder="Gold Ornaments"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
