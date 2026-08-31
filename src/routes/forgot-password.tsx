import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  User,
  Phone,
  ShieldAlert,
  Check,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { notifyPasswordReset } from "@/lib/comm/platform";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Account Recovery · AVS Gold ERP" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useLanguage();
  const { firm } = useSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"otp" | "link">("link");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // OTP state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Username recovery state
  const [searchQuery, setSearchQuery] = useState("");
  const [recoveredUsernames, setRecoveredUsernames] = useState<string[]>([]);
  const [usernameSearchDone, setUsernameSearchDone] = useState(false);

  async function handlePasswordRecovery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSuccess(false);

    try {
      if (method === "link") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl("/reset-password"),
        });
        if (error) {
          setErr(error.message);
        } else {
          setSuccess(true);
          toast.success("Recovery link sent successfully.");
          // Branded notification via AVS Communication Platform (non-blocking)
          void notifyPasswordReset({
            recipient: { name: email.split("@")[0] || "User", email },
            actionUrl: getAuthRedirectUrl("/reset-password"),
            firmName: firm.shopName || "AVS",
          });
        }
      } else {
        // Send OTP
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) {
          setErr(error.message);
        } else {
          setOtpSent(true);
          toast.success("6-digit verification code sent.");
        }
      }
    } catch (ex: any) {
      setErr(ex.message || "Could not complete password recovery request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "recovery",
      });

      if (error) {
        setErr(error.message);
      } else {
        toast.success("Verification successful. Redirecting to reset password page.");
        void navigate({ to: "/reset-password" });
      }
    } catch (ex: any) {
      setErr(ex.message || "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUsernameRecovery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setRecoveredUsernames([]);
      setUsernameSearchDone(true);
    } catch (ex: any) {
      setErr(ex.message || "Could not complete username recovery.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative overflow-hidden">
      <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-sm p-6 space-y-4 border-border shadow-elegant bg-card/85 backdrop-blur-md relative z-10">
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-2xl text-gold">Account Recovery</h1>
          <p className="text-xs text-muted-foreground">Recover password or retrieve username</p>
        </div>

        <Tabs defaultValue="password">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="username">Username / Email</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="space-y-4">
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
            ) : otpSent ? (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs text-left leading-relaxed flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    A 6-digit verification code was sent to{" "}
                    <strong className="break-all">{email}</strong>. Enter it below to proceed.
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Verification Code</Label>
                  <Input
                    className="text-center font-mono tracking-widest text-lg"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </div>

                {err && (
                  <div className="text-xs text-red-400 leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-1/2 text-xs"
                    onClick={() => setOtpSent(false)}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-1/2 gap-1.5" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify Code
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordRecovery} className="space-y-4">
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

                <div className="grid gap-2 border border-border bg-background/30 p-2.5 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Verification Method
                  </span>
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        checked={method === "otp"}
                        onChange={() => setMethod("otp")}
                      />
                      6-Digit OTP
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        checked={method === "link"}
                        onChange={() => setMethod("link")}
                      />
                      Reset Link
                    </label>
                  </div>
                </div>

                {err && (
                  <div className="text-xs text-red-400 leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                )}

                <Button type="submit" className="w-full gap-1.5" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {method === "otp" ? "Send OTP Code" : "Send Reset Link"}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="username" className="space-y-4">
            <form onSubmit={handleUsernameRecovery} className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-xs">Search by Name or Phone</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    required
                    placeholder="Enter name or phone number"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {err && (
                <div className="text-xs text-red-400 leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}

              <Button type="submit" className="w-full gap-1.5" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Retrieve Usernames
              </Button>
            </form>

            {usernameSearchDone && (
              <div className="border border-border rounded-lg p-3 bg-background/50 space-y-2">
                <div className="text-xs font-semibold text-gold border-b border-border pb-1">
                  Matching Usernames / Emails
                </div>
                {recoveredUsernames.length === 0 ? (
                  <div className="text-xs text-stone-400 py-1">
                    No matching accounts found locally.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {recoveredUsernames.map((u, idx) => (
                      <li
                        key={idx}
                        className="text-xs font-mono break-all flex items-center gap-1.5 text-stone-300"
                      >
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Link to="/">
          <Button variant="ghost" className="w-full text-xs gap-1 mt-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to login
          </Button>
        </Link>
      </Card>
    </div>
  );
}
