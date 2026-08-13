import { useEffect, type ReactNode } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

/**
 * Passive Supabase connectivity diagnostic.
 */
export function BackendGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      if (error) console.warn("[BackendGate] Supabase session check failed:", error.message);
    });
  }, []);

  return <>{children}</>;
}
