import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot Password · AVS Gold ERP" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Removed strict frontend check to adapt dynamically to Supabase's bot protection toggle.
    // If Supabase actually requires CAPTCHA, it will fail at the API level and return a CAPTCHA-related error.
    setBusy(true);
    setErr(null);
    setSuccess(false);

    try {
      // Direct reset link setup using SMTP system@maatarajewellers.shop
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setErr(error.message);
      } else {
        setSuccess(true);
      }
    } catch (ex: any) {
      setErr(ex.message || "Could not complete password reset request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-2xl text-gold">MTJ ERP</h1>
          <p className="text-xs text-muted-foreground">{t("auth.resetHeader")}</p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs text-left leading-relaxed flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                A secure password reset link has been dispatched to{" "}
                <strong className="break-all">{email}</strong>. Please check your inbox or spam
                directory to complete updating your password.
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
              Send Reset Link
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
