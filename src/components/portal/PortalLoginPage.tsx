import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckCircle2,
  Hammer,
  Loader2,
  Mail,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { isGoogleOAuthEnabled, signInWithGoogle } from "@/lib/auth/google-oauth";

export type PortalLoginRole = "customer" | "karigar" | "supplier";

const PORTAL_RETURN_KEY = "avs_portal_auth_return";

const META: Record<
  PortalLoginRole,
  { title: string; subtitle: string; icon: typeof Users; portalPath: string }
> = {
  customer: {
    title: "Customer Portal",
    subtitle: "Track orders, invoices, and repairs",
    icon: Users,
    portalPath: "/customer-portal",
  },
  karigar: {
    title: "Karigar Portal",
    subtitle: "Gold book, jobs, and work returns",
    icon: Hammer,
    portalPath: "/karigar-portal",
  },
  supplier: {
    title: "Supplier Portal",
    subtitle: "Purchase orders and challans",
    icon: Truck,
    portalPath: "/supplier-portal",
  },
};

export function setPortalAuthReturn(path: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PORTAL_RETURN_KEY, path);
}

export function consumePortalAuthReturn(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const path = sessionStorage.getItem(PORTAL_RETURN_KEY);
  sessionStorage.removeItem(PORTAL_RETURN_KEY);
  return path;
}

interface PortalLoginPageProps {
  role: PortalLoginRole;
}

export function PortalLoginPage({ role }: PortalLoginPageProps) {
  const meta = META[role];
  const Icon = meta.icon;
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        void navigate({ to: meta.portalPath as "/karigar-portal", replace: true });
        return;
      }
      setCheckingSession(false);
    })();
    return () => {
      active = false;
    };
  }, [meta.portalPath, navigate]);

  async function goToPortal() {
    void navigate({ to: meta.portalPath as "/karigar-portal", replace: true });
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setCodeSent(true);
      toast.success("Verification code sent.");
    } catch (ex) {
      const message = ex instanceof Error ? ex.message : "Could not send verification code.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifyBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      toast.success("Signed in successfully.");
      await goToPortal();
    } catch (ex) {
      const message = ex instanceof Error ? ex.message : "Invalid or expired code.";
      setErr(message);
    } finally {
      setVerifyBusy(false);
    }
  }

  async function handleGoogle() {
    setGoogleBusy(true);
    setErr(null);
    setPortalAuthReturn(meta.portalPath);
    const result = await signInWithGoogle({
      redirectPath: `/auth/callback?portal=${role}`,
    });
    if (!result.ok) {
      setGoogleBusy(false);
      setErr(result.error ?? "Google sign-in failed.");
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur px-4 py-3 safe-area-top">
        <div className="mx-auto max-w-md flex items-center justify-between gap-3">
          <Link to="/" className="text-xs text-muted-foreground hover:text-gold inline-flex items-center gap-1 min-h-11">
            <ArrowLeft className="h-3.5 w-3.5" /> Portal home
          </Link>
          <span className="text-xs font-medium text-gold">Aurum Portal</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <Card className="w-full max-w-md p-6 space-y-5 shadow-lg border-gold/10">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold">
              <Icon className="h-6 w-6" />
            </div>
            <h1 className="font-serif text-xl text-gold">{meta.title}</h1>
            <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>

          {codeSent ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Enter the 6-digit code sent to <strong className="break-all">{email}</strong>
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Verification code</Label>
                <Input
                  className="text-center tracking-widest text-lg font-mono min-h-11"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              {err ? <p className="text-xs text-red-400">{err}</p> : null}
              <Button type="submit" className="w-full min-h-11" disabled={verifyBusy}>
                {verifyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full min-h-11 text-xs"
                onClick={() => {
                  setCodeSent(false);
                  setOtp("");
                }}
              >
                Send a new code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 min-h-11"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              {err ? <p className="text-xs text-red-400">{err}</p> : null}
              <Button type="submit" className="w-full min-h-11" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification code"}
              </Button>
            </form>
          )}

          {isGoogleOAuthEnabled() ? (
            <>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-11"
                disabled={googleBusy}
                onClick={() => void handleGoogle()}
              >
                {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Google"}
              </Button>
            </>
          ) : null}

          <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
            Use the email your jeweller linked to your {role} profile. Need help?{" "}
            <Link to="/invite/accept" className="text-gold underline-offset-2 hover:underline">
              Accept an invite
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
