import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Package } from "lucide-react";
import { toast } from "sonner";
import { useItemMasters, type ItemMaster } from "@/lib/item-masters-store";
import { useItemGroups } from "@/lib/item-groups-store";
import { DEFAULT_PURITY_PERMILLE } from "@/lib/gold";
import { guardRoute } from "@/lib/permissions";
import { requireOrganizationFeature } from "@/lib/identity/feature-gate";

export const Route = createFileRoute("/catalog/masters")({
  beforeLoad: ({ location }) => {
    guardRoute(location.pathname);
    requireOrganizationFeature("business.item_masters");
  },
  head: () => ({ meta: [{ title: "Master Items · AVS Gold ERP" }] }),
  component: CatalogMastersPage,
});

const EMPTY_FORM = {
  item_code: "",
  item_name: "",
  item_group_id: "" as string | null,
  category: "Ring",
  metal_type: "gold",
  purity_stamp: "995",
  default_touch_pct: DEFAULT_PURITY_PERMILLE / 10,
  stock_method: "tagged_only",
  labour_basis: "per_gram_gross",
  default_making_rate_paise: 0,
  hsn_code: "7113",
  is_active: true,
};

function CatalogMastersPage() {
  const { items, loading, load, save } = useItemMasters();
  const { groups, load: loadGroups, hydrated: groupsHydrated, schemaAvailable } = useItemGroups();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemMaster | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    void load();
    if (!groupsHydrated) void loadGroups();
  }, [load, loadGroups, groupsHydrated]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (i) =>
        i.item_code.toLowerCase().includes(t) ||
        i.item_name.toLowerCase().includes(t) ||
        i.category.toLowerCase().includes(t),
    );
  }, [items, q]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(item: ItemMaster) {
    setEditing(item);
    setForm({
      item_code: item.item_code,
      item_name: item.item_name,
      item_group_id: item.item_group_id ?? "",
      category: item.category,
      metal_type: item.metal_type,
      purity_stamp: item.purity_stamp,
      default_touch_pct: item.default_touch_pct,
      stock_method: item.stock_method,
      labour_basis: item.labour_basis,
      default_making_rate_paise: item.default_making_rate_paise,
      hsn_code: item.hsn_code,
      is_active: item.is_active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.item_code.trim() || !form.item_name.trim()) {
      toast.error("Item code and name are required.");
      return;
    }
    try {
      const selectedGroup = groups.find((g) => g.id === form.item_group_id);
      await save({
        ...form,
        item_group_id: form.item_group_id || null,
        item_group: selectedGroup?.group_name ?? null,
        ...(editing ? { id: editing.id } : {}),
      });
      toast.success(editing ? "Master item updated." : "Master item created.");
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Items"
        subtitle="Canonical item definitions for stock, orders, and billing pickers."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Master Item
          </Button>
        }
      />

      {groupsHydrated && schemaAvailable === false ? (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-100">
          <strong>Item Groups blocked on this environment.</strong> Migration{" "}
          <code className="text-xs">20260830280000_item_groups_and_inventory_master_link.sql</code> is
          not applied on QA yet. Master items work without groups; group assignment activates after the
          approved migration is applied and verified.
        </Card>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 min-h-11"
            placeholder="Search code, name, category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium hidden md:table-cell">Category</th>
                <th className="p-3 font-medium hidden lg:table-cell">Purity</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No master items yet.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">{item.item_code}</td>
                    <td className="p-3">{item.item_name}</td>
                    <td className="p-3 hidden md:table-cell">{item.category}</td>
                    <td className="p-3 hidden lg:table-cell">{item.purity_stamp}</td>
                    <td className="p-3">
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Master Item" : "New Master Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Item Code</Label>
                <Input
                  value={form.item_code}
                  onChange={(e) => setForm((f) => ({ ...f, item_code: e.target.value }))}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="min-h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Item Name</Label>
              <Input
                value={form.item_name}
                onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Item Group</Label>
              <Select
                value={form.item_group_id || "none"}
                disabled={schemaAvailable === false}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, item_group_id: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger className="min-h-11">
                  <SelectValue
                    placeholder={
                      schemaAvailable === false ? "Unavailable until migration applied" : "Select group…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups
                    .filter((g) => g.is_active)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.group_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Purity Stamp</Label>
                <Input
                  value={form.purity_stamp}
                  onChange={(e) => setForm((f) => ({ ...f, purity_stamp: e.target.value }))}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stock Method</Label>
                <Select
                  value={form.stock_method}
                  onValueChange={(v) => setForm((f) => ({ ...f, stock_method: v }))}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tagged_only">Tagged only</SelectItem>
                    <SelectItem value="loose_stock">Loose stock</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
