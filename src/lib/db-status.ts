/**
 * AVS ERP - Supabase connection status.
 *
 * Reports live Supabase + auth status to the UI. Supabase is the production
 * source of truth; browser storage is limited to UI/session cache.
 */
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type DbStatus = "connected_authed" | "connected_anon" | "not_connected";

const LAST_MIGRATION_KEY = "mtj_last_migration_at";
const SOURCE_OF_TRUTH_KEY = "mtj_source_of_truth";
const MIGRATED_SNAPSHOT_KEY = "mtj_migrated_snapshot_hash";

export type SourceOfTruth = "supabase_online";

export function validateEnvironment(): { env: string; projectId: string; isValid: boolean } {
  const envMeta =
    typeof import.meta !== "undefined" && (import.meta as any).env
      ? (import.meta as any).env
      : undefined;
  const procEnv = typeof process !== "undefined" && process.env ? process.env : undefined;
  const env = (envMeta?.VITE_APP_ENV || procEnv?.VITE_APP_ENV || "development").toLowerCase();
  const projectId = envMeta?.VITE_SUPABASE_PROJECT_ID || procEnv?.VITE_SUPABASE_PROJECT_ID || "";

  const DEV_PROJECT_ID = "vqsrdemjiehzykexkcwo";
  const PROD_PROJECT_ID = "kjfjsfhftytezsjyegmb";

  if (env === "development" && projectId === PROD_PROJECT_ID) {
    console.error(
      "CRITICAL SECURITY VIOLATION: Development environment mapped to Production Supabase Project ID!",
    );
    throw new Error(
      "CRITICAL SECURITY ERROR: Development build configured with Production Supabase Project ID! Application locked.",
    );
  }

  return { env, projectId, isValid: true };
}

export function getDbStatusLabel(s: DbStatus): string {
  switch (s) {
    case "connected_authed":
      return "Supabase Connected - Signed in";
    case "connected_anon":
      return "Supabase Connected - Sign in required";
    case "not_connected":
      return "Supabase Not Connected";
  }
}

export function getLastMigrationAt(): string | null {
  return null;
}

export function setLastMigrationAt(iso: string = new Date().toISOString()): void {
  // Obsolete: no-op
}

export function getSourceOfTruth(): SourceOfTruth {
  return "supabase_online";
}

export function setSourceOfTruth(s: SourceOfTruth): void {
  // Obsolete: no-op
}

/**
 * Retired local-pilot compatibility shim. Production data lives in Supabase.
 */
export function computeLocalSnapshotHash(): string {
  return "";
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function hasLocalDiverged(): boolean {
  return false;
}

export function useDbStatus(): {
  status: DbStatus;
  email?: string;
  userId?: string;
  lastMigrationAt: string | null;
  sourceOfTruth: SourceOfTruth;
} {
  const [status, setStatus] = useState<DbStatus>("not_connected");
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const [lastMigrationAt, setLast] = useState<string | null>(null);
  const [sourceOfTruth, setSrc] = useState<SourceOfTruth>("supabase_online");

  useEffect(() => {
    let cancelled = false;
    setLast(null);
    setSrc("supabase_online");
    async function check() {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          setStatus("connected_authed");
          setEmail(data.session.user.email ?? undefined);
          setUserId(data.session.user.id);
        } else {
          setStatus("connected_anon");
        }
      } catch {
        if (!cancelled) setStatus("not_connected");
      }
    }
    check();
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) {
        setStatus("connected_authed");
        setEmail(session.user.email ?? undefined);
        setUserId(session.user.id);
      } else {
        setStatus("connected_anon");
        setEmail(undefined);
        setUserId(undefined);
      }
      setLast(null);
      setSrc("supabase_online");
    });
    // Sync when other tabs migrate
    const onStorage = () => {
      setLast(null);
      setSrc("supabase_online");
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { status, email, userId, lastMigrationAt, sourceOfTruth };
}
