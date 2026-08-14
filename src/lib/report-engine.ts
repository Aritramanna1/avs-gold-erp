import { printDocument } from "@/lib/print-document";

/**
 * MTJ ERP — Report Engine
 * Shared utilities for all report pages: PDF, XLSX, CSV export,
 * date range filters, branch filters.
 *
 * The spreadsheet writer is lazy-loaded so report browsing does not add its
 * cost to application startup.
 */

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export function isInDateRange(ts: number, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = new Date(ts);
  const dateStr = d.toISOString().slice(0, 10);
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

function safeDownloadName(requested: string, extension: ".xlsx" | ".csv"): string {
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

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function triggerPrint(): void {
  void printDocument("ERP Report");
}

export function fmtG(mg: number): string {
  return (mg / 1000).toFixed(3) + "g";
}

export function fmtRs(paise: number): string {
  return (
    "₹" +
    (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export { formatDateShort as fmtDate } from "@/lib/format-date";
