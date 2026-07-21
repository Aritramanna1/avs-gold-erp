import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, KeyRound, Eye, EyeOff, ShieldAlert, Loader2, WifiOff } from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { verifyLocalLogin, setLocalSession } from "@/lib/local-auth";

interface LocalAuthLayoutProps {
  onSuccess: (userId: string, role: string) => void;
}

/**
 * Offline-mode login form — verifies against the local encrypted SQLite DB
 * (local_users table) instead of Supabase. Deliberately simpler than
 * AuthLayout.tsx: no OTP/invite-accept links, since those require a cloud
 * account that doesn't exist in Offline mode.
 */
export function LocalAuthLayout({ onSuccess }: LocalAuthLayoutProps) {
  const { firm } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const result = await verifyLocalLogin(email.trim(), password);
      if (!result.ok || !result.user) {
        setErr(result.error || "Invalid email or password.");
        return;
      }
      await setLocalSession(result.user.id);
      onSuccess(result.user.id, result.user.role);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-8 relative overflow-hidden">
      <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-sm p-6 space-y-5 border-border shadow-elegant bg-card/85 backdrop-blur-md relative z-10">
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold shadow-sm border border-gold/15">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-wide text-gold mt-1.5">
            {(firm.shopName || APP_NAME).toUpperCase()}
          </h1>
          <p className="text-[9px] tracking-widest text-muted-foreground/70 font-medium">
            {APP_TAGLINE}
          </p>
          <p className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-1">
            <WifiOff className="h-3 w-3" /> Offline Mode — Local Sign-In
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="local-auth-form">
          <div className="grid gap-1.5">
            <Label htmlFor="local-auth-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="local-auth-email"
                className="pl-9 h-10"
                data-testid="local-auth-email"
                type="email"
                autoComplete="email"
                required
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="local-auth-password">Password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="local-auth-password"
                className="pl-9 pr-10 h-10"
                data-testid="local-auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={busy}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {err && (
            <div
              className="text-xs text-red-400 font-medium leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2"
              data-testid="local-auth-error"
            >
              <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <Button
            data-testid="local-auth-submit"
            type="submit"
            className="w-full h-10 bg-gold hover:bg-gold/90 text-black font-semibold mt-2"
            disabled={busy}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
