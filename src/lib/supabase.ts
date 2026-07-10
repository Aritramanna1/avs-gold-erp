import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Helper to sanitize environment variables
function sanitizeEnvValue(val: string | undefined | null): string {
  if (!val) return "";
  let s = val.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  if (s.startsWith("'") && s.endsWith("'")) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

// Safely check if a given string is a Supabase service role key (JWT check)
function isServiceRoleKey(key: string): boolean {
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    const payloadStr =
      typeof atob !== "undefined"
        ? atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("binary");
    const payload = JSON.parse(payloadStr);
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

// Ensure the client is memoized/cached as a single instance
let cachedClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient) {
    return cachedClient;
  }

  const rawUrl = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
  const rawKey =
    sanitizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    sanitizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

  // Configuration details
  const fallbackUrl = "https://kjfjsfhftytezsjyegmb.supabase.co";
  const fallbackKey = "sb_publishable_fThRlMsK8N5t_wU9_fzd7g_XBvvr-zW";

  const url = rawUrl || fallbackUrl;
  const key = rawKey || fallbackKey;

  if (!url) {
    throw new Error("Supabase URL is missing. Please define VITE_SUPABASE_URL.");
  }

  const isValidUrl = url.startsWith("http://") || url.startsWith("https://");
  if (!isValidUrl) {
    throw new Error(`Invalid Supabase URL: "${url}". It must be a valid HTTP or HTTPS URL.`);
  }

  if (!key) {
    throw new Error(
      "Supabase Anon/Publishable Key is missing. Please define VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  if (isServiceRoleKey(key)) {
    throw new Error(
      "Security Violation: A Supabase service_role key was detected. For security reasons, service_role keys must never be exposed or used in the client-side application.",
    );
  }

  try {
    cachedClient = createClient<Database>(url, key, {
      auth: {
        storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return cachedClient;
  } catch (err: any) {
    console.error("Critical error during Supabase client initialization:", err);
    throw err;
  }
}

export const supabase = getSupabaseClient();
