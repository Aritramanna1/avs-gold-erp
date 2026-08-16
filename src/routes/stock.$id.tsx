import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { StockMovement } from "@/lib/stock-store";
import { PageHeader } from "@/components/app-shell";
import { AttachmentsSection } from "@/components/attachments-section";
import { StockPhotoGallery } from "@/components/stock/StockPhotoGallery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useStock,
  STOCK_LOCATIONS,
  STOCK_LOCATION_LABELS,
  STOCK_STATUS_LABELS,
  type StockLocation,
  type StockStatus,
} from "@/lib/stock-store";
import { mgToGrams, getCaratLabel } from "@/lib/gold";
import { Barcode } from "@/components/barcode";
import { ArrowLeft, ArrowRightLeft, Printer, Receipt, Trash2, Pencil } from "lucide-react";
import { TagModifyDialog } from "@/components/stock/TagModifyDialog";
import { useCan } from "@/lib/rbac";
import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export const Route = createFileRoute("/stock/$id")({
  head: () => ({ meta: [{ title: "Stock Item · AVS Gold ERP" }] }),
  component: StockDetail,
});

function StockDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const item = useStock((s) => s.items.find((i) => i.id === id));
  const allMovements = useStock((s) => s.movements);
  const movements = useMemo(() => allMovements.filter((m) => m.itemId === id), [allMovements, id]);
  const transfer = useStock((s) => s.transfer);
  const changeStatus = useStock((s) => s.changeStatus);
  const update = useStock((s) => s.update);
  const remove = useStock((s) => s.remove);
  const { can } = useCan();
  const canModifyTag = can("goldLedger.edit") || can("settings.edit");
  const [tagModifyOpen, setTagModifyOpen] = useState(false);
  const [toLoc, setToLoc] = useState<StockLocation>("vault");
  const [toStatus, setToStatus] = useState<StockStatus>("available");

  if (!item) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground">Item not found.</p>
        <Link to="/stock">
          <Button variant="ghost" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Stock
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="stock-detail-root" className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title={item.itemName}
        subtitle={`${item.itemCode} · ${item.category} · ${getCaratLabel(item.purity)}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link to="/stock">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            <Link to="/stock/print/$id" params={{ id: item.id }}>
              <Button data-testid="stock-print-tag" variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Tag Preview
              </Button>
            </Link>
            {canModifyTag && (
              <Button variant="outline" className="gap-2" onClick={() => setTagModifyOpen(true)}>
                <Pencil className="h-4 w-4" /> Modify Tag
              </Button>
            )}
            {item.status === "available" && (
              <Link to="/billing/new" search={{ stockId: item.id }}>
                <Button className="gap-2">
                  <Receipt className="h-4 w-4" /> Bill Item
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-md border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Pair k="Gross Weight" v={`${mgToGrams(item.grossMg)} g`} />
            <Pair k="Net Weight" v={`${mgToGrams(item.netMg)} g`} />
            <Pair k="Fine Equivalent" v={`${mgToGrams(item.fineMg)} g fine`} />
            <Pair k="Purity / Carat" v={getCaratLabel(item.purity)} />
            <Pair k="HUID" v={item.huid || "—"} />
            <Pair k="Location" v={STOCK_LOCATION_LABELS[item.location]} />
            <Pair k="Status" v={STOCK_STATUS_LABELS[item.status]} />
            <Pair
              k="Making"
              v={
                item.makingChargePct != null
                  ? `${item.makingChargePct}% of gold value`
                  : item.makingChargePerGPaise
                    ? `₹${(item.makingChargePerGPaise / 100).toFixed(2)}/g (legacy)`
                    : "—"
              }
            />
            <Pair k="Price" v={item.pricePaise ? `₹${(item.pricePaise / 100).toFixed(2)}` : "—"} />
          </div>
          {item.notes && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Transfer location
              </div>
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
              <Button className="w-full gap-2" onClick={() => transfer(item.id, toLoc)}>
                <ArrowRightLeft className="h-4 w-4" /> Move to {STOCK_LOCATION_LABELS[toLoc]}
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Change status
              </div>
              <Select value={toStatus} onValueChange={(v) => setToStatus(v as StockStatus)}>
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
              <Button
                variant="outline"
                className="w-full"
                onClick={() => changeStatus(item.id, toStatus)}
              >
                Set status
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Movement history
            </div>
            <ul className="space-y-1.5">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{new Date(m.ts).toLocaleString()}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {m.kind}
                  </Badge>
                  <span>
                    {m.fromLocation
                      ? STOCK_LOCATION_LABELS[m.fromLocation]
                      : m.fromStatus
                        ? STOCK_STATUS_LABELS[m.fromStatus]
                        : "—"}
                    {" → "}
                    {m.toLocation
                      ? STOCK_LOCATION_LABELS[m.toLocation]
                      : m.toStatus
                        ? STOCK_STATUS_LABELS[m.toStatus]
                        : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive gap-2"
              onClick={() => {
                if (confirm("Delete this stock item?")) {
                  remove(item.id);
                  navigate({ to: "/stock" });
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        <aside className="rounded-md border border-border bg-card p-5 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Barcode</div>
          <div className="rounded-lg bg-background/60 p-3 grid place-items-center text-foreground">
            <Barcode value={item.barcode} height={60} />
          </div>
          <div className="font-mono text-xs text-center text-muted-foreground break-all">
            {item.barcode}
          </div>
        </aside>
      </div>

      <StockPhotoGallery stockId={item.id} />

      <AttachmentsSection
        entityType="stock"
        entityId={item.id}
        slots={[
          { key: "item_photo", label: "Item photo" },
          { key: "huid_image", label: "HUID / hallmark image" },
          { key: "tag_photo", label: "Tag photo" },
        ]}
      />

      <TagModifyDialog
        item={item}
        open={tagModifyOpen}
        onOpenChange={setTagModifyOpen}
        onSave={async (patch, audit) => {
          await update(item.id, {
            ...patch,
            notes: `${item.notes ? `${item.notes}\n` : ""}[TAG_MOD ${new Date().toISOString()}] ${audit.reason}`,
          });
          try {
            const { data } = await supabase.auth.getSession();
            await supabase.from("security_audit_log" as never).insert({
              actor_id: data.session?.user.id ?? null,
              action: "stock.tag_modify",
              entity_type: "stock_item",
              entity_id: item.id,
              metadata: { before: audit.before, after: patch, reason: audit.reason },
            } as never);
          } catch {
            // audit table optional — modification still saved on item
          }
        }}
      />
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
