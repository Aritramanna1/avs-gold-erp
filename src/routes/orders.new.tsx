import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraft } from "@/lib/drafts-store";
import { PageHeader } from "@/components/app-shell";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { usePeople, type Person, type PersonType, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useOrders, resolveProductionType, type Order } from "@/lib/orders-store";
import { lineReferenceDocKey } from "@/lib/job-card-engine";
import { copyAttachment } from "@/lib/attachments-store";
import { useCatalog } from "@/lib/catalog-store";
import { attributesForCategory } from "@/lib/product-attributes";
import { orderConfirmationMessage } from "@/lib/order-messages";
import { isValidWaPhone } from "@/lib/wa-link";
import { sendWhatsAppText } from "@/lib/comm/send-whatsapp-text";
import { useLedger } from "@/lib/ledger-store";
import { useSettings, useActiveDropdownValues } from "@/lib/settings-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { fineGoldMg, gramsToMg, parsePurity } from "@/lib/gold";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/orders/new")({
  head: () => ({ meta: [{ title: "Create Order · AVS Gold ERP" }] }),
  component: NewOrderPage,
});

/**
 * Create Production Order — workshop-first entry screen.
 *
 * Deliberately collapsed from the earlier 7-step wizard to a single screen
 * with only the fields required before work can start: Customer, Product
 * Type, Product Description, Reference Images, Expected Weight, Purity,
 * Gold Received (weight only), Delivery Date, Assigned Worker, Remarks.
 *
 * Every other field the `Order` type still defines (design metadata, cash
 * advance, priority, source, stone details, size/metal/colour/stamp,
 * labour/amount) is preserved in the store and populated here with a sane
 * default — never deleted — so downstream code (job cards, billing,
 * reports, catalog) that reads those fields keeps working unchanged, and a
 * future screen can still surface them without a schema migration.
 *
 * EXTENSION POINTS for future modules — all keyed off `order.id`, the same
 * foreign-key pattern already used throughout the codebase, so no new
 * linkage mechanism is needed when these are built:
 *   - Digital Job Card (PDF)   → jobcards-store.ts, keyed by order.id
 *   - Worker Gold Issue        → worker-gold-book-store.ts / ledger-store.ts
 *   - Material Issue           → (future) material-issue-store.ts
 *   - Outside Jeweller         → (future) outside-work-store.ts
 *   - Polishing                → repair-store.ts already models this pattern
 *   - Billing                  → billing-store.ts's Invoice.orderId
 *   - Customer Portal          → reads the same Order record read-only
 */

/** One product on the order. A jeweller places several jobs at once; each line
 *  becomes its own Job Card, so each carries its own weight and purity. */
interface LineForm {
  /** Stable key — also the attachment entity id for this line's reference images. */
  lineId: string;
  itemName: string;
  category: string;
  quantity: string;
  purity: string; // per-mille as string
  /** Expected weight of ONE piece. Line total = perPieceG × quantity. */
  perPieceG: string;
  /** Category-specific dimensions (ring size, chain length…) — see product-attributes.ts. */
  attributes: Record<string, string>;
  /** Save this design into the Catalog for reuse on future orders. */
  saveToCatalog: boolean;
  remarks: string;
}

interface FormState {
  /** The workshop's production type. Either an OrderType key, or `custom:<label>`
   *  for a type the workshop added in Settings (rides the `custom` workflow). */
  productionType: string | null;
  customerId: string | null;
  branchId: string;
  lines: LineForm[];
  goldReceivedG: string;
  goldReceivedPurity: string; // per-mille — the customer's OLD gold is often a different purity than the item ordered
  /** Appraisal melt-loss deduction (%) applied to old gold received — refining/testing loss the shop won't credit back. Optional, defaults to 0. */
  goldReceivedMeltLossPct: string;
  expectedDelivery: string;
  remarks: string;
}

