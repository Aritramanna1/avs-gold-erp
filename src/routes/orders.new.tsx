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
import { usePeople, type Person, type PersonType, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useOrders, ITEM_CATEGORIES, ORDER_TYPE_LABELS, type OrderType } from "@/lib/orders-store";
import { useLedger } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { fineGoldMg, gramsToMg, parsePurity } from "@/lib/gold";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import { ArrowLeft, CheckCircle2, Phone, Plus, Save, Search } from "lucide-react";

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

interface FormState {
  orderType: OrderType | null;
  customerId: string | null;
  branchId: string;
  itemName: string;
  category: string;
  purity: string; // per-mille as string
  grossG: string;
  goldReceivedG: string;
  karigarId: string | null;
  expectedDelivery: string;
  remarks: string;
}

const EMPTY: FormState = {
  orderType: null,
  customerId: null,
  branchId: "MAIN",
  itemName: "",
  category: "",
  purity: "916",
  grossG: "",
  goldReceivedG: "",
  karigarId: null,
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
  const form = useMemo(() => ({ ...EMPTY, ...rawForm }), [rawForm]);

  const [quickAdd, setQuickAdd] = useState<null | { type: PersonType }>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedCustomer = people.find((p) => p.id === form.customerId) ?? null;
  const selectedKarigar = people.find((p) => p.id === form.karigarId) ?? null;

  const customers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const base = people.filter((p) => p.type === "customer" || p.type === "firm_customer");
    if (!q) return base.slice(0, 8);
    return base.filter((p) => p.fullName.toLowerCase().includes(q) || p.phone.includes(q));
  }, [people, customerQuery]);

  const karigars = people.filter(
    (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
  );

  const calc = useMemo(() => {
    const grossMg = safeMg(form.grossG);
    const purity = safePurity(form.purity);
    const fineMg = fineGoldMg(grossMg, purity);
    const goldReceivedMg = safeMg(form.goldReceivedG);
    const goldReceivedFineMg = fineGoldMg(goldReceivedMg, purity);
    return { grossMg, purity, fineMg, goldReceivedMg, goldReceivedFineMg };
  }, [form.grossG, form.purity, form.goldReceivedG]);

  const isPastDate =
    !!form.expectedDelivery && form.expectedDelivery < new Date().toISOString().split("T")[0];

  const canSubmit =
    !!form.orderType &&
    !!form.customerId &&
    form.itemName.trim().length > 0 &&
    form.category.length > 0 &&
    calc.grossMg > 0 &&
    calc.purity > 0 &&
    !isPastDate;

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
    if (!form.orderType || !form.customerId) return;

    let ledgerEntryId: string | undefined;
    if (calc.goldReceivedMg > 0) {
      const entry = await appendLedger({
        type: "old_gold_received",
        netFineMg: calc.goldReceivedFineMg,
        deltas: { vault: calc.goldReceivedFineMg },
        grossMg: calc.goldReceivedMg,
        purity: calc.purity,
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
      type: form.orderType,
      status: "awaiting_job_card",
      customerId: form.customerId,
      karigarId: form.karigarId ?? undefined,
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
      item: {
        itemName: form.itemName.trim(),
        category: form.category,
        quantity: 1,
        metal: "Gold",
        metalColor: "Yellow",
        purity: calc.purity,
        grossMg: calc.grossMg,
        lessMg: 0,
        netMg: calc.grossMg,
        fineMg: calc.fineMg,
        expectedWastagePct: 0,
        expectedWastageMg: 0,
        remarks: form.remarks || undefined,
      },
      advance: {
        cashPaise: 0,
        goldKind: calc.goldReceivedMg > 0 ? "old_gold" : undefined,
        goldGrossMg: calc.goldReceivedMg,
        goldPurity: calc.goldReceivedMg > 0 ? calc.purity : undefined,
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

    clearDraftId();
    clearForm();
    toast.success(`Order ${order.orderNo} created.`);
    navigate({ to: "/orders/$id", params: { id: order.id } });
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

        {/* Product */}
        <Section title="Product">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Product Type *">
              <Select
                value={form.orderType ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, orderType: v as OrderType }))}
              >
                <SelectTrigger data-testid="order-type-select">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ORDER_TYPE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category *">
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Product Description *">
            <Input
              value={form.itemName}
              onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
              placeholder="e.g. Bridal necklace with temple motif"
              autoFocus
            />
          </Field>
          <Field label="Reference Images / Attachments">
            <AttachmentButton
              entityType="order"
              entityId={draftId}
              docKey="reference_image"
              docLabel="Reference Images"
              title="Reference Images / Attachments"
            />
          </Field>
        </Section>

        {/* Gold */}
        <Section title="Gold">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Expected Weight (g) *">
              <Input
                value={form.grossG}
                onChange={(e) => setForm((f) => ({ ...f, grossG: e.target.value }))}
                placeholder="10.000"
                inputMode="decimal"
              />
            </Field>
            <Field label="Purity *">
              <Input
                value={form.purity}
                onChange={(e) => setForm((f) => ({ ...f, purity: e.target.value }))}
                placeholder="916"
                inputMode="numeric"
              />
            </Field>
          </div>
          {calc.grossMg > 0 && calc.purity > 0 && (
            <p className="text-xs text-muted-foreground">
              Fine gold equivalent: {(calc.fineMg / 1000).toFixed(3)} g
            </p>
          )}
          <Field label="Gold Received (g)">
            <Input
              value={form.goldReceivedG}
              onChange={(e) => setForm((f) => ({ ...f, goldReceivedG: e.target.value }))}
              placeholder="0.000 — leave blank if none received yet"
              inputMode="decimal"
            />
          </Field>
          {calc.goldReceivedMg > 0 && (
            <p className="text-xs text-muted-foreground">
              Fine gold received: {(calc.goldReceivedFineMg / 1000).toFixed(3)} g — posted to the
              gold ledger on save.
            </p>
          )}
        </Section>

        {/* Workshop */}
        <Section title="Workshop">
          <div className="grid sm:grid-cols-2 gap-4">
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
            <Field label="Assigned Worker (optional)">
              <Select
                value={form.karigarId ?? "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, karigarId: v === "none" ? null : v }))
                }
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
          </div>
          {selectedKarigar && (
            <p className="text-xs text-muted-foreground">
              Assigned to {selectedKarigar.fullName} ({PERSON_TYPE_LABELS[selectedKarigar.type]}).
            </p>
          )}
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

  async function save() {
    if (!name.trim() || !phone.trim()) return;
    const p = await addPerson({
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
            Save & Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
