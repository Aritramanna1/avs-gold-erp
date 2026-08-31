/**
 * Resolve attachment bytes into printable image URLs for Print Engine.
 * Prefers full-resolution R2 signed URLs; falls back to inline thumbnails.
 */
import {
  getAttachmentUrl,
  useAttachments,
  type AttachmentEntityType,
  type AttachmentRecord,
} from "@/lib/attachments-store";
import { PORTAL_KYC_DOC_KEYS } from "@/lib/portal/portal-kyc-service";
import { KYC_DOC_LABELS, type KycDocKey } from "@/lib/people-store";
import {
  lineReferenceDocKey,
  referenceImageDocKeys,
} from "@/lib/job-card-engine";
import { isStockProductPhotoKey } from "@/lib/stock-photos";
import { orderItems, useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useBilling, type InvoiceItem } from "@/lib/billing-store";
import { useStock } from "@/lib/stock-store";
import { useCatalog } from "@/lib/catalog-store";
import type { PrintDocumentData, PrintImageItem } from "./types";

export interface AttachmentPrintSpec {
  entityType: AttachmentEntityType;
  entityId: string;
  docKey: string;
  label: string;
}

const ORDER_REFERENCE_LABELS: Record<string, string> = {
  design_photo: "Design photo",
  customer_reference: "Customer reference",
  die_photo: "Die photo",
  stones_photo: "Stones photo",
};

/** Paper-register “filed” alone is not printable — need R2 path or inline bytes. */
function hasAttachmentBytes(rec: AttachmentRecord | undefined): boolean {
  return !!(rec?.storagePath || rec?.fileDataUrl || rec?.thumbnailDataUrl);
}

function inlineFallback(rec: AttachmentRecord | undefined): string | null {
  if (!hasAttachmentBytes(rec)) return null;
  return rec!.thumbnailDataUrl || rec!.fileDataUrl || null;
}

/** Resolve one stored attachment to a renderable URL (never metadata-only placeholders). */
export async function resolveAttachmentPrintUrl(
  spec: AttachmentPrintSpec,
): Promise<PrintImageItem | null> {
  const key = `${spec.entityType}:${spec.entityId}:${spec.docKey}`;
  const rec = useAttachments.getState().items[key];
  if (!hasAttachmentBytes(rec)) {
    return null;
  }

  try {
    const url = (await getAttachmentUrl(spec.entityType, spec.entityId, spec.docKey)) ?? inlineFallback(rec);
    if (!url) return null;
    return { url, label: spec.label };
  } catch {
    const fallback = inlineFallback(rec);
    if (!fallback) return null;
    return { url: fallback, label: spec.label };
  }
}

export async function resolveAttachmentPrintUrls(
  specs: AttachmentPrintSpec[],
): Promise<PrintImageItem[]> {
  const results = await Promise.all(specs.map((spec) => resolveAttachmentPrintUrl(spec)));
  return results.filter((item): item is PrintImageItem => item != null);
}

function kycSpecsForPerson(personId: string): AttachmentPrintSpec[] {
  return PORTAL_KYC_DOC_KEYS.map((docKey) => ({
    entityType: "person" as const,
    entityId: personId,
    docKey,
    label: KYC_DOC_LABELS[docKey as KycDocKey],
  }));
}

function referenceLabel(docKey: string): string {
  if (docKey.startsWith("design_photo__")) return "Line design reference";
  return ORDER_REFERENCE_LABELS[docKey] ?? docKey.replace(/_/g, " ");
}

function referenceSpecsForOrder(orderId: string, lineId?: string): AttachmentPrintSpec[] {
  return referenceImageDocKeys(orderId, lineId).map((docKey) => ({
    entityType: "order" as const,
    entityId: orderId,
    docKey,
    label: referenceLabel(docKey),
  }));
}

function orderLineIdForInvoiceItem(orderId: string, it: InvoiceItem): string | undefined {
  const order = useOrders.getState().orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  const lines = orderItems(order);
  if (lines.length === 0) return undefined;
  const byName = lines.find((line) => line.itemName === it.itemName);
  if (byName?.lineId) return byName.lineId;
  if (lines.length === 1) return lines[0]?.lineId;
  return undefined;
}

