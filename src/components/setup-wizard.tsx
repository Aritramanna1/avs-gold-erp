import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CloudCog, WifiOff, Loader2, ShieldAlert, Check } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { useSettings } from "@/lib/settings-store";
import { setDeploymentMode, type DeploymentMode } from "@/lib/deployment-mode";
import { createLocalUser, setLocalSession } from "@/lib/local-auth";
import { ROLES } from "@/lib/permissions";
import { SUPABASE_RUNTIME_KEYS } from "@/lib/providers/data-provider";
import { setLicenseConfig, verifyLicense } from "@/lib/licensing/license-store";
import { toast } from "sonner";

function relaunchApp() {
  const w = window as unknown as { mtjDesktop?: { app?: { relaunch?: () => void } } };
  if (w.mtjDesktop?.app?.relaunch) w.mtjDesktop.app.relaunch();
  else window.location.reload();
}

const MODE_OPTIONS: {
  mode: DeploymentMode;
  icon: typeof WifiOff;
  title: string;
  description: string;
}[] = [
  {
    mode: "offline",
    icon: WifiOff,
    title: "Offline",
    description:
      "Runs entirely on this computer — local users, roles, database, settings and backups. No internet required, ever.",
  },
  {
    mode: "hybrid",
    icon: CloudCog,
    title: "Hybrid",
    description:
      "Local-first, with structured business data synchronized to your owner-managed Supabase project. Files always stay on this computer.",
  },
];

interface SetupWizardProps {
  onComplete: () => void;
}

function isAcceptedLicenseStatus(status: string): boolean {
  return status === "active" || status === "trial" || status === "lifetime";
}

/**
 * First-run setup wizard: shown once, when no deployment mode has ever been
 * chosen on this install. Offline/Hybrid also create the first local admin
 * account here, since Offline mode has no other way to sign in.
 */
