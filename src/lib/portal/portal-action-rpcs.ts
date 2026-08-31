/**
 * Portal mutation RPCs — shop chunk portal-action-rpcs-Bmy_vzhh.js contract.
 * Thin wrappers over dataProvider.rpc; throw on error.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

async function portalRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export function customerPortalApproveDesign(orderId: string) {
  return portalRpc("customer_portal_approve_design", { p_order_id: orderId });
}

export function customerPortalRequestDesignModification(
  orderId: string,
  notes: string,
  attachmentUrl?: string | null,
) {
  return portalRpc("customer_portal_request_design_modification", {
    p_order_id: orderId,
    p_notes: notes,
    p_attachment_url: attachmentUrl ?? null,
  });
}

export function customerPortalCreateEnquiry(input: {
  subject: string;
  notes?: string | null;
  catalogDesignId?: string | null;
  metal?: string | null;
  purityPermille?: number | null;
  targetGrossMg?: number | null;
}) {
  return portalRpc("customer_portal_create_enquiry", {
    p_subject: input.subject,
    p_notes: input.notes ?? null,
    p_catalog_design_id: input.catalogDesignId ?? null,
    p_metal: input.metal ?? null,
    p_purity_permille: input.purityPermille ?? null,
    p_target_gross_mg: input.targetGrossMg ?? null,
  });
}

export function customerPortalAcknowledgePaymentReceipt(reference: string, note?: string | null) {
  return portalRpc("customer_portal_acknowledge_payment_receipt", {
    p_reference: reference,
    p_note: note ?? null,
  });
}

export function supplierPortalAcceptPurchase(purchaseId: string, expectedDelivery?: string | null) {
  return portalRpc("supplier_portal_accept_purchase", {
    p_purchase_id: purchaseId,
    p_expected_delivery: expectedDelivery || null,
  });
}

export function supplierPortalRequestPurchaseModification(
  purchaseId: string,
  notes: string,
  proposed?: Record<string, unknown> | null,
) {
  return portalRpc("supplier_portal_request_purchase_modification", {
    p_purchase_id: purchaseId,
    p_notes: notes,
    p_proposed: proposed ?? {},
  });
}

export function supplierPortalNotifyDispatch(input: {
  purchaseId: string;
  carrier: string;
  trackingNo: string;
  grossMg?: number | null;
  netMg?: number | null;
  parcelCount?: number | null;
  expectedDelivery?: string | null;
}) {
  return portalRpc("supplier_portal_notify_dispatch", {
    p_purchase_id: input.purchaseId,
    p_carrier: input.carrier,
    p_tracking_no: input.trackingNo,
    p_gross_mg: input.grossMg ?? null,
    p_net_mg: input.netMg ?? null,
    p_parcel_count: input.parcelCount ?? 1,
    p_expected_delivery: input.expectedDelivery || null,
  });
}

export function supplierPortalRegisterDocument(input: {
  purchaseId: string;
  docKind: string;
  storagePath: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  return portalRpc("supplier_portal_register_document", {
    p_purchase_id: input.purchaseId,
    p_doc_kind: input.docKind,
    p_storage_path: input.storagePath,
    p_file_name: input.fileName ?? null,
    p_mime_type: input.mimeType ?? null,
  });
}
