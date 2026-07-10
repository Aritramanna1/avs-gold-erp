import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMemo, useRef, useState, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useStock,
  STOCK_LOCATIONS,
  STOCK_LOCATION_LABELS,
  STOCK_STATUS_LABELS,
  type StockLocation,
  type StockStatus,
  type StockItem,
} from "@/lib/stock-store";
import { ITEM_CATEGORIES } from "@/lib/orders-store";
import { COMMON_PURITIES, gramsToMg, mgToGrams } from "@/lib/gold";
import { Barcode } from "@/components/barcode";
import { WeightInput } from "@/components/hardware/WeightInput";
import { uploadToSupabaseStorage, getAttachmentSignedUrl } from "@/lib/supabase-storage";
import {
  ArrowRight,
  Boxes,
  ImagePlus,
  Plus,
  ScanLine,
  Search,
  Tag,
  ArrowRightLeft,
  MapPin,
  Printer,
} from "lucide-react";

export const Route = createFileRoute("/stock/")({
  head: () => ({ meta: [{ title: "Stock · AVS Gold ERP" }] }),
  component: StockIndex,
});

function StockIndex() {
  const items = useStock((s) => s.items);
  const movements = useStock((s) => s.movements);
  const [tab, setTab] = useState("finished");
  const [adding, setAdding] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Stock"
        subtitle="Finished jewellery, tags, locations and movements."
        actions={
          <div className="flex gap-2">
            <Link to="/barcode">
              <Button variant="outline" className="gap-2">
                <ScanLine className="h-4 w-4" /> Barcode &amp; Tagging
              </Button>
            </Link>
            <Link to="/stock/verification">
              <Button variant="outline" className="gap-2">
                <ScanLine className="h-4 w-4" /> Physical Verification
              </Button>
            </Link>
            <Link to="/stock/lots">
              <Button variant="outline" className="gap-2">
                <Boxes className="h-4 w-4" /> Lots &amp; Batches
              </Button>
            </Link>
            <Link to="/stock/stones">
              <Button variant="outline" className="gap-2">
                <Tag className="h-4 w-4" /> Stones &amp; Diamonds
              </Button>
            </Link>
            <Link to="/stock/import">
              <Button variant="outline" className="gap-2">
                <Boxes className="h-4 w-4" /> Bulk Import
              </Button>
            </Link>
            <Link to="/stock/hallmark">
              <Button variant="outline" className="gap-2">
                <Tag className="h-4 w-4" /> Hallmark Lifecycle
              </Button>
            </Link>
            <Button onClick={() => setAdding(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Stock Item
            </Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Stat icon={Boxes} label="Total items" value={String(items.length)} />
        <Stat
          icon={Tag}
          label="Available"
          value={String(items.filter((i) => i.status === "available").length)}
        />
        <Stat
          icon={MapPin}
          label="At Counter"
          value={String(items.filter((i) => i.location === "counter").length)}
        />
        <Stat icon={ArrowRightLeft} label="Movements" value={String(movements.length)} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="finished">Finished Stock</TabsTrigger>
          <TabsTrigger value="ready">Ready Stock</TabsTrigger>
          <TabsTrigger value="vault">Vault / Safe</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="finished" className="mt-4">
          <ItemTable items={items} />
        </TabsContent>
        <TabsContent value="ready" className="mt-4">
          <ItemTable
            items={items.filter((i) => i.status === "available" && i.location === "counter")}
          />
        </TabsContent>
        <TabsContent value="vault" className="mt-4">
          <ItemTable items={items.filter((i) => i.location === "vault" || i.location === "safe")} />
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          <MovementsTable />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <LocationsView />
        </TabsContent>
      </Tabs>

      <AddStockDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-10 w-10 grid place-items-center rounded-lg bg-gold/10 text-gold">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-serif text-xl">{value}</div>
      </div>
    </div>
  );
}

function ItemTable({ items }: { items: StockItem[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q) return items;
    const t = q.toLowerCase();
    return items.filter((i) =>
      [i.itemCode, i.barcode, i.itemName, i.category, i.huid]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(t)),
    );
  }, [items, q]);
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        No stock items yet.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, barcode, name, HUID…"
            className="pl-9"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th></Th>
              <Th>Code</Th>
              <Th>Item</Th>
              <Th>Purity</Th>
              <Th className="text-right">Gross</Th>
              <Th className="text-right">Net</Th>
              <Th>HUID</Th>
              <Th>Location</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <Td>
                  <StockThumb path={i.imageStoragePath} />
                </Td>
                <Td className="font-mono text-xs">{i.itemCode}</Td>
                <Td>
                  <div className="font-medium">{i.itemName}</div>
                  <div className="text-[11px] text-muted-foreground">{i.category}</div>
                </Td>
                <Td>{i.purity}</Td>
                <Td className="text-right tabular-nums">{mgToGrams(i.grossMg)}</Td>
                <Td className="text-right tabular-nums">{mgToGrams(i.netMg)}</Td>
                <Td>{i.huid || "—"}</Td>
                <Td>
                  <Badge variant="outline" className="text-[10px]">
                    {STOCK_LOCATION_LABELS[i.location]}
                  </Badge>
                </Td>
                <Td>
                  <Badge variant="secondary" className="text-[10px]">
                    {STOCK_STATUS_LABELS[i.status]}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Link to="/stock/print/$id" params={{ id: i.id }}>
                      <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground">
                        <Printer className="h-3 w-3" />
                      </Button>
                    </Link>
                    <Link to="/stock/$id" params={{ id: i.id }}>
                      <Button size="sm" variant="ghost" className="gap-1">
                        Open <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[11px] uppercase tracking-wider font-medium ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}

