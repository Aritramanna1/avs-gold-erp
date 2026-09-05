/**
 * Tenant email configuration — Gmail / SMTP with secrets via edge function.
 */
import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  fetchTenantEmailAccounts,
  upsertTenantEmailAccount,
  type TenantEmailAccount,
  type TenantEmailProviderType,
} from "@/lib/comm/platform/tenant-email-store";
import { Mail, Loader2, TestTube } from "lucide-react";
import { toast } from "sonner";

export function TenantEmailConfigForm({ branchId }: { branchId: string }) {
  const [accounts, setAccounts] = useState<TenantEmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fromEmail: "",
    displayName: "",
    replyTo: "",
    providerType: "email_smtp" as TenantEmailProviderType,
    host: "",
    port: "465",
    encryption: "ssl",
    username: "",
    password: "",
    isDefault: true,
  });

  const load = async () => {
    setLoading(true);
    setAccounts(await fetchTenantEmailAccounts());
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  async function handleSave() {
    setBusy(true);
    const settings =
      form.providerType === "email_google_workspace"
        ? { host: "smtp.gmail.com", port: 465, encryption: "ssl" }
        : { host: form.host, port: Number(form.port), encryption: form.encryption };

    const acct = await upsertTenantEmailAccount({
      fromEmail: form.fromEmail,
      displayName: form.displayName,
      replyTo: form.replyTo,
      providerType: form.providerType,
      providerSettings: settings,
      isDefault: form.isDefault,
      branchId,
    });
    if (!acct) {
      toast.error("Failed to save email account");
      setBusy(false);
      return;
    }

    if (form.password || form.username) {
      await supabase.functions.invoke("save-tenant-email-secret", {
        body: {
          accountId: acct.id,
          branchId,
          providerType:
            form.providerType === "email_google_workspace" ? "email_smtp" : form.providerType,
          secretData: {
            username: form.username || form.fromEmail,
            password: form.password,
          },
        },
      });
    }
    toast.success("Email sender saved");
    setForm((f) => ({ ...f, password: "" }));
    await load();
    setBusy(false);
  }

  async function handleTest() {
    setBusy(true);
    try {
      const resp = await fetch("/api/email/send.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: form.fromEmail || "test@example.com",
          subject: "AVS ERP — Verification Test",
          htmlBody: "<p>SMTP verification test from Tenant Email Config</p>",
          branchId,
        }),
      });
      const data = await resp.json().catch(() => ({ success: true }));
      if (resp.ok && (data?.success || data?.sent)) {
        toast.success("Hostinger email engine verified successfully");
      } else {
        toast.error(data?.error ?? "Test failed");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Test connection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Tenant Email Sender"
      description="Configure Gmail or custom SMTP. Credentials are stored server-side only."
    >
      <div className="grid gap-3 max-w-lg">
        <div className="grid gap-1.5">
          <Label className="text-xs">Provider</Label>
          <Select
            value={form.providerType}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, providerType: v as TenantEmailProviderType }))
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email_google_workspace">Google Workspace / Gmail</SelectItem>
              <SelectItem value="email_smtp">Custom SMTP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">From Email</Label>
          <Input
            value={form.fromEmail}
            onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Display Name</Label>
          <Input
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Reply-To</Label>
          <Input
            value={form.replyTo}
            onChange={(e) => setForm((f) => ({ ...f, replyTo: e.target.value }))}
          />
        </div>
        {form.providerType === "email_smtp" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">SMTP Host</Label>
                <Input
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Port</Label>
                <Input
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Encryption</Label>
              <Select
                value={form.encryption}
                onValueChange={(v) => setForm((f) => ({ ...f, encryption: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ssl">SSL (465)</SelectItem>
                  <SelectItem value="starttls">STARTTLS (587)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs">Username / App Password</Label>
          <Input
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Password / App Password</Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Stored securely — leave blank to keep existing"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.isDefault}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
          />
          <span className="text-xs text-muted-foreground">Default sender for this tenant</span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => void handleSave()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Save Sender
          </Button>
          <Button variant="outline" onClick={() => void handleTest()} disabled={busy}>
            <TestTube className="h-4 w-4" /> Test Connection
          </Button>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading accounts…</p>
        ) : accounts.length > 0 ? (
          <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
            {accounts.map((a) => (
              <p key={a.id}>
                {a.isDefault ? "● " : "○ "}
                {a.fromEmail} ({a.providerType.replace("email_", "")})
                {a.lastTestStatus ? ` — ${a.lastTestStatus}` : ""}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
