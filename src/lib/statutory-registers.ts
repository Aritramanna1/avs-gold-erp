/**
 * Sales / purchase / HSN register rows derived from posted invoices.
 * One compiler so GSTR HSN, the sales register page, and tests cannot drift.
 */
import type { Invoice } from "@/lib/billing-store";
import { defaultHsnForLine } from "@/lib/tax-profiles";
import { useSettings } from "@/lib/settings-store";

export function isConfirmedInvoice(inv: Invoice): boolean {
  return inv.status !== "draft" && inv.status !== "cancelled";
}

export function invoiceInRange(inv: Invoice, fromMs: number, toMs: number): boolean {
  return inv.createdAt >= fromMs && inv.createdAt <= toMs;
}

export interface SalesRegisterRow {
  invoiceNo: string;
  dateMs: number;
  customerName: string;
  gstin: string;
  fineMg: number;
  metalPaise: number;
  makingPaise: number;
  stonePaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  tcsPaise: number;
  grandPaise: number;
  hsn: string;
}

export function compileSalesRegister(invoices: Invoice[], fromMs: number, toMs: number): SalesRegisterRow[] {
  const gst = useSettings.getState().gst;
  return invoices
    .filter((inv) => isConfirmedInvoice(inv) && invoiceInRange(inv, fromMs, toMs))
    .map((inv) => {
      const isInterState = inv.gstPaise > 0 && inv.cgstPaise === 0;
      const hsn =
        inv.items.map((item) => defaultHsnForLine(item, gst)).find(Boolean) ??
        (gst.hsnJewellery ?? "7113");
      return {
        invoiceNo: inv.invoiceNo,
        dateMs: inv.createdAt,
        customerName: inv.customerName || "Walk-in",
        gstin: inv.customerGstin || "",
        fineMg: inv.items.reduce((sum, item) => sum + Math.max(0, item.fineMg), 0),
        metalPaise: inv.items.reduce((sum, item) => sum + Math.max(0, item.goldValuePaise), 0),
        makingPaise: inv.items.reduce((sum, item) => sum + Math.max(0, item.makingChargesPaise), 0),
        stonePaise: inv.items.reduce((sum, item) => sum + Math.max(0, item.stoneChargesPaise), 0),
        taxablePaise: inv.subtotalPaise - inv.adjustmentPaise,
        cgstPaise: isInterState ? 0 : inv.cgstPaise,
        sgstPaise: isInterState ? 0 : inv.sgstPaise,
        igstPaise: isInterState ? inv.gstPaise : 0,
        tcsPaise: inv.tcsPaise ?? 0,
        grandPaise: inv.grandTotalPaise,
        hsn,
      };
    });
}

export interface PurchaseRegisterRow {
  purchaseNo: string;
  invoiceNo: string;
  dateMs: number;
  supplierId: string;
  fineMg: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
}

export function compilePurchaseRegister(
  purchases: Array<{
    purchaseNo: string;
    invoiceNo: string | null;
    invoiceDate: string | null;
    createdAt: string;
    supplierId: string;
    fineMg: number;
    subtotalPaise: number;
    gstPaise: number;
    totalPaise: number;
    paidPaise: number;
    duePaise: number;
    reversed: boolean;
  }>,
  fromMs: number,
  toMs: number,
): PurchaseRegisterRow[] {
  return purchases
    .filter((p) => !p.reversed)
    .map((p) => {
      const dateMs = p.invoiceDate
        ? new Date(`${p.invoiceDate}T00:00:00`).getTime()
        : new Date(p.createdAt).getTime();
      return {
        purchaseNo: p.purchaseNo,
        invoiceNo: p.invoiceNo || p.purchaseNo,
        dateMs,
        supplierId: p.supplierId,
        fineMg: Math.max(0, p.fineMg),
        subtotalPaise: p.subtotalPaise,
        gstPaise: p.gstPaise,
        totalPaise: p.totalPaise,
        paidPaise: p.paidPaise,
        duePaise: p.duePaise,
      };
    })
    .filter((row) => row.dateMs >= fromMs && row.dateMs <= toMs);
}

export interface HsnSummaryRow {
  hsn: string;
  invoiceCount: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export function compileHsnSummary(invoices: Invoice[], fromMs: number, toMs: number): HsnSummaryRow[] {
  const rows = compileSalesRegister(invoices, fromMs, toMs);
  const buckets = new Map<string, HsnSummaryRow>();
  for (const row of rows) {
    const existing = buckets.get(row.hsn);
    if (existing) {
      existing.invoiceCount += 1;
      existing.taxablePaise += row.taxablePaise;
      existing.cgstPaise += row.cgstPaise;
      existing.sgstPaise += row.sgstPaise;
      existing.igstPaise += row.igstPaise;
    } else {
      buckets.set(row.hsn, {
        hsn: row.hsn,
        invoiceCount: 1,
        taxablePaise: row.taxablePaise,
        cgstPaise: row.cgstPaise,
        sgstPaise: row.sgstPaise,
        igstPaise: row.igstPaise,
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
}

export interface BillWiseRow {
  invoiceNo: string;
  dateMs: number;
  customerName: string;
  grandPaise: number;
  paidPaise: number;
  balancePaise: number;
  fineMg: number;
}

export function compileBillWiseOutstanding(invoices: Invoice[], customerId?: string): BillWiseRow[] {
  return invoices
    .filter(
      (inv) =>
        isConfirmedInvoice(inv) &&
        inv.balancePaise !== 0 &&
        (!customerId || inv.customerId === customerId),
    )
    .map((inv) => ({
      invoiceNo: inv.invoiceNo,
      dateMs: inv.createdAt,
      customerName: inv.customerName || "Walk-in",
      grandPaise: inv.grandTotalPaise,
      paidPaise: inv.paidPaise,
      balancePaise: inv.balancePaise,
      fineMg: inv.items.reduce((sum, item) => sum + Math.max(0, item.fineMg), 0),
    }));
}
