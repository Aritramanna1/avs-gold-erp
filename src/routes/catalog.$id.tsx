import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { AttachmentsSection } from "@/components/attachments-section";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { useAttachments, useAttachmentUrl } from "@/lib/attachments-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCatalog,
  DESIGN_SOURCE_LABELS,
  DIFFICULTY_LABELS,
  type Difficulty,
  type DesignSource,
} from "@/lib/catalog-store";
import { ITEM_CATEGORIES } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { COMMON_PURITIES, gramsToMg, mgToGrams } from "@/lib/gold";
import { ArrowLeft, Image as ImageIcon, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/catalog/$id")({
  head: () => ({ meta: [{ title: "Design · AVS Gold ERP" }] }),
  component: DesignPage,
});

function DesignPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const d = useCatalog((s) => s.designs.find((x) => x.id === id));
  const update = useCatalog((s) => s.update);
  const remove = useCatalog((s) => s.remove);
  const customers = usePeople((s) => s.people);
  const orders = useOrders((s) => s.orders);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d);
  const [isCustomCategory, setIsCustomCategory] = useState(
    d ? !ITEM_CATEGORIES.includes(d.category) && d.category !== "" : false,
  );

  useEffect(() => {
    if (draft && ITEM_CATEGORIES.includes(draft.category)) {
      setIsCustomCategory(false);
    }
  }, [draft?.category]);

  // Bytes come from the local encrypted vault (thumbnail first, full-size once
  // decrypted), not from base64 inlined on the row.
  const photoUrl = useAttachmentUrl("catalog", d?.id ?? "", "design_photo");

  if (!d) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground">Design not found.</p>
        <Link to="/catalog">
          <Button variant="ghost" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Catalog
          </Button>
        </Link>
      </div>
    );
  }

  const cur = draft ?? d;
  const cust = d.customerId ? customers.find((c) => c.id === d.customerId) : undefined;
  const order = d.orderId ? orders.find((o) => o.id === d.orderId) : undefined;

  function save() {
    if (!draft) return;
    update(d!.id, {
      designName: draft.designName,
      category: draft.category,
      subcategory: draft.subcategory,
      itemType: draft.itemType,
      purity: draft.purity,
      approxGrossMg: draft.approxGrossMg,
      approxNetMg: draft.approxNetMg,
      difficulty: draft.difficulty,
      tags: draft.tags,
      source: draft.source,
      notes: draft.notes,
    });
    setEditing(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title={cur.designName || cur.designNumber}
        subtitle={cur.designNumber}
        actions={
          <div className="flex gap-2">
            <Link to="/catalog">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            {!editing ? (
              <Button
                onClick={() => {
                  setDraft(d);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            ) : (
              <Button onClick={save} className="gap-2">
                <Save className="h-4 w-4" /> Save
              </Button>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        {photoUrl ? (
          <div className="aspect-square rounded-2xl border border-border bg-card overflow-hidden flex items-center justify-center relative p-2 shadow-sm">
            <img
              src={photoUrl}
              alt={d.designName}
              className="object-contain max-h-full max-w-full rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="aspect-square rounded-2xl border border-dashed border-border bg-card grid place-items-center text-muted-foreground p-4 text-center">
            <div className="space-y-3">
              <ImageIcon className="h-8 w-8 mx-auto opacity-50" />
              <div>
                <AttachmentButton
                  entityType="catalog"
                  entityId={d.id}
                  docKey="design_photo"
                  docLabel="Design photo"
                  title={`Upload Design Photo for ${d.designNumber}`}
                  className="bg-gold text-stone-950 font-semibold hover:bg-gold-light"
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                No design photo on file. Upload a JPG or PNG format image to render here.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{DESIGN_SOURCE_LABELS[cur.source]}</Badge>
            <Badge variant="outline">{DIFFICULTY_LABELS[cur.difficulty]}</Badge>
            <Badge variant="outline">{cur.purity}</Badge>
          </div>
          {!editing ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Pair k="Category" v={cur.category} />
              <Pair k="Subcategory" v={cur.subcategory || "—"} />
              <Pair k="Item type" v={cur.itemType || "—"} />
              <Pair k="Approx gross" v={`${mgToGrams(cur.approxGrossMg)} g`} />
              <Pair k="Approx net" v={`${mgToGrams(cur.approxNetMg)} g`} />
              <Pair k="Tags" v={cur.tags.join(", ") || "—"} />
              {cust && <Pair k="Customer" v={cust.fullName} />}
              {order && <Pair k="From order" v={order.orderNo} />}
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{cur.notes || "—"}</p>
              </div>
            </dl>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Name">
                <Input
                  value={cur.designName}
                  onChange={(e) => setDraft({ ...cur, designName: e.target.value })}
                />
              </F>
              <F label="Category">
                <Select
                  value={isCustomCategory ? "Custom" : cur.category}
                  onValueChange={(v) => {
                    if (v === "Custom") {
                      setIsCustomCategory(true);
                      setDraft({ ...cur, category: "" });
                    } else {
                      setIsCustomCategory(false);
                      setDraft({ ...cur, category: v });
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
                    value={cur.category}
                    onChange={(e) => setDraft({ ...cur, category: e.target.value })}
                  />
                )}
              </F>
              <F label="Subcategory">
                <Input
                  value={cur.subcategory || ""}
                  onChange={(e) => setDraft({ ...cur, subcategory: e.target.value })}
                />
              </F>
              <F label="Item type">
                <Input
                  value={cur.itemType || ""}
                  onChange={(e) => setDraft({ ...cur, itemType: e.target.value })}
                />
              </F>
              <F label="Purity">
                <Select
                  value={String(cur.purity)}
                  onValueChange={(v) => setDraft({ ...cur, purity: Number(v) })}
                >
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
              </F>
              <F label="Difficulty">
                <Select
                  value={cur.difficulty}
                  onValueChange={(v) => setDraft({ ...cur, difficulty: v as Difficulty })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Approx gross (g)">
                <Input
                  value={mgToGrams(cur.approxGrossMg)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...cur, approxGrossMg: gramsToMg(e.target.value) });
                    } catch {}
                  }}
                />
              </F>
              <F label="Approx net (g)">
                <Input
                  value={mgToGrams(cur.approxNetMg)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...cur, approxNetMg: gramsToMg(e.target.value) });
                    } catch {}
                  }}
                />
              </F>
              <F label="Source">
                <Select
                  value={cur.source}
                  onValueChange={(v) => setDraft({ ...cur, source: v as DesignSource })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="customer_reference">Customer Reference</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                    <SelectItem value="saved_from_order">Saved From Order</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Tags (comma separated)">
                <Input
                  value={cur.tags.join(", ")}
                  onChange={(e) =>
                    setDraft({
                      ...cur,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </F>
              <div className="sm:col-span-2">
                <F label="Notes">
                  <Textarea
                    rows={3}
                    value={cur.notes || ""}
                    onChange={(e) => setDraft({ ...cur, notes: e.target.value })}
                  />
                </F>
              </div>
            </div>
          )}
          <div className="pt-3 border-t border-border flex justify-end">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive gap-2"
              onClick={() => {
                if (confirm("Delete this design?")) {
                  remove(d!.id);
                  navigate({ to: "/catalog" });
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

      <AttachmentsSection
        entityType="catalog"
        entityId={d!.id}
        slots={[
          { key: "design_photo", label: "Design photo" },
          { key: "customer_reference", label: "Customer reference" },
          { key: "tech_drawing", label: "Technical drawing" },
        ]}
      />
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{k}</div>
      <div className="text-sm mt-0.5">{v}</div>
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
