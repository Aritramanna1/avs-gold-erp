import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export const Route = createFileRoute("/otp-login")({
  head: () => ({ meta: [{ title: "Sign In with OTP · AVS Gold ERP" }] }),
  component: OtpLoginPage,
});

function OtpLoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    // Removed strict frontend check to adapt dynamically to Supabase's bot protection toggle.
    // If Supabase actually requires CAPTCHA, it will fail at the API level and return a CAPTCHA-related error.
    setBusy(true);
    setErr(null);
    setSuccess(false);

    try {
      // OTP-only: no emailRedirectTo — this never sends a clickable sign-in
      // link, only a one-time 6-digit code (per the {{ .Token }} configured
      // in the Supabase "Magic Link" email template).
      const { error } = await supabase.auth.signInWithOtp({ email });

      if (error) {
        setErr(error.message);
      } else {
        setSuccess(true);
        toast.success("Verification code sent successfully.");
      }
    } catch (ex: any) {
      setErr(ex.message || "Could not send the verification code.");
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
        email,
        token: otp,
        type: "email",
      });

      if (error) {
        setErr(error.message);
      } else {
        toast.success("Authentication validated! Secure session established.");
        void navigate({ to: "/" });
      }
    } catch (ex: any) {
      setErr(ex.message || "Invalid or expired code.");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
            <Mail className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-2xl text-gold">MTJ ERP</h1>
          <p className="text-xs text-muted-foreground">Sign in with a one-time code</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs text-left leading-relaxed flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                A 6-digit verification code has been sent to{" "}
                <strong className="break-all">{email}</strong>. Enter it below to sign in.
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">6-Digit Verification Code</Label>
                  <Input
                    className="text-center tracking-widest text-lg font-mono"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </div>

                {err && (
                  <div className="text-xs text-red-400 font-medium leading-relaxed">{err}</div>
                )}

                <Button type="submit" className="w-full gap-1.5" disabled={verifyBusy}>
                  {verifyBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify Code & Access
                </Button>
              </form>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setSuccess(false);
                setOtp("");
              }}
              className="w-full text-xs gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Send code again
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("auth.emailLabel")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  type="email"
                  required
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {err && <div className="text-xs text-red-400 font-medium leading-relaxed">{err}</div>}

            <Button type="submit" className="w-full gap-1.5" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Verification Code
            </Button>

            <Link to="/">
              <Button variant="ghost" type="button" className="w-full text-xs gap-1 mt-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to login
              </Button>
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}
