import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useDraft } from "@/lib/drafts-store";
import { PageHeader } from "@/components/app-shell";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { usePeople, type Person, type PersonType, PERSON_TYPE_LABELS } from "@/lib/people-store";
import {
  useOrders,
  ITEM_CATEGORIES,
  METALS,
  METAL_COLORS,
  ORDER_TYPE_LABELS,
  PAYMENT_MODES,
  paiseToRupees,
  rupeesToPaise,
  type OrderType,
  type OrderSource,
  type Priority,
  ORDER_SOURCE_LABELS,
} from "@/lib/orders-store";
import { useCatalog, type Design } from "@/lib/catalog-store";
import { useLedger } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBilling, customerLedger } from "@/lib/billing-store";
import { COMMON_PURITIES, fineGoldMg, gramsToMg, mgToGrams, parsePurity } from "@/lib/gold";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Hammer,
  Image as ImageIcon,
  Info,
  Package,
  Phone,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  Wrench,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/orders/new")({
  head: () => ({ meta: [{ title: "Create Order · MTJ ERP" }] }),
  component: WizardPage,
});

const STEPS = [
  { n: 1, label: "Order Type" },
  { n: 2, label: "Customer" },
  { n: 3, label: "Design" },
  { n: 4, label: "Item & Gold" },
  { n: 5, label: "Advance / Gold In" },
  { n: 6, label: "Assignment" },
  { n: 7, label: "Confirm" },
] as const;

const ORDER_TYPE_CARDS: {
  type: OrderType;
  icon: typeof ShoppingBag;
  desc: string;
  ready: boolean;
}[] = [
  {
    type: "custom",
    icon: Sparkles,
    desc: "Order made specifically for the customer.",
    ready: true,
  },
  { type: "repair", icon: Wrench, desc: "Existing jewellery brought in for repair.", ready: true },
  {
    type: "polishing",
    icon: Hammer,
    desc: "Polishing / refurbishing existing piece.",
    ready: true,
  },
  {
    type: "ready_stock",
    icon: Package,
    desc: "Sale of an item already in showroom stock.",
    ready: true,
  },
  {
    type: "wholesale",
    icon: ShoppingBag,
    desc: "Bulk order for a firm / wholesaler.",
    ready: true,
  },
];

interface FormState {
  orderType: OrderType | null;
  customerId: string | null;
  branchId: string;
  design: {
    designNumber: string;
    customerCode: string;
    pattern: string;
    notes: string;
    saveToCatalog: boolean;
  };
  item: {
    itemName: string;
    category: string;
    quantity: string;
    size: string;
    metal: string;
    metalColor: string;
    purity: string; // per-mille as string
    grossG: string;
    addG: string;
    lessG: string;
    expectedWastagePct: string;
    stoneDetails: string;
    remarks: string;
    stamp: string;
    labourRupees: string;
    amountRupees: string;
    customNetG?: string;
    customFineG?: string;
    customWastageG?: string;
    customCalculatedGoldG?: string;
    isManualOverride?: boolean;
  };
  advance: {
    cashRupees: string;
    cashMode: "" | "cash" | "upi" | "bank" | "card";
    cashRef: string;
    goldKind: "" | "advance" | "old_gold";
    goldGrossG: string;
    goldPurity: string;
    goldApplyMode: "apply" | "credit";
    goldRate: string;
  };
  karigarId: string | null;
  expectedDelivery: string;
  priority: Priority;
  source: OrderSource;
  whatsappSourceId: string;
}

const EMPTY: FormState = {
  orderType: null,
  customerId: null,
  branchId: "MAIN",
  design: { designNumber: "", customerCode: "", pattern: "", notes: "", saveToCatalog: false },
  item: {
    itemName: "",
    category: "",
    quantity: "1",
    size: "",
    metal: "Gold",
    metalColor: "Yellow",
    purity: "916",
    grossG: "",
    addG: "",
    lessG: "",
    expectedWastagePct: "",
    stoneDetails: "",
    remarks: "",
    stamp: "",
    labourRupees: "",
    amountRupees: "",
    customNetG: "",
    customFineG: "",
    customWastageG: "",
    customCalculatedGoldG: "",
    isManualOverride: false,
  },
  advance: {
    cashRupees: "",
    cashMode: "",
    cashRef: "",
    goldKind: "",
    goldGrossG: "",
    goldPurity: "916",
    goldApplyMode: "apply",
    goldRate: "",
  },
  karigarId: null,
  expectedDelivery: "",
  priority: "normal",
  source: "walk_in",
  whatsappSourceId: "",
};

function WizardPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const people = usePeople((s) => s.people);
  const addPerson = usePeople((s) => s.add);
  const addOrder = useOrders((s) => s.add);
  const appendLedger = useLedger((s) => s.append);
  const addDesign = useCatalog((s) => s.add);
  const designs = useCatalog((s) => s.designs);

  const [draftId, setDraftId, clearDraftId] = useDraft(
    "mtj-order-draft-id-v1",
    () => "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
  );
  const [step, setStep, clearStep] = useDraft("mtj-order-draft-step-v1", 1);
  const [submitting, setSubmitting] = useState(false);
  const [rawForm, setForm, clearForm] = useDraft<FormState>("mtj-order-draft-form-v1", () => {
    const rate = useSettings.getState().goldRatePerGramPaise;
    const sBid = useSettings.getState().selectedBranchId || "MAIN";
    return {
      ...EMPTY,
      branchId: sBid,
      advance: {
        ...EMPTY.advance,
        goldRate: rate ? (rate / 100).toString() : "",
      },
    };
  });
  const form = useMemo(() => {
    return {
      ...EMPTY,
      ...rawForm,
      item: { ...EMPTY.item, ...rawForm?.item },
      design: { ...EMPTY.design, ...rawForm?.design },
      advance: { ...EMPTY.advance, ...rawForm?.advance },
    };
  }, [rawForm]);
  const [storageNotice, setStorageNotice] = useState(false);
  const [quickAdd, setQuickAdd] = useState<null | { type: PersonType }>(null);
  const [pickCatalog, setPickCatalog] = useState(false);

  const selectedCustomer = people.find((p) => p.id === form.customerId) ?? null;
  const selectedKarigar = people.find((p) => p.id === form.karigarId) ?? null;

  // Live calculations
  const calc = useMemo(() => {
    const grossMg = safeMg(form.item.grossG);
    const addMg = safeMg(form.item.addG || "0");
    const lessMg = safeMg(form.item.lessG);
    const calculatedNetMg = Math.max(0, grossMg + addMg - lessMg);
    const netMg =
      form.item.isManualOverride && form.item.customNetG
        ? safeMg(form.item.customNetG)
        : calculatedNetMg;

    const purity = safePurity(form.item.purity);
    const calculatedFineMg = fineGoldMg(netMg, purity);
    const fineMg =
      form.item.isManualOverride && form.item.customFineG
        ? safeMg(form.item.customFineG)
        : calculatedFineMg;

    const wPct = Number(form.item.expectedWastagePct) || 0;
    const calculatedWastageMg = Math.round((netMg * wPct) / 100);
    const wastageMg =
      form.item.isManualOverride && form.item.customWastageG
        ? safeMg(form.item.customWastageG)
        : calculatedWastageMg;

    const appSettings = useSettings.getState();
    const calculationMode = appSettings.print?.voucherCalculationMode || "fine_only";

    let calculatedGoldMg = fineMg;
    if (calculationMode === "fine_wastage") {
      calculatedGoldMg = fineMg + wastageMg;
    }
    if (form.item.isManualOverride && form.item.customCalculatedGoldG) {
      calculatedGoldMg = safeMg(form.item.customCalculatedGoldG);
    }

    const advGrossMg = safeMg(form.advance.goldGrossG);
    const advPurity = safePurity(form.advance.goldPurity);
    const advFineMg = fineGoldMg(advGrossMg, advPurity);

    return {
      grossMg,
      addMg,
      lessMg,
      netMg,
      purity,
      fineMg,
      wastageMg,
      calculatedGoldMg,
      advGrossMg,
      advPurity,
      advFineMg,
    };
  }, [form]);

  // Step validation
  const canNext = (() => {
    if (step === 1) return !!form.orderType;
    if (step === 2) return !!form.customerId;
    if (step === 3) return true;
    if (step === 4) {
      const isPurityValid = calc.purity > 0;
      const isWastageNonNegative = (Number(form.item.expectedWastagePct) || 0) >= 0;
      const isNetWeightNonNegative = calc.netMg >= 0;
      return (
        form.item.itemName.trim().length > 0 &&
        form.item.category.length > 0 &&
        calc.grossMg > 0 &&
        isNetWeightNonNegative &&
        isPurityValid &&
        isWastageNonNegative
      );
    }
    if (step === 5) {
      // Either no advance, or chosen options must be coherent
      if (form.advance.cashRupees && !form.advance.cashMode) return false;
      if (form.advance.goldKind && calc.advGrossMg <= 0) return false;
      return true;
    }
    if (step === 6) {
      if (form.expectedDelivery) {
        const todayStr = new Date().toISOString().split("T")[0];
        if (form.expectedDelivery < todayStr) return false;
      }
      return true;
    }
    return true;
  })();

  function goNext() {
    if (step < 7 && canNext) setStep(step + 1);
  }
  function goBack() {
    if (step > 1) setStep(step - 1);
  }

  async function submit(confirm: boolean) {
    if (!form.orderType || !form.customerId) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitInternal(confirm);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInternal(confirm: boolean) {
    if (!form.orderType || !form.customerId) return;
    const advance = {
      cashPaise: rupeesToPaise(form.advance.cashRupees),
      cashMode: form.advance.cashMode || undefined,
      cashRef: form.advance.cashRef || undefined,
      goldKind: form.advance.goldKind || undefined,
      goldGrossMg: calc.advGrossMg,
      goldPurity: calc.advGrossMg > 0 ? calc.advPurity : undefined,
      goldFineMg: calc.advFineMg,
      goldApplyMode: calc.advGrossMg > 0 ? form.advance.goldApplyMode : undefined,
      goldRatePerGram: form.advance.goldRate ? Number(form.advance.goldRate) : undefined,
    } as const;

    let ledgerEntryId: string | undefined;
    // Post gold movement if any gold received (only on confirm, not on draft)
    if (confirm && calc.advGrossMg > 0 && form.advance.goldKind) {
      const isOld = form.advance.goldKind === "old_gold";
      const movementType = isOld ? "old_gold_received" : "customer_gold_received";
      // Decide bucket: "apply to this order" → goes into vault (becomes shop gold against order);
      // "keep as credit" → stays in customer bucket.
      const toVault = form.advance.goldApplyMode === "apply";
      const entry = await appendLedger({
        type: movementType,
        netFineMg: calc.advFineMg,
        deltas: toVault ? { vault: calc.advFineMg } : { customer: calc.advFineMg },
        grossMg: calc.advGrossMg,
        purity: calc.advPurity,
        fineMg: calc.advFineMg,
        form: isOld ? "old_gold" : "other",
        reference: `Order (pending)`,
        notes: `${isOld ? "Old gold" : "Customer gold advance"} from ${selectedCustomer?.fullName ?? "customer"} · ${form.advance.goldApplyMode === "apply" ? "Applied to order" : "Held as customer credit"}`,
      });
      ledgerEntryId = entry.id;
    }

    const allocatedOrderNo = await getNextSequenceNumber("order");

    let designNum = form.design.designNumber;
    if (!designNum) {
      designNum = await getNextSequenceNumber("design");
    }

    const order = await addOrder({
      ...(draftId ? ({ id: draftId } as object) : {}),
      orderNo: allocatedOrderNo,
      type: form.orderType,
      status: confirm ? "awaiting_job_card" : "draft",
      customerId: form.customerId,
      karigarId: form.karigarId ?? undefined,
      expectedDelivery: form.expectedDelivery || undefined,
      priority: form.priority,
      source: form.source,
      branchId: form.branchId,
      whatsappSourceId: form.whatsappSourceId || undefined,
      design: {
        designNumber: designNum,
        customerCode: form.design.customerCode || undefined,
        pattern: form.design.pattern || undefined,
        notes: form.design.notes || undefined,
        saveToCatalog: form.design.saveToCatalog,
      },
      item: {
        itemName: form.item.itemName.trim(),
        category: form.item.category,
        quantity: Math.max(1, Number(form.item.quantity) || 1),
        size: form.item.size || undefined,
        metal: form.item.metal,
        metalColor: form.item.metalColor,
        purity: calc.purity,
        grossMg: calc.grossMg,
        addMg: calc.addMg || undefined,
        lessMg: calc.lessMg,
        netMg: calc.netMg,
        fineMg: calc.calculatedGoldMg,
        expectedWastagePct: Number(form.item.expectedWastagePct) || 0,
        expectedWastageMg: calc.wastageMg,
        stamp: form.item.stamp || undefined,
        labourRupees: form.item.labourRupees ? Number(form.item.labourRupees) : undefined,
        amountRupees: form.item.amountRupees ? Number(form.item.amountRupees) : undefined,
        stoneDetails: form.item.stoneDetails || undefined,
        remarks: form.item.remarks || undefined,
      },
      advance: { ...advance, goldLedgerEntryId: ledgerEntryId },
      timeline: [
        { ts: Date.now(), label: confirm ? "Order confirmed" : "Draft saved" },
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

    // Save reference to Catalog if requested
    if (confirm && form.design.saveToCatalog) {
      try {
        addDesign({
          designNumber: designNum,
          designName:
            form.design.pattern?.trim() || form.item.itemName.trim() || `Order ${order.orderNo}`,
          category: form.item.category || "Other",
          purity: calc.purity,
          approxGrossMg: calc.grossMg,
          approxNetMg: calc.netMg,
          difficulty: "medium",
          tags: form.design.pattern ? [form.design.pattern] : [],
          source: "saved_from_order",
          customerId: form.customerId ?? undefined,
          orderId: order.id,
          notes: form.design.notes,
        });
      } catch {
        toast.error("Order saved, but design could not be added to catalog.");
      }
    }

    clearDraftId();
    clearStep();
    clearForm();

    navigate({ to: "/orders/$id", params: { id: order.id } });
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title={t("orders.createOrder")}
        subtitle={t("orders.createOrderSubtitle")}
        actions={
          <Link to="/orders">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> {t("orders.backToOrders")}
            </Button>
          </Link>
        }
      />

      {/* Stepper */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <li
                key={s.n}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                  active
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : done
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-border text-muted-foreground"
                }`}
              >
                <span
                  className={`h-5 w-5 grid place-items-center rounded-full text-[10px] ${
                    done ? "bg-emerald-500/30" : active ? "bg-gold/30" : "bg-muted"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" /> : s.n}
                </span>
                {t("orders.step_" + s.n)}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Body */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 min-h-[420px]">
          {step === 1 && <Step1 form={form} setForm={setForm} />}
          {step === 2 && (
            <Step2
              form={form}
              setForm={setForm}
              people={people}
              onQuickAdd={(t) => setQuickAdd({ type: t })}
            />
          )}
          {step === 3 && (
            <Step3
              form={form}
              setForm={setForm}
              draftId={draftId}
              onPickCatalog={() => setPickCatalog(true)}
            />
          )}
          {step === 4 && <Step4 form={form} setForm={setForm} calc={calc} />}
          {step === 5 && <Step5 form={form} setForm={setForm} calc={calc} />}
          {step === 6 && (
            <Step6
              form={form}
              setForm={setForm}
              people={people}
              selectedKarigar={selectedKarigar}
            />
          )}
          {step === 7 && (
            <Step7
              form={form}
              calc={calc}
              customer={selectedCustomer}
              karigar={selectedKarigar}
              onSaveDraft={() => submit(false)}
              onConfirm={() => submit(true)}
            />
          )}
        </div>

        <aside className="space-y-4">
          <SummaryCard
            form={form}
            calc={calc}
            customer={selectedCustomer}
            karigar={selectedKarigar}
          />
        </aside>
      </div>

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={goBack} disabled={step === 1} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {(step > 1 || form.orderType !== null || form.customerId !== null) && (
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm("Are you sure you want to discard this order draft?")) {
                  clearDraftId();
                  clearStep();
                  clearForm();
                  setStep(1);
                }
              }}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 gap-1.5 text-xs h-9"
            >
              Discard Draft
            </Button>
          )}
        </div>
        {step < 7 ? (
          <Button data-testid="order-next" onClick={goNext} disabled={!canNext} className="gap-2">
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              data-testid="order-save-draft"
              variant="outline"
              onClick={() => submit(false)}
              disabled={submitting}
              className="gap-2"
            >
              <Save className="h-4 w-4" /> {submitting ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              data-testid="order-confirm"
              onClick={() => submit(true)}
              disabled={submitting}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> {submitting ? "Confirming…" : "Confirm Order"}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={storageNotice} onOpenChange={setStorageNotice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Photo / file upload</DialogTitle>
            <DialogDescription>
              File upload storage will be enabled in a future version. For the pilot, attach
              physical files (photo, design sheet, customer reference) to the corresponding paper
              register and note the order number.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setStorageNotice(false)}>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddDialog
        open={!!quickAdd}
        type={quickAdd?.type ?? "customer"}
        onClose={() => setQuickAdd(null)}
        onSaved={(p) => {
          setForm((f) => ({ ...f, customerId: p.id }));
          setQuickAdd(null);
        }}
        addPerson={addPerson as any}
      />

      <CatalogPickerDialog
        open={pickCatalog}
        designs={designs}
        onClose={() => setPickCatalog(false)}
        onPick={(d) => {
          setForm((f) => ({
            ...f,
            design: {
              ...f.design,
              designNumber: d.designNumber,
              pattern: d.designName,
              notes: d.notes ?? f.design.notes,
            },
            item: {
              ...f.item,
              itemName: f.item.itemName || d.designName,
              category: f.item.category || d.category,
              purity: String(d.purity),
              grossG: f.item.grossG || (d.approxGrossMg ? (d.approxGrossMg / 1000).toFixed(3) : ""),
            },
          }));
          setPickCatalog(false);
        }}
      />
    </div>
  );
}

/* ───────────── STEPS ───────────── */

function Step1({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const branches = useSettings((s) => s.branches);

  const actionLabels: Record<OrderType, string> = {
    custom: "Start Custom Manufacturing Order",
    repair: "Start Repair Order",
    polishing: "Start Polishing Order",
    ready_stock: "Start Ready Stock Sale",
    wholesale: "Start Wholesale/Bulk Order",
  };

  return (
    <div>
      <h2 className="font-serif text-2xl text-gold mb-1">Choose order type</h2>
      <p className="text-sm text-muted-foreground mb-6">Pick what kind of order you are taking.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {ORDER_TYPE_CARDS.map((c) => {
          const Icon = c.icon;
          const active = form.orderType === c.type;
          return (
            <button
              key={c.type}
              type="button"
              data-testid={`order-type-${c.type}`}
              onClick={() => setForm((f) => ({ ...f, orderType: c.type }))}
              className={`text-left rounded-xl border p-4 transition-all flex flex-col justify-between h-auto min-h-[140px] ${
                active
                  ? "border-gold bg-gold/10 shadow-[0_0_12px_rgba(200,162,75,0.15)] scale-[1.01]"
                  : "border-border bg-background/40 hover:border-gold/40 hover:bg-background/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`h-10 w-10 rounded-lg grid place-items-center ${active ? "bg-gold/20" : "bg-muted"}`}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-gold" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm sm:text-base">
                    {ORDER_TYPE_LABELS[c.type]}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.desc}</p>
                </div>
              </div>
              <div className="mt-4">
                <span
                  className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded px-2.5 py-1 ${active ? "bg-gold text-neutral-900" : "bg-muted text-muted-foreground hover:text-gold"}`}
                >
                  {actionLabels[c.type]}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 border-t border-border pt-6" id="wizard-branch-selector">
        <h3 className="font-serif text-lg text-gold mb-2">Order Branch</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select which branch should register this order.
        </p>
        <div className="max-w-xs">
          <Select
            value={form.branchId}
            onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function Step2({
  form,
  setForm,
  people,
  onQuickAdd,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  people: Person[];
  onQuickAdd: (t: PersonType) => void;
}) {
  const [query, setQuery] = useState("");
  const customers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = people.filter((p) => p.type === "customer" || p.type === "firm_customer");
    if (!q) return base;
    return base.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.gstin ?? "").toLowerCase().includes(q),
    );
  }, [people, query]);

  const selected = people.find((p) => p.id === form.customerId) ?? null;

  return (
    <div>
      <h2 className="font-serif text-2xl text-gold mb-1">Customer</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Search an existing customer or add a new one.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or GSTIN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => onQuickAdd("customer")}
        >
          <Plus className="h-3 w-3" /> Quick add customer
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => onQuickAdd("firm_customer")}
        >
          <Plus className="h-3 w-3" /> Quick add firm
        </Button>
      </div>

      {selected && (
        <SelectedPersonCard
          person={selected}
          kind="customer"
          onClear={() => setForm((f) => ({ ...f, customerId: null }))}
        />
      )}

      <div className="mt-4 grid gap-2 max-h-80 overflow-y-auto">
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
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left ${
                form.customerId === p.id
                  ? "border-gold/60 bg-gold/10"
                  : "border-border bg-background/40 hover:border-gold/40"
              }`}
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
                  {p.villageCity ? <span>· {p.villageCity}</span> : null}
                </div>
              </div>
              {form.customerId === p.id && <CheckCircle2 className="h-4 w-4 text-gold" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Step3({
  form,
  setForm,
  draftId,
  onPickCatalog,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  draftId: string;
  onPickCatalog: () => void;
}) {
  const d = form.design;
  const set = (patch: Partial<FormState["design"]>) =>
    setForm((f) => ({ ...f, design: { ...f.design, ...patch } }));
  return (
    <div>
      <h2 className="font-serif text-2xl text-gold mb-1">Design / Reference</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Capture design info & attach drawing references below.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <AttachmentButton
          entityType="order"
          entityId={draftId}
          docKey="design_photo"
          docLabel="Design photo"
          title="Upload Design Photo"
          variant="outline"
        />
        <AttachmentButton
          entityType="order"
          entityId={draftId}
          docKey="customer_reference"
          docLabel="Customer reference"
          title="Attach Customer Reference"
          variant="outline"
        />
        <Button variant="outline" type="button" className="gap-2" onClick={onPickCatalog}>
          <Sparkles className="h-4 w-4" /> Select from Catalog
        </Button>
        <AttachmentButton
          entityType="order"
          entityId={draftId}
          docKey="tech_drawing"
          docLabel="Technical drawing"
          title="Upload Technical Drawing"
          variant="outline"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Design number (Read-only)">
          <Input
            value={d.designNumber || "[ Auto-Sequence DSG-... ]"}
            readOnly
            className="bg-muted text-muted-foreground font-mono"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {d.designNumber
              ? "Pre-filled from Selected Catalog Design"
              : "Auto-generated from system sequence"}
          </p>
        </Field>
        <Field label="Customer design code">
          <Input
            value={d.customerCode}
            onChange={(e) => set({ customerCode: e.target.value })}
            placeholder="Customer's own reference"
          />
        </Field>
        <Field label="Item pattern">
          <Input
            value={d.pattern}
            onChange={(e) => set({ pattern: e.target.value })}
            placeholder="Antique, Filigree, Plain…"
          />
        </Field>
        <div className="flex items-center gap-3 mt-6">
          <Switch checked={d.saveToCatalog} onCheckedChange={(v) => set({ saveToCatalog: v })} />
          <Label>Save this design to the catalog after order</Label>
        </div>
        <div className="sm:col-span-2">
          <Field label="Design notes">
            <Textarea
              rows={3}
              value={d.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Stone setting, finishing, customer preferences…"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step4({
  form,
  setForm,
  calc,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  calc: ReturnType<typeof useCalcType>;
}) {
  const it = form.item;
  const set = (patch: Partial<FormState["item"]>) =>
    setForm((f) => ({ ...f, item: { ...f.item, ...patch } }));
  const [isCustomCategory, setIsCustomCategory] = useState(
    !ITEM_CATEGORIES.includes(it.category) && it.category !== "",
  );
  return (
    <div>
      <h2 className="font-serif text-2xl text-gold mb-1">Item &amp; Gold</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Enter the piece details. Net and Fine gold are calculated.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Item name *">
          <Input
            data-testid="order-item-name"
            value={it.itemName}
            onChange={(e) => set({ itemName: e.target.value })}
            placeholder="e.g. Gold Ring"
          />
        </Field>
        <Field label="Category *">
          <Select
            value={isCustomCategory ? "Custom" : it.category}
            onValueChange={(v) => {
              if (v === "Custom") {
                setIsCustomCategory(true);
                set({ category: "" });
              } else {
                setIsCustomCategory(false);
                set({ category: v });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose…" />
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
              value={it.category}
              onChange={(e) => set({ category: e.target.value })}
            />
          )}
        </Field>
        <Field label="Quantity / pieces">
          <Input
            type="number"
            min={1}
            value={it.quantity}
            onChange={(e) => set({ quantity: e.target.value })}
          />
        </Field>
        <Field label="Size / finger size">
          <Input
            value={it.size}
            onChange={(e) => set({ size: e.target.value })}
            placeholder="e.g. 14"
          />
        </Field>
        <Field label="Metal">
          <Select value={it.metal} onValueChange={(v) => set({ metal: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METALS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Metal colour">
          <Select value={it.metalColor} onValueChange={(v) => set({ metalColor: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METAL_COLORS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Purity / touch (per-mille)">
          <div className="flex gap-2">
            <Select value={it.purity} onValueChange={(v) => set({ purity: v })}>
              <SelectTrigger data-testid="order-purity" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PURITIES.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-24"
              value={it.purity === "custom" ? "" : it.purity}
              onChange={(e) => set({ purity: e.target.value })}
              placeholder="e.g. 920"
            />
          </div>
        </Field>
        <div />

        <Field label="Stamp (Brand/Purity stamp)">
          <Input
            value={it.stamp || ""}
            onChange={(e) => set({ stamp: e.target.value })}
            placeholder="e.g. 916 HUID, MTJ"
          />
        </Field>
        <div />

        <Field label="Gross Weight (grams) *">
          <Input
            data-testid="order-gross-weight"
            value={it.grossG}
            onChange={(e) => set({ grossG: e.target.value })}
            placeholder="10.000"
          />
        </Field>
        <Field label="Add Weight (grams)">
          <Input
            value={it.addG || ""}
            onChange={(e) => set({ addG: e.target.value })}
            placeholder="0.000"
          />
        </Field>
        <Field label="Less Weight (grams)">
          <Input
            value={it.lessG}
            onChange={(e) => set({ lessG: e.target.value })}
            placeholder="0.000"
          />
        </Field>
        <div className="sm:col-span-2 border border-dashed border-amber-500/30 rounded-xl p-3 bg-amber-500/5 my-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-500">
                Manual Override Weights &amp; Calculations
              </div>
              <div className="text-xs text-muted-foreground">
                Directly override net weight, fine gold, and wastage values manually.
              </div>
            </div>
            <Switch
              checked={!!it.isManualOverride}
              onCheckedChange={(v) => set({ isManualOverride: v })}
              id="isManualOverride-switch"
              data-lpignore="true"
              data-autofill="false"
            />
          </div>
        </div>

        <Field label="Net Weight (grams)">
          {it.isManualOverride ? (
            <Input
              value={it.customNetG ?? ""}
              onChange={(e) => set({ customNetG: e.target.value })}
              placeholder={mgToGrams(
                Math.max(0, safeMg(it.grossG) + safeMg(it.addG) - safeMg(it.lessG)),
              )}
              className="bg-amber-500/5 border-amber-500/30 font-mono font-semibold"
            />
          ) : (
            <Input
              value={mgToGrams(calc.netMg)}
              readOnly
              className="bg-muted/40 font-mono font-semibold"
            />
          )}
        </Field>

        <Field label="Fine Gold (grams)">
          {it.isManualOverride ? (
            <Input
              value={it.customFineG ?? ""}
              onChange={(e) => set({ customFineG: e.target.value })}
              placeholder={mgToGrams(fineGoldMg(calc.netMg, safePurity(it.purity)))}
              className="bg-amber-500/5 border-amber-500/30 font-mono text-amber-500 font-semibold"
            />
          ) : (
            <Input
              value={mgToGrams(calc.fineMg)}
              readOnly
              className="bg-muted/30 font-mono text-amber-500 font-semibold"
            />
          )}
        </Field>
        <Field label="Wastage Charged to Customer (%)">
          <Input
            data-testid="order-wastage-charged"
            value={it.expectedWastagePct}
            onChange={(e) => set({ expectedWastagePct: e.target.value })}
            placeholder="e.g. 8"
          />
        </Field>
        <Field label="Wastage Gold (grams)">
          {it.isManualOverride ? (
            <Input
              value={it.customWastageG ?? ""}
              onChange={(e) => set({ customWastageG: e.target.value })}
              placeholder={mgToGrams(
                Math.round((calc.netMg * (Number(it.expectedWastagePct) || 0)) / 100),
              )}
              className="bg-amber-500/5 border-amber-500/30 font-mono"
            />
          ) : (
            <Input value={mgToGrams(calc.wastageMg)} readOnly className="bg-muted/30 font-mono" />
          )}
        </Field>
        <Field label="Total Order Fine Gold (grams)">
          <div className="relative">
            {it.isManualOverride ? (
              <Input
                value={it.customCalculatedGoldG ?? ""}
                onChange={(e) => set({ customCalculatedGoldG: e.target.value })}
                placeholder={mgToGrams(
                  calc.fineMg +
                    (useSettings.getState().print?.voucherCalculationMode === "fine_wastage"
                      ? calc.wastageMg
                      : 0),
                )}
                className="bg-amber-500/5 border-amber-500/30 font-mono font-bold text-amber-500"
              />
            ) : (
              <Input
                value={mgToGrams(calc.calculatedGoldMg)}
                readOnly
                className="bg-gold/10 font-mono font-bold text-gold border-gold/40"
              />
            )}
            <span className="absolute right-2 top-1.5 text-[9px] px-1.5 py-0.5 rounded bg-gold/20 text-gold font-bold uppercase tracking-wide">
              {it.isManualOverride
                ? "Custom Override"
                : useSettings.getState().print?.voucherCalculationMode === "fine_wastage"
                  ? "Fine + Wstg"
                  : "Fine Only"}
            </span>
          </div>
        </Field>

        <Field label="Labour / Making Charges (Rs.)">
          <Input
            type="number"
            value={it.labourRupees || ""}
            onChange={(e) => set({ labourRupees: e.target.value })}
            placeholder="e.g. 450"
          />
        </Field>
        <Field label="Voucher Amount (Rs. - optional)">
          <Input
            type="number"
            value={it.amountRupees || ""}
            onChange={(e) => set({ amountRupees: e.target.value })}
            placeholder="e.g. 62000"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Stone type / details (optional)">
            <Input
              value={it.stoneDetails}
              onChange={(e) => set({ stoneDetails: e.target.value })}
              placeholder="e.g. 4 polki pieces customer-supplied"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Remarks">
            <Textarea
              rows={2}
              value={it.remarks}
              onChange={(e) => set({ remarks: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step5({
  form,
  setForm,
  calc,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  calc: ReturnType<typeof useCalcType>;
}) {
  const a = form.advance;
  const set = (patch: Partial<FormState["advance"]>) =>
    setForm((f) => ({ ...f, advance: { ...f.advance, ...patch } }));
  return (
    <div>
      <h2 className="font-serif text-2xl text-gold mb-1">Advance &amp; Customer Gold</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Optional. Record cash advance, gold advance, or old gold received.
      </p>

      <div className="rounded-xl border border-border bg-background/40 p-4 mb-4">
        <h3 className="font-medium mb-3">Cash advance</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Amount (₹)">
            <Input
              value={a.cashRupees}
              onChange={(e) => set({ cashRupees: e.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="Payment mode">
            <Select
              value={a.cashMode || undefined}
              onValueChange={(v) => set({ cashMode: v as typeof a.cashMode })}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reference / note">
            <Input
              value={a.cashRef}
              onChange={(e) => set({ cashRef: e.target.value })}
              placeholder="UPI ref, receipt #"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/40 p-4">
        <h3 className="font-medium mb-3">Gold received from customer</h3>
        <div className="flex gap-2 mb-3">
          {(
            [
              { v: "", label: "None" },
              { v: "advance", label: "Gold advance (pure)" },
              { v: "old_gold", label: "Old gold / jewellery" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => set({ goldKind: o.v as typeof a.goldKind })}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                a.goldKind === o.v
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-border bg-background hover:border-gold/40"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {a.goldKind && (
          <>
            <div className="grid sm:grid-cols-4 gap-3">
              <Field label="Gross weight (g)">
                <Input
                  value={a.goldGrossG}
                  onChange={(e) => set({ goldGrossG: e.target.value })}
                  placeholder="3.000"
                />
              </Field>
              <Field label="Purity / touch">
                <Select value={a.goldPurity} onValueChange={(v) => set({ goldPurity: v })}>
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
              <Field label="Fine gold (g)">
                <Input
                  value={mgToGrams(calc.advFineMg)}
                  readOnly
                  className="bg-muted/30 font-mono text-gold"
                />
              </Field>
              <Field label="Gold rate (₹/g, optional)">
                <Input
                  value={a.goldRate}
                  onChange={(e) => set({ goldRate: e.target.value })}
                  placeholder="e.g. 7200"
                />
              </Field>
            </div>

            <div className="mt-3 flex gap-2">
              {(["apply", "credit"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ goldApplyMode: m })}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    a.goldApplyMode === m
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-border bg-background hover:border-gold/40"
                  }`}
                >
                  {m === "apply" ? "Apply to this order" : "Keep as customer gold credit"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {a.goldApplyMode === "apply"
                ? "Fine gold will move into the shop vault on confirm."
                : "Fine gold will sit in the customer bucket and remain credit for the customer."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Step6({
  form,
  setForm,
  people,
  selectedKarigar,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  people: Person[];
  selectedKarigar: Person | null;
}) {
  const karigars = people.filter(
    (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
  );
  return (
    <div>
      <h2 className="font-serif text-2xl text-gold mb-1">Assignment</h2>
      <p className="text-sm text-muted-foreground mb-6">Optional. Assign now or leave for later.</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Field label="Karigar / Worker">
          <Select
            value={form.karigarId ?? "none"}
            onValueChange={(v) => setForm((f) => ({ ...f, karigarId: v === "none" ? null : v }))}
          >
            <SelectTrigger data-testid="order-karigar-select">
              <SelectValue placeholder="Skip — assign later" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Skip — assign later</SelectItem>
              {karigars.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.fullName} · {PERSON_TYPE_LABELS[p.type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Expected delivery date">
          <Input
            type="date"
            value={form.expectedDelivery}
            onChange={(e) => setForm((f) => ({ ...f, expectedDelivery: e.target.value }))}
            className={
              form.expectedDelivery &&
              form.expectedDelivery < new Date().toISOString().split("T")[0]
                ? "border-red-500 focus-visible:ring-red-500 text-red-500"
                : ""
            }
          />
          {form.expectedDelivery &&
            form.expectedDelivery < new Date().toISOString().split("T")[0] && (
              <p className="text-xs text-red-500 mt-1 font-medium">
                Expected delivery date cannot be in the past.
              </p>
            )}
        </Field>
        <Field label="Priority">
          <Select
            value={form.priority}
            onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Order source">
          <Select
            value={form.source}
            onValueChange={(v) => setForm((f) => ({ ...f, source: v as OrderSource }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walk_in">{ORDER_SOURCE_LABELS.walk_in}</SelectItem>
              <SelectItem value="phone">{ORDER_SOURCE_LABELS.phone}</SelectItem>
              <SelectItem value="manual">{ORDER_SOURCE_LABELS.manual}</SelectItem>
              <SelectItem value="whatsapp" disabled>
                {ORDER_SOURCE_LABELS.whatsapp} (future)
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {form.source === "whatsapp" && (
          <Field label="WhatsApp source ID (future)">
            <Input
              value={form.whatsappSourceId}
              onChange={(e) => setForm((f) => ({ ...f, whatsappSourceId: e.target.value }))}
              placeholder="Set automatically by WhatsApp Ingestion phase"
            />
          </Field>
        )}
        <Field label="Process route / template">
          <Input value="" placeholder="Comes in workshop phase" disabled />
        </Field>
      </div>

      {selectedKarigar && (
        <SelectedPersonCard
          person={selectedKarigar}
          kind="karigar"
          onClear={() => setForm((f) => ({ ...f, karigarId: null }))}
        />
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Job Card creation happens in the next phase. From the order detail, you'll see "Create Job
        Card" as the next action.
      </p>
    </div>
  );
}

function Step7({
  form,
  calc,
  customer,
  karigar,
  onSaveDraft,
  onConfirm,
}: {
  form: FormState;
  calc: ReturnType<typeof useCalcType>;
  customer: Person | null;
  karigar: Person | null;
  onSaveDraft: () => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-gold mb-1">Confirm</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Review everything. Save as draft or confirm the order.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <Row k="Order type" v={form.orderType ? ORDER_TYPE_LABELS[form.orderType] : "—"} />
        <Row k="Priority" v={form.priority} />
        <Row k="Customer" v={customer?.fullName ?? "—"} />
        <Row k="Customer phone" v={customer?.phone ?? "—"} />
        <Row k="Design number" v={form.design.designNumber || "—"} />
        <Row k="Pattern" v={form.design.pattern || "—"} />
        <Row k="Item" v={form.item.itemName} />
        <Row k="Category" v={form.item.category || "—"} />
        <Row k="Purity" v={`${calc.purity}`} />
        <Row
          k="Target Weight / Net Gold / Fine Gold"
          v={`${mgToGrams(calc.grossMg)} g / ${mgToGrams(calc.netMg)} g / ${mgToGrams(calc.fineMg)} g`}
          highlight
        />
        <Row
          k="Wastage Charged to Customer"
          v={`${form.item.expectedWastagePct || 0}% (${mgToGrams(calc.wastageMg)} g)`}
        />
        <Row
          k="Cash advance"
          v={
            form.advance.cashRupees
              ? `₹ ${paiseToRupees(rupeesToPaise(form.advance.cashRupees))} (${form.advance.cashMode || "—"})`
              : "—"
          }
        />
        <Row
          k="Gold received"
          v={
            form.advance.goldKind
              ? `${mgToGrams(calc.advGrossMg)} g @ ${calc.advPurity} (fine ${mgToGrams(calc.advFineMg)} g) · ${form.advance.goldApplyMode === "apply" ? "Apply to order" : "Customer credit"}`
              : "—"
          }
        />
        <Row k="Assigned karigar" v={karigar?.fullName ?? "Skip / later"} />
        <Row k="Expected delivery" v={form.expectedDelivery || "—"} />
        <Row k="Source" v={ORDER_SOURCE_LABELS[form.source]} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onSaveDraft} className="gap-2">
          <Save className="h-4 w-4" /> Save Draft
        </Button>
        <Button onClick={onConfirm} className="gap-2">
          <CheckCircle2 className="h-4 w-4" /> Confirm Order
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        On confirm, the order will appear in the Orders list and (if gold was received) the Gold
        Ledger will be updated.
      </p>
    </div>
  );
}

/* ───────────── helpers ───────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-border bg-background/40 px-3 py-2 ${highlight ? "border-gold/40 bg-gold/5" : ""}`}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`text-sm ${highlight ? "text-gold font-mono" : ""}`}>{v}</div>
    </div>
  );
}

function SelectedPersonCard({
  person,
  kind,
  onClear,
}: {
  person: Person;
  kind: "customer" | "karigar";
  onClear: () => void;
}) {
  const invoices = useBilling((s) => s.invoices);
  const orders = useOrders((s) => s.orders);

  const ledgerResult = useMemo(() => {
    return customerLedger(person.id, invoices);
  }, [person.id, invoices]);

  const openOrders = useMemo(() => {
    return orders.filter(
      (o) => o.customerId === person.id && o.status !== "billed" && o.status !== "cancelled",
    );
  }, [person.id, orders]);

  const pendingCashAdvanceRupees = useMemo(() => {
    const paise = openOrders.reduce((sum, o) => sum + (o.advance?.cashPaise ?? 0), 0);
    return paise / 100;
  }, [openOrders]);

  const pendingGoldAdvanceGrams = useMemo(() => {
    const mg = openOrders.reduce((sum, o) => sum + (o.advance?.goldGrossMg ?? 0), 0);
    return mg / 1000;
  }, [openOrders]);

  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
      <div className="flex items-start justify-between gap-3">
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
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {person.phone}
              </span>
              {person.villageCity && <span>· {person.villageCity}</span>}
              {person.gstin && <span>· GSTIN {person.gstin}</span>}
              {kind === "karigar" && person.workType && <span>· {person.workType}</span>}
            </div>
            {person.currentAddress && (
              <div className="text-xs text-muted-foreground mt-1">{person.currentAddress}</div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {kind === "customer" ? (
                <>
                  <Badge
                    variant="outline"
                    className="border-gold/30 text-stone-900 bg-amber-50 dark:text-stone-100 dark:bg-stone-900"
                  >
                    Total Advances: ₹{" "}
                    {pendingCashAdvanceRupees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}{" "}
                    &amp; {pendingGoldAdvanceGrams.toFixed(3)}g Gold
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`border-gold/30 font-semibold ${ledgerResult.outstanding > 0 ? "text-destructive" : "text-emerald-600"}`}
                  >
                    Outstanding: ₹{" "}
                    {(ledgerResult.outstanding / 100).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </Badge>
                </>
              ) : (
                <Badge variant="outline" className="border-gold/30 text-muted-foreground">
                  Current gold custody: 0.000 g (live in later phase)
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <Link to="/people" className="text-xs text-gold underline">
            View profile
          </Link>
          {kind === "customer" ? (
            <Link to="/ledger" className="text-xs text-muted-foreground hover:text-gold underline">
              View ledger
            </Link>
          ) : (
            <Link
              to="/attendance"
              className="text-xs text-muted-foreground hover:text-gold underline"
            >
              View passbook
            </Link>
          )}
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  form,
  calc,
  customer,
  karigar,
}: {
  form: FormState;
  calc: ReturnType<typeof useCalcType>;
  customer: Person | null;
  karigar: Person | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sticky top-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Live summary</div>
      <div className="mt-2 space-y-2 text-sm">
        <SummaryRow k="Type" v={form.orderType ? ORDER_TYPE_LABELS[form.orderType] : "—"} />
        <SummaryRow k="Customer" v={customer?.fullName ?? "—"} />
        <SummaryRow k="Item" v={form.item.itemName || "—"} />
        <SummaryRow k="Purity" v={form.item.purity || "—"} />
        <SummaryRow k="Net gold" v={`${mgToGrams(calc.netMg)} g`} />
        <SummaryRow k="Fine gold" v={`${mgToGrams(calc.fineMg)} g`} accent />
        <SummaryRow
          k="Cash adv"
          v={
            form.advance.cashRupees
              ? `₹ ${paiseToRupees(rupeesToPaise(form.advance.cashRupees))}`
              : "—"
          }
        />
        <SummaryRow
          k="Gold in"
          v={form.advance.goldKind ? `${mgToGrams(calc.advFineMg)} g fine` : "—"}
        />
        <SummaryRow k="Karigar" v={karigar?.fullName ?? "—"} />
        <SummaryRow k="Delivery" v={form.expectedDelivery || "—"} />
      </div>
    </div>
  );
}

function SummaryRow({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`text-right ${accent ? "text-gold font-mono" : ""}`}>{v}</span>
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
  ) => Person;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const isFirm = type === "firm_customer";

  function save() {
    if (!name.trim() || !phone.trim()) return;
    const p = addPerson({
      type,
      active: true,
      fullName: name.trim(),
      phone: phone.trim(),
      currentAddress: address.trim() || undefined,
      gstin: isFirm ? gstin.trim() || undefined : undefined,
    });
    onSaved(p);
    setName("");
    setPhone("");
    setAddress("");
    setGstin("");
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
          <Button onClick={save} disabled={!name.trim() || !phone.trim()}>
            Save &amp; Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* type helper for live calc */
function useCalcType() {
  return {
    grossMg: 0,
    addMg: 0,
    lessMg: 0,
    netMg: 0,
    purity: 0 as number,
    fineMg: 0,
    wastageMg: 0,
    calculatedGoldMg: 0,
    advGrossMg: 0,
    advPurity: 0 as number,
    advFineMg: 0,
  };
}

function safeMg(s: string): number {
  if (!s || !s.trim()) return 0;
  try {
    return gramsToMg(s);
  } catch {
    return 0;
  }
}
function safePurity(s: string): number {
  if (!s) return 0;
  try {
    return parsePurity(s);
  } catch {
    return 0;
  }
}

function CatalogPickerDialog({
  open,
  designs,
  onClose,
  onPick,
}: {
  open: boolean;
  designs: Design[];
  onClose: () => void;
  onPick: (d: Design) => void;
}) {
  const [q, setQ] = useState("");
  const list = designs.filter((d) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return [d.designNumber, d.designName, d.category, ...(d.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(t);
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">Select from Catalog</DialogTitle>
          <DialogDescription>Pick a design to fill the design and item fields.</DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalog…" />
        <div className="max-h-[420px] overflow-y-auto mt-3 space-y-2">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No designs in catalog yet. Add some from the Catalog page.
            </p>
          )}
          {list.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onPick(d)}
              className="w-full text-left rounded-lg border border-border p-3 hover:border-gold/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{d.designName}</span>
                <Badge variant="outline" className="text-[10px]">
                  {d.designNumber}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {d.category} · {d.purity} · approx {(d.approxGrossMg / 1000).toFixed(3)} g
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