function makeLineId(): string {
  return "ln_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function emptyLine(): LineForm {
  return {
    lineId: makeLineId(),
    itemName: "",
    category: "",
    quantity: "1",
    purity: "916",
    perPieceG: "",
    attributes: {},
    saveToCatalog: false,
    remarks: "",
  };
}

/**
 * Makes one persisted line whole.
 *
 * The form draft is saved to localStorage under a fixed key and survives a code
 * change, so a line written by an EARLIER version of this form comes back
 * missing whatever fields have been added since — `attributes` was absent, and
 * `line.attributes[key]` threw the moment a category with dynamic fields
 * rendered, taking the whole page down.
 *
 * Spreading EMPTY over the draft only fills TOP-LEVEL keys; the lines inside it
 * are untouched. So every line is normalised on the way out of the draft, which
 * fixes this class of crash for good rather than null-guarding the one field
 * that happened to break today.
 *
 * `grossG` is the old per-line total field, from before per-piece capture.
 * Carrying it into `perPieceG` keeps a half-typed draft's weight instead of
 * silently blanking it (quantity was always 1 back then, so total == per piece).
 */
function normalizeLine(raw: Partial<LineForm> & { grossG?: string }): LineForm {
  const base = emptyLine();
  return {
    ...base,
    ...raw,
    lineId: raw.lineId || base.lineId,
    attributes: raw.attributes ?? {},
    perPieceG: raw.perPieceG ?? raw.grossG ?? "",
    saveToCatalog: raw.saveToCatalog ?? false,
  };
}

const EMPTY: FormState = {
  productionType: null,
  customerId: null,
  branchId: "MAIN",
  lines: [],
  goldReceivedG: "",
  goldReceivedPurity: "",
  goldReceivedMeltLossPct: "",
  expectedDelivery: "",
  remarks: "",
};

function safeMg(s: string): number {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return gramsToMg(n);
}

function safePurity(s: string): number {
  const p = parsePurity(s);
  return p > 0 ? p : 0;
}

function NewOrderPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const people = usePeople((s) => s.people);
  const addPerson = usePeople((s) => s.add);
  const addOrder = useOrders((s) => s.add);
  const appendLedger = useLedger((s) => s.append);

  const [draftId, , clearDraftId] = useDraft(
    "mtj-order-draft-id-v1",
    () => "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
  );
  const [submitting, setSubmitting] = useState(false);
  const [rawForm, setForm, clearForm] = useDraft<FormState>("mtj-order-draft-form-v1", () => {
    const sBid = useSettings.getState().selectedBranchId || "MAIN";
    return { ...EMPTY, branchId: sBid };
  });
  // EMPTY fills missing top-level keys; normalizeLine fills missing keys INSIDE
  // each persisted line. A draft written by an older build of this form is the
  // normal case after any deploy, so it must be shaped, not trusted.
  const form = useMemo<FormState>(() => {
    const merged = { ...EMPTY, ...rawForm };
    return { ...merged, lines: (merged.lines ?? []).map(normalizeLine) };
  }, [rawForm]);

  const [quickAdd, setQuickAdd] = useState<null | { type: PersonType }>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [created, setCreated] = useState<null | { order: Order; customer: Person }>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const addDesign = useCatalog((s) => s.add);
  const nextDesignNumber = useCatalog((s) => s.nextDesignNumber);

  // Both lists are Settings masters — add/rename/disable them there, no code
  // change. Disabled values are excluded, so a type the workshop retired stops
  // being offered on new orders while old orders keep displaying it.
  const productionTypes = useActiveDropdownValues("orderType");
  const categories = useActiveDropdownValues("itemCategory");

  const selectedCustomer = people.find((p) => p.id === form.customerId) ?? null;

  const customers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const base = people.filter((p) => p.type === "customer" || p.type === "firm_customer");
    if (!q) return base.slice(0, 8);
    return base.filter((p) => p.fullName.toLowerCase().includes(q) || p.phone.includes(q));
  }, [people, customerQuery]);

  // Seed the first line into state rather than synthesizing one during render:
  // a line's `lineId` is the attachment entity id its reference images are
  // stored under, so a fresh id on every render would orphan every upload.
  useEffect(() => {
    if (!form.lines.length) setForm((f) => ({ ...f, lines: [emptyLine()] }));
  }, [form.lines.length, setForm]);

  const lines = form.lines;

  const lineCalcs = useMemo(
    () =>
      lines.map((l) => {
        // The workshop quotes and works in PER-PIECE weight ("six rings, 4g
        // each"), but gold is issued and wastage is measured against the LINE
        // TOTAL. Capture the per-piece figure and derive the total, rather than
        // asking for a total the user has to multiply in their head.
        const perPieceGrossMg = safeMg(l.perPieceG);
        const purity = safePurity(l.purity);
        const quantity = Math.max(1, Math.floor(Number(l.quantity) || 1));
        const grossMg = perPieceGrossMg * quantity;
        return {
          perPieceGrossMg,
          grossMg,
          purity,
          quantity,
          perPieceFineMg: fineGoldMg(perPieceGrossMg, purity),
          fineMg: fineGoldMg(grossMg, purity),
        };
      }),
    [lines],
  );

  const calc = useMemo(() => {
    const grossMg = lineCalcs.reduce((s, c) => s + c.grossMg, 0);
    const fineMg = lineCalcs.reduce((s, c) => s + c.fineMg, 0);
    const goldReceivedMg = safeMg(form.goldReceivedG);
    // Old gold coming in is very often a different purity than the item going
    // out — 22K bangles melted toward an 18K order. Purity is REQUIRED once any
    // weight is entered: fine gold is what the vault and the customer's account
    // are actually denominated in, and a guessed purity is a wrong ledger entry,
    // not a missing one.
    const goldReceivedPurity = safePurity(form.goldReceivedPurity);
    const goldReceivedGrossFineMg = fineGoldMg(goldReceivedMg, goldReceivedPurity);
    // Melt-loss (refining/testing loss) is deducted from the appraised fine weight
    // before it's credited to the customer — the shop doesn't pay for gold that
    // burns off in the melt. Clamped so a typo can't credit negative or >100%.
    const meltLossPct = Math.min(100, Math.max(0, Number(form.goldReceivedMeltLossPct) || 0));
    const goldReceivedFineMg = Math.round(goldReceivedGrossFineMg * (1 - meltLossPct / 100));
    return {
      grossMg,
      fineMg,
      goldReceivedMg,
      goldReceivedPurity,
      goldReceivedGrossFineMg,
      meltLossPct,
      goldReceivedFineMg,
    };
  }, [lineCalcs, form.goldReceivedG, form.goldReceivedPurity, form.goldReceivedMeltLossPct]);

  const isPastDate =
    !!form.expectedDelivery && form.expectedDelivery < new Date().toISOString().split("T")[0];

  const goldReceivedNeedsPurity = calc.goldReceivedMg > 0 && calc.goldReceivedPurity <= 0;

  const linesValid =
    lines.length > 0 &&
    lines.every(
      (l, i) =>
        l.itemName.trim().length > 0 &&
        l.category.length > 0 &&
        lineCalcs[i].grossMg > 0 &&
        lineCalcs[i].purity > 0,
    );

  const canSubmit =
    !!form.productionType &&
    !!form.customerId &&
    linesValid &&
    !goldReceivedNeedsPurity &&
    !isPastDate;

  function setLine(i: number, patch: Partial<LineForm>) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  }

  function removeLine(i: number) {
    setForm((f) => (f.lines.length <= 1 ? f : { ...f, lines: f.lines.filter((_, x) => x !== i) }));
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await submitInternal();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInternal() {
    if (!form.productionType || !form.customerId) return;
    const { type, productionType } = resolveProductionType(form.productionType);

    let ledgerEntryId: string | undefined;
    if (calc.goldReceivedMg > 0) {
      const entry = await appendLedger({
        type: "old_gold_received",
        netFineMg: calc.goldReceivedFineMg,
        deltas: { vault: calc.goldReceivedFineMg },
        grossMg: calc.goldReceivedMg,
        purity: calc.goldReceivedPurity,
        fineMg: calc.goldReceivedFineMg,
        form: "old_gold",
        reference: `Order (pending)`,
        notes: `Gold received from ${selectedCustomer?.fullName ?? "customer"} at order creation · applied to order`,
      });
      ledgerEntryId = entry.id;
    }

    const allocatedOrderNo = await getNextSequenceNumber("order");
    const designNum = await getNextSequenceNumber("design");

    const order = await addOrder({
      ...({ id: draftId } as object),
      orderNo: allocatedOrderNo,
      type,
      productionType,
      // Order accepted. Work is assigned later, per item, when its Job Card is
      // created — so "confirmed" is the truth here, not "awaiting job card".
      status: "confirmed",
      customerId: form.customerId,
      // Unassigned on purpose — a karigar is chosen per item at Job Card time.
      expectedDelivery: form.expectedDelivery || undefined,
      priority: "normal",
      source: "manual",
      branchId: form.branchId,
      // Design capture is deferred to a future screen — kept as a fully
      // valid (if empty) OrderDesign so nothing downstream needs to
      // null-check a missing `design` object.
      design: {
        designNumber: designNum,
      },
      // One line per product. Each becomes its own Job Card at confirmation.
      items: lines.map((l, i) => ({
        itemName: l.itemName.trim(),
        category: l.category,
        quantity: lineCalcs[i].quantity,
        // Only the keys this category actually defines, and only the filled-in
        // ones — no empty strings persisted for fields the user skipped.
        attributes: Object.fromEntries(
          attributesForCategory(l.category)
            .map((a) => [a.key, (l.attributes[a.key] ?? "").trim()])
            .filter(([, v]) => v !== ""),
        ),
        metal: "Gold",
        metalColor: "Yellow",
        purity: lineCalcs[i].purity,
        perPieceGrossMg: lineCalcs[i].perPieceGrossMg,
        // Line TOTAL — gold is issued against this, not the per-piece figure.
        grossMg: lineCalcs[i].grossMg,
        lessMg: 0,
        netMg: lineCalcs[i].grossMg,
        fineMg: lineCalcs[i].fineMg,
        expectedWastagePct: 0,
        expectedWastageMg: 0,
        remarks: l.remarks || undefined,
        lineId: l.lineId,
      })),
      advance: {
        cashPaise: 0,
        goldKind: calc.goldReceivedMg > 0 ? "old_gold" : undefined,
        goldGrossMg: calc.goldReceivedMg,
        goldPurity: calc.goldReceivedMg > 0 ? calc.goldReceivedPurity : undefined,
        goldFineMg: calc.goldReceivedFineMg,
        goldApplyMode: calc.goldReceivedMg > 0 ? "apply" : undefined,
        goldLedgerEntryId: ledgerEntryId,
      },
      timeline: [
        { ts: Date.now(), label: "Order created" },
        ...(ledgerEntryId
          ? [
              {
                ts: Date.now(),
                label: "Customer gold posted to ledger",
                note: `Entry ${ledgerEntryId.slice(0, 8)}`,
              },
            ]
          : []),
      ],
    });

    // Catalog: save the lines the user ticked, so a design ordered once can be
    // reused instead of re-described. Best-effort — the order is already saved,
    // and a catalog failure must never fail the order.
    let savedToCatalog = 0;
    for (const [i, l] of lines.entries()) {
      if (!l.saveToCatalog) continue;
      try {
        const design = addDesign({
          designNumber: nextDesignNumber(l.category),
          designName: l.itemName.trim(),
          category: l.category,
          purity: lineCalcs[i].purity,
          approxGrossMg: lineCalcs[i].perPieceGrossMg || lineCalcs[i].grossMg,
          approxNetMg: lineCalcs[i].perPieceGrossMg || lineCalcs[i].grossMg,
          difficulty: "medium",
          tags: [],
          source: "saved_from_order",
          customerId: form.customerId ?? undefined,
          orderId: order.id,
          notes: l.remarks || undefined,
        });

        // The design IS the photo, for a catalog — a design saved without its
        // reference image is not reusable, which was the whole point. Copy this
        // line's reference into the slot the Catalog reads
        // (`catalog:<designId>:design_photo`). A real copy, so deleting the
        // order later doesn't take the catalog entry's picture with it.
        await copyAttachment(
          { entityType: "order", entityId: order.id, docKey: lineReferenceDocKey(l.lineId) },
          { entityType: "catalog", entityId: design.id, docKey: "design_photo" },
        );

        savedToCatalog++;
      } catch (err) {
        console.error("[Orders] Could not save design to catalog:", err);
      }
    }

    clearDraftId();
    clearForm();
    toast.success(
      `Order ${order.orderNo} created.` +
        (savedToCatalog > 0
          ? ` ${savedToCatalog} design${savedToCatalog > 1 ? "s" : ""} saved to Catalog.`
          : ""),
    );

    // Offer the customer confirmation as a WhatsApp deep link rather than
    // sending it: V1 has no WhatsApp API, so the user sends it from their own
    // account. Only offered when the number can actually be opened.
    if (selectedCustomer && isValidWaPhone(selectedCustomer.phone)) {
      setCreated({ order, customer: selectedCustomer });
    } else {
      navigate({ to: "/orders/$id", params: { id: order.id } });
    }
  }

  // Keyboard-first: Ctrl+S saves, Esc returns to the orders list. Tab/Enter
  // are native — inputs tab through in DOM order, and the surrounding <form>
  // submits on Enter from any single-line input (not from the Remarks
  // textarea, where Enter correctly inserts a newline instead).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        navigate({ to: "/orders" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmit, submitting, form]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        title={t("orders.createOrder")}
        subtitle="Everything required before work starts — nothing more."
        actions={
          <Link to="/orders">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> {t("orders.backToOrders")}
            </Button>
          </Link>
        }
      />

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-6"
      >
        {/* Customer */}
        <Section title="Customer / Dealer">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone…"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setQuickAdd({ type: "customer" })}
            >
              <Plus className="h-3 w-3" /> Quick add customer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setQuickAdd({ type: "firm_customer" })}
            >
              <Plus className="h-3 w-3" /> Quick add firm
            </Button>
          </div>
          {selectedCustomer ? (
            <SelectedPersonChip
              person={selectedCustomer}
              onClear={() => setForm((f) => ({ ...f, customerId: null }))}
            />
          ) : (
            <div className="grid gap-2 max-h-56 overflow-y-auto">
              {customers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">
                  No matching customers. Use "Quick add" above.
                </p>
              ) : (
                customers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid="order-customer-select"
                    onClick={() => setForm((f) => ({ ...f, customerId: p.id }))}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/40 hover:border-gold/40 px-3 py-2 text-left"
                  >
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {p.fullName}
                        <Badge variant="outline" className="text-[10px]">
                          {PERSON_TYPE_LABELS[p.type]}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </Section>

        {/* Production type */}
        <Section title="Production">
          <Field label="Production Type *">
            <Select
              value={form.productionType ?? ""}
              onValueChange={(v) => setForm((f) => ({ ...f, productionType: v }))}
            >
              <SelectTrigger data-testid="order-type-select">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {productionTypes.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Managed in Settings → Dropdowns → Order Type.
            </p>
          </Field>
        </Section>

        {/* Products — one line per piece; each becomes its own Job Card */}
        <Section title="Products">
          <p className="text-xs text-muted-foreground -mt-1">
            One line per piece. Each line becomes its own Job Card, with its own gold issue and
            wastage.
          </p>

          {lines.map((line, i) => (
            <div
              key={line.lineId}
              className="rounded-xl border border-border bg-background/40 p-4 space-y-4"
              data-testid="order-line"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gold">Item {i + 1}</div>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLine(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>

              <Field label="Product Description *">
                <Input
                  value={line.itemName}
                  onChange={(e) => setLine(i, { itemName: e.target.value })}
                  placeholder="e.g. Bridal necklace with temple motif"
                  autoFocus={i === 0}
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Category *">
                  <Select value={line.category} onValueChange={(v) => setLine(i, { category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quantity *">
                  <Input
                    value={line.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    inputMode="numeric"
                    placeholder="1"
                  />
                </Field>
              </div>

              {/* Category-specific dimensions — only the ones this category
                  actually has (ring size, chain length, bangle diameter). These
                  are what the karigar works to; a job card without them sends a
                  piece to the bench that comes back to be re-sized. */}
              {attributesForCategory(line.category).length > 0 && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {attributesForCategory(line.category).map((attr) => (
                    <Field key={attr.key} label={attr.label}>
                      <Input
                        value={line.attributes[attr.key] ?? ""}
                        onChange={(e) =>
                          setLine(i, {
                            attributes: { ...line.attributes, [attr.key]: e.target.value },
                          })
                        }
                        placeholder={attr.placeholder}
                      />
                      {attr.hint && (
                        <p className="text-[11px] text-muted-foreground mt-1">{attr.hint}</p>
                      )}
                    </Field>
                  ))}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Expected Weight per Piece (g) *">
                  <Input
                    value={line.perPieceG}
                    onChange={(e) => setLine(i, { perPieceG: e.target.value })}
                    placeholder="10.000"
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Purity *">
                  <Input
                    value={line.purity}
                    onChange={(e) => setLine(i, { purity: e.target.value })}
                    placeholder="916"
                    inputMode="numeric"
                  />
                </Field>
              </div>

              {/* Per-piece vs total: gold is issued against the TOTAL, so the
                  multiplication is shown rather than left to the user. */}
              {lineCalcs[i].perPieceGrossMg > 0 && lineCalcs[i].quantity > 1 && (
                <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per piece</span>
                    <span className="font-mono">
                      {(lineCalcs[i].perPieceGrossMg / 1000).toFixed(3)} g
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>
                      Total expected weight ({lineCalcs[i].quantity} ×{" "}
                      {(lineCalcs[i].perPieceGrossMg / 1000).toFixed(3)} g)
                    </span>
                    <span className="font-mono text-gold">
                      {(lineCalcs[i].grossMg / 1000).toFixed(3)} g
                    </span>
                  </div>
                </div>
              )}

              {lineCalcs[i].grossMg > 0 && lineCalcs[i].purity > 0 && (
                <p className="text-xs text-muted-foreground">
                  Fine gold equivalent: {(lineCalcs[i].fineMg / 1000).toFixed(3)} g
                </p>
              )}

              <Field label="Reference Images / Attachments">
                {/* Per-line, so the karigar making THIS piece gets THIS photo.
                    Stored under the order's own attachment namespace via
                    lineReferenceDocKey() — the same key job-card-engine and the
                    print templates resolve from. entityId is the draft id, which
                    IS the order id once saved (addOrder is called with it). */}
                <AttachmentButton
                  entityType="order"
                  entityId={draftId}
                  docKey={lineReferenceDocKey(line.lineId)}
                  docLabel={`Reference — Item ${i + 1}`}
                  title="Reference Images / Attachments"
                />
              </Field>

              <Field label="Item Remarks">
                <Input
                  value={line.remarks}
                  onChange={(e) => setLine(i, { remarks: e.target.value })}
                  placeholder="Anything specific to this piece"
                />
              </Field>

              {/* A design a jeweller orders once is usually ordered again. Saving
                  it to the Catalog on the way past means the next order can start
                  from it, instead of re-describing the same piece from scratch. */}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={line.saveToCatalog}
                  onCheckedChange={(v) => setLine(i, { saveToCatalog: v === true })}
                />
                <span>Also save this design to the Catalog for reuse</span>
              </label>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" /> Add another item
          </Button>

          {lines.length > 1 && calc.grossMg > 0 && (
            <p className="text-xs text-muted-foreground">
              Order total: {lines.length} items · {(calc.grossMg / 1000).toFixed(3)} g gross ·{" "}
              {(calc.fineMg / 1000).toFixed(3)} g fine
            </p>
          )}
        </Section>

        {/* Gold received */}
        <Section title="Gold Received">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Gold Received (g)">
              <Input
                value={form.goldReceivedG}
                onChange={(e) => setForm((f) => ({ ...f, goldReceivedG: e.target.value }))}
                placeholder="0.000 — leave blank if none received yet"
                inputMode="decimal"
              />
            </Field>
            <Field label={calc.goldReceivedMg > 0 ? "Purity *" : "Purity"}>
              <Input
                value={form.goldReceivedPurity}
                onChange={(e) => setForm((f) => ({ ...f, goldReceivedPurity: e.target.value }))}
                placeholder="916"
                inputMode="numeric"
                disabled={calc.goldReceivedMg <= 0}
                className={
                  goldReceivedNeedsPurity ? "border-red-500 focus-visible:ring-red-500" : ""
                }
              />
            </Field>
            <Field label="Melt-Loss Deduction (%)">
              <Input
                value={form.goldReceivedMeltLossPct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, goldReceivedMeltLossPct: e.target.value }))
                }
                placeholder="0 — refining/testing loss not credited back"
                inputMode="decimal"
                disabled={calc.goldReceivedMg <= 0}
              />
            </Field>
          </div>
          {goldReceivedNeedsPurity && (
            <p className="text-xs text-red-500 font-medium">
              Purity is required for gold received — fine weight, not gross, is what posts to the
              gold ledger and the customer's account.
            </p>
          )}
          {calc.goldReceivedMg > 0 && calc.goldReceivedPurity > 0 && (
            <p className="text-xs text-muted-foreground">
              Appraised fine gold: {(calc.goldReceivedGrossFineMg / 1000).toFixed(3)} g
              {calc.meltLossPct > 0 && <> − {calc.meltLossPct}% melt loss</>} ={" "}
              {(calc.goldReceivedFineMg / 1000).toFixed(3)} g — posted to the gold ledger on save.
            </p>
          )}
        </Section>

        {/* Workshop */}
        {/* No karigar here. Taking an order and assigning the bench are two
            different decisions, made at two different times: the order is
            reviewed first, then each item is assigned to a karigar when its Job
            Card is created (Order screen → Create Job Card). */}
        <Section title="Workshop">
          <Field label="Delivery Date">
            <Input
              type="date"
              value={form.expectedDelivery}
              onChange={(e) => setForm((f) => ({ ...f, expectedDelivery: e.target.value }))}
              className={isPastDate ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {isPastDate && (
              <p className="text-xs text-red-500 mt-1 font-medium">
                Delivery date cannot be in the past.
              </p>
            )}
          </Field>
          <Field label="Remarks">
            <Textarea
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              rows={3}
              placeholder="Anything the workshop needs to know"
            />
          </Field>
        </Section>

        <div className="flex items-center justify-end gap-2 pb-8">
          <Link to="/orders">
            <Button type="button" variant="ghost">
              Cancel (Esc)
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="gap-2"
            data-testid="order-create-submit"
          >
            <Save className="h-4 w-4" />
            {submitting ? "Creating…" : "Create Order (Ctrl+S)"}
          </Button>
        </div>
      </form>

      <QuickAddDialog
        open={!!quickAdd}
        type={quickAdd?.type ?? "customer"}
        onClose={() => setQuickAdd(null)}
        addPerson={addPerson}
        onSaved={(p) => {
          setForm((f) => ({ ...f, customerId: p.id }));
          setQuickAdd(null);
        }}
      />

      {/* Post-create: offer to send the customer a WhatsApp confirmation.
          Skipping it is a first-class choice — the order is already saved, this
          dialog only decides whether a message goes out. */}
      <Dialog
        open={!!created}
        onOpenChange={(o) => {
          if (!o && created) {
            const id = created.order.id;
            setCreated(null);
            navigate({ to: "/orders/$id", params: { id } });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order {created?.order.orderNo} created</DialogTitle>
            <DialogDescription>
              Send {created?.customer.fullName} a confirmation with the expected delivery date?
            </DialogDescription>
          </DialogHeader>
          {created && (
            <pre className="text-xs whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 max-h-52 overflow-y-auto">
              {orderConfirmationMessage(created.order)}
            </pre>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (!created) return;
                const id = created.order.id;
                setCreated(null);
                navigate({ to: "/orders/$id", params: { id } });
              }}
            >
              Skip
            </Button>
            <Button
              className="gap-2 bg-[#25D366] hover:bg-[#20bf5a] text-white"
              onClick={() => {
                if (!created) return;
                // Through the configured WhatsApp provider (deep link today,
                // OpenWA later) — this screen never builds a link itself.
                void sendWhatsAppText({
                  phone: created.customer.phone,
                  message: orderConfirmationMessage(created.order),
                  recipientName: created.customer.fullName,
                  branchId: created.order.branchId,
                  linkedType: "order",
                  linkedId: created.order.id,
                }).then((r) => {
                  if (!r.ok) toast.error(r.error ?? "Could not send the WhatsApp message.");
                });
                const id = created.order.id;
                setCreated(null);
                navigate({ to: "/orders/$id", params: { id } });
              }}
            >
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-serif text-lg text-gold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SelectedPersonChip({ person, onClear }: { person: Person; onClear: () => void }) {
  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full gradient-gold grid place-items-center text-primary-foreground font-serif shrink-0">
          {person.fullName.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2">
            {person.fullName}
            <Badge variant="outline" className="text-[10px]">
              {PERSON_TYPE_LABELS[person.type]}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" /> {person.phone}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1"
      >
        <CheckCircle2 className="h-4 w-4 text-gold" /> Change
      </button>
    </div>
  );
}

function QuickAddDialog({
  open,
  type,
  onClose,
  onSaved,
  addPerson,
}: {
  open: boolean;
  type: PersonType;
  onClose: () => void;
  onSaved: (p: Person) => void;
  addPerson: (
    p: Omit<Person, "id" | "createdAt" | "updatedAt" | "docs"> & { docs?: Person["docs"] },
  ) => Promise<Person>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const isFirm = type === "firm_customer";

  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !phone.trim() || saving) return;
    setSaving(true);
    try {
      // Creates a real People record (usePeople.add persists it and stamps the
      // branch); the order is then linked to the returned id, so the customer is
      // fully visible in the People module with KYC still to complete.
      const p = await addPerson({
        type,
        active: true,
        fullName: name.trim(),
        phone: phone.trim(),
        currentAddress: address.trim() || undefined,
        gstin: isFirm ? gstin.trim() || undefined : undefined,
      });
      onSaved(p);
      toast.success(`${p.fullName} added to People.`);
      setName("");
      setPhone("");
      setAddress("");
      setGstin("");
    } catch (err: any) {
      // Previously this threw into an unhandled rejection: the dialog just sat
      // there and the user had no idea the customer was never created.
      toast.error(err?.message || "Could not create the customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add — {isFirm ? "Firm customer" : "Customer"}</DialogTitle>
          <DialogDescription>The full KYC can be completed later from People.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={isFirm ? "Firm name *" : "Customer name *"}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone *">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Address">
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          {isFirm && (
            <Field label="GSTIN">
              <Input value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim() || !phone.trim() || saving}>
            {saving ? "Saving…" : "Save & Select"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
