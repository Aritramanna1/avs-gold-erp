/**
 * Shared date formatting — en-IN locale. Replaces ~10 near-identical
 * fmtDate/formatDate re-implementations scattered across routes/lib.
 */

function toDate(val: string | number | Date | null | undefined): Date | null {
  if (val === null || val === undefined || val === "") return null;
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "15 Aug 2026" style — the common case across portals and documents. */
export function formatDateMedium(val: string | number | Date | null | undefined): string {
  const d = toDate(val);
  return d ? d.toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
}

/** "15 Aug 2026" via explicit day/month/year parts — same output as medium, used where callers spelled it out. */
export function formatDateShort(val: string | number | Date | null | undefined): string {
  const d = toDate(val);
  return d
    ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

/** "15 Aug 2026, 3:45 pm" — date + time. */
export function formatDateTime(val: string | number | Date | null | undefined): string {
  const d = toDate(val);
  return d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
