import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMemo, useState, useEffect } from "react";
import { useDraft } from "@/lib/drafts-store";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
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
  useCatalog,
  DESIGN_SOURCE_LABELS,
  DIFFICULTY_LABELS,
  type DesignSource,
  type Difficulty,
  type Design,
} from "@/lib/catalog-store";
import { ITEM_CATEGORIES } from "@/lib/orders-store";
import { COMMON_PURITIES, gramsToMg, mgToGrams } from "@/lib/gold";
import { usePeople } from "@/lib/people-store";
import { useAttachments, generateImageThumbnail } from "@/lib/attachments-store";
import { Image as ImageIcon, Plus, Search, Sparkles, Tag } from "lucide-react";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";

export const Route = createFileRoute("/catalog/")({
  head: () => ({ meta: [{ title: "Catalog · AVS Gold ERP" }] }),
  component: CatalogIndex,
});

const TABS: { value: DesignSource | "all"; label: string }[] = [
  { value: "all", label: "All Designs" },
  { value: "internal", label: "Internal" },
  { value: "customer_reference", label: "Customer Reference" },
  { value: "external", label: "External" },
  { value: "saved_from_order", label: "Saved From Orders" },
];

function CatalogIndex() {
  const { t } = useLanguage();
  const designs = useCatalog((s) => s.designs);
  const customers = usePeople((s) => s.people);
  const [tab, setTab] = useState<DesignSource | "all">("all");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [storageNotice, setStorageNotice] = useState(false);

  const list = useMemo(() => {
    return designs.filter((d) => {
      if (tab !== "all" && d.source !== tab) return false;
      if (cat !== "all" && d.category !== cat) return false;
      if (q) {
        const tVal = q.toLowerCase();
        const hay = [d.designNumber, d.designName, d.category, ...(d.tags ?? [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(tVal)) return false;
      }
      return true;
    });
  }, [designs, tab, q, cat]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title={t("catalog.title")}
        subtitle={t("catalog.subtitle")}
        actions={
          <Button onClick={() => setAdding(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t("catalog.add_design")}
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("catalog.search_placeholder")}
              className="pl-9"
            />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("catalog.all_categories")}</SelectItem>
              {ITEM_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DesignSource | "all")}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((tItem) => (
            <TabsTrigger key={tItem.value} value={tItem.value}>
              {t("catalog.tab_" + tItem.value)}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {tItem.value === "all"
                  ? designs.length
                  : designs.filter((d) => d.source === tItem.value).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground font-sans">
              {t("catalog.no_designs")}{" "}
              <button
                onClick={() => setAdding(true)}
                className="text-gold underline cursor-pointer"
              >
                {t("catalog.add_design")}
              </button>{" "}
              {t("catalog.click_add_design")}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((d) => (
                <DesignCard
                  key={d.id}
                  d={d}
                  customerName={
                    d.customerId
                      ? customers.find((c) => c.id === d.customerId)?.fullName
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddDesignDialog
        open={adding}
        onClose={() => setAdding(false)}
        onStorageNotice={() => setStorageNotice(true)}
      />
      <Dialog open={storageNotice} onOpenChange={setStorageNotice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalog.under_construction_title")}</DialogTitle>
            <DialogDescription>{t("catalog.under_construction_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setStorageNotice(false)}>{t("catalog.understood")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DesignCard({ d, customerName }: { d: Design; customerName?: string }) {
  const photoAtt = useAttachments((s) => s.items[`catalog:${d.id}:design_photo`]);
  const save = useAttachments((s) => s.save);

  useEffect(() => {
    if (photoAtt?.fileDataUrl && !photoAtt.thumbnailDataUrl) {
      generateImageThumbnail(photoAtt.fileDataUrl, 240)
        .then((thumb) => {
          save("catalog", d.id, "design_photo", {
            thumbnailDataUrl: thumb,
          });
        })
        .catch((err) => {
          console.warn("Retroactive thumbnail generation failed:", err);
        });
    }
  }, [photoAtt?.fileDataUrl, photoAtt?.thumbnailDataUrl, d.id, save]);

  const displaySrc = photoAtt?.thumbnailDataUrl || photoAtt?.fileDataUrl;

  return (
    <Link
      to="/catalog/$id"
      params={{ id: d.id }}
      className="block rounded-2xl border border-border bg-card hover:border-gold/40 transition-colors overflow-hidden"
    >
      <div className="aspect-video bg-muted/40 grid place-items-center text-muted-foreground relative">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={d.designName || d.designNumber}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ImageIcon className="h-8 w-8 opacity-50" />
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium truncate">{d.designName || "—"}</div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {d.designNumber}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2">
          <span>{d.category}</span>
          <span>·</span>
          <span>{d.purity}</span>
          <span>·</span>
          <span>{mgToGrams(d.approxGrossMg)}g</span>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">
            {DESIGN_SOURCE_LABELS[d.source]}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {DIFFICULTY_LABELS[d.difficulty]}
          </Badge>
          {customerName && (
            <span className="text-[10px] text-muted-foreground truncate">· {customerName}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function AddDesignDialog({
  open,
  onClose,
  onStorageNotice,
}: {
  open: boolean;
  onClose: () => void;
  onStorageNotice: () => void;
}) {
  const add = useCatalog((s) => s.add);
  const nextNum = useCatalog((s) => s.nextDesignNumber);
  const [draftId, setDraftId, clearDraftId] = useDraft(
    "mtj-catalog-draftId-v1",
    () => `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  );
  const [designNumber, setDesignNumber, clearDesignNumber] = useDraft(
    "mtj-catalog-designNumber-v1",
    "",
  );
  const [designName, setDesignName, clearDesignName] = useDraft("mtj-catalog-designName-v1", "");
  const [category, setCategory, clearCategory] = useDraft("mtj-catalog-category-v1", "Ring");
  const [subcategory, setSubcategory, clearSubcategory] = useDraft(
    "mtj-catalog-subcategory-v1",
    "",
  );
  const [itemType, setItemType, clearItemType] = useDraft("mtj-catalog-itemType-v1", "");
  const [purity, setPurity, clearPurity] = useDraft("mtj-catalog-purity-v1", "916");
  const [grossG, setGrossG, clearGrossG] = useDraft("mtj-catalog-grossG-v1", "");
  const [netG, setNetG, clearNetG] = useDraft("mtj-catalog-netG-v1", "");
  const [difficulty, setDifficulty, clearDifficulty] = useDraft<Difficulty>(
    "mtj-catalog-difficulty-v1",
    "medium",
  );
  const [tags, setTags, clearTags] = useDraft("mtj-catalog-tags-v1", "");
  const [source, setSource, clearSource] = useDraft<DesignSource>(
    "mtj-catalog-source-v1",
    "internal",
  );
  const [notes, setNotes, clearNotes] = useDraft("mtj-catalog-notes-v1", "");

  const [isCustomCategory, setIsCustomCategory] = useState(
    !ITEM_CATEGORIES.includes(category) && category !== "",
  );

  useEffect(() => {
    if (category && ITEM_CATEGORIES.includes(category)) {
      setIsCustomCategory(false);
    }
  }, [category]);

  // Re-generate tmp ID each time the modal is reset or opened
  useEffect(() => {
    if (open && !draftId) {
      setDraftId(`d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    }
  }, [open, draftId]);

  function save() {
    const cleanName = designName.trim();
    if (!cleanName) {
      alert("Design Name is required.");
      return;
    }
    if (!category) {
      alert("Category is required.");
      return;
    }

    const num = designNumber.trim() || nextNum(category);

    // Enforce design number uniqueness
    const existingDesigns = useCatalog.getState().designs;
    const isDuplicate = existingDesigns.some(
      (d) => d.designNumber.toLowerCase() === num.toLowerCase(),
    );
    if (isDuplicate) {
      alert(
        `Design number "${num}" already exists in the catalog. Please use a unique design number.`,
      );
      return;
    }

    try {
      const d = add({
        id: draftId,
        designNumber: num,
        designName: cleanName,
        category,
        subcategory: subcategory || undefined,
        itemType: itemType || undefined,
        purity: Number(purity) || 916,
        approxGrossMg: grossG ? gramsToMg(grossG) : 0,
        approxNetMg: netG ? gramsToMg(netG) : grossG ? gramsToMg(grossG) : 0,
        difficulty,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source,
        notes: notes || undefined,
      });
      // reset
      clearDraftId();
      clearDesignNumber();
      clearDesignName();
      clearCategory();
      clearSubcategory();
      clearItemType();
      clearPurity();
      clearGrossG();
      clearNetG();
      clearDifficulty();
      clearTags();
      clearSource();
      clearNotes();
      onClose();
      void d;
    } catch (e: any) {
      toast.error(`Failed to save design: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">Add Design</DialogTitle>
          <DialogDescription>
            Create a reusable design entry. Required: name, category, purity.
          </DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Design number">
            <Input
              value={designNumber}
              onChange={(e) => setDesignNumber(e.target.value)}
              placeholder={`auto: ${nextNum(category)}`}
            />
          </Field>
          <Field label="Design name *">
            <Input
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Kolkata Filigree Ring"
            />
          </Field>
          <Field label="Category *">
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
          <Field label="Subcategory">
            <Input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="e.g. Antique"
            />
          </Field>
          <Field label="Item type">
            <Input
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              placeholder="Ladies / Gents / Kid"
            />
          </Field>
          <Field label="Usual purity / touch *">
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
          <Field label="Approx gross (g)">
            <Input value={grossG} onChange={(e) => setGrossG(e.target.value)} placeholder="8.500" />
          </Field>
          <Field label="Approx net (g)">
            <Input value={netG} onChange={(e) => setNetG(e.target.value)} placeholder="8.500" />
          </Field>
          <Field label="Making difficulty">
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source">
            <Select value={source} onValueChange={(v) => setSource(v as DesignSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="customer_reference">Customer Reference</SelectItem>
                <SelectItem value="external">External / Supplier</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tags (comma separated)">
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="filigree, antique, bridal"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <AttachmentButton
              entityType="catalog"
              entityId={draftId}
              docKey="design_photo"
              docLabel="Design photo"
              title="Add Design Photo"
              variant="outline"
              className="gap-2"
            />
            <AttachmentButton
              entityType="catalog"
              entityId={draftId}
              docKey="customer_reference"
              docLabel="Customer reference"
              title="Attach Customer Reference"
              variant="outline"
              className="gap-2"
            />
            <Button variant="ghost" type="button" disabled className="gap-2" title="Future">
              <Tag className="h-4 w-4" /> Technical drawing (future)
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!designName.trim() || !category}>
            <Sparkles className="h-4 w-4 mr-2" /> Save Design
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
