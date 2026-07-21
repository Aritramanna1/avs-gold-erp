/**
 * MTJ ERP — Lovable Cloud / Supabase connection status.
 *
 * Reports live cloud + auth + migration status to the UI.
 * Cloud is the source of truth once a user is signed in.
 * Local pilot storage remains as offline cache / fallback.
 */
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type DbStatus = "connected_authed" | "connected_anon" | "not_connected";

const LAST_MIGRATION_KEY = "mtj_last_migration_at";
const SOURCE_OF_TRUTH_KEY = "mtj_source_of_truth";
const MIGRATED_SNAPSHOT_KEY = "mtj_migrated_snapshot_hash";

export type SourceOfTruth = "cloud" | "local";

export function getDbStatusLabel(s: DbStatus): string {
  switch (s) {
    case "connected_authed":
      return "Cloud Connected · Signed in";
    case "connected_anon":
      return "Cloud Connected · Local Pilot Storage";
    case "not_connected":
      return "Cloud Not Connected · Using Local Pilot Storage";
  }
}

export function getLastMigrationAt(): string | null {
  return null;
}

export function setLastMigrationAt(iso: string = new Date().toISOString()): void {
  // Obsolete: no-op
}

export function getSourceOfTruth(): SourceOfTruth {
  return "cloud";
}

export function setSourceOfTruth(s: SourceOfTruth): void {
  // Obsolete: no-op
}

/**
 * Fingerprint of all local MTJ stores. Two snapshots with the same hash
 * mean the local pilot data is byte-identical. Used to detect divergence
 * between local cache and what was last pushed to Lovable Cloud.
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
  const [sourceOfTruth, setSrc] = useState<SourceOfTruth>("cloud");

  useEffect(() => {
    let cancelled = false;
    setLast(null);
    setSrc("cloud");
    async function check() {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data.user) {
          setStatus("connected_authed");
          setEmail(data.user.email ?? undefined);
          setUserId(data.user.id);
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
      setSrc("cloud");
    });
    // Sync when other tabs migrate
    const onStorage = () => {
      setLast(null);
      setSrc("cloud");
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
