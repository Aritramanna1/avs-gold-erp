import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ShieldAlert,
  Loader2,
  WifiOff,
  ArrowLeft,
  CheckCircle2,
  User,
  Phone,
  Check,
} from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import {
  verifyLocalLogin,
  setLocalSession,
  changeLocalPassword,
  getLocalUserRecoveryQuestions,
  verifyRecoveryAnswers,
  verifyRecoveryKey,
  recoverLocalUsernames,
} from "@/lib/local-auth";
import { toast } from "sonner";

interface LocalAuthLayoutProps {
  onSuccess: (userId: string, role: string) => void;
}

export function LocalAuthLayout({ onSuccess }: LocalAuthLayoutProps) {
  const { firm, branding } = useSettings();

  // View states: "login" | "forgot-password" | "forgot-username"
  const [view, setView] = useState<"login" | "forgot-password" | "forgot-username">("login");

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Recovery States
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMethod, setRecoveryMethod] = useState<"questions" | "key">("key");
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1); // 1: Email, 2: Challenge, 3: Reset
  const [questions, setQuestions] = useState<{ q1: string; q2: string } | null>(null);
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);

  // Reset Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Username Recovery State
  const [searchQuery, setSearchQuery] = useState("");
  const [recoveredEmails, setRecoveredEmails] = useState<string[]>([]);
  const [searchDone, setSearchDone] = useState(false);

  async function handleLoginSubmit(e: React.FormEvent) {
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

  async function handleRecoveryStep1(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (recoveryMethod === "questions") {
        const qs = await getLocalUserRecoveryQuestions(recoveryEmail);
        if (!qs) {
          setErr("No recovery questions set up for this account. Use Recovery Key instead.");
          return;
        }
        setQuestions(qs);
        setRecoveryStep(2);
      } else {
        setRecoveryStep(2);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRecoveryChallenge(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      let result;
      if (recoveryMethod === "questions") {
        result = await verifyRecoveryAnswers(recoveryEmail, answer1, answer2);
      } else {
        result = await verifyRecoveryKey(recoveryEmail, recoveryKey);
      }

      if (!result.ok || !result.userId) {
        setErr(result.error || "Verification failed.");
        return;
      }

      setVerifiedUserId(result.userId);
      setRecoveryStep(3);
      toast.success("Identity verified successfully!");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 10) {
      setErr("Password must contain at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (!verifiedUserId) return;
      await changeLocalPassword(verifiedUserId, newPassword);
      toast.success("Password reset successfully. Please log in.");
      setView("login");
      // Reset recovery flow
      setRecoveryEmail("");
      setRecoveryStep(1);
      setAnswer1("");
      setAnswer2("");
      setRecoveryKey("");
      setVerifiedUserId(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (ex: any) {
      setErr(ex.message || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUsernameRecovery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const emails = await recoverLocalUsernames(searchQuery);
      setRecoveredEmails(emails);
      setSearchDone(true);
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
            {(firm.shopName || branding.applicationName || APP_NAME).toUpperCase()}
          </h1>
          <p className="text-[9px] tracking-widest text-muted-foreground/70 font-medium">
            {branding.tagline || APP_TAGLINE}
          </p>
          <p className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-1">
            <WifiOff className="h-3 w-3" /> Offline Mode — Local Sign-In
          </p>
        </div>

        {view === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4" data-testid="local-auth-form">
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
              <div className="flex justify-between items-center">
                <Label htmlFor="local-auth-password">Password</Label>
                <button
                  type="button"
                  onClick={() => {
                    setView("forgot-password");
                    setErr(null);
                  }}
                  className="text-[10px] text-gold hover:underline focus:outline-none"
                >
                  Forgot Password?
                </button>
              </div>
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
              className="w-full h-10 bg-gold hover:bg-gold/90 text-black font-semibold mt-2 animate-all"
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

            <div className="text-center pt-2 border-t border-border mt-2">
              <button
                type="button"
                onClick={() => {
                  setView("forgot-username");
                  setErr(null);
                }}
                className="text-xs text-gold font-medium hover:underline"
              >
                Forgot Username / Email?
              </button>
            </div>
          </form>
        )}

        {view === "forgot-password" && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gold border-b border-border pb-1">
              Offline Password Reset
            </div>

            {recoveryStep === 1 && (
              <form onSubmit={handleRecoveryStep1} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label>Account Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      required
                      placeholder="Enter your account email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2 border border-border bg-background/30 p-2.5 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Recovery Mechanism
                  </span>
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="localRecovery"
                        checked={recoveryMethod === "key"}
                        onChange={() => setRecoveryMethod("key")}
                      />
                      Recovery Key
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="localRecovery"
                        checked={recoveryMethod === "questions"}
                        onChange={() => setRecoveryMethod("questions")}
                      />
                      Security Questions
                    </label>
                  </div>
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
                    onClick={() => setView("login")}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-1/2 text-xs" disabled={busy}>
                    Continue
                  </Button>
                </div>
              </form>
            )}

            {recoveryStep === 2 && (
              <form onSubmit={handleRecoveryChallenge} className="space-y-4">
                {recoveryMethod === "questions" && questions ? (
                  <div className="space-y-3">
                    <div className="grid gap-1">
                      <Label className="text-xs text-stone-300">Question 1: {questions.q1}</Label>
                      <Input
                        required
                        placeholder="Your answer"
                        value={answer1}
                        onChange={(e) => setAnswer1(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs text-stone-300">Question 2: {questions.q2}</Label>
                      <Input
                        required
                        placeholder="Your answer"
                        value={answer2}
                        onChange={(e) => setAnswer2(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label>Emergency Recovery Key</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 font-mono uppercase text-sm"
                        required
                        placeholder="MTJ-RECO-XXXX-XXXX..."
                        value={recoveryKey}
                        onChange={(e) => setRecoveryKey(e.target.value)}
                      />
                    </div>
                  </div>
                )}

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
                    onClick={() => setRecoveryStep(1)}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-1/2 text-xs" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    Verify Identity
                  </Button>
                </div>
              </form>
            )}

            {recoveryStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={10}
                    placeholder="At least 10 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={10}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {err && (
                  <div className="text-xs text-red-400 leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                )}

                <Button type="submit" className="w-full gap-1.5" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save New Password
                </Button>
              </form>
            )}
          </div>
        )}

        {view === "forgot-username" && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gold border-b border-border pb-1">
              Retrieve Username / Email
            </div>

            <form onSubmit={handleUsernameRecovery} className="space-y-4">
              <div className="grid gap-1.5">
                <Label>Search by Name or Phone</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    required
                    placeholder="Enter user name or phone number"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2 text-xs"
                  onClick={() => setView("login")}
                >
                  Back
                </Button>
                <Button type="submit" className="w-1/2 text-xs" disabled={busy}>
                  Search
                </Button>
              </div>
            </form>

            {searchDone && (
              <div className="border border-border rounded-lg p-3 bg-background/50 space-y-2">
                <div className="text-xs font-semibold text-gold border-b border-border pb-1">
                  Matching Local Usernames
                </div>
                {recoveredEmails.length === 0 ? (
                  <div className="text-xs text-stone-400 py-1">No matching accounts found.</div>
                ) : (
                  <ul className="space-y-1">
                    {recoveredEmails.map((u, idx) => (
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
          </div>
        )}
      </Card>
    </div>
  );
}
