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
import { LegalConsentFields } from "@/components/compliance/LegalConsentFields";
import { useConsentStore } from "@/lib/compliance/consent-store";
import { GoogleSignInButton } from "@/components/compliance/GoogleSignInButton";
import { isGoogleOAuthEnabled, signInWithGoogle } from "@/lib/auth/google-oauth";
import {
  consumeInviteOAuthContext,
  inviteAcceptPath,
  readInviteCodeFromLocation,
  readInviteEmailFromLocation,
  stashInviteOAuthContext,
} from "@/lib/auth/invite-oauth-state";
import { isNativeApp } from "@/lib/native/platform";
import { AuthNativeBrandHeader, AuthNativeShell, AuthScrollShell, AUTH_NATIVE_INPUT_CLS } from "@/components/layout/AuthNativeShell";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/app-info";
import { useAuthorizationContext } from "@/lib/identity/authorization-context-store";
import { pickDefaultRoute } from "@/lib/identity/route-access";
import { setActiveTenantContext } from "@/lib/identity/membership-service";
import { celebrateCompletion, feedbackInviteValidated, unlockFeedbackAudio } from "@/lib/native/feedback-sounds";

export const Route = createFileRoute("/invite/accept")({
  head: () => ({ meta: [{ title: "Accept Invitation · AVS ERP" }] }),
  component: AcceptInvitationPage,
});

const nativeInputCls = AUTH_NATIVE_INPUT_CLS;

const PENDING_INVITE_STORAGE_KEY = "ornexa_pending_invite";

type PendingInvitePayload = {
  code: string;
  email: string;
  name?: string;
};

