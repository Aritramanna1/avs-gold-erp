import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { usePrintEngine } from "@/lib/print-engine";
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
  useOrders,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  paiseToRupees,
  type OrderStatus,
} from "@/lib/orders-store";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { useWorkerReturns, computeGoldPosition } from "@/lib/worker-return-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { WorkerReturnDialog } from "@/components/worker-return-dialog";
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
import { CommLogCard } from "@/components/comm-log-card";
import { ReferenceNotesPanel } from "@/components/reference-notes/ReferenceNotesPanel";
import { useLanguage } from "@/contexts/LanguageContext";
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
} from "lucide-react";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({ meta: [{ title: "Order Detail · AVS Gold ERP" }] }),
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
  const removeJob = useJobCards((s) => s.remove);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [workerReturnOpen, setWorkerReturnOpen] = useState(false);
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
    refreshWorkerReturns();
    refreshGoldBook();
    refreshOutsideWorkLabour();
    refreshPolishing();
    refreshBusinessRules();
    refreshManufacturingBarcodes();
  }, [
    refreshWorkerReturns,
    refreshGoldBook,
    refreshOutsideWorkLabour,
    refreshPolishing,
    refreshBusinessRules,
    refreshManufacturingBarcodes,
  ]);

  const { triggerPrint } = usePrintEngine();

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

  const customer = people.find((p) => p.id === order.customerId);
  const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;
  const linkedJob = jobs.find((j) => j.orderId === order.id);

  // Dashboard Summary — display-only aggregation across every module this
  // order already touches. Never writes anything; purely reads issueHistory/
  // workerReturnHistory/goldPosition/timeline, which are each themselves
  // kept in sync by the dialogs that create issues/returns/status changes.
  const currentWorkerName = karigar?.fullName ?? "Not assigned";
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
      if (linkedJob) removeJob(linkedJob.id);
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
              onClick={() =>
                triggerPrint(
                  `/orders/print/slip/${order.id}`,
                  `Order Slip Preview · ${order.orderNo}`,
                )
              }
            >
              <Printer className="h-4 w-4" /> {t("orders.orderSlip")}
            </Button>
            <Link to="/workshop/job-card/$orderId" params={{ orderId: order.id }}>
              <Button variant="outline" className="gap-2">
                <ClipboardList className="h-4 w-4" /> Job Card
              </Button>
            </Link>
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

      {/* Dashboard Summary — display only, aggregated from Gold Ledger, Worker Gold Book, Order Issues, Worker Returns, and the Timeline */}
      <div
        className="rounded-2xl border border-border bg-card p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3"
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

          {/* Linked Job Card */}
          <Section title="Job Card" icon={Hammer}>
            {linkedJob ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-gold">{linkedJob.jobNo}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: {JOB_STATUS_LABELS[linkedJob.status]}
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
                        `/workshop/print/job-card/${order.id}`,
                        `Job Card Preview · ${linkedJob.jobNo}`,
                      )
                    }
                  >
                    <Printer className="h-3 w-3" /> Print Job Card
                  </Button>
                  {!linkedJob.workReceipt && (
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => navigate({ to: "/workshop/gold-book" })}
                    >
                      <Hammer className="h-3 w-3" /> Worker Gold Book
                    </Button>
                  )}
                  {!linkedJob.workReceipt && (
                    <Button size="sm" className="gap-1" onClick={() => setReceiveOpen(true)}>
                      <PackageCheck className="h-3 w-3" /> Receive Work
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Job Card is created automatically once the order is confirmed.
              </p>
            )}
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
            {workerIssueHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">No issues recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-xs mt-3">
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
              {linkedJob && !linkedJob.workReceipt && (
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
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        job={linkedJob ?? null}
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
