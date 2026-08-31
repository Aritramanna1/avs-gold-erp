/**
 * WhatsApp deep-link helpers — no API, just URLs the user opens manually.
 */

/**
 * Normalises a stored phone number into the digits-with-country-code form
 * wa.me requires.
 *
 * wa.me does NOT resolve a bare national number — `wa.me/9876543210` opens a
 * chat with a nonexistent contact rather than failing loudly, so a number that
 * isn't normalised here produces a link that looks like it worked and silently
 * reaches nobody. Every WhatsApp URL in the app must be built through the
 * helpers below rather than string-concatenating a phone.
 *
 * Handled: spaces/dashes/brackets, a leading `+`, the trunk `0` a lot of Indian
 * records carry (`09876543210`, `0091…`), and numbers that already have 91.
 */
export function cleanPhone(raw: string | undefined | null): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // 00 international prefix (0091 98765 43210)
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Trunk zero before a 10-digit national number (09876543210)
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  // 10-digit Indian mobile → prepend country code
  if (digits.length === 10 && /^[6-9]/.test(digits)) return "91" + digits;
  // Already carries a country code → keep as-is
  return digits;
}

/**
 * Whether a number can actually be opened in WhatsApp. A phone that merely
 * EXISTS on the record is not enough — a 5-digit landline or a typo yields a
 * link that opens WhatsApp on an unknown contact.
 */
export function isValidWaPhone(raw: string | undefined | null): boolean {
  const c = cleanPhone(raw);
  // 11 = shortest plausible country code + national number; 15 = E.164 maximum.
  return c.length >= 11 && c.length <= 15;
}

/** wa.me — works on desktop (hands off to the WhatsApp app) and mobile. */
export function waMobileUrl(phone: string, message: string): string {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function waWebUrl(phone: string, message: string): string {
  return `https://web.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeURIComponent(message)}`;
}
