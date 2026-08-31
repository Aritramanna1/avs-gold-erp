/**
 * ERP staff inbox notifications — enqueue at event sources only (never from refresh).
 */
import { enqueueForCurrentUser } from "@/lib/notifications/enqueue-client";

export async function notifyStaffInvoiceReady(opts: {
  invoiceId: string;
  invoiceNo: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "billing",
    eventKey: "invoice.ready",
    title: "Invoice ready",
    message: opts.invoiceNo,
    href: `/billing?invoice=${encodeURIComponent(opts.invoiceId)}`,
    referenceType: "invoice",
    referenceId: opts.invoiceId,
    idempotencyKey: `staff:invoice.ready:${opts.invoiceId}`,
  });
}

export async function notifyStaffPaymentReceived(opts: {
  invoiceId: string;
  invoiceNo: string;
  paymentId: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "payments",
    eventKey: "payment.received",
    title: "Payment received",
    message: opts.invoiceNo,
    href: `/billing?invoice=${encodeURIComponent(opts.invoiceId)}`,
    referenceType: "invoice",
    referenceId: opts.invoiceId,
    idempotencyKey: `payment.received:${opts.invoiceId}:${opts.paymentId}`,
  });
}

export async function notifyStaffPaymentDue(opts: {
  customerId: string;
  customerName: string;
  invoiceNo?: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "payments",
    eventKey: "payment.due",
    title: "Payment due",
    message: opts.invoiceNo
      ? `${opts.customerName} · ${opts.invoiceNo}`
      : opts.customerName,
    href: "/billing",
    referenceType: "customer",
    referenceId: opts.customerId,
    priority: "high",
    idempotencyKey: `staff:payment.due:${opts.customerId}:${opts.invoiceNo ?? "general"}`,
  });
}

export async function notifyStaffOrderEvent(opts: {
  orderId: string;
  orderNo: string;
  eventKey: "order.created" | "order.ready";
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "manufacturing",
    eventKey: opts.eventKey,
    title: opts.eventKey === "order.created" ? "Order created" : "Order ready",
    message: opts.orderNo,
    href: `/orders?order=${encodeURIComponent(opts.orderId)}`,
    referenceType: "order",
    referenceId: opts.orderId,
    idempotencyKey: `staff:${opts.eventKey}:${opts.orderId}`,
  });
}

export async function notifyStaffManufacturingBillReady(opts: {
  billId: string;
  billNo: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "billing",
    eventKey: "document.ready",
    title: "Manufacturing bill ready",
    message: opts.billNo,
    href: "/manufacturing/bills",
    referenceType: "job",
    referenceId: opts.billId,
    idempotencyKey: `staff:document.ready:${opts.billId}`,
  });
}

export async function notifyStaffRepairUpdate(opts: {
  repairId: string;
  repairNo: string;
  status: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "manufacturing",
    eventKey: "order.ready",
    title: "Repair update",
    message: `${opts.repairNo} · ${opts.status}`,
    href: "/repair",
    referenceType: "repair",
    referenceId: opts.repairId,
    idempotencyKey: `staff:repair:${opts.repairId}:${opts.status}`,
  });
}

export async function notifyStaffPortalInvited(opts: {
  invitationId: string;
  partyName: string;
  portalType: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "portal",
    eventKey: "portal.invited",
    title: "Portal invitation sent",
    message: `${opts.partyName} · ${opts.portalType}`,
    href: "/settings?tab=users",
    referenceType: "portal_invite",
    referenceId: opts.invitationId,
    idempotencyKey: `staff:portal.invited:${opts.invitationId}`,
  });
}

export async function notifyStaffCommQueueFailed(opts: {
  jobId: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "system",
    eventKey: "support.updated",
    title: "Communication delivery failed",
    message: "A message needs attention in Communications",
    href: "/communications",
    referenceType: "comm_job",
    referenceId: opts.jobId,
    priority: "critical",
    mandatory: true,
    idempotencyKey: `staff:comm.failed:${opts.jobId}`,
  });
}

export async function notifyStaffSyncAttention(opts: {
  operationId: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "system",
    title: "Sync needs attention",
    message: "An offline operation requires review",
    href: "/settings/storage-diagnostics",
    referenceType: "offline_op",
    referenceId: opts.operationId,
    priority: "critical",
    mandatory: true,
    idempotencyKey: `staff:sync.attention:${opts.operationId}`,
  });
}

export async function notifyStaffApprovalPending(opts: {
  approvalId: string;
  entityType: string;
}): Promise<void> {
  await enqueueForCurrentUser({
    category: "approvals",
    title: "Approval pending",
    message: opts.entityType,
    href: "/reports/approvals",
    referenceType: "approval",
    referenceId: opts.approvalId,
    priority: "high",
    idempotencyKey: `staff:approval:${opts.approvalId}`,
  });
}
