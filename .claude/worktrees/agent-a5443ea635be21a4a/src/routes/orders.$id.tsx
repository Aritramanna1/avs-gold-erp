import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { AttachmentsSection } from "@/components/attachments-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  useOrders,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  paiseToRupees,
  type OrderStatus,
  type Priority,
} from "@/lib/orders-store";
import {
  useJobCards,
  PROCESS_TEMPLATES,
  JOB_STATUS_LABELS,
  type ProcessTemplateKey,
} from "@/lib/jobcards-store";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { IssueGoldDialog } from "@/components/issue-gold-dialog";
import { ReceiveWorkDialog } from "@/components/receive-work-dialog";
import { EmailSendPanel } from "@/components/email-send-panel";
import { DocCommActions } from "@/components/doc-comm-actions";
import { CommLogCard } from "@/components/comm-log-card";
import { useLanguage } from "@/contexts/LanguageContext";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Eye,
  Hammer,
  PackageCheck,
  Printer,
  Receipt,
  ShoppingBag,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { PrintDialog } from "@/components/print-dialog";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({ meta: [{ title: "Order Detail · MTJ ERP" }] }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { t } = useLanguage();
  const { id } = useParams({ from: "/orders/$id" });
  const navigate = useNavigate();
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  const update = useOrders((s) => s.update);
  const remove = useOrders((s) => s.remove);
  const append = useOrders((s) => s.appendTimeline);
  const people = usePeople((s) => s.people);
  const jobs = useJobCards((s) => s.jobs);
  const addJob = useJobCards((s) => s.add);
  const removeJob = useJobCards((s) => s.remove);
  const [jobOpen, setJobOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  // Print Dialog States
  const [printOpen, setPrintOpen] = useState(false);
  const [printUrl, setPrintUrl] = useState("");
  const [printTitle, setPrintTitle] = useState("");

  if (!order) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <h1 className="font-serif text-2xl text-gold">{t("orders.orderNotFound")}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t("orders.orderNotFoundDesc")}</p>
        <Link to="/orders" className="text-gold underline mt-4 inline-block">
          {t("orders.backToOrders")}
        </Link>
      </div>
    );
  }

  function triggerPrint(url: string, titleName: string) {
    setPrintUrl(url);
    setPrintTitle(titleName);
    setPrintOpen(true);
  }

  const customer = people.find((p) => p.id === order.customerId);
  const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;
  const linkedJob = jobs.find((j) => j.orderId === order.id);

  const breadcrumb = [
    "Order",
    "Job Card",
    "Issue Gold",
    "Receive Work",
    "Stock",
    "Billing",
    "Daily Close",
  ];

  function setStatus(s: OrderStatus) {
    update(order!.id, { status: s });
    append(order!.id, { ts: Date.now(), label: `Status → ${ORDER_STATUS_LABELS[s]}` });
  }

  function del() {
    if (
      confirm(
        "Delete this order? This does not reverse the gold ledger entry — handle that from Ledger if needed.",
      )
    ) {
      if (linkedJob) removeJob(linkedJob.id);
      remove(order!.id);
      navigate({ to: "/orders" });
    }
  }

  return (
    <div data-testid="order-detail-root" className="p-4 md:p-8 max-w-6xl mx-auto">
      <PrintDialog
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        printUrl={printUrl}
        title={printTitle}
      />
      <PageHeader
        title={order.orderNo}
        subtitle={`${t("orders.type_" + order.type)} · created ${new Date(order.createdAt).toLocaleString("en-IN")}`}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Link to="/orders">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> {t("orders.allOrders")}
              </Button>
            </Link>
            <Button
              data-testid="order-print-slip"
              variant="outline"
              className="gap-2"
              onClick={() =>
                triggerPrint(
                  `/orders/print/slip/${order.id}`,
                  `Order Slip Preview · ${order.orderNo}`,
                )
              }
            >
              <Printer className="h-4 w-4" /> {t("orders.orderSlip")}
            </Button>
            {order.advance.goldGrossMg > 0 && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const kind =
                    order.advance.goldKind === "old_gold" ? "old-gold-receipt" : "gold-receipt";
                  triggerPrint(
                    `/orders/print/${kind}/${order.id}`,
                    `Gold Receipt Preview · ${order.orderNo}`,
                  );
                }}
              >
                <Printer className="h-4 w-4" />
                {order.advance.goldKind === "old_gold"
                  ? t("orders.oldGoldReceipt")
                  : t("orders.customerGoldReceipt")}
              </Button>
            )}
            {order.advance.cashPaise > 0 && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  triggerPrint(
                    `/orders/print/advance-receipt/${order.id}`,
                    `Cash Advance Receipt · ${order.orderNo}`,
                  )
                }
              >
                <Printer className="h-4 w-4" /> {t("orders.advanceReceipt")}
              </Button>
            )}
          </div>
        }
      />

      {/* Communication Actions */}
      <div className="mt-3 mb-5">
        <DocCommActions
          printA4Href={`/orders/print/slip/${order.id}` as any}
          whatsapp={{
            phone: customer?.phone,
            message: `Hello ${customer?.fullName ?? order.customerId},\nYour order ${order.orderNo} (${order.item}) is confirmed at ${useSettings.getState().firm.shopName}.\n\nExpected delivery: ${order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString("en-IN") : "TBD"}.\n\nThank you!`,
          }}
          linkedType="order"
          linkedId={order.id}
          recipientLabel={customer?.fullName ?? order.customerId}
        />
      </div>

      {/* Breadcrumb / next-action */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {breadcrumb.map((b, i) => (
            <div key={b} className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded ${i === 0 ? "bg-gold/15 text-gold border border-gold/30" : "text-muted-foreground"}`}
              >
                {b}
              </span>
              {i < breadcrumb.length - 1 && <span className="text-muted-foreground">›</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t("orders.statusPlaceholder")}:</span>
          <Select value={order.status} onValueChange={(v) => setStatus(v as OrderStatus)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {t("orders.status_" + s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider">
            {t("orders.priorityLabel")}: {t("orders.priority_" + order.priority)}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <Section title="Customer" icon={UserIcon}>
            {customer ? (
              <div>
                <div className="font-medium">{customer.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {customer.phone} {customer.villageCity ? `· ${customer.villageCity}` : ""}
                  {customer.gstin ? ` · GSTIN ${customer.gstin}` : ""}
                </div>
                {customer.currentAddress && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {customer.currentAddress}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Customer record removed.</div>
            )}
          </Section>

          {/* Item */}
          <Section title="Item & Gold" icon={ShoppingBag}>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <Kv k="Item" v={order.item.itemName} />
              <Kv k="Category" v={order.item.category} />
              <Kv k="Quantity" v={String(order.item.quantity)} />
              <Kv k="Size" v={order.item.size || "—"} />
              <Kv k="Metal" v={`${order.item.metal} · ${order.item.metalColor}`} />
              <Kv k="Purity" v={String(order.item.purity)} />
              <Kv k="Gross" v={`${mgToGrams(order.item.grossMg)} g`} />
              <Kv k="Less" v={`${mgToGrams(order.item.lessMg)} g`} />
              <Kv k="Net" v={`${mgToGrams(order.item.netMg)} g`} />
              <Kv k="Fine gold" v={`${mgToGrams(order.item.fineMg)} g`} accent />
              <Kv
                k="Expected wastage"
                v={`${order.item.expectedWastagePct}% (${mgToGrams(order.item.expectedWastageMg)} g)`}
              />
              {order.item.stoneDetails && <Kv k="Stone" v={order.item.stoneDetails} />}
            </div>
            {order.item.remarks && (
              <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
                {order.item.remarks}
              </p>
            )}
          </Section>

          {/* Design */}
          {(order.design.designNumber || order.design.pattern || order.design.notes) && (
            <Section title="Design / Reference">
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <Kv k="Design no" v={order.design.designNumber || "—"} />
                <Kv k="Customer code" v={order.design.customerCode || "—"} />
                <Kv k="Pattern" v={order.design.pattern || "—"} />
                <Kv k="Save to catalog" v={order.design.saveToCatalog ? "Yes" : "No"} />
              </div>
              {order.design.notes && (
                <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
                  {order.design.notes}
                </p>
              )}
            </Section>
          )}

          {/* Advance */}
          <Section title="Advance & Customer Gold">
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <Kv
                k="Cash advance"
                v={
                  order.advance.cashPaise > 0
                    ? `₹ ${paiseToRupees(order.advance.cashPaise)} (${order.advance.cashMode || "—"})`
                    : "—"
                }
              />
              <Kv k="Cash reference" v={order.advance.cashRef || "—"} />
              <Kv
                k="Gold received"
                v={
                  order.advance.goldGrossMg > 0
                    ? `${mgToGrams(order.advance.goldGrossMg)} g @ ${order.advance.goldPurity} (fine ${mgToGrams(order.advance.goldFineMg)} g)`
                    : "—"
                }
              />
              <Kv
                k="Applied"
                v={
                  order.advance.goldGrossMg > 0
                    ? order.advance.goldApplyMode === "apply"
                      ? "To this order (vault)"
                      : "Held as customer credit"
                    : "—"
                }
              />
              {order.advance.goldLedgerEntryId && (
                <Kv k="Ledger entry" v={order.advance.goldLedgerEntryId.slice(0, 8)} />
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          {/* Assignment */}
          <Section title="Assignment" icon={Hammer}>
            {karigar ? (
              <div>
                <div className="font-medium">{karigar.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {karigar.phone}
                  {karigar.workType ? ` · ${karigar.workType}` : ""}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Not assigned yet.</div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>
                Expected delivery:{" "}
                <span className="text-foreground">{order.expectedDelivery || "—"}</span>
              </span>
            </div>
          </Section>

          {/* Linked Job Card */}
          <Section title="Job Card" icon={Hammer}>
            {linkedJob ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-gold">{linkedJob.jobNo}</div>
                    <div className="text-xs text-muted-foreground">
                      {(linkedJob.templateKey && PROCESS_TEMPLATES[linkedJob.templateKey]?.name) ??
                        "Standard"}{" "}
                      · Status: {JOB_STATUS_LABELS[linkedJob.status]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current step:{" "}
                      {linkedJob.steps.find((s) => s.status === "in_progress")?.name ??
                        linkedJob.steps.find((s) => s.status === "pending")?.name ??
                        "All done"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to="/workshop/$id" params={{ id: linkedJob.id }}>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Eye className="h-3 w-3" /> View Job Card
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() =>
                      triggerPrint(
                        `/workshop/print/${linkedJob.id}`,
                        `Job Card Preview · ${linkedJob.jobNo}`,
                      )
                    }
                  >
                    <Printer className="h-3 w-3" /> Print Job Card
                  </Button>
                  {!linkedJob.workReceipt && (
                    <Button size="sm" className="gap-1" onClick={() => setIssueOpen(true)}>
                      <Hammer className="h-3 w-3" />{" "}
                      {linkedJob.goldIssue ? "Additional Issue" : "Issue Gold"}
                    </Button>
                  )}
                  {linkedJob.goldIssue && !linkedJob.workReceipt && (
                    <Button size="sm" className="gap-1" onClick={() => setReceiveOpen(true)}>
                      <PackageCheck className="h-3 w-3" /> Receive Work
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">No job card yet for this order.</p>
                <Button
                  data-testid="workshop-create-job-card"
                  className="mt-3 w-full gap-2"
                  onClick={() => setJobOpen(true)}
                >
                  <Hammer className="h-4 w-4" /> Create Job Card
                </Button>
              </div>
            )}
          </Section>

          {/* Next actions */}
          <Section title="Next actions">
            <div className="space-y-2 text-sm">
              {linkedJob && !linkedJob.workReceipt && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setIssueOpen(true)}
                >
                  <Hammer className="h-4 w-4" />{" "}
                  {linkedJob.goldIssue ? "Additional Gold Issue" : "Issue Gold to Karigar"}
                </Button>
              )}
              {linkedJob?.goldIssue && !linkedJob.workReceipt && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setReceiveOpen(true)}
                >
                  <PackageCheck className="h-4 w-4" /> Receive Work from Karigar
                </Button>
              )}
              <Link to="/billing/new" search={{ orderId: order.id }}>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Receipt className="h-4 w-4" /> Create Invoice
                </Button>
              </Link>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-3 text-red-400 hover:text-red-300 gap-2"
              onClick={del}
            >
              <Trash2 className="h-4 w-4" /> Delete order
            </Button>
          </Section>

          {/* Timeline */}
          <Section title="Timeline">
            <ol className="space-y-2 text-xs">
              {order.timeline.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="h-3 w-3 text-gold mt-0.5 shrink-0" />
                  <div>
                    <div>{e.label}</div>
                    <div className="text-muted-foreground">
                      {new Date(e.ts).toLocaleString("en-IN")}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <EmailSendPanel
          templateKinds={[
            "order_confirm",
            "order_ready",
            "payment_reminder",
            "delay_update",
            "custom",
          ]}
          recipients={[
            ...(customer?.email
              ? [{ label: customer.fullName, role: "Customer", email: customer.email }]
              : []),
            ...(karigar?.email
              ? [{ label: karigar.fullName, role: "Karigar", email: karigar.email }]
              : []),
          ]}
          context={{ orderId: order.id }}
          linkedType="order"
          linkedId={order.id}
        />
        <CommLogCard linkedType="order" linkedId={order.id} />
        <AttachmentsSection
          entityType="order"
          entityId={order.id}
          slots={[
            { key: "design_photo", label: "Design photo" },
            { key: "customer_reference", label: "Customer reference photo" },
            { key: "die_photo", label: "Die / dye photo" },
            { key: "stones_photo", label: "Stones photo" },
          ]}
        />
      </div>

      <CreateJobCardDialog
        open={jobOpen}
        onClose={() => setJobOpen(false)}
        order={order}
        karigarName={karigar?.fullName ?? null}
        onCreated={(jobId) => {
          update(order!.id, { status: "in_production" });
          append(order!.id, { ts: Date.now(), label: "Job Card created", note: jobId.slice(0, 8) });
          setJobOpen(false);
          navigate({ to: "/workshop/$id", params: { id: jobId } });
        }}
        addJob={addJob}
      />

      <IssueGoldDialog
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        job={linkedJob ?? null}
      />
      <ReceiveWorkDialog
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        job={linkedJob ?? null}
      />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-4 w-4 text-gold" />}
        <h3 className="font-serif text-lg text-gold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Kv({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`text-sm ${accent ? "text-gold font-mono" : ""}`}>{v}</div>
    </div>
  );
}

function CreateJobCardDialog({
  open,
  onClose,
  order,
  karigarName,
  onCreated,
  addJob,
}: {
  open: boolean;
  onClose: () => void;
  order: NonNullable<ReturnType<typeof useOrders.getState>["orders"][number]>;
  karigarName: string | null;
  onCreated: (jobId: string) => void;
  addJob: ReturnType<typeof useJobCards.getState>["add"];
}) {
  const people = usePeople((s) => s.people);
  const workshopTemplatesEnabled = useSettings((s) => s.workshopTemplatesEnabled);
  const karigars = people.filter(
    (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
  );

  const [karigarId, setKarigarId] = useState<string | null>(order.karigarId ?? null);
  const [templateKey, setTemplateKey] = useState<ProcessTemplateKey>(
    order.item.category === "Ring"
      ? "ring_basic"
      : order.type === "repair"
        ? "repair_basic"
        : "handmade_basic",
  );
  const [priority, setPriority] = useState<Priority>(order.priority);
  const [expectedStart, setExpectedStart] = useState("");
  const [expectedCompletion, setExpectedCompletion] = useState("");
  const [notes, setNotes] = useState(order.item.remarks ?? "");

  async function save() {
    const k = karigarId ? people.find((p) => p.id === karigarId) : null;
    const allocatedJobNo = await getNextSequenceNumber("jobcard");

    const job = await addJob({
      jobNo: allocatedJobNo,
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      customerName: people.find((p) => p.id === order.customerId)?.fullName ?? "—",
      karigarId: k?.id,
      karigarName: k?.fullName,
      itemName: order.item.itemName,
      category: order.item.category,
      purity: order.item.purity,
      targetGrossMg: order.item.grossMg,
      targetNetMg: order.item.netMg,
      targetFineMg: order.item.fineMg,
      templateKey,
      status: "ready_for_gold_issue",
      priority,
      expectedDelivery: order.expectedDelivery,
      expectedStart: expectedStart || undefined,
      expectedCompletion: expectedCompletion || undefined,
      notes: notes.trim() || undefined,
    });
    onCreated(job.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Job Card</DialogTitle>
          <DialogDescription>
            Auto-filled from order <span className="font-mono">{order.orderNo}</span>. Confirm
            karigar, process and dates.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Customer</Label>
            <Input
              value={people.find((p) => p.id === order.customerId)?.fullName ?? "—"}
              readOnly
              className="bg-muted/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Item</Label>
            <Input
              value={`${order.item.itemName} (${order.item.category})`}
              readOnly
              className="bg-muted/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Target gross / net / fine (g)</Label>
            <Input
              value={`${mgToGrams(order.item.grossMg)} / ${mgToGrams(order.item.netMg)} / ${mgToGrams(order.item.fineMg)}`}
              readOnly
              className="bg-muted/30 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Purity</Label>
            <Input value={String(order.item.purity)} readOnly className="bg-muted/30 font-mono" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Assigned karigar</Label>
            <Select
              value={karigarId ?? "none"}
              onValueChange={(v) => setKarigarId(v === "none" ? null : v)}
            >
              <SelectTrigger>
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
            {karigarName && !karigarId && (
              <p className="text-[11px] text-muted-foreground">
                Order had {karigarName} — keep or change above.
              </p>
            )}
          </div>

          {workshopTemplatesEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Process template</Label>
              <Select
                value={templateKey}
                onValueChange={(v) => setTemplateKey(v as ProcessTemplateKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PROCESS_TEMPLATES).map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Steps:{" "}
                {(
                  (templateKey && PROCESS_TEMPLATES[templateKey]?.steps) ||
                  PROCESS_TEMPLATES.handmade_basic.steps
                ).join(" · ")}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Expected start</Label>
            <Input
              type="date"
              value={expectedStart}
              onChange={(e) => setExpectedStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Expected completion</Label>
            <Input
              type="date"
              value={expectedCompletion}
              onChange={(e) => setExpectedCompletion(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Notes for karigar</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the karigar should know…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} className="gap-2">
            <Hammer className="h-4 w-4" /> Create Job Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