/** Build attachment lookup specs for an invoice line photo. */
export function invoiceItemPhotoSpecs(it: InvoiceItem, orderId?: string): AttachmentPrintSpec[] {
  const specs: AttachmentPrintSpec[] = [];
  const attachments = useAttachments.getState().items;

  if (it.stockItemId) {
    const stockList = useAttachments.getState().listForEntity("stock", it.stockItemId);
    for (const { docKey } of stockList) {
      if (isStockProductPhotoKey(docKey)) {
        specs.push({
          entityType: "stock",
          entityId: it.stockItemId,
          docKey,
          label: "Product photo",
        });
      }
    }
    for (const legacy of ["design_photo", "item_photo"] as const) {
      if (attachments[`stock:${it.stockItemId}:${legacy}`]) {
        specs.push({
          entityType: "stock",
          entityId: it.stockItemId,
          docKey: legacy,
          label: "Product photo",
        });
      }
    }
  }

  if (it.stockItemId || it.barcode) {
    const stockItem = useStock
      .getState()
      .items.find((s) => s.id === it.stockItemId || (it.barcode && s.barcode === it.barcode));
    if (stockItem) {
      const catalogDesign = useCatalog
        .getState()
        .designs.find(
          (d) => d.designNumber === stockItem.itemCode || d.designName === stockItem.itemName,
        );
      if (catalogDesign) {
        specs.push({
          entityType: "catalog",
          entityId: catalogDesign.id,
          docKey: "design_photo",
          label: "Catalog design",
        });
      }
    }
  }

  const catalogByName = useCatalog.getState().designs.find((d) => d.designName === it.itemName);
  if (catalogByName) {
    specs.push({
      entityType: "catalog",
      entityId: catalogByName.id,
      docKey: "design_photo",
      label: "Catalog design",
    });
  }

  if (orderId) {
    specs.push({
      entityType: "order",
      entityId: orderId,
      docKey: "design_photo",
      label: "Order design",
    });
    const lineId = orderLineIdForInvoiceItem(orderId, it);
    if (lineId) {
      specs.push({
        entityType: "order",
        entityId: orderId,
        docKey: lineReferenceDocKey(lineId),
        label: "Line design reference",
      });
    }
  }

  return specs;
}

function mergeImageItems(data: PrintDocumentData, key: string, items: PrintImageItem[]): PrintDocumentData {
  if (items.length === 0) return data;
  const imageItems = { ...(data.imageItems ?? {}), [key]: items };
  const images = { ...data.images, [key]: items.map((i) => i.url) };
  return { ...data, images, imageItems };
}

/** Async enrichment — keeps resolvePrintContext synchronous. */
export async function enrichPrintDocumentData(data: PrintDocumentData): Promise<PrintDocumentData> {
  switch (data.docType) {
    case "worker_kyc": {
      const items = await resolveAttachmentPrintUrls(kycSpecsForPerson(data.recordId));
      return {
        ...mergeImageItems(data, "kyc", items),
        flags: { ...data.flags, hasKycImages: items.length > 0 },
      };
    }

    case "job_card": {
      const job = useJobCards.getState().jobs.find((j) => j.id === data.recordId);
      const order =
        useOrders.getState().orders.find((o) => o.id === data.recordId) ??
        (job ? useOrders.getState().orders.find((o) => o.id === job.orderId) : undefined);
      if (!order) return data;
      const lineId = job?.lineId ?? orderItems(order)[0]?.lineId;
      const items = await resolveAttachmentPrintUrls(referenceSpecsForOrder(order.id, lineId));
      return {
        ...mergeImageItems(data, "reference", items),
        flags: { ...data.flags, hasReferenceImages: items.length > 0 },
      };
    }

    case "gst_invoice":
    case "retail_invoice": {
      const inv = useBilling.getState().invoices.find((i) => i.id === data.recordId);
      if (!inv) return data;
      let next = data;
      const rows = [...(next.tables.items ?? [])];
      let anyPhoto = false;
      for (let i = 0; i < inv.items.length; i += 1) {
        const it = inv.items[i];
        const specs = invoiceItemPhotoSpecs(it, inv.orderId);
        const resolved = await resolveAttachmentPrintUrls(specs);
        const url = resolved[0]?.url ?? "";
        if (url) anyPhoto = true;
        if (rows[i]) rows[i] = { ...rows[i], photoUrl: url };
      }
      next = {
        ...next,
        tables: { ...next.tables, items: rows },
        flags: { ...next.flags, hasItemPhotos: anyPhoto || !!next.flags.hasItemPhotos },
      };
      return next;
    }

    default:
      return data;
  }
}

