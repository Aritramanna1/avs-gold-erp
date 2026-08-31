/**
 * Barcode encode helpers: Code128 (default), EAN-13 with check digit,
 * GS1 DataMatrix payload. HUID is never encoded here.
 */
export type BarcodeSymbology = "code128" | "ean13" | "gs1_datamatrix";

/** GS1 EAN-13 check digit for a 12-digit numeric body. */
export function ean13CheckDigit(body12: string): number {
  if (!/^\d{12}$/.test(body12)) {
    throw new Error("EAN-13 body must be exactly 12 digits");
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(body12[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function buildEan13(body12: string): string {
  const digs = body12.replace(/\D/g, "").padStart(12, "0").slice(-12);
  return `${digs}${ean13CheckDigit(digs)}`;
}

/**
 * Build the string that goes into the symbol.
 * - code128: internal shop code
 * - ean13: requires firm GS1 company prefix; otherwise falls back to internal code
 * - gs1_datamatrix: (01)GTIN when prefix set; optional (21) serial / (10) lot
 */
export function buildEncodePayload(input: {
  symbology: BarcodeSymbology;
  internalCode: string;
  gtinPrefix?: string;
  serial?: string;
  lot?: string;
}): string {
  const code = String(input.internalCode || "")
    .trim()
    .replace(/\s+/g, "");
  if (!code) throw new Error("Barcode value is required");

  if (input.symbology === "ean13") {
    const prefix = (input.gtinPrefix || "").replace(/\D/g, "");
    if (prefix.length < 6 || prefix.length > 9) {
      return code.slice(0, 32);
    }
    const itemPart = code
      .replace(/\D/g, "")
      .padStart(12 - prefix.length, "0")
      .slice(-(12 - prefix.length));
    return buildEan13(`${prefix}${itemPart}`.slice(0, 12));
  }

  if (input.symbology === "gs1_datamatrix") {
    const prefix = (input.gtinPrefix || "").replace(/\D/g, "");
    let body = "";
    if (prefix.length >= 6 && prefix.length <= 9) {
      const itemPart = code
        .replace(/\D/g, "")
        .padStart(12 - prefix.length, "0")
        .slice(-(12 - prefix.length));
      const gtin = buildEan13(`${prefix}${itemPart}`.slice(0, 12));
      body = `(01)${gtin}`;
    } else {
      body = code.slice(0, 48);
    }
    const serial = input.serial?.trim();
    const lot = input.lot?.trim();
    if (serial) body += `(21)${serial.slice(0, 20)}`;
    if (lot) body += `(10)${lot.slice(0, 20)}`;
    return body;
  }

  return code.slice(0, 64);
}
