/**
 * Unified Print Engine — shared, dependency-free resolution helpers used
 * by both the React section renderers and the PDF generator, so "does
 * this section show" and "what's this field's value" are answered
 * identically in every output path.
 */
import type { PrintDocumentData } from "./types";

/** Dot-path lookup into a plain object, e.g. getPath(obj, "customer.phone"). */
export function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

/** A section/field/column with no showIf is always visible. */
export function isVisible(showIf: string | undefined, flags: PrintDocumentData["flags"]): boolean {
  if (!showIf) return true;
  return !!flags[showIf];
}
