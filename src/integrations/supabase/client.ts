import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function env(name: string): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim().replace(/^['"]|['"]$/g, "") : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL");
const SUPABASE_PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");

// Retained only so old settings imports compile; web deployments use build-time
// environment configuration and never use these keys as an identity store.
export const SUPABASE_RUNTIME_KEYS = {
  url: "supabase_runtime_url",
  key: "supabase_runtime_key",
  projectId: "supabase_runtime_project_id",
} as const;

export function isSupabaseConfigured(): boolean {
  return /^https?:\/\//.test(SUPABASE_URL) && Boolean(SUPABASE_PUBLISHABLE_KEY);
}

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before starting the web app.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: (input, init) => {
        const timeoutSignal = AbortSignal.timeout(10_000);
        const signal =
          init?.signal && typeof AbortSignal.any === "function"
            ? AbortSignal.any([init.signal, timeoutSignal])
            : (init?.signal ?? timeoutSignal);
        return fetch(input, { ...init, signal });
      },
    },
  });
}

let client: ReturnType<typeof createSupabaseClient> | undefined;

/** The only application data/auth client. All identity and business data are cloud-backed. */
export function getSupabaseClient(): ReturnType<typeof createSupabaseClient> {
  client ??= createSupabaseClient();
  return client;
}

/** Compatibility alias for synchronization and repository code. */
export function getRawSupabaseClient(): ReturnType<typeof createSupabaseClient> {
  return getSupabaseClient();
}
