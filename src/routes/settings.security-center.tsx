import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listRegisteredDevices,
  setDeviceTrust,
  type DeviceInfo,
} from "@/lib/security/device-registry";
import { rotateEncryptionKey } from "@/lib/security/key-management";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Loader2,
  RefreshCw,
  MonitorSmartphone,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/security-center")({
  head: () => ({ meta: [{ title: "Security Center · AVS Gold ERP" }] }),
  component: SecurityCenterPage,
});

function SecurityCenterPage() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionExpires, setSessionExpires] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function refreshSession() {
    const { data } = await supabase.auth.getSession();
    setSessionEmail(data.session?.user.email ?? null);
    const exp = data.session?.expires_at;
    setSessionExpires(exp ? new Date(exp * 1000).toLocaleString("en-IN") : null);
  }

  async function refresh() {
    setLoading(true);
    try {
      setDevices(await listRegisteredDevices());
    } catch (error) {
      setDevices([]);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load registered devices. Retry shortly.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    void refreshSession();
  }, []);

  async function handleToggleTrust(d: DeviceInfo) {
    setBusyDeviceId(d.deviceId);
    try {
      await setDeviceTrust(d.deviceId, !d.trusted);
      toast.success(`${d.label} marked ${!d.trusted ? "trusted" : "untrusted"}.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update device trust.");
    } finally {
      setBusyDeviceId(null);
    }
  }

  async function handleSignOutOthers() {
    if (!window.confirm("Sign out all other devices and sessions? This device stays signed in."))
      return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: "others" });
      toast.success("Other sessions revoked.");
      await refreshSession();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke other sessions");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleSignOutAll() {
    if (!window.confirm("Sign out everywhere including this device?")) return;
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/";
  }
  async function handleRotateKey() {
    if (
      !window.confirm(
        "Run the Supabase security key check now? Browser-local database key rotation is retired in this online build.",
      )
    ) {
      return;
    }
    setRotating(true);
    try {
      const { data } = await supabase.auth.getSession();
      const result = await rotateEncryptionKey(data.session?.user.email ?? null);
      toast.success(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Key rotation failed");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Security Center"
        subtitle="Registered devices, trust controls, and Supabase-online security checks."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="rounded-md border border-border bg-card p-5 mb-6 flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Supabase Security Key Check
          </div>
          <div className="text-sm text-muted-foreground">
            Browser-local database key rotation is retired. This check records that Supabase
            platform secrets and RLS remain the active security layer.
          </div>
        </div>
        <Button onClick={handleRotateKey} disabled={rotating} className="gap-2 shrink-0">
          {rotating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Run Key Check
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card p-5 mb-6">
        <div className="font-semibold flex items-center gap-2 mb-2">
          <MonitorSmartphone className="h-4 w-4" /> Active Auth Session
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Supabase manages session tokens securely. Uncheck &quot;Keep me signed in&quot; on login
          for session-only access on shared devices.
        </p>
        <div className="text-xs space-y-1 mb-4 font-mono">
          <div>Account: {sessionEmail ?? "—"}</div>
          <div>Access token refresh: {sessionExpires ?? "—"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={signingOut}
            onClick={() => void handleSignOutOthers()}
          >
            <LogOut className="h-3.5 w-3.5" /> Revoke Other Sessions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive"
            onClick={() => void handleSignOutAll()}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out Everywhere
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold">Registered Devices</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Device</th>
                <th className="p-3">Platform</th>
                <th className="p-3">First Seen</th>
                <th className="p-3">Last Seen</th>
                <th className="p-3">Trust</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No devices registered yet."}
                  </td>
                </tr>
              )}
              {devices.map((d) => (
                <tr key={d.deviceId} className="border-b border-border last:border-0">
                  <td className="p-3">{d.label}</td>
                  <td className="p-3 text-muted-foreground">{d.platform ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(d.firstSeenAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(d.lastSeenAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {d.trusted ? (
                      <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                        <ShieldCheck className="h-3 w-3" /> Trusted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <ShieldOff className="h-3 w-3" /> Untrusted
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyDeviceId === d.deviceId}
                      onClick={() => handleToggleTrust(d)}
                    >
                      Mark {d.trusted ? "Untrusted" : "Trusted"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
