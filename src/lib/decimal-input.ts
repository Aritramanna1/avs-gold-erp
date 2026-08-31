/**
 * String-based decimal field helpers — empty string means "cleared", not zero.
 * Use for weight/qty inputs so users can erase and re-type without snap-back.
 */

/** Trimmed empty / invalid → null; valid finite number → value. */
export function parseOptionalDecimal(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseDecimalOrZero(raw: string): number {
  return parseOptionalDecimal(raw) ?? 0;
}

/** Allow digits and one decimal point while typing. */
export function sanitizeDecimalTyping(raw: string): string {
  let out = "";
  let dot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (ch === "." && !dot) {
      out += ch;
      dot = true;
    }
  }
  return out;
}
