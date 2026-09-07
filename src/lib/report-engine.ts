/**
 * AVS ERP — Report Engine
 * Shared utilities for all report pages: PDF, XLSX, CSV export,
 * date range filters, branch filters.
 *
 * The spreadsheet writer is lazy-loaded so report browsing does not add its
 * cost to application startup.
 */

import { isNativeApp } from "@/lib/native/platform";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export function isInDateRange(ts: number, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return true;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  if (range.from && dateStr < range.from) return false;
  if (range.to && dateStr > range.to) return false;
  return true;
}

export function thisMonthRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

/** Monday-start week containing today (ISO week convention, matches Indian business-week practice). */
export function thisWeekRange(): DateRange {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

export function thisYearRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  return { from, to };
}

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly" | "custom";

/** Shared period→range resolver so every report's Daily/Weekly/Monthly/Yearly
 * toggle agrees on the same week/month/year boundaries — one implementation,
 * not five reports each rolling their own. */
export function rangeForPeriod(period: ReportPeriod, custom: DateRange): DateRange {
  const today = new Date().toISOString().slice(0, 10);
  switch (period) {
    case "daily":
      return { from: today, to: today };
    case "weekly":
      return thisWeekRange();
    case "monthly":
      return thisMonthRange();
    case "yearly":
      return thisYearRange();
    case "custom":
    default:
      return custom;
  }
}

export async function exportToXLSX(
  filename: string,
  sheets: Record<string, (string | number)[][]>,
): Promise<void> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const usedNames = new Set<string>();

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const worksheet = workbook.addWorksheet(uniqueWorksheetName(sheetName, usedNames));
    worksheet.addRows(rows.map((row) => row.map(sanitizeSpreadsheetCell)));
  }

  const output = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([new Uint8Array(output)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    safeDownloadName(filename, ".xlsx"),
  );
}

export function exportToCSV(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(sanitizeSpreadsheetCell(c));
          return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, safeDownloadName(filename, ".csv"));
}

function sanitizeSpreadsheetCell(value: string | number): string | number {
  if (typeof value !== "string") return value;
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

function uniqueWorksheetName(requested: string, usedNames: Set<string>): string {
  const base =
    requested
      .replace(/[\\/*?:[\]]/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";
  let name = base;
  let suffix = 1;
  while (usedNames.has(name.toLocaleLowerCase())) {
    const marker = ` (${++suffix})`;
    name = `${base.slice(0, 31 - marker.length)}${marker}`;
  }
  usedNames.add(name.toLocaleLowerCase());
  return name;
}

function safeDownloadName(
  requested: string,
  extension: ".xlsx" | ".csv" | ".xml",
): string {
  const rawLeaf = requested
    .split(/[\\/]/)
    .pop()
    ?.replace(/[<>:"|?*]/g, "-");
  const leaf = rawLeaf
    ? Array.from(rawLeaf, (character) => (character.charCodeAt(0) < 32 ? "-" : character))
        .join("")
        .trim()
    : "";
  const name = leaf || `erp-export${extension}`;
  return name.toLocaleLowerCase().endsWith(extension) ? name : `${name}${extension}`;
}

/** Download arbitrary text/binary exports through the universal export blob path. */
export function exportBlobFile(
  filename: string,
  content: string | Blob,
  mimeType: string,
  extension: ".xlsx" | ".csv" | ".xml",
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  downloadBlob(blob, safeDownloadName(filename, extension));
}

function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;

  const triggerBrowserDownload = () => {
    const rawUrl = URL.createObjectURL(blob);
    if (!rawUrl.startsWith("blob:")) return;
    const a = document.createElement("a");
    a.setAttribute("href", rawUrl);
    a.setAttribute("download", filename.replace(/[^a-zA-Z0-9._\-]/g, "_"));
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(rawUrl), 100);
  };

  // Web: fire download synchronously so Playwright (and the browser) observe the event.
  if (!isNativeApp()) {
    triggerBrowserDownload();
    return;
  }

  void (async () => {
    const { downloadPdfBlob } = await import("@/lib/native/document-output");
    await downloadPdfBlob(blob, filename);
  })();
}

export async function triggerPrint(
  title = "ERP Report",
  range?: { from?: string; to?: string },
  tables?: string[][][],
): Promise<void> {
  const { extractReportTables, generateReportPdf } = await import("@/lib/print-engine/pdf/report");
  const { reportShareCaption } = await import("@/lib/native/share-caption");
  const root =
    document.querySelector("[data-testid='report-print-source']") ??
    document.querySelector("[data-testid='print-layout-root']");
  const resolvedTables = tables?.length ? tables : extractReportTables(root);
  const pdf = await generateReportPdf({
    title,
    from: range?.from,
    to: range?.to,
    tables: resolvedTables,
  });
  const { usePrintEngine } = await import("@/lib/print-engine");
  usePrintEngine.getState().triggerPrint("", title, {
    pdfBlob: pdf.blob,
    pdfFileName: pdf.fileName,
    shareCaption: reportShareCaption({ title, from: range?.from, to: range?.to }),
  });
}

export function fmtG(mg: number): string {
  if (typeof mg !== "number" || isNaN(mg) || !Number.isFinite(mg)) return "0.000 g";
  const sign = mg < 0 ? "-" : "";
  const absG = Math.abs(mg) / 1000;
  return `${sign}${absG.toFixed(3)} g`;
}

export function fmtRs(paise: number): string {
  if (typeof paise !== "number" || isNaN(paise) || !Number.isFinite(paise)) return "₹ 0.00";
  const sign = paise < 0 ? "-" : "";
  const absRs = Math.abs(paise) / 100;
  return (
    `${sign}₹ ` +
    absRs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export { formatDateShort as fmtDate } from "@/lib/format-date";
