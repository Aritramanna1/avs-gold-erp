/**
 * MTJ ERP — R2 Storage Proxy Worker.
 *
 * Authenticated proxy in front of the `mtj-erp-files` R2 bucket. The browser
 * never talks to R2 directly (no R2 credentials ship to the client) — every
 * attachment upload/download goes through this Worker, which:
 *   1. Validates the caller's Supabase access token (GET /auth/v1/user).
 *   2. Resolves their firm/branch tenant from user_profiles + user_roles.
 *   3. Enforces that the object key's `firms/{firmId}/branches/{branchId}/…`
 *      prefix matches the caller's own tenant before touching R2.
 *
 * This is the sole authorization boundary for R2 objects — R2 itself has no
 * per-object RLS, so every route below must re-check tenant scope.
 *
 * Reconstructed from the deployed bundle (worker `mtj-storage-proxy`) on
 * 2026-08-15 to bring the live source under version control; behaviour is
 * unchanged from what's running in production.
 */

export interface Env {
  STORAGE: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  ALLOWED_ORIGIN: string;
}

const ALLOWED_ORIGINS = new Set([
  "https://erp.arivahly.in",
  "https://maatarajewellers.shop",
  "https://maatarajewellers.in",
  "https://aurum.arivahly.in",
  "https://aurum.erp.arivahly.in",
  "https://erp.aurum.arivahly.in",
  "https://aurumportal.arivahly.in",
  "https://avs-erp-preview-20260806.hostingersite.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function resolveCorsOrigin(request: Request, fallback: string): string {
  const origin = request.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  if (fallback && ALLOWED_ORIGINS.has(fallback)) return fallback;
  return "https://erp.arivahly.in";
}

const CORS_HEADERS = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Firm-Id",
  "Access-Control-Max-Age": "86400",
});

interface SupabaseUser {
  id: string;
  email: string;
}

async function validateSupabaseJwt(
  token: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<SupabaseUser | null> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user.id) return null;
  return { id: user.id, email: user.email ?? "" };
}

interface Tenant {
  firmId: string;
  branchId: string | null;
  isAdmin: boolean;
}

async function resolveTenant(token: string, userId: string, env: Env): Promise<Tenant | null> {
  const profileResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_profiles?select=firm_id,branch_id,active,status&auth_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_PUBLISHABLE_KEY } },
  );
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as Array<{
    firm_id?: string;
    branch_id?: string | null;
    active?: boolean;
    status?: string;
  }>;
  const profile = profiles[0];
  if (!profile?.firm_id || profile.active === false || profile.status === "suspended") {
    return null;
  }

  const rolesResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_PUBLISHABLE_KEY } },
  );
  const roles = rolesResponse.ok ? ((await rolesResponse.json()) as Array<{ role?: string }>) : [];

  return {
    firmId: profile.firm_id,
    branchId: profile.branch_id ?? null,
    isAdmin: roles.some((role) => ["saas_admin", "owner", "admin"].includes(role.role ?? "")),
  };
}

/** Object keys can be `firms/{firmId}/...`, `platform/...`, or `public/...`. */
function pathTenant(key: string): { firmId: string; branchId?: string } | null {
  const parts = key.split("/");
  if (parts[0] === "platform" || parts[0] === "public") {
    return { firmId: "public" };
  }
  if (parts[0] === "firms" && parts.length >= 2) {
    const firmId = parts[1];
    const branchId = parts[2] === "branches" && parts[3] ? parts[3] : undefined;
    return { firmId, branchId };
  }
  // Fallback for namespaced keys (e.g. customer-documents/{firmId}/...)
  if (parts.length >= 2 && parts[1]) {
    return { firmId: parts[1] };
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx?: { waitUntil: (p: Promise<unknown>) => void }): Promise<Response> {
    const origin = resolveCorsOrigin(request, env.ALLOWED_ORIGIN);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Firm-Id",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // URL shape: /{bucketNamespace}/{objectKey...} — bucketNamespace (e.g.
    // "catalog-designs") is client-side routing only, R2 itself is one bucket.
    const url = new URL(request.url);
    const parts = url.pathname.slice(1).split("/");
    if (parts.length < 2) {
      return new Response("Bad Request", { status: 400, headers: cors });
    }
    const objectKey = parts.slice(1).join("/");

    // GET / HEAD: Public/direct object read. Uses Cloudflare edge cache for sub-second retrieval.
    if (request.method === "GET" || request.method === "HEAD") {
      const cache = typeof caches !== "undefined" && (caches as any).default ? (caches as any).default : null;
      if (cache && request.method === "GET") {
        const cachedRes = await cache.match(request);
        if (cachedRes) {
          return cachedRes;
        }
      }

      const obj = await env.STORAGE.get(objectKey);
      if (!obj) return new Response("Not Found", { status: 404, headers: cors });
      const headers = new Headers(cors);
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      if (request.method === "HEAD") {
        return new Response(null, { headers });
      }
      const response = new Response(obj.body, { headers });
      if (cache && ctx?.waitUntil) {
        ctx.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    }

    // PUT / DELETE: Require valid Supabase user JWT and strict tenant scoping.
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    const user = await validateSupabaseJwt(token, env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);
    if (!user) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    const tenant = await resolveTenant(token, user.id, env);
    if (!tenant) return new Response("Tenant assignment required", { status: 403, headers: cors });

    const objectTenant = pathTenant(objectKey);
    if (
      !objectTenant ||
      (objectTenant.firmId !== "public" && objectTenant.firmId !== tenant.firmId)
    ) {
      return new Response("Forbidden", { status: 403, headers: cors });
    }

    if (request.method === "PUT") {
      const body = request.body;
      if (!body) return new Response("No body", { status: 400, headers: cors });
      await env.STORAGE.put(objectKey, body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") ?? "application/octet-stream",
        },
        customMetadata: { uploadedBy: user.id },
      });
      return new Response(JSON.stringify({ key: objectKey }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (request.method === "DELETE") {
      if (!tenant.isAdmin) return new Response("Forbidden", { status: 403, headers: cors });
      await env.STORAGE.delete(objectKey);
      return new Response(null, { status: 204, headers: cors });
    }

    return new Response("Method Not Allowed", { status: 405, headers: cors });
  },
};
