import { useEffect, useState, type ReactNode } from "react";
import { useDeploymentMode } from "@/lib/deployment-mode";
import {
  useLicense,
  verifyLicense,
  getLicenseConfig,
  setLicenseConfig,
  getSupportUrl,
  IS_DEVELOPER_BUILD,
  type LicenseStatus,
} from "@/lib/licensing/license-store";
import { useSettings } from "@/lib/settings-store";
import { AppBootSkeleton } from "@/components/app-boot-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRound, LogOut, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

const RECHECK_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function openRenewal(url: string) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function LicenseGate({ children }: { children: ReactNode }) {
  const mode = useDeploymentMode((state) => state.mode);
  const status = useLicense((state) => state.status);
  const message = useLicense((state) => state.message);
  const expiry = useLicense((state) => state.expiry);
  const trialEndsAt = useLicense((state) => state.trialEndsAt);
  const branding = useSettings((state) => state.branding);
  const config = getLicenseConfig();
  // null = not yet resolved. Starting at false (instead of null) was the bug:
  // a saas_admin whose license status resolves to expired/suspended before
  // this async role lookup finishes would flash the tenant LicenseBlock
  // ("Contact Support", renewal prompt) even though they're not a tenant.
  const [isSaasAdmin, setIsSaasAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!mode) return;
    void verifyLicense(mode);
    if (mode === "offline") return;
    const id = window.setInterval(() => void verifyLicense(mode), RECHECK_MS);
    return () => window.clearInterval(id);
  }, [mode]);

  // Platform administrators operate the control plane and are not tenants;
  // their access must not depend on any firm's license key. The role is read
  // from the authoritative user_roles table, never from browser state.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id;
      if (!userId) {
        if (!cancelled) setIsSaasAdmin(false);
        return;
      }
      const { data: roles, error } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", userId);
      if (!cancelled) {
        if (error) {
          console.error("[LicenseGate] user_roles lookup failed:", error);
          setIsSaasAdmin(false);
          return;
        }
        setIsSaasAdmin(
          ((roles ?? []) as Array<{ role?: string }>).some((entry) => entry.role === "saas_admin"),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mode || status === "checking" || isSaasAdmin === null) return <AppBootSkeleton />;

  if ((status === "expired" || status === "suspended") && !isSaasAdmin) {
    return (
      <LicenseBlock
        status={status}
        message={message}
        renewalUrl={config.renewalUrl}
        applicationName={branding.applicationName}
        companyName={branding.companyName}
      />
    );
  }

  const relevantEnd = status === "trial" ? trialEndsAt : expiry;
  const daysRemaining = relevantEnd
    ? Math.max(0, Math.ceil((relevantEnd - Date.now()) / DAY_MS))
    : null;

  return (
    <>
      {status === "trial" ? (
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-1.5 text-center text-xs text-foreground">
          {branding.applicationName} trial
          {daysRemaining !== null
            ? ` · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
            : ""}
        </div>
      ) : null}
      {children}
      <RenewalNotice
        status={status}
        daysRemaining={daysRemaining}
        noticeDays={config.renewalNoticeDays}
        renewalUrl={config.renewalUrl}
        applicationName={branding.applicationName}
        companyName={branding.companyName}
      />
    </>
  );
}

function RenewalNotice({
  status,
  daysRemaining,
  noticeDays,
  renewalUrl,
  applicationName,
  companyName,
}: {
  status: LicenseStatus;
  daysRemaining: number | null;
  noticeDays: number;
  renewalUrl: string;
  applicationName: string;
  companyName: string;
}) {
  const due = daysRemaining !== null && daysRemaining <= noticeDays;
  const storageKey = `license-renewal-notice-${status}-${new Date().toISOString().slice(0, 10)}`;
  const [open, setOpen] = useState(() => due && !window.sessionStorage.getItem(storageKey));

  useEffect(() => {
    if (due && !window.sessionStorage.getItem(storageKey)) setOpen(true);
  }, [due, storageKey]);

  if (!due) return null;
  const dismiss = () => {
    window.sessionStorage.setItem(storageKey, "shown");
    setOpen(false);
  };
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="border-gold/30">
        <AlertDialogHeader>
          <AlertDialogTitle>{applicationName} renewal reminder</AlertDialogTitle>
          <AlertDialogDescription>
            Your {status} period ends in {daysRemaining} day{daysRemaining === 1 ? "" : "s"}.
            Contact {companyName} to renew access. Payment collection is not included in this build.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={dismiss}>Remind me later</AlertDialogCancel>
          {renewalUrl ? (
            <AlertDialogAction onClick={() => openRenewal(renewalUrl)}>
              Renew / Contact
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LicenseBlock({
  status,
  message,
  renewalUrl,
  applicationName,
  companyName,
}: {
  status: "expired" | "suspended";
  message: string | null;
  renewalUrl: string;
  applicationName: string;
  companyName: string;
}) {
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-gold/30 bg-card p-6 shadow-elegant">
        <div className="flex items-center gap-2 text-gold">
          <ShieldAlert className="h-6 w-6" />
          <h1 className="font-serif text-xl">
            {applicationName} · License {status === "expired" ? "Expired" : "Suspended"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {message ??
            `Contact ${companyName} to restore access. No payment is collected inside the application.`}
        </p>
        {renewalUrl ? (
          <Button className="w-full" onClick={() => openRenewal(renewalUrl)}>
            Renew / Contact
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => void supabase.auth.signOut()}
        >
          <LogOut className="h-4 w-4" /> Log Out / Switch Account
        </Button>
        <LicensePanel />
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  lifetime: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trial: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  expired: "bg-red-500/15 text-red-400 border-red-500/30",
  suspended: "bg-red-500/15 text-red-400 border-red-500/30",
  checking: "bg-muted text-muted-foreground border-border",
};

function fmt(ts: number | null): string {
  return ts ? new Date(ts).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
}
function maskKey(k: string): string {
  if (!k) return "—";
  return k.length <= 4 ? k : `${"•".repeat(Math.max(0, k.length - 4))}${k.slice(-4)}`;
}

/**
 * Enterprise-grade license screen. Shows read-only status/type/key/expiry/last-
 * verification + Contact Support. Customer builds add a License-Key field and an
 * Activate button (the activation server is embedded, never entered). The
 * developer build shows a permanent Lifetime license with no controls.
 */
export function LicensePanel({ onActivated }: { onActivated?: () => void }) {
  const status = useLicense((s) => s.status);
  const storedKey = useLicense((s) => s.key);
  const expiry = useLicense((s) => s.expiry);
  const trialEndsAt = useLicense((s) => s.trialEndsAt);
  const lastVerifiedAt = useLicense((s) => s.lastVerifiedAt);
  const message = useLicense((s) => s.message);
  const edition = useLicense((s) => s.edition);
  const maximumDevices = useLicense((s) => s.seats);
  const features = useLicense((s) => s.features);
  const customerStatus = useLicense((s) => s.customerStatus);
  const mode = useDeploymentMode((s) => s.mode);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const typeLabel =
    status === "lifetime"
      ? "Lifetime (Developer)"
      : status.charAt(0).toUpperCase() + status.slice(1);
  const effectiveExpiry = status === "trial" ? trialEndsAt : expiry;

  async function activate() {
    setBusy(true);
    try {
      if (key.trim()) setLicenseConfig({ key: key.trim() });
      const resolved = await verifyLicense(mode);
      toast.success(`License: ${resolved}`);
      onActivated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[status] ?? STATUS_STYLE.checking}`}
            >
              {status}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            License Type
          </dt>
          <dd className="mt-1 font-medium">{typeLabel}</dd>
        </div>
        {status !== "lifetime" && (
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
              License Key
            </dt>
            <dd className="mt-1 font-mono text-xs">{maskKey(storedKey)}</dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Expiry</dt>
          <dd className="mt-1 font-medium">
            {status === "lifetime" ? "Never" : fmt(effectiveExpiry)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Last Verification
          </dt>
          <dd className="mt-1 font-medium">{fmt(lastVerifiedAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Edition</dt>
          <dd className="mt-1 font-medium">{edition ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Maximum Devices
          </dt>
          <dd className="mt-1 font-medium">{maximumDevices ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Customer Status
          </dt>
          <dd className="mt-1 font-medium">{customerStatus ?? "—"}</dd>
        </div>
      </dl>

      {features.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Enabled Features
          </p>
          <p className="text-xs">{features.join(", ")}</p>
        </div>
      )}

      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      {/* Customer builds only: enter a key and activate against the embedded server. */}
      {!IS_DEVELOPER_BUILD && (
        <div className="space-y-2 border-t border-border pt-3">
          <Label className="flex items-center gap-1.5 text-xs">
            <KeyRound className="h-3.5 w-3.5" /> License Key
          </Label>
          <div className="flex gap-2">
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={storedKey ? "Enter a new key to re-activate" : "XXXX-XXXX-XXXX-XXXX"}
              className="text-xs font-mono"
            />
            <Button size="sm" onClick={() => void activate()} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate / Verify"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => window.open(getSupportUrl(), "_blank")}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Contact Support
        </Button>
      </div>
    </div>
  );
}