function MovementsTable() {
  const movements = useStock((s) => s.movements);
  const items = useStock((s) => s.items);
  if (movements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        No movements yet.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>When</Th>
              <Th>Item</Th>
              <Th>Kind</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const item = items.find((i) => i.id === m.itemId);
              return (
                <tr key={m.id} className="border-t border-border">
                  <Td className="text-xs text-muted-foreground">
                    {new Date(m.ts).toLocaleString()}
                  </Td>
                  <Td>{item ? `${item.itemCode} · ${item.itemName}` : "—"}</Td>
                  <Td>
                    <Badge variant="outline" className="text-[10px]">
                      {m.kind.replace("_", " ")}
                    </Badge>
                  </Td>
                  <Td className="text-xs">
                    {m.fromLocation
                      ? STOCK_LOCATION_LABELS[m.fromLocation]
                      : m.fromStatus
                        ? STOCK_STATUS_LABELS[m.fromStatus]
                        : "—"}
                  </Td>
                  <Td className="text-xs">
                    {m.toLocation
                      ? STOCK_LOCATION_LABELS[m.toLocation]
                      : m.toStatus
                        ? STOCK_STATUS_LABELS[m.toStatus]
                        : "—"}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{m.notes || "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LocationsView() {
  const items = useStock((s) => s.items);
  const transfer = useStock((s) => s.transfer);
  const [itemId, setItemId] = useState<string>("");
  const [toLoc, setToLoc] = useState<StockLocation>("vault");
  const [notes, setNotes] = useState("");
  const item = items.find((i) => i.id === itemId);
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="font-serif text-lg text-gold mb-3">By location</div>
        <ul className="space-y-2">
          {STOCK_LOCATIONS.map((l) => (
            <li
              key={l}
              className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2"
            >
              <span className="text-sm">{STOCK_LOCATION_LABELS[l]}</span>
              <Badge variant="outline">{items.filter((i) => i.location === l).length}</Badge>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="font-serif text-lg text-gold mb-3">Transfer location</div>
        <div className="space-y-3">
          <Field label="Item">
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose item…" />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.itemCode} · {i.itemName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {item && (
            <div className="text-xs text-muted-foreground">
              From: <span className="text-foreground">{STOCK_LOCATION_LABELS[item.location]}</span>
            </div>
          )}
          <Field label="To location">
            <Select value={toLoc} onValueChange={(v) => setToLoc(v as StockLocation)}>
              <SelectTrigger>
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
          </Field>
          <Field label="Notes">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason / reference"
            />
          </Field>
          <Button
            disabled={!itemId}
            onClick={async () => {
              const mv = await transfer(itemId, toLoc, notes || undefined);
              if (mv) {
                setNotes("");
              }
            }}
            className="gap-2 w-full"
          >
            <ArrowRightLeft className="h-4 w-4" /> Create Movement
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddStockDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useStock((s) => s.add);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Ring");
  const [isCustomCategory, setIsCustomCategory] = useState(
    !ITEM_CATEGORIES.includes(category) && category !== "",
  );

  useEffect(() => {
    if (category && ITEM_CATEGORIES.includes(category)) {
      setIsCustomCategory(false);
    }
  }, [category]);

  const [purity, setPurity] = useState("916");
  const [grossG, setGrossG] = useState("");
  const [netG, setNetG] = useState("");
  const [huid, setHuid] = useState("");
  const [makingG, setMakingG] = useState("");
  const [priceR, setPriceR] = useState("");
  const [location, setLocation] = useState<StockLocation>("counter");
  const [status, setStatus] = useState<StockStatus>("available");
  const [notes, setNotes] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => setImageDataUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    try {
      setUploading(true);
      let imageStoragePath: string | undefined;
      if (imageDataUrl) {
        const tmpId = `stock_${Date.now()}`;
        imageStoragePath = await uploadToSupabaseStorage(
          "catalog-designs",
          "item.jpg",
          imageDataUrl,
          tmpId,
          "stock_image",
        );
      }
      await add({
        itemName: itemName.trim(),
        category,
        purity: Number(purity) || 916,
        grossMg: grossG ? gramsToMg(grossG) : 0,
        netMg: netG ? gramsToMg(netG) : grossG ? gramsToMg(grossG) : 0,
        huid: huid || undefined,
        makingChargePct: makingG ? Number(makingG) : undefined,
        pricePaise: priceR ? Math.round(Number(priceR) * 100) : undefined,
        status,
        location,
        notes: notes || undefined,
        imageStoragePath,
      });
      setItemName("");
      setGrossG("");
      setNetG("");
      setHuid("");
      setPriceR("");
      setMakingG("");
      setNotes("");
      setImageDataUrl(null);
      onClose();
    } catch (e) {
      toast.error("Failed to save stock item. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">Add Stock Item</DialogTitle>
          <DialogDescription>
            Manual stock entry. This is non-ledger (does not affect Gold Balance Sheet) until linked
            to receive-work / opening-stock in a later phase.
          </DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Item name *">
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Gold Ring Ready Stock"
            />
          </Field>
          <Field label="Category">
            <Select
              value={isCustomCategory ? "Custom" : category}
              onValueChange={(v) => {
                if (v === "Custom") {
                  setIsCustomCategory(true);
                  setCategory("");
                } else {
                  setIsCustomCategory(false);
                  setCategory(v);
                }
              }}
            >
              <SelectTrigger>
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
            {isCustomCategory && (
              <Input
                className="mt-2"
                placeholder="Enter custom category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            )}
          </Field>
          <Field label="Purity">
            <Select value={purity} onValueChange={setPurity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PURITIES.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="HUID">
            <Input value={huid} onChange={(e) => setHuid(e.target.value)} placeholder="AZ1234" />
          </Field>
          <Field label="Gross weight (g) *">
            <WeightInput
              valueGrams={grossG ? parseFloat(grossG) : null}
              onChange={(g) => setGrossG(g != null ? String(g) : "")}
            />
          </Field>
          <Field label="Net weight (g)">
            <WeightInput
              valueGrams={netG ? parseFloat(netG) : null}
              onChange={(g) => setNetG(g != null ? String(g) : "")}
            />
          </Field>
          <Field label="Making charge (% of gold value)">
            <Input
              value={makingG}
              onChange={(e) => setMakingG(e.target.value)}
              placeholder="e.g. 12"
            />
          </Field>
          <Field label="Price (₹)">
            <Input
              value={priceR}
              onChange={(e) => setPriceR(e.target.value)}
              placeholder="optional"
            />
          </Field>
          <Field label="Location">
            <Select value={location} onValueChange={(v) => setLocation(v as StockLocation)}>
              <SelectTrigger>
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
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as StockStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STOCK_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Item photo (optional)">
              <div className="flex items-center gap-3">
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt="preview"
                    className="h-16 w-16 rounded object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => imgInputRef.current?.click()}
                  >
                    {imageDataUrl ? "Change photo" : "Upload photo"}
                  </Button>
                  {imageDataUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive text-xs"
                      onClick={() => setImageDataUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageFile(f);
                }}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!itemName.trim() || !grossG || uploading}>
            <Plus className="h-4 w-4 mr-2" /> {uploading ? "Saving…" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockThumb({ path }: { path?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    getAttachmentSignedUrl("catalog-designs", path)
      .then(setUrl)
      .catch(() => {});
  }, [path]);
  if (!path) return <div className="h-8 w-8" />;
  if (!url) return <div className="h-8 w-8 rounded border bg-muted animate-pulse" />;
  return <img src={url} alt="" className="h-8 w-8 rounded object-cover border" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// Keep effect dependency lint quiet for cross-component reuse
void useEffect;
void useRef;
void Barcode;
void Printer;
