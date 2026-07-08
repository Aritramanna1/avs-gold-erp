import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useStock,
  STOCK_LOCATIONS,
  STOCK_LOCATION_LABELS,
  STOCK_STATUS_LABELS,
  type StockLocation,
  type StockStatus,
} from "@/lib/stock-store";
import { ITEM_CATEGORIES } from "@/lib/orders-store";
import { COMMON_PURITIES, gramsToMg, mgToGrams } from "@/lib/gold";
import { Barcode } from "@/components/barcode";
import { Plus, Printer, ScanLine, Search, Trash2, Tag, CheckSquare, Square } from "lucide-react";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/barcode")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Barcode & Tagging · AVS Gold ERP" }] }),
  component: BarcodePage,
});

interface DraftRow {
  itemName: string;
  category: string;
  purity: string;
  grossG: string;
  netG: string;
  huid: string;
  makingG: string;
  location: StockLocation;
  status: StockStatus;
}

const EMPTY_ROW: DraftRow = {
  itemName: "",
  category: "Ring",
  purity: "916",
  grossG: "",
  netG: "",
  huid: "",
  makingG: "",
  location: "counter",
  status: "available",
};

function BarcodePage() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Barcode & Tagging"
        subtitle="Scanner desk, bulk tagging and jewellery tag settings."
        actions={
          <Link to="/stock">
            <Button variant="ghost">Back to Stock</Button>
          </Link>
        }
      />

      <Tabs defaultValue="scanner">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="scanner">
            <ScanLine className="h-4 w-4 mr-2" /> Scanner Desk
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <Plus className="h-4 w-4 mr-2" /> Bulk Stock Tagging
          </TabsTrigger>
          <TabsTrigger value="print">
            <Printer className="h-4 w-4 mr-2" /> Print Tags
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Tag className="h-4 w-4 mr-2" /> Tag Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="scanner" className="mt-4">
          <ScannerDesk />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <BulkTagging />
        </TabsContent>
        <TabsContent value="print" className="mt-4">
          <BulkPrintTags />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <TagSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScannerDesk() {
  const find = useStock((s) => s.findByBarcode);
  const allItems = useStock((s) => s.items);
  const recent = useMemo(() => allItems.slice(0, 8), [allItems]);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<ReturnType<typeof find>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function lookup(v?: string) {
    const q = (v ?? code).trim();
    if (!q) {
      setFound(undefined);
      return;
    }
    setFound(find(q));
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Scan or type barcode / item code (F2 to focus)
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            data-testid="barcode-scanner-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                lookup();
              }
            }}
            placeholder="Scan or type…"
            className="text-lg h-12 font-mono"
            autoFocus
          />
          <Button type="submit" className="h-12 px-6">
            <Search className="h-4 w-4 mr-2" /> Lookup
          </Button>
        </form>

        <div className="mt-5">
          {!found && code && (
            <p className="text-sm text-muted-foreground">
              No item found for <span className="font-mono">{code}</span>.
            </p>
          )}
          {found && (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-serif text-xl text-gold">{found.itemName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{found.itemCode}</div>
                </div>
                <Link to="/stock/$id" params={{ id: found.id }}>
                  <Button variant="outline">Open</Button>
                </Link>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 text-sm">
                <Pair k="Cat" v={found.category} />
                <Pair k="Purity" v={String(found.purity)} />
                <Pair k="Gross" v={`${mgToGrams(found.grossMg)}g`} />
                <Pair k="Net" v={`${mgToGrams(found.netMg)}g`} />
                <Pair k="Fine" v={`${mgToGrams(found.fineMg)}g`} />
                <Pair k="HUID" v={found.huid || "—"} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">{STOCK_LOCATION_LABELS[found.location]}</Badge>
                <Badge variant="secondary">{STOCK_STATUS_LABELS[found.status]}</Badge>
                {found.linkedOrderId && <Badge variant="outline">Linked order</Badge>}
                {found.linkedJobId && <Badge variant="outline">Linked job</Badge>}
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="rounded-2xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Recent items
        </div>
        <ul className="space-y-2">
          {recent.length === 0 && <li className="text-xs text-muted-foreground">No items yet.</li>}
          {recent.map((i) => (
            <li key={i.id}>
              <button
                className="w-full text-left rounded-lg border border-border px-3 py-2 hover:border-gold/40"
                onClick={() => {
                  setCode(i.barcode);
                  lookup(i.barcode);
                }}
              >
                <div className="text-sm">{i.itemName}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{i.barcode}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

function BulkTagging() {
  const add = useStock((s) => s.add);
  const [rows, setRows] = useState<DraftRow[]>([
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
    { ...EMPTY_ROW },
  ]);
  const [saved, setSaved] = useState<string[]>([]); // saved item ids
  const valid = useMemo(() => rows.some((r) => r.itemName.trim() && r.grossG), [rows]);

  function setRow(i: number, patch: Partial<DraftRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function saveAll() {
    const newIds: string[] = [];
    for (const r of rows) {
      if (!r.itemName.trim() || !r.grossG) continue;
      try {
        const item = await add({
          itemName: r.itemName.trim(),
          category: r.category,
          purity: Number(r.purity) || 916,
          grossMg: gramsToMg(r.grossG),
          netMg: r.netG ? gramsToMg(r.netG) : gramsToMg(r.grossG),
          huid: r.huid || undefined,
          makingChargePct: r.makingG ? Number(r.makingG) : undefined,
          location: r.location,
          status: r.status,
        });
        newIds.push(item.id);
      } catch (e: any) {
        toast.error(`Failed to save item: ${e?.message ?? "Unknown error"}`);
      }
    }
    setSaved(newIds);
    setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="text-left p-2">Item name</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Purity</th>
              <th className="text-left p-2">Gross (g)</th>
              <th className="text-left p-2">Net (g)</th>
              <th className="text-left p-2">HUID</th>
              <th className="text-left p-2">MC %</th>
              <th className="text-left p-2">Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-1.5">
                  <Input
                    value={r.itemName}
                    onChange={(e) => setRow(i, { itemName: e.target.value })}
                    placeholder="Item"
                  />
                </td>
                <td className="p-1.5 flex flex-col gap-1 min-w-[130px]">
                  <Select
                    value={ITEM_CATEGORIES.includes(r.category) ? r.category : "Custom"}
                    onValueChange={(v) => {
                      if (v === "Custom") {
                        setRow(i, { category: "" });
                      } else {
                        setRow(i, { category: v });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {!ITEM_CATEGORIES.includes(r.category) && (
                    <Input
                      className="h-8 text-xs"
                      placeholder="Custom..."
                      value={r.category}
                      onChange={(e) => setRow(i, { category: e.target.value })}
                    />
                  )}
                </td>
                <td className="p-1.5">
                  <Select value={r.purity} onValueChange={(v) => setRow(i, { purity: v })}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_PURITIES.map((p) => (
                        <SelectItem key={p.value} value={String(p.value)}>
                          {p.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1.5">
                  <Input
                    className="w-24"
                    value={r.grossG}
                    onChange={(e) => setRow(i, { grossG: e.target.value })}
                    placeholder="0.000"
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    className="w-24"
                    value={r.netG}
                    onChange={(e) => setRow(i, { netG: e.target.value })}
                    placeholder="0.000"
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    className="w-28"
                    value={r.huid}
                    onChange={(e) => setRow(i, { huid: e.target.value })}
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    className="w-20"
                    value={r.makingG}
                    onChange={(e) => setRow(i, { makingG: e.target.value })}
                  />
                </td>
                <td className="p-1.5">
                  <Select
                    value={r.location}
                    onValueChange={(v) => setRow(i, { location: v as StockLocation })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_LOCATIONS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {STOCK_LOCATION_LABELS[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4 mr-2" /> Add row
        </Button>
        <Button onClick={saveAll} disabled={!valid}>
          Save Items &amp; Generate Tags
        </Button>
        {saved.length > 0 && (
          <Link to="/barcode" search={{}}>
            <Button variant="ghost">Saved {saved.length} items</Button>
          </Link>
        )}
      </div>

      {saved.length > 0 && <SavedTagsPreview ids={saved} />}
    </div>
  );
}

function SavedTagsPreview({ ids }: { ids: string[] }) {
  const allItems = useStock((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => ids.includes(i.id)), [allItems, ids]);
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-serif text-lg text-gold">Generated tags ({items.length})</div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" /> Print All
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.id} className="rounded-lg border border-border bg-background/60 p-3">
            <div className="text-xs text-muted-foreground font-mono">{i.itemCode}</div>
            <div className="text-sm font-medium">{i.itemName}</div>
            <div className="text-[10px] text-muted-foreground">
              {i.category} · {i.purity} · {mgToGrams(i.grossMg)}g
            </div>
            <div className="mt-2 grid place-items-center">
              <Barcode value={i.barcode} height={42} width={1.2} fontSize={9} />
            </div>
            <div className="mt-2 flex justify-end">
              <Link to="/stock/print/$id" params={{ id: i.id }}>
                <Button size="sm" variant="ghost">
                  Tag preview
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BulkPrintTags() {
  const allItems = useStock((s) => s.items);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allItems.slice(0, 50);
    return allItems
      .filter(
        (i) =>
          i.itemName.toLowerCase().includes(q) ||
          (i.barcode && i.barcode.toLowerCase().includes(q)) ||
          (i.itemCode && i.itemCode.toLowerCase().includes(q)) ||
          (i.huid && i.huid.toLowerCase().includes(q)) ||
          i.category.toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [allItems, query]);

  const selectedItems = useMemo(
    () => allItems.filter((i) => selected.has(i.id)),
    [allItems, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((i) => i.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Search + actions bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, barcode, HUID, category…"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>
          Select All ({filtered.length})
        </Button>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear
        </Button>
        <Button disabled={selected.size === 0} onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print {selected.size} Tag{selected.size !== 1 ? "s" : ""}
        </Button>
      </div>

      {/* Stock list for selection */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid divide-y divide-border">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">No items found.</div>
          )}
          {filtered.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${isSelected ? "bg-gold/5" : ""}`}
              >
                {isSelected ? (
                  <CheckSquare className="h-4 w-4 text-gold flex-shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.itemName}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {item.itemCode} · {item.category} · {item.purity} · {mgToGrams(item.grossMg)}g
                    {item.huid ? ` · HUID: ${item.huid}` : ""}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] font-mono text-muted-foreground">{item.barcode}</div>
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 h-4"
                    style={{
                      color: item.status === "available" ? "var(--emerald-500)" : undefined,
                    }}
                  >
                    {STOCK_STATUS_LABELS[item.status]}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Print preview — only shown when items are selected, hidden in screen mode */}
      {selectedItems.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground print:hidden">
            {selectedItems.length} tag{selectedItems.length !== 1 ? "s" : ""} selected — click Print
            to send to printer
          </div>
          {/* Print-only tag grid */}
          <div className="hidden print:block">
            <div className="grid grid-cols-2 gap-4 p-4">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-black rounded p-3 bg-white text-black"
                  style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                >
                  <div className="flex items-center justify-between border-b border-black/20 pb-1 mb-1">
                    <div className="text-[11px] font-bold">
                      {useSettings.getState().firm.shopName}
                    </div>
                    <div className="text-[10px] font-mono">{item.itemCode}</div>
                  </div>
                  <div className="text-[13px] font-semibold">{item.itemName}</div>
                  <div className="text-[10px] text-black/60">
                    {item.category} · {item.purity} · {mgToGrams(item.grossMg)}g Gross ·{" "}
                    {mgToGrams(item.netMg)}g Net
                  </div>
                  {item.huid && (
                    <div className="text-[10px] font-mono text-black/60">HUID: {item.huid}</div>
                  )}
                  <div className="mt-2 flex justify-center">
                    <Barcode
                      value={item.barcode}
                      height={40}
                      width={1.2}
                      fontSize={9}
                      color="#000"
                      background="#fff"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TagSettings() {
  const settings = useStock((s) => s.tagSettings);
  const set = useStock((s) => s.setTagSettings);
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Shop name on tag
          </Label>
          <Input value={settings.shopName} onChange={(e) => set({ shopName: e.target.value })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Show price</Label>
          <Switch checked={settings.showPrice} onCheckedChange={(v) => set({ showPrice: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Show HUID</Label>
          <Switch checked={settings.showHuid} onCheckedChange={(v) => set({ showHuid: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Show making charge</Label>
          <Switch checked={settings.showMaking} onCheckedChange={(v) => set({ showMaking: v })} />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tag size</Label>
          <Input value={settings.tagSize} onChange={(e) => set({ tagSize: e.target.value })} />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Sample tag
        </div>
        <div
          className="bg-white text-black p-3 rounded-md border border-black/20"
          style={{ width: 320, height: 200 }}
        >
          <div className="flex items-center justify-between border-b border-black/20 pb-1">
            <div className="text-[11px] font-semibold">{settings.shopName}</div>
            <div className="text-[10px]">MTJ-SAMPLE</div>
          </div>
          <div className="mt-1 text-[12px] font-medium">Gold Ring</div>
          <div className="text-[10px] text-black/70">Ring · 916</div>
          <div className="grid grid-cols-3 gap-1 mt-1 text-[10px]">
            <div>
              <div className="text-black/60">Gross</div>
              <div className="font-medium">10.000g</div>
            </div>
            <div>
              <div className="text-black/60">Net</div>
              <div className="font-medium">9.500g</div>
            </div>
            {settings.showHuid && (
              <div>
                <div className="text-black/60">HUID</div>
                <div className="font-medium">AZ1234</div>
              </div>
            )}
          </div>
          <div className="mt-2 flex justify-center">
            <Barcode
              value="123456789012"
              height={36}
              width={1.2}
              fontSize={9}
              color="#000"
              background="#fff"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
