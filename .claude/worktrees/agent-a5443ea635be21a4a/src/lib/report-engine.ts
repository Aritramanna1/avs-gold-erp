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
