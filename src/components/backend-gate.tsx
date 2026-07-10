import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * BackendGate — passive connectivity check, logged for diagnostics only.
 *
 * This used to hard-block the whole app behind a "Backend Connection
 * Required" screen whenever the live session check failed (e.g. no
 * internet). That contradicted the app's offline-first design (local
 * encrypted SQLite + outbox + sync engine, all built specifically so the
 * app keeps working without a live connection and reconciles later).
 * AuthGate already gates on actual session validity (SIGNED_OUT etc.) and
 * tolerates network blips with its own retry logic — this component no
 * longer duplicates that gating, it just logs unreachability so offline
 * sessions are visible in diagnostics without blocking the UI.
 */
export function BackendGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        console.warn("[BackendGate] Backend unreachable, continuing offline:", error.message);
      }
    });
  }, []);

  return <>{children}</>;
}
