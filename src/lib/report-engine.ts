/**
 * MTJ ERP — Report Engine
 * Shared utilities for all report pages: PDF, XLSX, CSV export,
 * date range filters, branch filters.
 *
 * NOTE: `xlsx` (~280 kB) is lazy-loaded on demand inside exportToXLSX so that
 * merely viewing a report does not pull the spreadsheet library into the chunk.
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
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function triggerPrint(): void {
  window.print();
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

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
