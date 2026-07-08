import { useState } from "react";
import { useSessionLock } from "@/lib/security/session-lock";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

/**
 * Full-screen overlay shown when the session is idle-locked (Plan 1 Step 8).
 * Rendered once at the app root, on top of everything else — doesn't change
 * the underlying app's layout/navigation/branding, just gates interaction
 * with it until the current user re-enters their password.
 */
export function SessionLockOverlay() {
  const locked = useSessionLock((s) => s.locked);
  const unlock = useSessionLock((s) => s.unlock);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  if (!locked) return null;

  if (email === null) {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    const result = await unlock(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Incorrect password");
      return;
    }
    setPassword("");
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Session Locked</h2>
          <p className="text-sm text-muted-foreground">
            {email ? `Signed in as ${email}` : "Loading session..."}
          </p>
        </div>
        <Input
          type="password"
          autoFocus
          placeholder="Enter your password to resume"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !password}>
          {busy ? "Unlocking..." : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
