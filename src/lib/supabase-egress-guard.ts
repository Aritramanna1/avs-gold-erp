/**
 * Production Supabase egress quarantine — blocks outbound API/Auth/Storage/Edge
 * traffic from local dev and Playwright unless explicitly opted in.
 * Does not weaken RLS; prevents localhost from billing against production.
 */

export const PRODUCTION_SUPABASE_REF = "vqsrdemjiehzykexkcwo";

const BILLABLE_PATH_RE =
  /\/(rest|auth|storage|functions|realtime)\/v1\//i;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** True when this browser/build must not call production Supabase over the network. */
export function isProductionSupabaseEgressBlocked(): boolean {
  const env: Record<string, string | boolean | undefined> =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : (typeof process !== "undefined" && process.env ? process.env : {});

  if (env.VITE_ENABLE_DEV_SUPABASE === "1") return false;
  if (env.ALLOW_PROD_E2E === "1") return false;
  const block =
    env.VITE_DISABLE_PARITY_BOOT === "1" ||
    env.VITE_DISABLE_PARITY_BOOT === "true" ||
    env.PLAYWRIGHT_SUPABASE_BLOCK === "1" ||
    env.PLAYWRIGHT_SUPABASE_BLOCK === "true";
  if (block) return true;
  return Boolean(env.DEV);
}

export function isProductionSupabaseUrl(url: string): boolean {
  return url.includes(PRODUCTION_SUPABASE_REF);
}

export function shouldBlockSupabaseRequest(input: RequestInfo | URL): boolean {
  if (!isProductionSupabaseEgressBlocked()) return false;
  const url = requestUrl(input);
  if (!isProductionSupabaseUrl(url)) return false;
  return BILLABLE_PATH_RE.test(url);
}

export function blockedSupabaseResponse(): Response {
  return new Response(
    JSON.stringify({
      message:
        "Production Supabase egress quarantined in dev. Use npm run preview:shop for UI-only work, or set VITE_ENABLE_DEV_SUPABASE=1 locally (never commit).",
      code: "EGRESS_QUARANTINE",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    },
  );
}
