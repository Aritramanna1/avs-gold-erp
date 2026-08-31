import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { AttachmentsSection } from "@/components/attachments-section";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  useOrders,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_FLOW,
  orderItems,
  orderTotals,
  productionTypeLabel,
  createJobCardForLine,
  paiseToRupees,
  type Order,
  type OrderStatus,
} from "@/lib/orders-store";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { useWorkerReturns, computeGoldPosition } from "@/lib/worker-return-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { WorkerReturnDialog } from "@/components/worker-return-dialog";
import { WorkerIssueDialog } from "@/components/worker-issue-dialog";
import {
  useOutsideWorkLabour,
  computeOutsideWorkCostForOrder,
} from "@/lib/outside-work-labour-store";
import { usePolishing } from "@/lib/polishing-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { SendToPolishingDialog } from "@/components/send-to-polishing-dialog";
import { ReceiveFromPolishingDialog } from "@/components/receive-from-polishing-dialog";
import { useManufacturingBarcodes } from "@/lib/manufacturing-barcode-store";
import { ManufacturingBarcodePanel } from "@/components/manufacturing-barcode-panel";
import { ReceiveWorkDialog } from "@/components/receive-work-dialog";
import { EmailSendPanel } from "@/components/email-send-panel";
import { DocCommActions } from "@/components/doc-comm-actions";
import { WhatsAppDocMenu } from "@/components/whatsapp-doc-menu";
import { orderConfirmationMessage } from "@/lib/order-messages";
import { CommLogCard } from "@/components/comm-log-card";
import { ReferenceNotesPanel } from "@/components/reference-notes/ReferenceNotesPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOrderById } from "@/lib/use-order";
import {
  ArrowLeft,
  BookOpen,
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
  ClipboardList,
  Sparkles,
  Loader2,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({ meta: [{ title: "Order Detail · AVS Gold ERP" }] }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { t } = useLanguage();
  const { id } = useParams({ from: "/orders/$id" });
  const navigate = useNavigate();
  const { order, loading, error, retry } = useOrderById(id);
  const update = useOrders((s) => s.update);
  const remove = useOrders((s) => s.remove);
  const append = useOrders((s) => s.appendTimeline);
  const people = usePeople((s) => s.people);
  const jobs = useJobCards((s) => s.jobs);
  const removeJob = useJobCards((s) => s.remove);
  // WHICH job card we're receiving work for — an order has one per item, so a
  // bare open/closed flag can't say which piece came back from the bench.
  const [receiveJobId, setReceiveJobId] = useState<string | null>(null);
  // The item we're creating a Job Card for — i.e. the piece we're about to
  // assign to a karigar.
  const [assignLine, setAssignLine] = useState<{
    lineId?: string;
    itemName: string;
  } | null>(null);
  const [workerReturnOpen, setWorkerReturnOpen] = useState(false);
  const [workerIssueOpen, setWorkerIssueOpen] = useState(false);
  const [sendPolishingOpen, setSendPolishingOpen] = useState(false);
  const [receivePolishingOpen, setReceivePolishingOpen] = useState(false);

  const refreshWorkerReturns = useWorkerReturns((s) => s.refresh);
  const allWorkerReturns = useWorkerReturns((s) => s.returns);
  const workerReturnHistory = useMemo(
    () => allWorkerReturns.filter((r) => r.orderId === order?.id),
    [allWorkerReturns, order?.id],
  );
  const refreshGoldBook = useWorkerGoldBook((s) => s.refresh);
  const allGoldBookEntries = useWorkerGoldBook((s) => s.entries);
  const workerIssueHistory = useMemo(
    () => allGoldBookEntries.filter((e) => e.orderId === order?.id && e.type === "given"),
    [allGoldBookEntries, order?.id],
  );
  const goldPosition = useMemo(
    () =>
      computeGoldPosition(
        workerIssueHistory.reduce((s, e) => s + e.fineMg, 0),
        workerReturnHistory,
      ),
    [workerIssueHistory, workerReturnHistory],
  );

  const refreshOutsideWorkLabour = useOutsideWorkLabour((s) => s.refresh);
  const allOutsideWorkCharges = useOutsideWorkLabour((s) => s.charges);
  const outsideWorkCostPaise = useMemo(
    () => computeOutsideWorkCostForOrder(allOutsideWorkCharges, order?.id ?? ""),
    [allOutsideWorkCharges, order?.id],
  );

  const refreshPolishing = usePolishing((s) => s.refresh);
  const allPolishingTransactions = usePolishing((s) => s.transactions);
  const polishingHistory = useMemo(
    () =>
      allPolishingTransactions.filter((t) => t.orderId === order?.id).sort((a, b) => b.ts - a.ts),
    [allPolishingTransactions, order?.id],
  );
  const isRuleEnabled = useBusinessRules((s) => s.isEnabled);
  const refreshBusinessRules = useBusinessRules((s) => s.refresh);
  const polishingModuleEnabled = isRuleEnabled("enable_polishing_module");
  const refreshManufacturingBarcodes = useManufacturingBarcodes((s) => s.refresh);

  useEffect(() => {
    void useWorkerReturns.getState().refresh();
    void useWorkerGoldBook.getState().refresh();
    void useOutsideWorkLabour.getState().refresh();
    void usePolishing.getState().refresh();
    void useBusinessRules.getState().refresh();
    void useManufacturingBarcodes.getState().refresh();
  }, [id]);

  if (loading && !order) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-3">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold" />
        <p className="text-sm text-muted-foreground">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-3">
        <h1 className="font-serif text-2xl text-gold">{t("orders.orderNotFound")}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {error || t("orders.orderNotFoundDesc")}
        </p>
        {error ? (
          <Button variant="outline" className="mt-2 text-xs gap-1.5" onClick={retry}>
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        ) : null}
        <div>
          <Link to="/orders" className="text-gold underline mt-4 inline-block">
            {t("orders.backToOrders")}
          </Link>
        </div>
      </div>
    );
  }

  const customer = people.find((p) => p.id === order.customerId);
  const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;
  // Every job card on this order — one per item, never merged.
  const orderJobs = jobs.filter((j) => j.orderId === order.id);
  const linkedJob = orderJobs[0];
  const receiveJob = orderJobs.find((j) => j.id === receiveJobId) ?? null;
  const items = orderItems(order);
  const totals = orderTotals(order);

  /** The Job Card for a given line, if one has been created. Cards written
   *  before line ids exist carry none, and cover the first line. */
  const jobForLine = (it: (typeof items)[number], index: number) =>
    it.lineId
      ? orderJobs.find((j) => j.lineId === it.lineId)
      : orderJobs.find((j) => !j.lineId && index === 0);

  // Dashboard Summary — display-only aggregation across every module this
  // order already touches. Never writes anything; purely reads issueHistory/
  // workerReturnHistory/goldPosition/timeline, which are each themselves
  // kept in sync by the dialogs that create issues/returns/status changes.
  // The karigars actually working this order come from its JOB CARDS — that is
  // where work is assigned now. `order.karigarId` is only ever set by legacy /
  // imported orders, so it's a fallback, not the source of truth. Several items
  // can be on several benches at once, so this can legitimately name more than one.
  const assignedNames = Array.from(
    new Set(orderJobs.map((j) => j.karigarName).filter((n): n is string => !!n)),
  );
  const currentWorkerName =
    assignedNames.length > 0 ? assignedNames.join(", ") : (karigar?.fullName ?? "Not assigned");
  const lastActivity = [...order.timeline].sort((a, b) => b.ts - a.ts)[0];

  const breadcrumb = ["Order", "Job Card", "Receive Work", "Stock", "Billing", "Daily Close"];

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
      // Every card, not just the first — otherwise deleting a 3-item order
      // leaves two orphaned job cards pointing at an order that no longer exists.
      orderJobs.forEach((j) => removeJob(j.id));
      remove(order!.id);
      navigate({ to: "/orders" });
    }
  }

  return (
    <div data-testid="order-detail-root" className="p-4 md:p-8 max-w-6xl mx-auto">
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
              onClick={() => navigate({ to: `/orders/print/slip/${order.id}` as any })}
            >
              <Printer className="h-4 w-4" /> {t("orders.orderSlip")}
            </Button>
            {/* Only for a single-item order. With several pieces there is no
                "the" job card — they're listed individually below, each with its
                own view/print, so a header button here would silently open one. */}
            <Link
              to="/workshop/job-card/$orderId"
              params={{ orderId: orderJobs[0]?.id ?? order.id }}
              className={orderJobs.length > 1 ? "hidden" : undefined}
            >
              <Button variant="outline" className="gap-2">
                <ClipboardList className="h-4 w-4" /> Job Card
              </Button>
            </Link>
            <Link
              to="/orders/print/$kind/$id"
              params={{ kind: "slip", id: order.id }}
            >
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Job Slip
              </Button>
            </Link>
            {order.advance.goldGrossMg > 0 && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const kind =
                    order.advance.goldKind === "old_gold" ? "old-gold-receipt" : "gold-receipt";
                  navigate({ to: `/orders/print/${kind}/${order.id}` as any });
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
                onClick={() => navigate({ to: `/orders/print/advance-receipt/${order.id}` as any })}
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
          shareDocument={{
            docType: "order_slip",
            recordId: order.id,
            title: `Order Slip · ${order.orderNo}`,
          }}
          emailDocument={{
            docType: "order_slip",
            recordId: order.id,
          }}
          whatsapp={{
            phone: customer?.phone,
            message: orderConfirmationMessage(order),
          }}
          linkedType="order"
          linkedId={order.id}
          recipientLabel={customer?.fullName ?? order.customerId}
        />
        {/* Send-with-PDF actions (Universal Print Engine → WasenderAPI). */}
        <div className="mt-2 flex flex-wrap gap-2">
          <WhatsAppDocMenu
            buttonLabel="Customer Docs"
            phone={customer?.phone}
            recipientName={customer?.fullName ?? "Customer"}
            linkedType="order"
            linkedId={order.id}
            items={[
              { label: "Order Slip", docType: "order_slip", recordId: order.id },
              ...(order.customerId
                ? [
                    {
                      label: "Ledger Statement",
                      docType: "customer_ledger_statement" as const,
                      recordId: order.customerId,
                    },
                  ]
                : []),
            ]}
          />
          <WhatsAppDocMenu
            buttonLabel="Carrier Docs"
            phone={customer?.phone}
            recipientName={customer?.fullName ?? "Customer"}
            linkedType="order"
            linkedId={order.id}
            items={[
              { label: "Job Slip (Carrier)", docType: "order_slip", recordId: order.id },
              ...(orderJobs[0]
                ? [{ label: "Job Card", docType: "job_card" as const, recordId: orderJobs[0].id }]
                : []),
            ]}
          />
          {(() => {
            const jobKarigarId = jobs.find((j) => j.orderId === order.id && j.karigarId)?.karigarId;
            const kg = karigar ?? people.find((p) => p.id === jobKarigarId) ?? null;
            const firstJob = jobs.find((j) => j.orderId === order.id);
            if (!kg) return null;
            return (
              <WhatsAppDocMenu
                buttonLabel="Karigar Docs"
                phone={kg.phone}
                recipientName={kg.fullName}
                linkedType="job"
                linkedId={firstJob?.id ?? order.id}
                items={[
                  { label: "Job Card", docType: "job_card", recordId: firstJob?.id ?? order.id },
                  {
                    label: "Worker Statement",
                    docType: "karigar_custody_statement",
                    recordId: kg.id,
                  },
                ]}
              />
            );
          })()}
        </div>
      </div>

      {/* Breadcrumb / next-action */}
      <div className="rounded-md border border-border bg-card p-4 mb-6">
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
              {ORDER_STATUS_FLOW.map((s) => (
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

      {/* Dashboard Summary — display only, aggregated from Gold Ledger, Worker Gold Book, Order Issues, Worker Returns, and the Timeline */}
      <div
        className="rounded-md border border-border bg-card p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3"
        data-testid="order-dashboard-summary"
      >
        <DashboardStat label="Gold Received" value={`${mgToGrams(order.advance.goldGrossMg)} g`} />
        <DashboardStat label="Gold Issued" value={`${mgToGrams(goldPosition.issuedFineMg)} g`} />
        <DashboardStat
          label="Gold Returned"
          value={`${mgToGrams(goldPosition.returnedFineMg)} g`}
        />
        <DashboardStat
          label="Pending Gold"
          value={`${mgToGrams(goldPosition.pendingFineMg)} g`}
          accent={goldPosition.pendingFineMg > 0}
        />
        <DashboardStat label="Current Worker" value={currentWorkerName} />
        <DashboardStat
          label="Last Activity"
          value={lastActivity ? new Date(lastActivity.ts).toLocaleDateString("en-IN") : "—"}
        />
        <DashboardStat label="Current Status" value={ORDER_STATUS_LABELS[order.status]} />
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

          {/* Items — one block per line, each of which is its own Job Card */}
          <Section
            title={items.length > 1 ? `Items & Gold (${items.length})` : "Item & Gold"}
            icon={ShoppingBag}
          >
            <div className="space-y-4">
              {items.map((it, i) => (
                <div
                  key={it.lineId ?? i}
                  className={i > 0 ? "border-t border-border pt-4" : undefined}
                >
                  {items.length > 1 && (
                    <div className="text-xs font-medium text-gold mb-2">Item {i + 1}</div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    <Kv k="Item" v={it.itemName} />
                    <Kv k="Category" v={it.category} />
                    <Kv k="Quantity" v={String(it.quantity)} />
                    <Kv k="Size" v={it.size || "—"} />
                    <Kv k="Metal" v={`${it.metal} · ${it.metalColor}`} />
                    <Kv k="Purity" v={String(it.purity)} />
                    <Kv k="Gross" v={`${mgToGrams(it.grossMg)} g`} />
                    <Kv k="Less" v={`${mgToGrams(it.lessMg)} g`} />
                    <Kv k="Net" v={`${mgToGrams(it.netMg)} g`} />
                    <Kv k="Fine gold" v={`${mgToGrams(it.fineMg)} g`} accent />
                    <Kv
                      k="Expected wastage"
                      v={`${it.expectedWastagePct}% (${mgToGrams(it.expectedWastageMg)} g)`}
                    />
                    {it.stoneDetails && <Kv k="Stone" v={it.stoneDetails} />}
                  </div>
                  {it.remarks && <p className="text-xs text-muted-foreground mt-2">{it.remarks}</p>}
                </div>
              ))}
            </div>

            {items.length > 1 && (
              <div className="mt-4 border-t border-border pt-3 grid sm:grid-cols-2 gap-2 text-sm">
                <Kv k="Total pieces" v={String(totals.quantity)} />
                <Kv k="Total gross" v={`${mgToGrams(totals.grossMg)} g`} />
                <Kv k="Total net" v={`${mgToGrams(totals.netMg)} g`} />
                <Kv k="Total fine gold" v={`${mgToGrams(totals.fineMg)} g`} accent />
              </div>
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
          <Section title="Advance & Customer Gold (Gold First)">
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <Kv
                k="Gold received (Primary)"
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
              <Kv
                k="Cash advance (Secondary)"
                v={
                  order.advance.cashPaise > 0
                    ? `₹ ${paiseToRupees(order.advance.cashPaise)} (${order.advance.cashMode || "—"})`
                    : "—"
                }
              />
              <Kv k="Cash reference" v={order.advance.cashRef || "—"} />
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

          {/* Polishing — optional business process, hidden entirely if the module is off */}
          {polishingModuleEnabled && (
            <Section title="Polishing" icon={Sparkles}>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSendPolishingOpen(true)}
                  data-testid="order-send-polishing"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Send to Polishing
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setReceivePolishingOpen(true)}
                  data-testid="order-receive-polishing"
                >
                  <PackageCheck className="h-3.5 w-3.5" /> Receive from Polishing
                </Button>
              </div>
              {polishingHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No polishing transactions yet.</p>
              ) : (
                <ul className="space-y-2 text-xs" data-testid="order-polishing-history-list">
                  {polishingHistory.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-border bg-background/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {t.type === "sent" ? "Sent" : "Received"} · {t.product} ·{" "}
                          {mgToGrams(t.grossMg)} g
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(t.ts).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {t.type === "sent" ? "To" : "From"} {t.polisherName} · Fine{" "}
                        {mgToGrams(t.fineMg)} g
                      </div>
                      {t.remarks && <div className="text-muted-foreground mt-0.5">{t.remarks}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Barcode & Tagging — finished-product identity, only after Worker Return + Polishing */}
          <ManufacturingBarcodePanel
            order={order}
            customerName={customer?.fullName ?? order.customerId}
          />

          {/* Linked Job Cards — ONE PER ITEM. Each is an independent bench job
              and can go to a different karigar, so each is listed, viewed and
              printed on its own. */}
          <Section
            title={
              items.length > 1 ? `Job Cards (${orderJobs.length}/${items.length})` : "Job Card"
            }
            icon={Hammer}
          >
            <p className="text-xs text-muted-foreground mb-3">
              Work is assigned per item. Create a Job Card when you decide which karigar makes that
              piece — an order on its own assigns nothing.
            </p>

            <div className="space-y-3">
              {/* Every ITEM, not every card: an item without a card is the thing
                  the workshop still has to act on, and it must be visible. */}
              {items.map((it, i) => {
                const job = jobForLine(it, i);
                return (
                  <div
                    key={it.lineId ?? i}
                    className="rounded-lg border border-border bg-background/40 p-3 space-y-2 text-sm"
                  >
                    <div>
                      {job ? (
                        <div className="font-mono text-xs text-gold">{job.jobNo}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Not yet assigned</div>
                      )}
                      <div className="text-sm font-medium">{it.itemName}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.category} · {it.quantity > 1 ? `${it.quantity} pcs · ` : ""}
                        {mgToGrams(it.grossMg)} g
                        {job ? ` · ${JOB_STATUS_LABELS[job.status]} · ${job.karigarName}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {job ? (
                        <>
                          <Link to="/workshop/$id" params={{ id: job.id }}>
                            <Button size="sm" variant="outline" className="gap-1">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() =>
                              // Keyed by JOB CARD id, not order id — otherwise every
                              // card on a multi-item order prints the first item.
                              navigate({ to: `/workshop/print/job-card/${job.id}` as any })
                            }
                          >
                            <Printer className="h-3 w-3" /> Print
                          </Button>
                          {!job.workReceipt && (
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => setReceiveJobId(job.id)}
                            >
                              <PackageCheck className="h-3 w-3" /> Receive Work
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="gap-1"
                          data-testid="order-create-job-card"
                          onClick={() =>
                            setAssignLine({ lineId: it.lineId, itemName: it.itemName })
                          }
                        >
                          <ClipboardList className="h-3 w-3" /> Create Job Card
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {orderJobs.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() => navigate({ to: "/workshop/gold-book" })}
                >
                  <Hammer className="h-3 w-3" /> Worker Gold Book
                </Button>
              )}
            </div>
          </Section>

          {/* Worker Issues */}
          <Section title="Worker Issues" icon={Hammer}>
            <p className="text-xs text-muted-foreground mb-3">
              Gold or material physically handed to a worker against this order. Issued from the{" "}
              <Link to="/workshop/gold-book" className="text-gold underline">
                Worker Gold Book
              </Link>{" "}
              — the single approved place to issue gold. This is the structured, order-linked issue
              that Manufacturing Barcode eligibility and Manufacturing Bill auto-collect read from.
            </p>
            <Button
              className="w-full gap-2 mb-3"
              onClick={() => setWorkerIssueOpen(true)}
              data-testid="order-issue-gold-material"
            >
              <Hammer className="h-4 w-4" /> Issue Gold / Material
            </Button>
            {workerIssueHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">No issues recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-xs mt-3" data-testid="order-issue-history-list">
                {workerIssueHistory.map((iss) => (
                  <li
                    key={iss.id}
                    className="rounded-lg border border-border bg-background/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {iss.particulars} · {mgToGrams(iss.grossMg)} g
                        {iss.purity > 0 ? ` @ ${iss.purity}` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(iss.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      To {iss.workerName}
                      {iss.purity > 0 ? ` · Fine ${mgToGrams(iss.fineMg)} g` : ""}
                    </div>
                    {iss.notes && <div className="text-muted-foreground mt-0.5">{iss.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Worker Returns */}
          <Section title="Worker Returns" icon={PackageCheck}>
            <p className="text-xs text-muted-foreground mb-3">
              Record material or gold physically handed back by a worker against this order — any
              number of times. Wastage, recovery, over/loss and settlement are not calculated here.
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => setWorkerReturnOpen(true)}
              data-testid="order-receive-from-worker"
            >
              <PackageCheck className="h-4 w-4" /> Receive From Worker
            </Button>
            {workerReturnHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">No returns recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-xs mt-3">
                {workerReturnHistory.map((ret) => (
                  <li
                    key={ret.id}
                    className="rounded-lg border border-border bg-background/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {ret.materialReturned} · {mgToGrams(ret.grossMg)} g
                        {ret.purity > 0 ? ` @ ${ret.purity}` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(ret.ts).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      From {ret.workerName}
                      {ret.purity > 0 ? ` · Fine ${mgToGrams(ret.fineMg)} g` : ""}
                    </div>
                    {ret.finishedProductDescription && (
                      <div className="text-muted-foreground mt-0.5">
                        {ret.finishedProductDescription}
                      </div>
                    )}
                    {ret.remarks && (
                      <div className="text-muted-foreground mt-0.5">{ret.remarks}</div>
                    )}
                    {ret.referencePhotoDataUrl && (
                      <img
                        src={ret.referencePhotoDataUrl}
                        alt="Reference"
                        className="h-12 w-12 object-cover rounded border border-border mt-1.5"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Current Gold Position — visibility only, no wastage/recovery/over-loss settlement here */}
          <Section title="Current Gold Position" icon={Hammer}>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Total Issued
                </div>
                <div className="font-mono font-bold text-blue-400">
                  {mgToGrams(goldPosition.issuedFineMg)} g
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Total Returned
                </div>
                <div className="font-mono font-bold text-emerald-400">
                  {mgToGrams(goldPosition.returnedFineMg)} g
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Pending
                </div>
                <div
                  className={`font-mono font-bold ${goldPosition.pendingFineMg > 0 ? "text-amber-400" : "text-emerald-400"}`}
                >
                  {mgToGrams(goldPosition.pendingFineMg)} g
                </div>
              </div>
            </div>
          </Section>

          {/* Outside Work Cost — automatic rollup of every labour charge billed
              by an outside jeweller against this order (outside-work-labour-store.ts).
              Read-only here; no duplicate cost entry — Manufacturing Bill/Reports
              can pull the same computeOutsideWorkCostForOrder() when they need it. */}
          {outsideWorkCostPaise > 0 && (
            <Section title="Outside Work Cost" icon={Receipt}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Labour billed by outside jewellers</span>
                <span className="font-mono font-bold text-gold">
                  ₹{paiseToRupees(outsideWorkCostPaise)}
                </span>
              </div>
              <Link
                to="/workshop/outside-work"
                className="text-xs text-gold hover:underline inline-block mt-1"
              >
                View Outside Work Ledger →
              </Link>
            </Section>
          )}

          {/* Next actions */}
          <Section title="Next actions">
            <div className="space-y-2 text-sm">
              {linkedJob && !linkedJob.workReceipt && (
                <Link to="/workshop/gold-book">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <BookOpen className="h-4 w-4" /> Worker Gold Book
                  </Button>
                </Link>
              )}
              {/* Shortcut for the common single-item order. Multi-item orders
                  receive per card, from the Job Cards section — you cannot
                  receive "the order", only a finished piece. */}
              {orderJobs.length === 1 && !orderJobs[0].workReceipt && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setReceiveJobId(orderJobs[0].id)}
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

          {/* Reference Notes */}
          <Section title="Reference Notes">
            <ReferenceNotesPanel entityType="order" entityId={order.id} />
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

      <ReceiveWorkDialog
        open={!!receiveJob}
        onClose={() => setReceiveJobId(null)}
        job={receiveJob}
      />

      <CreateJobCardDialog
        open={!!assignLine}
        onClose={() => setAssignLine(null)}
        order={order}
        lineId={assignLine?.lineId}
        itemName={assignLine?.itemName ?? ""}
      />

      <WorkerReturnDialog
        open={workerReturnOpen}
        onClose={() => setWorkerReturnOpen(false)}
        orderId={order.id}
        orderNo={order.orderNo}
        defaultPurity={order.item.purity}
        onSaved={(info) => {
          append(order!.id, {
            ts: Date.now(),
            label: "Worker Return",
            note: `${(info.grossMg / 1000).toFixed(3)}g ${info.materialReturned} ← ${info.workerName}`,
          });
        }}
      />
      <WorkerIssueDialog
        open={workerIssueOpen}
        onClose={() => setWorkerIssueOpen(false)}
        orderId={order.id}
        orderNo={order.orderNo}
        defaultPurity={order.item.purity}
        onSaved={(info) => {
          append(order!.id, {
            ts: Date.now(),
            label: "Worker Issue",
            note: `${(info.grossMg / 1000).toFixed(3)}g ${info.material} → ${info.workerName}`,
          });
        }}
      />
      {/* Timeline entries for Send/Receive are appended by the dialogs
          themselves (gated on auto_timeline_entries_polishing) — not here —
          so the same behavior applies whether the dialog is opened from
          this order page or from the standalone Polishing Ledger page with
          an order picked there. Appending here too would double the entry. */}
      <SendToPolishingDialog
        open={sendPolishingOpen}
        onClose={() => setSendPolishingOpen(false)}
        orderId={order.id}
        orderNo={order.orderNo}
      />
      <ReceiveFromPolishingDialog
        open={receivePolishingOpen}
        onClose={() => setReceivePolishingOpen(false)}
        orderId={order.id}
        orderNo={order.orderNo}
        defaultPurity={order.item.purity}
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
    <div className="rounded-md border border-border bg-card p-5">
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

function DashboardStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
        {label}
      </div>
      <div
        className={`text-sm font-mono font-bold truncate ${accent ? "text-amber-400" : "text-foreground"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Create Job Card — the moment work is actually assigned.
 *
 * Deliberately a separate, explicit step from taking the order: the workshop
 * reviews the order, sees who is free and who suits the piece, and only then
 * puts it on a bench. One card, one item, one karigar.
 */
function CreateJobCardDialog({
  open,
  onClose,
  order,
  lineId,
  itemName,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  lineId?: string;
  itemName: string;
}) {
  const people = usePeople((s) => s.people);
  const [karigarId, setKarigarId] = useState<string>("");
  const [expectedStart, setExpectedStart] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset per open — the dialog stays mounted, so without this the previous
  // item's karigar would still be selected for the next one.
  useEffect(() => {
    if (open) {
      setKarigarId("");
      setExpectedStart("");
      setError(null);
    }
  }, [open]);

  // A start date after the delivery date is not a scheduling preference, it's a
  // typo — the piece cannot begin after it is due.
  const startsAfterDelivery =
    !!expectedStart && !!order.expectedDelivery && expectedStart > order.expectedDelivery;

  const karigars = people.filter(
    (p) =>
      (p.type === "karigar" || p.type === "worker" || p.type === "outside_worker") &&
      p.active !== false,
  );

  async function save() {
    if (!karigarId || saving || startsAfterDelivery) return;
    setSaving(true);
    setError(null);
    try {
      await createJobCardForLine(order, lineId, karigarId, {
        expectedStart: expectedStart || undefined,
      });
      toast.success(`Job Card created for ${itemName}.`);
      onClose();
    } catch (err) {
      // Surfaced, not swallowed: "already has a Job Card" and "no such karigar"
      // are both states the user needs to see rather than a dialog that does
      // nothing when clicked.
      setError(err instanceof Error ? err.message : "Could not create the Job Card.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Job Card</DialogTitle>
          <DialogDescription>
            Assign <span className="font-medium text-foreground">{itemName}</span> to a karigar.
            This piece gets its own card, its own gold issue and its own wastage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Karigar *</Label>
            <Select value={karigarId} onValueChange={setKarigarId}>
              <SelectTrigger data-testid="job-card-karigar-select">
                <SelectValue placeholder="Select the karigar who will make this…" />
              </SelectTrigger>
              <SelectContent>
                {karigars.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName} · {PERSON_TYPE_LABELS[p.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {karigars.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No karigars on record yet — add one in People first.
              </p>
            )}
          </div>

          {/* Work does not start the day the order is taken. The bench may be
              busy, gold may not be issued yet, or the piece may be deliberately
              queued — so when it is EXPECTED TO START is its own date. */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Expected Work Start Date</Label>
            <Input
              type="date"
              value={expectedStart}
              onChange={(e) => setExpectedStart(e.target.value)}
              className={startsAfterDelivery ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            <p className="text-[11px] text-muted-foreground">
              {order.expectedDelivery
                ? `Delivery deadline: ${order.expectedDelivery}`
                : "No delivery deadline set on this order."}
            </p>
            {startsAfterDelivery && (
              <p className="text-xs text-red-500 font-medium">
                Work cannot start after the delivery deadline.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={!karigarId || saving || startsAfterDelivery}
            className="gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            {saving ? "Creating…" : "Create Job Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
