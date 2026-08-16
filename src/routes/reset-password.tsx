import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowLeft, CheckCircle2, ShieldAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Logo } from "@/components/ui/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Update Password · AVS Gold ERP" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we currently have an active session (set automatically by Supabase via hash link parameters)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    if (password.length < 10) {
      setErr("Password must be at least 10 characters long.");
      setBusy(false);
      return;
    }

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      setBusy(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErr(error.message);
      } else {
        setSuccess(true);
        toast.success("Password has been changed successfully.");

        // Let user sign up and log out of the temporary recovery session so they can authenticate cleanly
        await supabase.auth.signOut();
        setTimeout(() => {
          void navigate({ to: "/" });
        }, 3000);
      }
    } catch (ex: any) {
      setErr(ex.message || "Could not complete password update.");
    } finally {
      setBusy(false);
    }
  }

  if (hasSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm p-6 space-y-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-2xl text-red-400">Recovery Expired</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your recovery request is either invalid, expired, or was already consumed. Please
            request a fresh reset link to update your password.
          </p>
          <div className="pt-2">
            <Link to="/forgot-password">
              <Button className="w-full">Request new reset link</Button>
            </Link>
          </div>
          <Link to="/">
            <Button variant="ghost" className="w-full text-xs gap-1 mt-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to login
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="text-center space-y-2">
          <Logo className="h-8 mx-auto" />
          <h1 className="font-serif text-2xl text-gold">AVS Gold ERP</h1>
          <p className="text-xs text-muted-foreground">Define your new credentials securely</p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs text-left leading-relaxed flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Password has been updated! You are being redirected to the login portal. Please
                supply your new credentials to sign in.
              </div>
            </div>
            <Link to="/">
              <Button variant="ghost" className="w-full text-xs gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 pr-10"
                  type={showPassword ? "text" : "password"}
                  required
                  style={{ contentVisibility: "auto" }}
                  minLength={10}
                  placeholder="At least 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 pr-10"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={10}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {err && <div className="text-xs text-red-400 font-medium leading-relaxed">{err}</div>}

            <Button type="submit" className="w-full gap-1.5" disabled={busy || hasSession === null}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
