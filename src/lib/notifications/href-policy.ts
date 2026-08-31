/**
 * Shared notification deep-link allowlist (client + tests).
 * Server RPC mirrors these rules in validate_notification_href().
 */
import { getPublicSiteOrigin } from "@/lib/website/public-site-url";

/** Invite origin falls back to public site origin in this baseline workspace. */
function getPublicInviteOrigin(): string {
  return getPublicSiteOrigin();
}

export const ALLOWED_HREF_PREFIXES = [
  "/app",
  "/billing",
  "/orders",
  "/manufacturing",
  "/communications",
  "/settings",
  "/notifications",
  "/reports",
  "/portal",
  "/platform",
  "/treasury",
  "/stock",
  "/repair",
  "/people",
  "/conversion",
  "/invite",
  "/karigar-portal",
  "/customer-portal",
  "/supplier-portal",
] as const;

/** Strip same-origin absolute URLs to a relative ERP path; reject external/malformed. */
export function normalizeNotificationHref(href: string | null | undefined): string | null {
  if (!href) return null;
  let path = href.trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path) || path.startsWith("//")) {
    try {
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : null;
      const parsed = new URL(path);
      if (origin && parsed.origin !== origin) return null;
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return isAllowedNotificationHref(path) ? path : null;
}

export function isAllowedNotificationHref(href: string | null | undefined): boolean {
  const normalized = href?.trim();
  if (!normalized) return false;
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return false;
  if (/^https?:\/\//i.test(normalized)) return false;
  return ALLOWED_HREF_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix}/`) ||
      normalized.startsWith(`${prefix}?`),
  );
}

const LEGACY_NOTIFICATION_HREF_TARGETS: Record<string, string> = {
  "/settings/portal-users": "/settings?tab=users",
};

function remapLegacyNotificationHref(href: string): string {
  const pathOnly = href.split("?")[0]?.split("#")[0] ?? href;
  return LEGACY_NOTIFICATION_HREF_TARGETS[pathOnly] ?? href;
}

export function sanitizeNotificationHref(href: string | null | undefined): string | undefined {
  const raw = href?.trim();
  if (!raw) return undefined;
  return resolveNotificationNavigationTarget(raw) ?? undefined;
}

/** Remap legacy/broken inbox hrefs and return a safe in-app navigation target. */
export function resolveNotificationNavigationTarget(
  href: string | null | undefined,
): string | null {
  const raw = href?.trim();
  if (!raw) return null;
  return normalizeNotificationHref(remapLegacyNotificationHref(raw));
}

export function canNavigateNotification(href: string | null | undefined): boolean {
  return resolveNotificationNavigationTarget(href) !== null;
}

/** Parse a notification href into TanStack Router navigate args (pathname + search). */
export function parseNotificationNavigateTarget(
  href: string | null | undefined,
): { to: string; search?: Record<string, string>; hash?: string } | null {
  const normalized = resolveNotificationNavigationTarget(href);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized, "https://ornexa.local");
    const search: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      search[key] = value;
    });
    return {
      to: parsed.pathname,
      search: Object.keys(search).length > 0 ? search : undefined,
      hash: parsed.hash ? parsed.hash.slice(1) : undefined,
    };
  } catch {
    const [path, query = ""] = normalized.split("?");
    const search: Record<string, string> = {};
    if (query) {
      for (const part of query.split("&")) {
        const [key, value = ""] = part.split("=");
        if (key) search[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }
    return {
      to: path || normalized,
      search: Object.keys(search).length > 0 ? search : undefined,
    };
  }
}

export function navigateFromNotificationHref(
  navigate: (opts: { to: string; search?: Record<string, string>; hash?: string }) => void,
  href: string | null | undefined,
): boolean {
  const target = parseNotificationNavigateTarget(href);
  if (!target) return false;
  navigate(target);
  return true;
}

/** Resolve a clickable URL for email CTAs (invite accept, auth links, ERP deep links). */
export function resolveEmailActionUrl(rawHref: string | null | undefined): string {
  const raw = rawHref?.trim() ?? "";
  if (!raw) return "";

  // Public invitation and auth recovery links must remain absolute in email clients.
  if (/^https?:\/\//i.test(raw)) {
    if (/\/invite\/accept/i.test(raw) || /\/auth\//i.test(raw) || /type=recovery/i.test(raw)) {
      if (/localhost|127\.0\.0\.1/i.test(raw)) {
        try {
          const parsed = new URL(raw);
          return `${getPublicInviteOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
          return raw;
        }
      }
      return raw;
    }
  }

  if (raw.startsWith("/invite/")) {
    return `${getPublicInviteOrigin()}${raw}`;
  }

  const sanitized = sanitizeNotificationHref(raw);
  if (sanitized?.startsWith("/")) {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : getPublicSiteOrigin().replace(/\/$/, "");
    return `${origin}${sanitized}`;
  }

  return sanitized ?? raw;
}
