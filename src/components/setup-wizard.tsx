import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cloud, CloudCog, WifiOff, Loader2, ShieldAlert, Check } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { setDeploymentMode, type DeploymentMode } from "@/lib/deployment-mode";
import { createLocalUser, setLocalSession } from "@/lib/local-auth";
import { ROLES } from "@/lib/permissions";

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
      "Local-first, with optional cloud sync. Sync is not available yet in this version — reserved for a future update.",
  },
  {
    mode: "online",
    icon: Cloud,
    title: "Online",
    description: "Cloud-only, same as today — requires an internet connection and a cloud account.",
  },
];

interface SetupWizardProps {
  onComplete: () => void;
}

/**
 * First-run setup wizard: shown once, when no deployment mode has ever been
 * chosen on this install. Offline/Hybrid also create the first local admin
 * account here, since Offline mode has no other way to sign in.
 */
export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<"choose-mode" | "create-admin">("choose-mode");
  const [mode, setMode] = useState<DeploymentMode | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function chooseMode(selected: DeploymentMode) {
    setMode(selected);
    if (selected === "online") {
      setBusy(true);
      await setDeploymentMode(selected);
      setBusy(false);
      onComplete();
      return;
    }
    setStep("create-admin");
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const user = await createLocalUser({
        name: name.trim(),
        email: email.trim(),
        role: ROLES.SUPER_OWNER,
        password,
        isSuperOwner: true,
      });
      await setDeploymentMode(mode);
      await setLocalSession(user.id);
      onComplete();
    } catch (ex: any) {
      setErr(ex?.message || "Could not create the local admin account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg p-6 space-y-5 border-border shadow-elegant bg-card/85 backdrop-blur-md">
        <div className="text-center space-y-1.5">
          <h1 className="font-serif text-2xl font-semibold tracking-wide text-gold">{APP_NAME}</h1>
          <p className="text-[9px] tracking-widest text-muted-foreground/70 font-medium">
            {APP_TAGLINE}
          </p>
        </div>

        {step === "choose-mode" && (
          <div className="space-y-3" data-testid="wizard-choose-mode">
            <p className="text-sm text-muted-foreground text-center">
              Choose how this installation will run. This can't be changed later without
              reinstalling.
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
                minLength={6}
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
                minLength={6}
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
      </Card>
    </div>
  );
}
