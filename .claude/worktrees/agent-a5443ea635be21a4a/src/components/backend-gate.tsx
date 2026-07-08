import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioTower, CloudAlert, RefreshCw } from "lucide-react";

/**
 * BackendGate — verifies the Supabase session is still valid.
 *
 * AuthGate already confirmed auth + ran pullCritical() before this mounts,
 * so we only need a lightweight session check — NOT a full DB query.
 * The previous implementation wasted 2 extra round-trips (getSession +
 * people.select) that were redundant with what AuthGate already did.
 */
export function BackendGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function checkConnection() {
    setChecking(true);
    setErrorMsg(null);
    try {
      // AuthGate already ran pullCritical which hit the DB.
      // We only need to confirm the session token is still valid —
      // no additional DB query needed.
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Authentication check failed: ${sessionErr.message}`);
      }
      if (!sessionData.session) {
        setConnected(false);
        setErrorMsg("Your session is not valid or has expired. Please log in again.");
        setChecking(false);
        return;
      }
      setConnected(true);
    } catch (err) {
      console.error("[BackendGate Error]:", err);
      setConnected(false);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not reach the database. Please verify your internet connection.",
      );
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    // Use cached session from Supabase client — avoids a network round-trip
    // since AuthGate already authenticated. getSession() returns the cached
    // value immediately when there is one.
    void checkConnection();
  }, []);

  if (checking) {
    return null;
  }

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md p-8 border-slate-800 bg-slate-900 text-slate-100 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <RadioTower className="h-32 w-32" />
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-red-400">
              <CloudAlert className="h-6 w-6" />
              <h2 className="text-lg font-semibold tracking-tight">Live Backend Required</h2>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-red-500 font-bold">
                CRITICAL INSTRUCTION VIOLATION GATED
              </p>
              <h1 className="font-serif text-2xl text-slate-100 italic leading-snug">
                Backend Connection Required
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                MTJ ERP has removed transient client-only local modes to protect ledger consistency.
                A secure live connection to the cloud database is mandatory for all operations.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-900/30 rounded text-xs font-mono text-red-300 leading-relaxed">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Button
                onClick={() => void checkConnection()}
                className="w-full bg-gold hover:bg-gold/90 text-slate-950 font-medium py-2 flex items-center justify-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Connection</span>
              </Button>
              <p className="text-[11px] text-center text-slate-500 leading-relaxed">
                Please make sure you have an active internet connection. Offline operation is
                permitted only as a transient cache after successful initial synchronization.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
