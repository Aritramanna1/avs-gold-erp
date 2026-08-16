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
import { useCatalog, type Difficulty, type DesignSource } from "@/lib/catalog-store";
import { ITEM_CATEGORIES } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { COMMON_PURITIES, gramsToMg, mgToGrams } from "@/lib/gold";
import { ArrowLeft, Image as ImageIcon, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/catalog/$id")({
  head: () => ({ meta: [{ title: "Design · AVS Gold ERP" }] }),
  component: DesignPage,
});

function DesignPage() {
  const { t } = useLanguage();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const d = useCatalog((s) => s.designs.find((x) => x.id === id));
  const update = useCatalog((s) => s.update);
  const remove = useCatalog((s) => s.remove);
  const customers = usePeople((s) => s.people);
  const orders = useOrders((s) => s.orders);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState(d);
  const [isCustomCategory, setIsCustomCategory] = useState(
    d ? !ITEM_CATEGORIES.includes(d.category) && d.category !== "" : false,
  );

  useEffect(() => {
    if (draft && ITEM_CATEGORIES.includes(draft.category)) {
      setIsCustomCategory(false);
    }
  }, [draft?.category]);

  // Bytes resolve from Supabase-backed storage, with legacy inlined-base64
  // fallback handled inside useAttachmentUrl.
  const photoUrl = useAttachmentUrl("catalog", d?.id ?? "", "design_photo");

  if (!d) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground">{t("catalog.not_found")}</p>
        <Link to="/catalog">
          <Button variant="ghost" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> {t("catalog.title")}
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
    toast.success(t("catalog.changes_saved"));
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
                <ArrowLeft className="h-4 w-4" /> {t("catalog.back")}
              </Button>
            </Link>
            {!editing ? (
              <Button
                onClick={() => {
                  setDraft(d);
                  setEditing(true);
                }}
              >
                {t("catalog.edit")}
              </Button>
            ) : (
              <Button onClick={save} className="gap-2">
                <Save className="h-4 w-4" /> {t("catalog.save_changes")}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        {photoUrl ? (
          <div className="aspect-square rounded-md border border-border bg-card overflow-hidden flex items-center justify-center relative p-2 shadow-sm">
            <img
              src={photoUrl}
              alt={d.designName}
              className="object-contain max-h-full max-w-full rounded-md"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="aspect-square rounded-md border border-dashed border-border bg-card grid place-items-center text-muted-foreground p-4 text-center">
            <div className="space-y-3">
              <ImageIcon className="h-8 w-8 mx-auto opacity-50" />
              <div>
                <AttachmentButton
                  entityType="catalog"
                  entityId={d.id}
                  docKey="design_photo"
                  docLabel={t("catalog.design_photo")}
                  title={`${t("catalog.upload_photo")} ${d.designNumber}`}
                  className="bg-gold text-stone-950 font-semibold hover:bg-gold-light"
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                {t("catalog.no_photo_desc")}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{t(`catalog.source_${cur.source}`)}</Badge>
            <Badge variant="outline">{t(`catalog.difficulty_${cur.difficulty}`)}</Badge>
            <Badge variant="outline">{cur.purity}</Badge>
          </div>
          {!editing ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Pair k={t("catalog.category")} v={cur.category} />
              <Pair k={t("catalog.subcategory")} v={cur.subcategory || "—"} />
              <Pair k={t("catalog.item_type")} v={cur.itemType || "—"} />
              <Pair k={t("catalog.approx_gross")} v={`${mgToGrams(cur.approxGrossMg)} g`} />
              <Pair k={t("catalog.approx_net")} v={`${mgToGrams(cur.approxNetMg)} g`} />
              <Pair k={t("catalog.tags")} v={cur.tags.join(", ") || "—"} />
              {cust && <Pair k={t("catalog.customer")} v={cust.fullName} />}
              {order && <Pair k={t("catalog.from_order")} v={order.orderNo} />}
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t("catalog.notes")}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{cur.notes || "—"}</p>
              </div>
            </dl>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <F label={t("catalog.design_name")}>
                <Input
                  value={cur.designName}
                  onChange={(e) => setDraft({ ...cur, designName: e.target.value })}
                />
              </F>
              <F label={t("catalog.category")}>
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
                    <SelectItem value="Custom">{t("catalog.custom")}</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomCategory && (
                  <Input
                    className="mt-2"
                    placeholder={t("catalog.custom_category_placeholder")}
                    value={cur.category}
                    onChange={(e) => setDraft({ ...cur, category: e.target.value })}
                  />
                )}
              </F>
              <F label={t("catalog.subcategory")}>
                <Input
                  value={cur.subcategory || ""}
                  onChange={(e) => setDraft({ ...cur, subcategory: e.target.value })}
                />
              </F>
              <F label={t("catalog.item_type")}>
                <Input
                  value={cur.itemType || ""}
                  onChange={(e) => setDraft({ ...cur, itemType: e.target.value })}
                />
              </F>
              <F label={t("catalog.purity")}>
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
              <F label={t("catalog.making_difficulty")}>
                <Select
                  value={cur.difficulty}
                  onValueChange={(v) => setDraft({ ...cur, difficulty: v as Difficulty })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t("catalog.difficulty_easy")}</SelectItem>
                    <SelectItem value="medium">{t("catalog.difficulty_medium")}</SelectItem>
                    <SelectItem value="hard">{t("catalog.difficulty_hard")}</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label={`${t("catalog.approx_gross")} (g)`}>
                <Input
                  value={mgToGrams(cur.approxGrossMg)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...cur, approxGrossMg: gramsToMg(e.target.value) });
                    } catch {}
                  }}
                />
              </F>
              <F label={`${t("catalog.approx_net")} (g)`}>
                <Input
                  value={mgToGrams(cur.approxNetMg)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...cur, approxNetMg: gramsToMg(e.target.value) });
                    } catch {}
                  }}
                />
              </F>
              <F label={t("catalog.source")}>
                <Select
                  value={cur.source}
                  onValueChange={(v) => setDraft({ ...cur, source: v as DesignSource })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">{t("catalog.source_internal")}</SelectItem>
                    <SelectItem value="customer_reference">
                      {t("catalog.source_customer_reference")}
                    </SelectItem>
                    <SelectItem value="external">{t("catalog.source_external")}</SelectItem>
                    <SelectItem value="saved_from_order">
                      {t("catalog.source_saved_from_order")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label={t("catalog.tags")}>
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
                <F label={t("catalog.notes")}>
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
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> {t("catalog.delete")}
            </Button>
          </div>
        </div>
      </div>

      <AttachmentsSection
        entityType="catalog"
        entityId={d!.id}
        slots={[
          { key: "design_photo", label: t("catalog.design_photo") },
          { key: "customer_reference", label: t("catalog.customer_reference_attachment") },
          { key: "tech_drawing", label: t("catalog.technical_drawing") },
        ]}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalog.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("catalog.delete_description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("catalog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                remove(d.id);
                toast.success(t("catalog.design_deleted"));
                void navigate({ to: "/catalog" });
              }}
            >
              {t("catalog.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