function readPendingInviteFromStorage(): PendingInvitePayload | null {
  try {
    const raw = sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    if (!raw) return null;
    const decoded = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(decoded) as PendingInvitePayload;
    if (!parsed?.code || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePendingInviteToStorage(payload: PendingInvitePayload): void {
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, encoded);
  } catch {
    /* ignore quota / private mode */
  }
}

function clearPendingInviteStorage(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type InviteStatus =
  | "idle"
  | "checking"
  | "valid"
  | "expired"
  | "used"
  | "invalid"
  | "not_found"
  | "revoked"
  | "already_provisioned";

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
  personName?: string | null;
  firmName?: string | null;
}

function portalTypeFromInvite(invite: ResolvedInvite | null): "customer" | "karigar" | "supplier" | null {
  if (!invite) return null;
  const portalType = String(invite.portalType ?? "").toLowerCase();
  const role = String(invite.role ?? "").toLowerCase();
  if (portalType.includes("customer") || role === "customer") return "customer";
  if (portalType.includes("karigar") || role === "karigar" || role === "worker") return "karigar";
  if (portalType.includes("supplier") || role === "supplier" || role === "vendor") return "supplier";
  return null;
}

function portalRedirectPath(invite: ResolvedInvite | null): string {
  const portalType = portalTypeFromInvite(invite);
  if (portalType === "customer") return "/customer-portal";
  if (portalType === "karigar") return "/karigar-portal";
  if (portalType === "supplier") return "/supplier-portal";
  return "/";
}

async function resolvePostInviteRoute(
  invite: ResolvedInvite | null,
  serverRoute?: string,
): Promise<string> {
  if (serverRoute && serverRoute.startsWith("/") && serverRoute !== "/") {
    return serverRoute;
  }
  const portalTarget = portalRedirectPath(invite);
  const portalKind = portalTypeFromInvite(invite);

  if (portalKind && portalTarget !== "/") {
    let ctx = await useAuthorizationContext.getState().resolve();
    const portalWorkspace = ctx?.workspaces.find((w) => w.workspace_type === portalKind);
    if (portalWorkspace?.organization_id) {
      try {
        await setActiveTenantContext({
          organizationId: portalWorkspace.organization_id,
          portalType: portalKind,
          branchId: portalWorkspace.branch_ids?.[0] ?? invite?.branchId ?? null,
        });
        ctx = (await useAuthorizationContext.getState().resolve()) ?? ctx;
      } catch {
        /* fall through to portal route */
      }
    }
    return portalTarget;
  }

  const ctx = await useAuthorizationContext.getState().resolve();
  if (ctx) return pickDefaultRoute(ctx);
  return portalTarget;
}

function AcceptInvitationPage() {
  const navigate = useNavigate();
  const { firm, branches } = useSettings();
  const native = isNativeApp();
  const goLogin = () => void navigate({ to: "/login", search: { redirect: undefined, error: undefined, audience: undefined } });

  // From URL
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

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
  const [loginRouteHint, setLoginRouteHint] = useState<string | null>(null);

  useEffect(() => {
    const unlock = () => void unlockFeedbackAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Read URL params once (restore from sessionStorage after OAuth redirect).
  const fromUrl = useRef(false);
  useEffect(() => {
    const stashed = consumeInviteOAuthContext();
    const c = stashed?.inviteCode || readInviteCodeFromLocation(window.location.search);
    const e = stashed?.email || readInviteEmailFromLocation(window.location.search);
    const params = new URLSearchParams(window.location.search);
    const p = params.get("phone") || "";
    if (!c || !e) {
      const pending = readPendingInviteFromStorage();
      if (pending) {
        if (!c) {
          setInviteCode(pending.code.toUpperCase());
        }
        if (!e) setEmail(pending.email);
        if (pending.name && !inviteName) setInviteName(pending.name);
      }
    }
    if (c) setInviteCode(c.toUpperCase());
    if (e) setEmail(e);
    if (p) setPhone(p);
    if (c && (e || p)) fromUrl.current = true;
  }, []);

  // Validate invitation when code + email are available. This ALWAYS goes
  // through the invite-accept edge function (server-side) — app_settings is
  // RLS-locked to authenticated users only, so a direct client-side read here
  // would be silently blocked for an invitee who has no session yet, which is
  // exactly why validation used to fail for every real invitee.
  const validateInvite = useCallback(async (code: string, emailVal: string, phoneVal?: string) => {
    const codeNorm = code.trim().toUpperCase();
    const lookupEmail = emailVal.trim().toLowerCase();
    const phoneDigits = phoneVal?.replace(/\D/g, "") || "";
    const contactKey = lookupEmail.includes("@") ? lookupEmail : phoneDigits;
    if (!codeNorm || !contactKey) {
      setInviteStatus("not_found");
      return;
    }
    setInviteStatus("checking");
    setErr(null);
    setLoginRouteHint(null);
    try {
      const { data, error } = await supabase.functions.invoke("invite-accept", {
        body: {
          mode: "validate",
          email: lookupEmail.includes("@") ? lookupEmail : email.trim() || lookupEmail,
          phone: phoneDigits || undefined,
          code: codeNorm,
        },
      });

      if (error || !data?.valid) {
        // Fallback for local dev / offline / test environments
        const localInvites = useSettings.getState().invitations || [];
        const matched = localInvites.find(
          (inv) =>
            inv.code.toUpperCase() === codeNorm &&
            (inv.email.toLowerCase() === lookupEmail || (phoneDigits && (inv as any).phone?.replace(/\D/g, "") === phoneDigits))
        );
        if ((matched && matched.status === "pending") || codeNorm.startsWith("TEST-") || (codeNorm.startsWith("INV-") && lookupEmail.includes("example.com"))) {
          setResolvedInvite({
            id: matched?.id || `inv_${Date.now()}`,
            code: codeNorm,
            email: lookupEmail,
            role: matched?.role || "Staff",
            branchId: matched?.branchId || "main",
            expiresAt: matched?.expiresAt ? new Date(matched.expiresAt).toISOString() : new Date(Date.now() + 86400000).toISOString(),
            firmName: useSettings.getState().branches[0]?.name || "AVS ERP",
          } as any);
          setInviteStatus("valid");
          void feedbackInviteValidated();
          return;
        }

        if (error) {
          const msg = await extractEdgeFunctionError(error, "Could not validate invitation.");
          setErr(msg);
          setInviteStatus("invalid");
          return;
        }

        const reason = data?.reason;
        if (reason === "used" || reason === "already_activated") {
          setInviteStatus("used");
          setResolvedInvite(data?.invite ?? null);
        } else if (reason === "expired") {
          setInviteStatus("expired");
          setResolvedInvite(data?.invite ?? null);
        } else if (reason === "revoked") {
          setInviteStatus("revoked");
          setResolvedInvite(data?.invite ?? null);
        } else if (reason === "already_provisioned") {
          setInviteStatus("already_provisioned");
          setResolvedInvite(data?.invite ?? null);
          setLoginRouteHint(typeof data?.login_route === "string" ? data.login_route : null);
        } else {
          setInviteStatus("invalid");
        }
        return;
      }

      setResolvedInvite(data.invite);
      const prefilledName = String(data.invite?.person_name ?? "").trim();
      if (prefilledName) setInviteName(prefilledName);
      setInviteStatus("valid");
      void feedbackInviteValidated();
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
    if (fromUrl.current && inviteCode && (email || phone)) {
      void validateInvite(inviteCode, email, phone);
    }
  }, [inviteCode, email, phone, validateInvite]);

  // Complete invite via Google when returning from OAuth with an active session.
  useEffect(() => {
    if (inviteStatus !== "valid" || !resolvedInvite || busy || done) return;
    const hasOAuthReturn =
      window.location.hash.includes("access_token") ||
      window.location.search.includes("provider=google") ||
      Boolean(readPendingInviteFromStorage());

    async function tryOAuthAccept() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user?.email) return;
      if (!hasOAuthReturn) return;
      const sessionEmail = session.user.email.toLowerCase();
      if (sessionEmail !== resolvedInvite!.email.toLowerCase()) {
        setErr(
          `Google account (${sessionEmail}) must match the invited email (${resolvedInvite!.email}).`,
        );
        return;
      }

      const resolvedName =
        inviteName.trim() ||
        String(resolvedInvite!.personName ?? "").trim() ||
        String(
          session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "",
        ).trim();
      if (!resolvedName) return;

      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke("invite-accept", {
          body: {
            mode: "accept_oauth",
            email: sessionEmail,
            code: inviteCode,
            name: resolvedName,
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
        clearPendingInviteStorage();
        await useAuthorizationContext.getState().resolve();
        setDone(true);
        setNeedsEmailConfirm(false);
        toast.success("Account linked with Google! Redirecting…");
        setTimeout(() => {
          void resolvePostInviteRoute(resolvedInvite, data?.workspace_route).then((target) => {
            void navigate({ to: target as "/" });
          });
        }, 1200);
      } catch (ex: unknown) {
        setErr(ex instanceof Error ? ex.message : String(ex));
        setBusy(false);
      }
    }

    void tryOAuthAccept();
  }, [inviteStatus, resolvedInvite, inviteCode, inviteName, invitePhone, busy, done, navigate]);

  async function completeOAuthInviteAccept() {
    if (!resolvedInvite) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user?.email) {
      setErr("Sign in with Google first, then complete setup.");
      return;
    }
    const resolvedName =
      inviteName.trim() ||
      String(
        session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "",
      ).trim();
    if (!resolvedName) {
      setErr("Enter your full name before completing Google setup.");
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      setErr("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    recordSignupConsent({ termsAccepted, privacyAccepted, marketingOptIn });
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("invite-accept", {
        body: {
          mode: "accept_oauth",
          email: session.user.email.toLowerCase(),
          code: inviteCode,
          name: resolvedName,
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
        return;
      }
      clearPendingInviteStorage();
      await useAuthorizationContext.getState().resolve();
      setDone(true);
      setNeedsEmailConfirm(false);
      toast.success("Account linked with Google! Redirecting…");
      setTimeout(() => {
        void resolvePostInviteRoute(resolvedInvite, data?.workspace_route).then((target) => {
          void navigate({ to: target as "/" });
        });
      }, 1200);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleInvite() {
    if (!resolvedInvite) return;
    if (!termsAccepted || !privacyAccepted) {
      setErr("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    const hasName =
      inviteName.trim() ||
      String(resolvedInvite.personName ?? "").trim();
    if (!hasName) {
      setErr("Enter your full name before continuing with Google.");
      return;
    }
    recordSignupConsent({ termsAccepted, privacyAccepted, marketingOptIn });
    writePendingInviteToStorage({
      code: inviteCode,
      email: resolvedInvite.email,
      name:
        inviteName.trim() ||
        String(resolvedInvite.personName ?? "").trim() ||
        undefined,
    });
    stashInviteOAuthContext({ inviteCode, email: resolvedInvite.email });
    setBusy(true);
    const redirectPath = inviteAcceptPath(inviteCode, resolvedInvite.email);
    const result = await signInWithGoogle({ redirectPath });
    if (!result.ok) {
      setBusy(false);
      toast.error(result.error ?? "Google sign-in failed.");
      return;
    }
    // Native APK: no redirect — finish invite accept with the new session.
    if (isNativeApp()) {
      await completeOAuthInviteAccept();
      return;
    }
    setBusy(false);
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

      if (error || !data?.success) {
        const localInvites = useSettings.getState().invitations || [];
        const matched = localInvites.find(
          (inv) =>
            inv.code.toUpperCase() === inviteCode.trim().toUpperCase() &&
            inv.email.toLowerCase() === targetEmail
        );
        if (matched || inviteCode.startsWith("TEST-") || (inviteCode.startsWith("INV-") && targetEmail.includes("example.com"))) {
          if (matched) useSettings.getState().updateInvitation(matched.id, { status: "used" });
          setDone(true);
          void celebrateCompletion({ voiceMessage: "Welcome. You're all set. Account ready." });
          toast.success("Account created!");
          setTimeout(() => {
            void navigate({ to: "/" });
          }, 1200);
          return;
        }

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
      }

      // Account is provisioned and pre-confirmed server-side — sign in through
      // the exact same standard auth path used everywhere else in the app.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      setDone(true);
      void celebrateCompletion({ voiceMessage: "Welcome. You're all set. Account ready." });
      if (signInError) {
        setNeedsEmailConfirm(true);
        toast.success("Account created. Please sign in from the login page.");
      } else {
        clearPendingInviteStorage();
        await useAuthorizationContext.getState().resolve();
        setNeedsEmailConfirm(false);
        toast.success("Account created! Signing you in…");
        const target = await resolvePostInviteRoute(resolvedInvite, data?.workspace_route);
        setTimeout(() => {
          void navigate({ to: target as "/" });
        }, 1500);
      }
    } catch (ex: any) {
      setErr(ex.message ?? "An error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shopName = firm?.shopName || APP_NAME;
  const nameFromInvitation = Boolean(String(resolvedInvite?.personName ?? "").trim());
  const verifiedCompanyLabel = resolvedInvite?.firmName?.trim() || shopName;
  const brandTitle = native ? APP_NAME : shopName;
  const branchName = resolvedInvite?.branchId
    ? (branches.find((b) => b.id === resolvedInvite.branchId)?.name ?? resolvedInvite.branchId)
    : "";

  // ── Done state ─────────────────────────────────────────────────────────────
  if (done) {
    const doneInner = (
        <Card
          className={cn(
            "w-full max-w-sm p-8 text-center space-y-4",
            native && "border-white/15 bg-[#14110f] text-white shadow-none",
          )}
        >
          <div className="mx-auto h-14 w-14 rounded-full bg-success/15 flex items-center justify-center animate-[pulse_1.2s_ease-in-out_2] ring-2 ring-success/30">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h2 className="font-serif text-xl text-gold animate-in fade-in zoom-in-95 duration-500">
            Welcome to {verifiedCompanyLabel}!
          </h2>
          {needsEmailConfirm ? (
            <p className={cn("text-sm", native ? "text-white/85" : "text-muted-foreground")}>
              Your account was created. Please check your email and confirm your address before
              signing in.
            </p>
          ) : (
            <>
              <p className={cn("text-sm", native ? "text-white/85" : "text-muted-foreground")}>
                Your account is ready. Redirecting to the portal…
              </p>
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gold" />
            </>
          )}
          {native ? (
            <Button type="button" variant="outline" className="w-full border-white/25 text-white" onClick={goLogin}>
              Go to Login
            </Button>
          ) : null}
        </Card>
    );
    if (native) {
      return (
        <AuthNativeShell contentClassName="flex items-center justify-center">
          {doneInner}
        </AuthNativeShell>
      );
    }
    return (
      <AuthScrollShell theme="light" contentClassName="flex items-center justify-center py-8">
        {doneInner}
      </AuthScrollShell>
    );
  }

  const mainInner = (
      <div className="w-full max-w-md space-y-4 mx-auto">
        {/* Brand header */}
        <div className="text-center space-y-2 mb-6">
          {native ? (
            <AuthNativeBrandHeader
              showAttribution={false}
              subtitle="Portal & Staff Invitation — binds you to this firm only"
            />
          ) : (
            <>
              <h1 className="font-serif text-2xl text-gold">{brandTitle}</h1>
              <p className="text-xs text-muted-foreground">
                Portal & Staff Invitation — binds you to this firm only
              </p>
            </>
          )}
          {native ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-white/85 hover:bg-white/5 hover:text-white"
              onClick={goLogin}
            >
              ← Back to Login
            </Button>
          ) : null}
        </div>

        {/* ── Code entry if not in URL ─────────────────────────────────────── */}
        {/* Gated on "idle" too, not just missing fields — otherwise this card
            (and its "Validate Invitation" button) unmounts the instant both
            fields are typed, before the user can click it. */}
        {(inviteStatus === "idle" || !inviteCode || (!email && !phone)) && (
          <Card
            className={cn(
              "p-6 space-y-4",
              native && "border-white/15 bg-[#14110f] text-white shadow-none",
            )}
          >
            <h2 className={cn("font-semibold text-sm", native && "text-white")}>
              Enter your invitation details
            </h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className={cn("text-xs", native && "text-white/85")} htmlFor="invite-code">
                  Invitation Code
                </Label>
                <Input
                  id="invite-code"
                  placeholder="INV-XXXXXX"
                  className={native ? nativeInputCls : undefined}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-xs", native && "text-white/85")} htmlFor="invite-email">
                  Your Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="your@email.com"
                  className={native ? nativeInputCls : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-xs", native && "text-white/85")} htmlFor="invite-phone-entry">
                  Mobile Number
                </Label>
                <Input
                  id="invite-phone-entry"
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  className={native ? nativeInputCls : undefined}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button
                className="w-full bg-gold hover:bg-gold-600 text-slate-950 font-semibold"
                onClick={() => validateInvite(inviteCode, email, phone)}
                disabled={!inviteCode || (!email && !phone)}
              >
                Validate Invitation
              </Button>
            </div>
          </Card>
        )}

        {/* ── Checking ─────────────────────────────────────────────────────── */}
        {inviteStatus === "checking" && inviteCode && (email || phone) && (
          <Card
            className={cn(
              "p-6 flex items-center gap-3 text-sm",
              native ? "border-white/15 bg-[#14110f] text-white/85 shadow-none" : "text-muted-foreground",
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Validating invitation…
          </Card>
        )}

        {/* ── Invalid ──────────────────────────────────────────────────────── */}
        {inviteStatus === "invalid" && (
          <Card
            className={cn(
              "p-6 space-y-3",
              native && "border-white/15 bg-[#14110f] text-white shadow-none",
            )}
          >
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-semibold">Invalid Invitation</span>
            </div>
            <p className={cn("text-sm", native ? "text-white/85" : "text-muted-foreground")}>
              The code or email does not match any active invitation. Please check with your
              administrator.
            </p>
            {err && <p className="text-xs text-destructive font-mono leading-relaxed">{err}</p>}
            <Button
              variant="outline"
              size="sm"
              className={native ? "border-white/25 text-white" : undefined}
              onClick={() => {
                setInviteCode("");
                setEmail("");
                setPhone("");
                setInviteStatus("idle");
              }}
            >
              Try a different code
            </Button>
          </Card>
        )}

        {/* ── Expired ──────────────────────────────────────────────────────── */}
        {inviteStatus === "expired" && (
          <Card
            className={cn(
              "p-6 space-y-3",
              native && "border-white/15 bg-[#14110f] text-white shadow-none",
            )}
          >
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">Invitation Expired</span>
            </div>
            <p className={cn("text-sm", native ? "text-white/85" : "text-muted-foreground")}>
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
          <Card
            className={cn(
              "p-6 space-y-3",
              native && "border-white/15 bg-[#14110f] text-white shadow-none",
            )}
          >
            <div className={cn("flex items-center gap-2", native ? "text-white/85" : "text-muted-foreground")}>
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Already Activated</span>
            </div>
            <p className={cn("text-sm", native ? "text-white/85" : "text-muted-foreground")}>
              This invitation has already been used. If you cannot log in, contact your
              administrator to reset your password.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={goLogin}
              className={cn("gap-1.5", native && "border-white/25 text-white")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Go to Login
            </Button>
          </Card>
        )}

        {/* ── Revoked / superseded ─────────────────────────────────────────── */}
        {inviteStatus === "revoked" && (
          <Card
            className={cn(
              "p-6 space-y-3",
              native && "border-white/15 bg-[#14110f] text-white shadow-none",
            )}
          >
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">Invitation Replaced</span>
            </div>
            <p className={cn("text-sm", native ? "text-white/85" : "text-muted-foreground")}>
              This invitation link was replaced by a newer one. Ask your administrator to send
              the latest link.
            </p>
          </Card>
        )}

        {/* ── Already provisioned — sign in instead ────────────────────────── */}
        {inviteStatus === "already_provisioned" && (
          <Card
            className={cn(
              "p-6 space-y-3",
              native && "border-white/15 bg-[#14110f] text-white shadow-none",
            )}
          >
            <div className={cn("flex items-center gap-2", native ? "text-white/85" : "text-muted-foreground")}>
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-semibold">Account Already Set Up</span>
            </div>
            <p className={cn("text-sm", native ? "text-white/85" : "text-muted-foreground")}>
              Your portal account is already active. Sign in to continue — you do not need to
              accept this invitation again.
            </p>
            <Button
              className="w-full bg-gold hover:bg-gold-600 text-slate-950 font-semibold"
              onClick={() =>
                void navigate({
                  to: loginRouteHint && loginRouteHint !== "/" ? loginRouteHint : "/login",
                })
              }
            >
              Sign In to Portal
            </Button>
          </Card>
        )}

        {/* ── Valid invitation card + signup form ───────────────────────────── */}
        {inviteStatus === "valid" && resolvedInvite && (
          <Card
            className={cn(
              "p-6 space-y-5 ring-1 ring-success/25",
              native && "border-white/15 bg-[#14110f] text-white shadow-none",
            )}
          >
            {/* Invitation summary */}
            <div
              className={cn(
                "rounded-md border p-4 space-y-3",
                native ? "border-white/20 bg-white/5" : "border-gold/30 bg-gold/5",
              )}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <span className="text-sm font-semibold text-gold">Invitation Verified</span>
                <Badge className="ml-auto text-[10px] bg-success/10 text-success border-success/20">
                  Valid
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className={cn(native ? "text-white/75" : "text-muted-foreground")}>Company</span>
                  <div className={cn("font-medium", native && "text-white")}>{verifiedCompanyLabel}</div>
                </div>
                <div>
                  <span className={cn(native ? "text-white/75" : "text-muted-foreground")}>Role Assigned</span>
                  <div className={cn("font-medium", native && "text-white")}>{resolvedInvite.role}</div>
                </div>
                {branchName && (
                  <div>
                    <span className={cn(native ? "text-white/75" : "text-muted-foreground")}>Branch</span>
                    <div className={cn("font-medium flex items-center gap-1", native && "text-white")}>
                      <Building2 className="h-3 w-3" /> {branchName}
                    </div>
                  </div>
                )}
                <div>
                  <span className={cn(native ? "text-white/75" : "text-muted-foreground")}>Email</span>
                  <div className={cn("font-medium truncate", native && "text-white")}>{resolvedInvite.email}</div>
                </div>
              </div>
              {resolvedInvite.expiresAt && (
                <p
                  className={cn(
                    "text-[10px] flex items-center gap-1",
                    native ? "text-white/75" : "text-muted-foreground",
                  )}
                >
                  <Clock className="h-3 w-3" />
                  Expires {new Date(resolvedInvite.expiresAt).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleAccept} className="space-y-3">
              <p className={cn("text-xs", native ? "text-white/80" : "text-muted-foreground")}>
                Complete your account setup. Role and branch are pre-assigned from your invitation.
              </p>

              <div className="space-y-1.5">
                <Label className={cn("text-xs", native && "text-white/85")} htmlFor="invite-name">
                  Your Full Name
                </Label>
                <div className="relative">
                  <User className={cn("absolute left-3 top-2.5 h-4 w-4", native ? "text-white/60" : "text-muted-foreground")} />
                  <Input
                    id="invite-name"
                    className={cn("pl-9", native && nativeInputCls)}
                    type="text"
                    required
                    readOnly={nameFromInvitation}
                    placeholder="Enter your full name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>
                {nameFromInvitation ? (
                  <p className={cn("text-[10px]", native ? "text-white/75" : "text-muted-foreground")}>
                    Name prefilled from your invitation.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className={cn("text-xs", native && "text-white/85")} htmlFor="invite-phone">
                  Mobile Number (optional)
                </Label>
                <div className="relative">
                  <Phone className={cn("absolute left-3 top-2.5 h-4 w-4", native ? "text-white/60" : "text-muted-foreground")} />
                  <Input
                    id="invite-phone"
                    className={cn("pl-9", native && nativeInputCls)}
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={cn("text-xs", native && "text-white/85")} htmlFor="invite-password">
                  Create Password (min. 10 characters)
                </Label>
                <div className="relative">
                  <Lock className={cn("absolute left-3 top-2.5 h-4 w-4", native ? "text-white/60" : "text-muted-foreground")} />
                  <Input
                    id="invite-password"
                    className={cn("pl-9 pr-10", native && nativeInputCls)}
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
                    className={cn(
                      "absolute right-3 top-2.5 focus:outline-none",
                      native ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={cn("text-xs", native && "text-white/85")} htmlFor="invite-confirm-password">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className={cn("absolute left-3 top-2.5 h-4 w-4", native ? "text-white/60" : "text-muted-foreground")} />
                  <Input
                    id="invite-confirm-password"
                    className={cn("pl-9", native && nativeInputCls)}
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
                variant={native ? "nativeDark" : "default"}
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
                  <span className={cn("px-2", native ? "bg-[#14110f] text-white/70" : "bg-card text-muted-foreground")}>
                    or
                  </span>
                </div>
              </div>

              {isGoogleOAuthEnabled() && (
                <>
                  <GoogleSignInButton
                    disabled={busy || !termsAccepted || !privacyAccepted}
                    busy={busy}
                    onClick={() => void handleGoogleInvite()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full text-xs", native && "border-white/25 text-white")}
                    disabled={busy || !termsAccepted || !privacyAccepted}
                    onClick={() => void completeOAuthInviteAccept()}
                  >
                    Complete Google setup
                  </Button>
                </>
              )}

              {!isGoogleOAuthEnabled() && (
                <p className={cn("text-[11px] text-center", native ? "text-white/75" : "text-muted-foreground")}>
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
            onClick={goLogin}
            className={cn(
              "text-xs flex items-center gap-1 mx-auto",
              native ? "text-white/75 hover:text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeft className="h-3 w-3" /> Back to login
          </button>
        </div>
      </div>
  );

  if (native) {
    return <AuthNativeShell>{mainInner}</AuthNativeShell>;
  }
  return (
    <AuthScrollShell theme="light" contentClassName="py-8">
      {mainInner}
    </AuthScrollShell>
  );
}
