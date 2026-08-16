import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Gem, Plus, Sparkles, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  ensurePurityGradesLoaded,
  usePurityGradesStore,
  type MetalType,
} from "@/lib/purity-grades-store";

const METAL_TABS: { key: MetalType; label: string; icon: typeof Coins }[] = [
  { key: "gold", label: "Gold", icon: Coins },
  { key: "silver", label: "Silver", icon: Sparkles },
  { key: "platinum", label: "Platinum", icon: Gem },
];

export function PurityGradesPanel() {
  const { grades, loading, hydrated, addGrade, updateGrade, toggleActive, removeGrade } =
    usePurityGradesStore();
  const [metalTab, setMetalTab] = useState<MetalType>("gold");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    karatLabel: "",
    touchPermille: "916",
    hallmarkSeal: "",
    sortOrder: "100",
    notes: "",
  });

  useEffect(() => {
    void ensurePurityGradesLoaded();
  }, []);

  const visible = grades
    .filter((g) => g.metalType === metalTab)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function openCreate() {
    setEditingId(null);
    setForm({
      karatLabel: "",
      touchPermille: metalTab === "silver" ? "925" : metalTab === "platinum" ? "950" : "916",
      hallmarkSeal: "",
      sortOrder: String((visible.length + 1) * 10),
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const grade = grades.find((g) => g.id === id);
    if (!grade) return;
    setEditingId(id);
    setForm({
      karatLabel: grade.karatLabel,
      touchPermille: String(grade.touchPermille),
      hallmarkSeal: grade.hallmarkSeal ?? "",
      sortOrder: String(grade.sortOrder),
      notes: grade.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const touch = Number(form.touchPermille);
    if (!form.karatLabel.trim()) {
      toast.error("Karat / stamp label is required.");
      return;
    }
    if (!Number.isInteger(touch) || touch < 0 || touch > 999) {
      toast.error("Touch must be an integer from 0 to 999 (per-mille).");
      return;
    }
    try {
      if (editingId) {
        await updateGrade(editingId, {
          karatLabel: form.karatLabel.trim(),
          touchPermille: touch,
          hallmarkSeal: form.hallmarkSeal.trim() || undefined,
          sortOrder: Number(form.sortOrder) || 100,
          notes: form.notes.trim() || undefined,
        });
        toast.success("Purity grade updated.");
      } else {
        const created = await addGrade({
          metalType: metalTab,
          karatLabel: form.karatLabel.trim(),
          touchPermille: touch,
          hallmarkSeal: form.hallmarkSeal.trim() || undefined,
          isActive: true,
          sortOrder: Number(form.sortOrder) || 100,
          notes: form.notes.trim() || undefined,
        });
        if (!created) {
          toast.error("Could not save purity grade. Check for duplicate touch values.");
          return;
        }
        toast.success("Purity grade added.");
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold">Stamp / Purity Master</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Authoritative fineness registry for fine-weight conversion, hallmark binding, and karat
            segregation across stock, vault, and manufacturing. Used everywhere purity is selected.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/stock/stones">Stones & Diamonds</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/control/rates">Daily Bhav</Link>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Grade
          </Button>
        </div>
      </div>

      <Tabs value={metalTab} onValueChange={(v) => setMetalTab(v as MetalType)}>
        <TabsList>
          {METAL_TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {METAL_TABS.map(({ key }) => (
          <TabsContent key={key} value={key} className="mt-4">
            {loading && !hydrated ? (
              <p className="text-sm text-muted-foreground">Loading purity grades…</p>
            ) : visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">No grades configured for this metal.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Label</th>
                      <th className="py-2 pr-3">Touch</th>
                      <th className="py-2 pr-3">Hallmark Seal</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((grade) => (
                      <tr key={grade.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3 font-medium">{grade.karatLabel}</td>
                        <td className="py-2.5 pr-3 font-mono">{grade.touchPermille}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground">
                          {grade.hallmarkSeal || "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          {grade.isActive ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-600 border-emerald-500/40"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                          {grade.isSystem && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              System
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(grade.id)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void toggleActive(grade.id)}
                          >
                            {grade.isActive ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          {!grade.isSystem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={async () => {
                                const ok = await removeGrade(grade.id);
                                if (ok) toast.success("Grade removed.");
                                else toast.error("System grades cannot be deleted.");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Purity Grade" : "Add Purity Grade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Karat / Stamp Label</Label>
              <Input
                value={form.karatLabel}
                onChange={(e) => setForm((f) => ({ ...f, karatLabel: e.target.value }))}
                placeholder="916 · 22K"
              />
            </div>
            <div>
              <Label>Touch (per-mille)</Label>
              <Input
                value={form.touchPermille}
                onChange={(e) => setForm((f) => ({ ...f, touchPermille: e.target.value }))}
                inputMode="numeric"
              />
            </div>
            <div>
              <Label>Hallmark / HUID Seal (optional)</Label>
              <Input
                value={form.hallmarkSeal}
                onChange={(e) => setForm((f) => ({ ...f, hallmarkSeal: e.target.value }))}
              />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                inputMode="numeric"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
