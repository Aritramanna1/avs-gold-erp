/**
 * OpenWA URL helpers — no hard-coded localhost assumptions in routing logic.
 */

/** True when the host is loopback or a private LAN address (unreachable from mobile/cloud). */
export function isLocalhostOpenWaUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      return true;
    }
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Cloud OpenWA endpoints should use HTTPS in production (warn-only in UI). */
export function isSecureOpenWaCloudUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}
