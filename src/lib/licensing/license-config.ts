/**
 * Embedded licensing configuration — NOT user-editable.
 *
 * The Arivahly API, verification key, and support URL are baked
 * into the application. End users can enter only their issued License Key.
 */

/** Central activation server. Baked in per build (`VITE_LICENSE_ENDPOINT`); customers never paste it. */
export const LICENSE_ACTIVATION_ENDPOINT = (import.meta.env.VITE_LICENSE_ENDPOINT ?? "")
  .toString()
  .trim();

/** Raw Ed25519 public verification key, base64url encoded. */
export const LICENSE_ED25519_PUBLIC_KEY = (import.meta.env.VITE_LICENSE_ED25519_PUBLIC_KEY ?? "")
  .toString()
  .trim();

/** Support / renewal contact — shown only as a "Contact Support" button. */
export const LICENSE_SUPPORT_URL = "https://arivahly.in/contact";

export const LICENSE_GRACE_DAYS = 0;
export const LICENSE_RENEWAL_NOTICE_DAYS = 7;
