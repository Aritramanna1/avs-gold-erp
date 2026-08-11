import { useEffect, useState } from "react";
import { useSessionLock } from "@/lib/security/session-lock";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
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
  /** The signed-in identity: null = still resolving, "" = none stored. */
  const [email, setEmail] = useState<string | null>(null);
  /** Typed by the user, only when no identity could be resolved. */
  const [typedEmail, setTypedEmail] = useState("");

  /**
   * Whose session is locked.
   *
   * MUST come from the same place that will verify the password. In Offline
   * mode there is no Supabase session at all: `supabase.auth.getSession()`
   * resolves to none (or, with no network, doesn't resolve promptly), so `email`
   * stayed null — the overlay sat on "Loading session…" forever AND
   * `handleUnlock` returned early at `if (!email)`, making the Unlock button
   * permanently dead. The user was locked out of their own offline install.
   *
   * Online mode reads Supabase. On any failure `email` resolves to "" and the
   * form falls back to asking for it, rather than silently disabling itself.
   */
  useEffect(() => {
    if (!locked) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setEmail(data.session?.user.email ?? "");
      } catch (err) {
        console.error("[SessionLock] Could not resolve the locked session's user:", err);
        if (!cancelled) setEmail("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locked]);

  // `email` null = still resolving who is locked. "" = resolved, nobody stored,
  // so the user supplies it themselves rather than being stranded.
  const needsEmail = email === "";
  const effectiveEmail = (email || typedEmail).trim();

  if (!locked) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (email === null || !effectiveEmail) return;
    setBusy(true);
    setError(null);
    // Trim both fields — trailing/leading whitespace from autofill or an
    // accidental space is invisible to the operator but makes Supabase
    // reject an otherwise-correct password as "Invalid login credentials".
    const result = await unlock(effectiveEmail, password.trim());
    setBusy(false);
    if (!result.ok) {
      const isRateLimited = /rate limit|too many requests/i.test(result.error ?? "");
      setError(
        isRateLimited
          ? "Too many attempts — please wait a minute before trying again."
          : (result.error ?? "Incorrect password"),
      );
      return;
    }
    setPassword("");
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <form
        onSubmit={handleUnlock}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-lg"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Session Locked</h2>
          <p className="text-sm text-muted-foreground">
            {email === null
              ? "Restoring session…"
              : email
                ? `Signed in as ${email}`
                : "Enter your email and password to resume"}
          </p>
        </div>

        {/* Only when no identity is stored. A locked screen must never become
            un-unlockable just because we couldn't work out who is signed in. */}
        {needsEmail && (
          <Input
            type="email"
            autoFocus
            placeholder="Email"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
          />
        )}

        <Input
          type="password"
          autoFocus={!needsEmail}
          placeholder="Enter your password to resume"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={busy || !password || email === null || !effectiveEmail}
        >
          {busy ? "Unlocking..." : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
