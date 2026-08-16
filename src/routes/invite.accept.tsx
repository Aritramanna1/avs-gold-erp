/**
 * Invite Accept page — production-ready signup flow.
 *
 * 1. Code + email pre-filled from URL params.
 * 2. Live validation against Supabase on load: Valid / Expired / Used / Invalid.
 * 3. Shows invitation card (company, role, branch) before password entry.
 * 4. Minimal form: only Name + Phone + Password.
 * 5. Auto-assigns branchId, workshopId, role from invitation.
 * 6. Marks invitation "used" in Supabase on completion.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck,
  Lock,
  Phone,
  User,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { toast } from "sonner";
import { Logo } from "@/components/ui/Logo";
import { LegalConsentFields } from "@/components/compliance/LegalConsentFields";
import { useConsentStore } from "@/lib/compliance/consent-store";
import { isGoogleOAuthEnabled, signInWithGoogle } from "@/lib/auth/google-oauth";

export const Route = createFileRoute("/invite/accept")({
  head: () => ({ meta: [{ title: "Accept Invitation · AVS Gold ERP" }] }),
  component: AcceptInvitationPage,
});

type InviteStatus = "idle" | "checking" | "valid" | "expired" | "used" | "invalid" | "not_found";

interface ResolvedInvite {
  id: string;
  email: string;
  role: string;
  code: string;
  expiresAt: number;
  status: string;
  branchId?: string;
  workshopId?: string;
  invitedBy?: string;
  portalType?: string | null;
  isPortalInvitation?: boolean;
}

function portalRedirectPath(invite: ResolvedInvite | null): string {
  if (!invite) return "/";
  const portalType = String(invite.portalType ?? "").toLowerCase();
  const role = String(invite.role ?? "").toLowerCase();
  if (portalType.includes("customer") || role === "customer") return "/customer-portal";
  if (portalType.includes("karigar") || role === "karigar" || role === "worker")
    return "/karigar-portal";
  if (portalType.includes("supplier") || role === "supplier" || role === "vendor")
    return "/supplier-portal";
  return "/";
}

function AcceptInvitationPage() {
  const navigate = useNavigate();
  const { firm, branches } = useSettings();

  // From URL
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");

  // Invitation state
  // "idle": no validation attempted yet (distinct from "checking", the
  // in-flight state) — otherwise the code-entry form's "Checking" card
  // would render the instant both fields are typed, before the user ever
  // clicks "Validate Invitation".
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("idle");
  const [resolvedInvite, setResolvedInvite] = useState<ResolvedInvite | null>(null);

  // Form
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Submit state
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const recordSignupConsent = useConsentStore((s) => s.recordSignupConsent);

  // Read URL params once
  const fromUrl = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code") || "";
    const e = params.get("email") || "";
    if (c) setInviteCode(c);
    if (e) setEmail(e);
    if (c && e) fromUrl.current = true;
  }, []);

  // Validate invitation when code + email are available. This ALWAYS goes
  // through the invite-accept edge function (server-side) — app_settings is
  // RLS-locked to authenticated users only, so a direct client-side read here
  // would be silently blocked for an invitee who has no session yet, which is
  // exactly why validation used to fail for every real invitee.
  const validateInvite = useCallback(async (code: string, emailVal: string) => {
    if (!code || !emailVal) {
      setInviteStatus("not_found");
      return;
    }
    setInviteStatus("checking");
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("invite-accept", {
        body: { mode: "validate", email: emailVal, code },
      });

      if (error) {
        const msg = await extractEdgeFunctionError(error, "Could not validate invitation.");
        setErr(msg);
        setInviteStatus("invalid");
        return;
      }

      if (!data?.valid) {
        const reason = data?.reason;
        if (reason === "used") {
          setInviteStatus("used");
          setResolvedInvite(data?.invite ?? null);
        } else if (reason === "expired") {
          setInviteStatus("expired");
          setResolvedInvite(data?.invite ?? null);
        } else {
          setInviteStatus("invalid");
        }
        return;
      }

      setResolvedInvite(data.invite);
      setInviteStatus("valid");
    } catch (ex: any) {
      setErr(ex?.message || String(ex));
      setInviteStatus("invalid");
    }
  }, []);

  // Auto-validate when both code + email are set from URL. Manually-typed
  // entry (the code-entry form below) must NOT auto-fire on every keystroke —
  // that unmounts the form and its "Validate Invitation" button the instant
  // both fields fill, before the user can click it — so it stays gated on the
  // "Validate Invitation" button's onClick instead.
  useEffect(() => {
    if (fromUrl.current && inviteCode && email) {
      void validateInvite(inviteCode, email);
    }
  }, [inviteCode, email, validateInvite]);

  // Complete invite via Google when returning from OAuth with an active session.
  useEffect(() => {
    if (inviteStatus !== "valid" || !resolvedInvite || busy || done) return;
    const hasOAuthReturn =
      window.location.hash.includes("access_token") ||
      window.location.search.includes("provider=google");

    async function tryOAuthAccept() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user?.email) return;
      if (!hasOAuthReturn) return;
      const sessionEmail = session.user.email.toLowerCase();
      if (sessionEmail !== resolvedInvite!.email.toLowerCase()) return;

      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke("invite-accept", {
          body: {
            mode: "accept_oauth",
            email: sessionEmail,
            code: inviteCode,
            name: inviteName.trim() || session.user.user_metadata?.full_name,
            phone: invitePhone.trim(),
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error || !data?.success) {
          setErr(
            error
              ? await extractEdgeFunctionError(error, "Google account setup failed.")
              : data?.error || "Google account setup failed.",
          );
          setBusy(false);
          return;
        }
        setDone(true);
        setNeedsEmailConfirm(false);
        toast.success("Account linked with Google! Redirecting…");
        setTimeout(() => {
          void navigate({ to: portalRedirectPath(resolvedInvite) });
        }, 1200);
      } catch (ex: unknown) {
        setErr(ex instanceof Error ? ex.message : String(ex));
        setBusy(false);
      }
    }

    void tryOAuthAccept();
  }, [inviteStatus, resolvedInvite, inviteCode, inviteName, invitePhone, busy, done, navigate]);

  async function handleGoogleInvite() {
    if (!resolvedInvite) return;
    if (!termsAccepted || !privacyAccepted) {
      setErr("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    recordSignupConsent({ termsAccepted, privacyAccepted, marketingOptIn });
    const redirectPath = `/invite/accept?code=${encodeURIComponent(inviteCode)}&email=${encodeURIComponent(resolvedInvite.email)}`;
    const result = await signInWithGoogle({ redirectPath });
    if (!result.ok) toast.error(result.error ?? "Google sign-in failed.");
  }

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedInvite) return;

    setErr(null);
    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setErr("Password must be at least 10 characters.");
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      setErr("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    recordSignupConsent({ termsAccepted, privacyAccepted, marketingOptIn });

    setBusy(true);
    try {
      const targetEmail = resolvedInvite.email.toLowerCase();

      // The entire accept flow — re-validating the invite, creating/updating
      // the Supabase Auth account, upserting app_settings.users, and marking
      // the invitation used — happens atomically in the server function,
      // since this browser has no session yet and app_settings is RLS-locked
      // to authenticated users only.
      const { data, error } = await supabase.functions.invoke("invite-accept", {
        body: {
          mode: "accept",
          email: targetEmail,
          // The validate response's `invite` object never echoes back the
          // code (see the edge function — it returns id/email/role/branchId/
          // workshopId/expiresAt only), so resolvedInvite.code is always
          // undefined here. Use the code already held in component state
          // from validation instead — every real acceptance was silently
          // failing with "code and email are required" before this fix.
          code: inviteCode,
          name: inviteName.trim(),
          phone: invitePhone.trim(),
          password,
        },
      });

      if (error) {
        setErr(await extractEdgeFunctionError(error, "Account creation failed."));
        setBusy(false);
        return;
      }
      if (!data?.success) {
        setErr(data?.error || "Account creation failed.");
        setBusy(false);
        return;
      }

      // Account is provisioned and pre-confirmed server-side — sign in through
      // the exact same standard auth path used everywhere else in the app.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      setDone(true);
      if (signInError) {
        setNeedsEmailConfirm(true);
        toast.success("Account created. Please sign in from the login page.");
      } else {
        setNeedsEmailConfirm(false);
        toast.success("Account created! Signing you in…");
        const target = portalRedirectPath(resolvedInvite);
        setTimeout(() => {
          void navigate({ to: target });
        }, 1500);
      }
    } catch (ex: any) {
      setErr(ex.message ?? "An error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shopName = firm?.shopName || "AVS ERP";
  const branchName = resolvedInvite?.branchId
    ? (branches.find((b) => b.id === resolvedInvite.branchId)?.name ?? resolvedInvite.branchId)
    : "";

  // ── Done state ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <h2 className="font-serif text-xl text-gold">Welcome to {shopName}!</h2>
          {needsEmailConfirm ? (
            <p className="text-sm text-muted-foreground">
              Your account was created. Please check your email and confirm your address before
              signing in.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Your account is ready. Redirecting to the portal…
              </p>
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gold" />
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* Brand header */}
        <div className="text-center space-y-2 mb-6">
          <Logo className="h-8 mx-auto" />
          <h1 className="font-serif text-2xl text-gold">{shopName}</h1>
          <p className="text-xs text-muted-foreground">Portal & Staff Invitation</p>
        </div>

        {/* ── Code entry if not in URL ─────────────────────────────────────── */}
        {/* Gated on "idle" too, not just missing fields — otherwise this card
            (and its "Validate Invitation" button) unmounts the instant both
            fields are typed, before the user can click it. */}
        {(inviteStatus === "idle" || !inviteCode || !email) && (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-sm">Enter your invitation details</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="invite-code">
                  Invitation Code
                </Label>
                <Input
                  id="invite-code"
                  placeholder="INV-XXXXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="invite-email">
                  Your Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                />
              </div>
              <Button
                className="w-full bg-gold hover:bg-gold-600 text-slate-950 font-semibold"
                onClick={() => validateInvite(inviteCode, email)}
                disabled={!inviteCode || !email}
              >
                Validate Invitation
              </Button>
            </div>
          </Card>
        )}

        {/* ── Checking ─────────────────────────────────────────────────────── */}
        {inviteStatus === "checking" && inviteCode && email && (
          <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Validating invitation…
          </Card>
        )}

        {/* ── Invalid ──────────────────────────────────────────────────────── */}
        {inviteStatus === "invalid" && (
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-semibold">Invalid Invitation</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The code or email does not match any active invitation. Please check with your
              administrator.
            </p>
            {err && <p className="text-xs text-destructive font-mono leading-relaxed">{err}</p>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInviteCode("");
                setEmail("");
                setInviteStatus("checking");
              }}
            >
              Try a different code
            </Button>
          </Card>
        )}

        {/* ── Expired ──────────────────────────────────────────────────────── */}
        {inviteStatus === "expired" && (
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">Invitation Expired</span>
            </div>
            <p className="text-sm text-muted-foreground">
              This invitation expired on{" "}
              {resolvedInvite?.expiresAt
                ? new Date(resolvedInvite.expiresAt).toLocaleDateString("en-IN")
                : "an unknown date"}
              . Ask your administrator to send a new invitation.
            </p>
          </Card>
        )}

        {/* ── Already used ─────────────────────────────────────────────────── */}
        {inviteStatus === "used" && (
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Already Activated</span>
            </div>
            <p className="text-sm text-muted-foreground">
              This invitation has already been used. If you cannot log in, contact your
              administrator to reset your password.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigate({ to: "/" })}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Go to Login
            </Button>
          </Card>
        )}

        {/* ── Valid invitation card + signup form ───────────────────────────── */}
        {inviteStatus === "valid" && resolvedInvite && (
          <Card className="p-6 space-y-5">
            {/* Invitation summary */}
            <div className="rounded-md border border-gold/30 bg-gold/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <span className="text-sm font-semibold text-gold">Invitation Verified</span>
                <Badge className="ml-auto text-[10px] bg-success/10 text-success border-success/20">
                  Valid
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Company</span>
                  <div className="font-medium">{shopName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Role Assigned</span>
                  <div className="font-medium">{resolvedInvite.role}</div>
                </div>
                {branchName && (
                  <div>
                    <span className="text-muted-foreground">Branch</span>
                    <div className="font-medium flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {branchName}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <div className="font-medium truncate">{resolvedInvite.email}</div>
                </div>
              </div>
              {resolvedInvite.expiresAt && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires {new Date(resolvedInvite.expiresAt).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleAccept} className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Complete your account setup. Role and branch are pre-assigned from your invitation.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="invite-name">
                  Your Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-name"
                    className="pl-9"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="invite-phone">
                  Mobile Number (optional)
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-phone"
                    className="pl-9"
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="invite-password">
                  Create Password (min. 10 characters)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-password"
                    className="pl-9 pr-10"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={10}
                    placeholder="Minimum 10 characters"
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

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="invite-confirm-password">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-confirm-password"
                    className="pl-9"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={10}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <LegalConsentFields
                termsAccepted={termsAccepted}
                privacyAccepted={privacyAccepted}
                marketingOptIn={marketingOptIn}
                onTermsChange={setTermsAccepted}
                onPrivacyChange={setPrivacyAccepted}
                onMarketingChange={setMarketingOptIn}
                showMarketing={false}
              />

              {err && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive leading-relaxed">
                  {err}
                </div>
              )}

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {isGoogleOAuthEnabled() && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={busy || !termsAccepted || !privacyAccepted}
                  onClick={() => void handleGoogleInvite()}
                >
                  Continue with Google
                </Button>
              )}

              {!isGoogleOAuthEnabled() && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Google sign-in is not enabled on this environment.
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-2"
                disabled={busy || !termsAccepted || !privacyAccepted}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating Account…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Activate Account
                  </>
                )}
              </Button>
            </form>
          </Card>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
          >
            <ArrowLeft className="h-3 w-3" /> Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
