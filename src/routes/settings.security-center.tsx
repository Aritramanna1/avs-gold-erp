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
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldOff, KeyRound, Loader2, RefreshCw } from "lucide-react";
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

  async function refresh() {
    setLoading(true);
    try {
      setDevices(await listRegisteredDevices());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleToggleTrust(d: DeviceInfo) {
    setBusyDeviceId(d.deviceId);
    try {
      await setDeviceTrust(d.deviceId, !d.trusted);
      toast.success(`${d.label} marked ${!d.trusted ? "trusted" : "untrusted"}.`);
      await refresh();
    } finally {
      setBusyDeviceId(null);
    }
  }

  async function handleRotateKey() {
    if (
      !window.confirm(
        "Rotate the local database encryption key now? This re-encrypts the entire local database in place.",
      )
    ) {
      return;
    }
    setRotating(true);
    try {
      const { data } = await supabase.auth.getSession();
      const result = await rotateEncryptionKey(data.session?.user.email ?? null);
      toast.success(
        `Encryption key rotated successfully — ${result.filesReencrypted} attachment file(s) re-encrypted.`,
      );
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
        subtitle="Devices that have written to this install's database, and encryption key rotation."
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

      <div className="rounded-2xl border border-border bg-card p-5 mb-6 flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Database Encryption Key
          </div>
          <div className="text-sm text-muted-foreground">
            Decrypts with the current key, re-encrypts with a freshly generated one, in place. Every
            rotation is recorded in the Audit Log.
          </div>
        </div>
        <Button onClick={handleRotateKey} disabled={rotating} className="gap-2 shrink-0">
          {rotating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Rotate Key Now
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
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
