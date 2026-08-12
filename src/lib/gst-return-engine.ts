/**
 * GST Return Exporters — GSTR-1 (outward supplies) and GSTR-3B (monthly
 * summary), generated from real posted invoices. Matches the GST portal's
 * offline-utility CSV column conventions closely enough to paste into the
 * portal tool; this is not a direct API filing integration.
 */
import type { Invoice } from "./billing-store";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: Array<string | number>): string {
  return cells.map(csvCell).join(",");
}

/**
 * GSTR-1 B2B invoices sheet — one row per confirmed invoice with a
 * customer GSTIN (unregistered/B2C sales are out of scope for this sheet,
 * matching the portal's own B2B/B2C split).
 */
export function generateGSTR1CSV(invoices: Invoice[]): string {
  const header = [
    "GSTIN/UIN of Recipient",
    "Receiver Name",
    "Invoice Number",
    "Invoice Date",
    "Invoice Value",
    "Place of Supply",
    "Reverse Charge",
    "Invoice Type",
    "Rate",
    "Taxable Value",
    "Integrated Tax Amount",
    "Central Tax Amount",
    "State/UT Tax Amount",
    "Cess Amount",
  ];
  const rows = invoices
    .filter((inv) => inv.status !== "cancelled" && inv.customerGstin)
    .map((inv) => {
      const taxableValue = (inv.subtotalPaise - inv.adjustmentPaise) / 100;
      const stateCode = inv.customerGstin!.slice(0, 2);
      // billing-store's splitMode==="igst" path stores the full IGST amount
      // in sgstPaise with cgstPaise forced to 0 (see billing-store.ts's GST
      // computation) — there is no dedicated igstPaise field, so a zero
      // cgstPaise alongside a non-zero gstPaise is how an inter-state
      // invoice is represented on a posted Invoice row.
      const isInterState = inv.gstPaise > 0 && inv.cgstPaise === 0;
      const rate =
        inv.subtotalPaise > 0 ? ((inv.gstPaise / inv.subtotalPaise) * 100).toFixed(2) : "0";
      return csvRow([
        inv.customerGstin!,
        inv.customerName,
        inv.invoiceNo,
        new Date(inv.createdAt).toLocaleDateString("en-IN"),
        (inv.grandTotalPaise / 100).toFixed(2),
        stateCode,
        "N",
        "Regular B2B",
        rate,
        taxableValue.toFixed(2),
        isInterState ? (inv.gstPaise / 100).toFixed(2) : "0.00",
        isInterState ? "0.00" : (inv.cgstPaise / 100).toFixed(2),
        isInterState ? "0.00" : (inv.sgstPaise / 100).toFixed(2),
        "0.00",
      ]);
    });
  return [csvRow(header), ...rows].join("\n");
}

/**
 * GSTR-1 B2CS (B2C Small) summary sheet — every invoice without a customer
 * GSTIN, aggregated by Place of Supply + tax rate (the portal files B2C as
 * one row per state+rate, not per invoice). A B2C sale is assumed
 * intra-state (the seller's own registered state) unless the invoice's own
 * cgstPaise===0-with-gstPaise>0 signal marks it inter-state — the same
 * heuristic used for B2B since Invoice has no dedicated buyer-state field
 * for walk-in retail customers.
 */
export function generateGSTR1B2CSummaryCSV(invoices: Invoice[], sellerStateCode: string): string {
  const header = ["Type", "Place of Supply", "Rate", "Taxable Value", "Cess Amount"];
  const buckets = new Map<string, { placeOfSupply: string; rate: number; taxableValue: number }>();
  for (const inv of invoices) {
    if (inv.status === "cancelled" || inv.customerGstin) continue;
    const isInterState = inv.gstPaise > 0 && inv.cgstPaise === 0;
    const rate =
      inv.subtotalPaise > 0 ? Math.round((inv.gstPaise / inv.subtotalPaise) * 10000) / 100 : 0;
    const placeOfSupply = isInterState ? "Other Territory" : sellerStateCode || "—";
    const key = `${placeOfSupply}::${rate}`;
    const taxableValue = (inv.subtotalPaise - inv.adjustmentPaise) / 100;
    const existing = buckets.get(key);
    if (existing) existing.taxableValue += taxableValue;
    else buckets.set(key, { placeOfSupply, rate, taxableValue });
  }
  const rows = Array.from(buckets.values()).map((b) =>
    csvRow(["OE", b.placeOfSupply, b.rate, b.taxableValue.toFixed(2), "0.00"]),
  );
  return [csvRow(header), ...rows].join("\n");
}

export interface GSTR3BSummary {
  periodLabel: string;
  totalTaxableValuePaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  totalInvoiceValuePaise: number;
  invoiceCount: number;
}

export function summarizeGSTR3B(invoices: Invoice[], periodLabel: string): GSTR3BSummary {
  const confirmed = invoices.filter((inv) => inv.status !== "cancelled");
  let totalTaxableValuePaise = 0;
  let totalCgstPaise = 0;
  let totalSgstPaise = 0;
  let totalIgstPaise = 0;
  let totalInvoiceValuePaise = 0;
  for (const inv of confirmed) {
    const isInterState = inv.gstPaise > 0 && inv.cgstPaise === 0;
    totalTaxableValuePaise += inv.subtotalPaise - inv.adjustmentPaise;
    if (isInterState) totalIgstPaise += inv.gstPaise;
    else {
      totalCgstPaise += inv.cgstPaise;
      totalSgstPaise += inv.sgstPaise;
    }
    totalInvoiceValuePaise += inv.grandTotalPaise;
  }
  return {
    periodLabel,
    totalTaxableValuePaise,
    totalCgstPaise,
    totalSgstPaise,
    totalIgstPaise,
    totalInvoiceValuePaise,
    invoiceCount: confirmed.length,
  };
}

export function generateGSTR3BCSV(summary: GSTR3BSummary): string {
  const rows = [
    ["GSTR-3B Summary", summary.periodLabel],
    [],
    ["Section", "Taxable Value", "IGST", "CGST", "SGST/UTGST", "Cess"],
    [
      "3.1(a) Outward taxable supplies",
      (summary.totalTaxableValuePaise / 100).toFixed(2),
      (summary.totalIgstPaise / 100).toFixed(2),
      (summary.totalCgstPaise / 100).toFixed(2),
      (summary.totalSgstPaise / 100).toFixed(2),
      "0.00",
    ],
    [],
    ["Total invoices", summary.invoiceCount],
    ["Total invoice value", (summary.totalInvoiceValuePaise / 100).toFixed(2)],
  ];
  return rows.map((r) => csvRow(r)).join("\n");
}
