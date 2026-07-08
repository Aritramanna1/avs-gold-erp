/**
 * WhatsApp deep-link helpers — no API, just URLs the user opens manually.
 */

/** Strip everything non-numeric and normalise Indian 10-digit numbers to 91… */
export function cleanPhone(raw: string | undefined | null): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  // 10-digit Indian mobile → prepend 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) return "91" + digits;
  // Already has country code (12-13 digits) → keep
  return digits;
}

export function isValidWaPhone(raw: string | undefined | null): boolean {
  const c = cleanPhone(raw);
  return c.length >= 10 && c.length <= 13;
}

export function waMobileUrl(phone: string, message: string): string {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function waWebUrl(phone: string, message: string): string {
  return `https://web.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeURIComponent(message)}`;
}