export function SetupWizard({ onComplete }: SetupWizardProps) {
  const branding = useSettings((state) => state.branding);
  const [step, setStep] = useState<
    "choose-mode" | "config-supabase" | "activate" | "create-admin" | "finalizing"
  >("choose-mode");
  const [mode, setMode] = useState<DeploymentMode | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Hybrid: customer's own Supabase project. SaaS: central activation server.
  const [supaUrl, setSupaUrl] = useState("");
  const [supaKey, setSupaKey] = useState("");
  const [supaServiceRoleKey, setSupaServiceRoleKey] = useState("");
  const [licKey, setLicKey] = useState("");
  const [licenseValidated, setLicenseValidated] = useState(false);
  // Shown only when validation reports the schema is missing/outdated.
  const [needsSchemaInit, setNeedsSchemaInit] = useState(false);
  const [pgConnStr, setPgConnStr] = useState("");
  const [schemaInitBusy, setSchemaInitBusy] = useState(false);

  function chooseMode(selected: DeploymentMode) {
    setMode(selected);
    setErr(null);
    setLicenseValidated(false);
    if (selected === "hybrid") return setStep("config-supabase");
    if (selected === "online") return setStep("activate");
    setStep("create-admin"); // offline
  }

  async function handleSaveSupabase(e: React.FormEvent) {
    e.preventDefault();
    const url = supaUrl.trim();
    if (!licKey.trim()) {
      setErr("Enter the license key issued by Arivahly.");
      return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
      setErr("Enter a valid Supabase project URL (https://…).");
      return;
    }
    if (supaKey.trim().length < 20) {
      setErr("Enter the project's publishable/anon key.");
      return;
    }
    if (supaServiceRoleKey.trim().length < 20) {
      setErr("Enter the setup-only Service Role Key.");
      return;
    }
    const desktop = (
      window as unknown as {
        mtjDesktop?: {
          hybrid?: {
            validateSetup: (args: {
              projectUrl: string;
              anonKey: string;
              serviceRoleKey: string;
            }) => Promise<{ ok: boolean; schemaVersion?: number; error?: string }>;
          };
        };
      }
    ).mtjDesktop;
    if (!desktop?.hybrid?.validateSetup) {
      setErr("Hybrid setup validation is available only in the Electron desktop application.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setLicenseConfig({ key: licKey.trim() });
      const licenseStatus = await verifyLicense("hybrid");
      if (!isAcceptedLicenseStatus(licenseStatus)) {
        setErr("The license key is invalid, expired, or suspended.");
        return;
      }
      const result = await desktop.hybrid.validateSetup({
        projectUrl: url,
        anonKey: supaKey.trim(),
        serviceRoleKey: supaServiceRoleKey.trim(),
      });
      if (!result.ok) {
        // The owner applies the bundled master SQL outside the customer app.
        const missing = /master sql migration|schema metadata is missing/i.test(result.error || "");
        setNeedsSchemaInit(missing);
        setErr(result.error || "Supabase project validation failed.");
        return;
      }
      setNeedsSchemaInit(false);
      localStorage.setItem(SUPABASE_RUNTIME_KEYS.url, url.replace(/\/$/, ""));
      localStorage.setItem(SUPABASE_RUNTIME_KEYS.key, supaKey.trim());
      setSupaServiceRoleKey("");
      setLicenseValidated(true);
      setStep("create-admin");
    } finally {
      setBusy(false);
    }
  }

  async function handleInitializeSchema() {
    const url = supaUrl.trim();
    if (pgConnStr.trim().length < 20) {
      setErr("Enter the project's Postgres connection string to run the migration.");
      return;
    }
    const desktop = (
      window as unknown as {
        mtjDesktop?: {
          hybrid?: {
            initializeSchema: (args: {
              projectUrl: string;
              anonKey: string;
              pgConnectionString: string;
            }) => Promise<{ ok: boolean; schemaVersion?: number; error?: string }>;
          };
        };
      }
    ).mtjDesktop;
    if (!desktop?.hybrid?.initializeSchema) {
      setErr("Schema initialization is available only in the Electron desktop application.");
      return;
    }
    setSchemaInitBusy(true);
    setErr(null);
    try {
      const result = await desktop.hybrid.initializeSchema({
        projectUrl: url,
        anonKey: supaKey.trim(),
        pgConnectionString: pgConnStr.trim(),
      });
      setPgConnStr("");
      if (!result.ok) {
        setErr(result.error || "Master SQL migration failed.");
        return;
      }
      setNeedsSchemaInit(false);
      toast.success(`ERP schema initialized (v${result.schemaVersion}). Continue below.`);
    } finally {
      setSchemaInitBusy(false);
    }
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setLicenseConfig({ key: licKey.trim() });
      const status = await verifyLicense("online");
      if (status === "active" || status === "trial") {
        await setDeploymentMode("online");
        setStep("finalizing");
      } else {
        setErr("The license key is invalid, expired, or suspended. Contact Arivahly support.");
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    if (password.length < 10) {
      setErr("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (!licenseValidated) {
        if (!licKey.trim()) throw new Error("Enter the license key issued by Arivahly.");
        setLicenseConfig({ key: licKey.trim() });
        const licenseStatus = await verifyLicense(mode);
        if (!isAcceptedLicenseStatus(licenseStatus)) {
          throw new Error("The license key is invalid, expired, or suspended.");
        }
        setLicenseValidated(true);
      }
      const user = await createLocalUser({
        name: name.trim(),
        email: email.trim(),
        role: ROLES.SUPER_OWNER,
        password,
        isSuperOwner: true,
      });
      await setDeploymentMode(mode);
      await setLocalSession(user.id);
      setStep("finalizing");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Could not create the local admin account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg p-6 space-y-5 border-border shadow-elegant bg-card/85 backdrop-blur-md">
        <div className="text-center space-y-1.5">
          <h1 className="font-serif text-2xl font-semibold tracking-wide text-gold">
            {branding.applicationName || APP_NAME}
          </h1>
          <p className="text-[9px] tracking-widest text-muted-foreground/70 font-medium">
            {branding.tagline || APP_TAGLINE}
          </p>
        </div>

        {step === "choose-mode" && (
          <div className="space-y-3" data-testid="wizard-choose-mode">
            <p className="text-sm text-muted-foreground text-center">
              Choose how this installation will run. Offline can be upgraded to owner-managed Hybrid
              later from Settings.
            </p>
            {MODE_OPTIONS.map(({ mode: optionMode, icon: Icon, title, description }) => (
              <button
                key={optionMode}
                type="button"
                disabled={busy}
                data-testid={`wizard-mode-${optionMode}`}
                onClick={() => chooseMode(optionMode)}
                className="w-full text-left p-4 rounded-lg border border-input hover:border-gold/50 hover:bg-gold/5 transition-colors flex gap-3 items-start disabled:opacity-50"
              >
                <Icon className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">{title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "create-admin" && (
          <form
            onSubmit={handleCreateAdmin}
            className="space-y-4"
            data-testid="wizard-create-admin"
          >
            <p className="text-sm text-muted-foreground text-center">
              Create the first administrator account for this {mode} installation.
            </p>

            {!licenseValidated && (
              <div className="grid gap-1.5">
                <Label htmlFor="wizard-license-key">License Key</Label>
                <Input
                  id="wizard-license-key"
                  type="password"
                  required
                  disabled={busy}
                  placeholder="Enter the key issued by Arivahly"
                  value={licKey}
                  onChange={(event) => setLicKey(event.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="wizard-name">Full name</Label>
              <Input
                id="wizard-name"
                data-testid="wizard-name"
                required
                disabled={busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="wizard-email">Email</Label>
              <Input
                id="wizard-email"
                data-testid="wizard-email"
                type="email"
                required
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="wizard-password">Password</Label>
              <Input
                id="wizard-password"
                data-testid="wizard-password"
                type="password"
                minLength={10}
                required
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="wizard-confirm-password">Confirm password</Label>
              <Input
                id="wizard-confirm-password"
                data-testid="wizard-confirm-password"
                type="password"
                minLength={10}
                required
                disabled={busy}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {err && (
              <div
                className="text-xs text-red-400 font-medium leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2"
                data-testid="wizard-error"
              >
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => setStep("choose-mode")}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gold hover:bg-gold/90 text-black font-semibold"
                disabled={busy}
                data-testid="wizard-submit"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" /> Create Account
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}

        {step === "config-supabase" && (
          <form onSubmit={handleSaveSupabase} className="space-y-4" data-testid="wizard-supabase">
            <p className="text-sm text-muted-foreground text-center">
              Connect the owner-managed Supabase project after applying the master SQL migration.
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="hybrid-license-key">License Key</Label>
              <Input
                id="hybrid-license-key"
                type="password"
                required
                disabled={busy}
                placeholder="Enter the key issued by Arivahly"
                value={licKey}
                onChange={(event) => setLicKey(event.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supa-url">Supabase Project URL</Label>
              <Input
                id="supa-url"
                required
                disabled={busy}
                placeholder="https://xxxx.supabase.co"
                value={supaUrl}
                onChange={(e) => setSupaUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supa-key">Publishable / Anon Key</Label>
              <Input
                id="supa-key"
                required
                disabled={busy}
                value={supaKey}
                onChange={(e) => setSupaKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="supa-service-role">Service Role Key (setup only)</Label>
              <Input
                id="supa-service-role"
                type="password"
                required
                disabled={busy}
                value={supaServiceRoleKey}
                onChange={(e) => setSupaServiceRoleKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              This key validates the owner-managed setup and is discarded immediately. It is never
              stored by the ERP. Runtime synchronization uses only the anon key.
            </p>
            {err && <ErrorNote message={err} />}

            {needsSchemaInit && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-200">
                  This project does not have the ERP schema yet (or it needs updating). Run the
                  bundled master SQL migration now, or ask the ERP owner to apply it manually.
                </p>
                <div className="grid gap-1.5">
                  <Label htmlFor="pg-conn-str">Postgres Connection String (setup only)</Label>
                  <Input
                    id="pg-conn-str"
                    type="password"
                    disabled={schemaInitBusy}
                    placeholder="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres"
                    value={pgConnStr}
                    onChange={(e) => setPgConnStr(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Used once to run the migration, then discarded. Never stored, logged, or sent
                  anywhere except this project's own database.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={schemaInitBusy}
                  onClick={handleInitializeSchema}
                >
                  {schemaInitBusy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Running migration...
                    </span>
                  ) : (
                    "Run Master SQL Migration"
                  )}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => setStep("choose-mode")}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gold hover:bg-gold/90 text-black font-semibold"
                disabled={busy}
              >
                {busy ? "Validating..." : "Validate & Continue"}
              </Button>
            </div>
          </form>
        )}

        {step === "activate" && (
          <form onSubmit={handleActivate} className="space-y-4" data-testid="wizard-activate">
            <p className="text-sm text-muted-foreground text-center">
              Enter the license key issued by Arivahly. The licensing service address is built into
              this application and cannot be changed by customers.
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="lic-key">License Key</Label>
              <Input
                id="lic-key"
                required
                disabled={busy}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licKey}
                onChange={(e) => setLicKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            {err && <ErrorNote message={err} />}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => setStep("choose-mode")}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gold hover:bg-gold/90 text-black font-semibold"
                disabled={busy}
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Activating…
                  </span>
                ) : (
                  "Activate"
                )}
              </Button>
            </div>
          </form>
        )}

        {step === "finalizing" && (
          <FinalizingSteps mode={mode} onDone={mode === "hybrid" ? relaunchApp : onComplete} />
        )}
      </Card>
    </div>
  );
}

/**
 * Professional finish sequence — walks the operator through the setup steps
 * (schema, ERP init, admin, finalize) with a brief pause each, then opens the
 * ERP. The real work (mode, admin, session) already completed before this
 * shows; these are the user-facing progress messages the setup spec asks for.
 */
function ErrorNote({ message }: { message: string }) {
  return (
    <div className="text-xs text-red-400 font-medium leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2">
      <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function FinalizingSteps({ mode, onDone }: { mode: DeploymentMode | null; onDone: () => void }) {
  const stages = [
    mode === "offline" ? "Setting up your local database…" : "Setting up your database…",
    "Initializing ERP…",
    "Creating administrator account…",
    "Finalizing installation…",
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= stages.length) {
      const t = window.setTimeout(onDone, 500);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setI((n) => n + 1), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  return (
    <div className="space-y-2.5 py-2" data-testid="wizard-finalizing">
      <p className="text-sm text-muted-foreground text-center mb-3">Setting up your ERP…</p>
      {stages.map((label, idx) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          {idx < i ? (
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : idx === i ? (
            <Loader2 className="h-4 w-4 text-gold animate-spin shrink-0" />
          ) : (
            <span className="h-4 w-4 rounded-full border border-border shrink-0" />
          )}
          <span className={idx <= i ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </div>
      ))}
    </div>
  );
}