/** Convert a renderable URL (blob, data, R2 proxy, or remote) to jsPDF-safe JPEG/PNG data URL.
 *  Always rasterizes via canvas so WebP and auth-gated R2 assets embed reliably.
 *  Never passes raw blob:/proxy URLs into jsPDF.addImage (those fail silently).
 */
export async function urlToPdfImageData(
  url: string,
): Promise<{ dataUrl: string; format: "JPEG" | "PNG" | "WEBP" } | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    // Tiny pure data-URL JPEG/PNG can skip canvas when already jsPDF-friendly.
    if (
      trimmed.startsWith("data:image/jpeg") ||
      trimmed.startsWith("data:image/jpg") ||
      trimmed.startsWith("data:image/png")
    ) {
      const format = trimmed.includes("image/png") ? "PNG" : "JPEG";
      return { dataUrl: trimmed, format };
    }

    if (trimmed.startsWith("data:image/svg+xml")) {
      try {
        if (typeof Image !== "undefined" && typeof document !== "undefined") {
          const img = await loadHtmlImage(trimmed);
          const width = img.naturalWidth || img.width || 600;
          const height = img.naturalHeight || img.height || 600;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/png");
            return { dataUrl, format: "PNG" };
          }
        }
      } catch (err) {
        console.warn("[urlToPdfImageData] SVG load fallback:", err);
      }
    }

    const { fetchAuthorizedObjectBlob } = await import("@/lib/supabase-storage");
    const blob = await fetchAuthorizedObjectBlob(trimmed);
    return await blobToPdfCompatibleImage(blob);
  } catch (err) {
    console.warn("[urlToPdfImageData] failed:", trimmed.slice(0, 80), err);
    return null;
  }
}

const PDF_IMAGE_MAX_EDGE = 1600;

/** Decode any browser-supported image blob → JPEG data URL for jsPDF. */
async function blobToPdfCompatibleImage(
  blob: Blob,
): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> {
  if (blob.size === 0) return null;

  // Prefer createImageBitmap (handles WebP); fall back to HTMLImageElement.
  let width = 0;
  let height = 0;
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      width = bitmap.width;
      height = bitmap.height;
      draw = (ctx, w, h) => {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();
      };
    } else {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const img = await loadHtmlImage(objectUrl);
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        draw = (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  } catch {
    return null;
  }

  if (!width || !height) return null;

  let targetW = width;
  let targetH = height;
  const maxEdge = Math.max(width, height);
  if (maxEdge > PDF_IMAGE_MAX_EDGE) {
    const scale = PDF_IMAGE_MAX_EDGE / maxEdge;
    targetW = Math.max(1, Math.round(width * scale));
    targetH = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // White background — avoids black fill when source has alpha (PNG/WebP).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  draw(ctx, targetW, targetH);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  if (!dataUrl.startsWith("data:image/")) return null;
  return { dataUrl, format: "JPEG" };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}

export function printImageItemsForSection(
  data: PrintDocumentData,
  imagesKey: string,
): PrintImageItem[] {
  const detailed = data.imageItems?.[imagesKey];
  if (detailed?.length) return detailed;
  return (data.images[imagesKey] ?? []).map((url, index) => ({
    url,
    label: `Image ${index + 1}`,
  }));
}
