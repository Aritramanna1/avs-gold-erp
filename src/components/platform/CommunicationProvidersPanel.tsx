/**
 * Platform Owner — Communication Providers (Email, WhatsApp, SMS, In-App).
 */
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fetchPlatformSmsConfig } from "@/lib/comm/platform/sms-provider-adapter";
import {
  loadPlatformEmailSettings,
  savePlatformEmailSettings,
  testPlatformEmailConnection,
} from "@/lib/platform-email-settings";
import { invokeCommunicationScheduler } from "@/lib/comm/communication-scheduler-client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, MessageSquare, Smartphone, Bell } from "lucide-react";

export function CommunicationProvidersPanel() {
  const [sms, setSms] = useState({
    enabled: false,
    provider: "",
    senderId: "",
    otpEnabled: false,
    transactionalEnabled: false,
    credentialsStatus: "not_configured",
  });
  const [otpChannels, setOtpChannels] = useState("email, whatsapp, sms");
  const [email, setEmail] = useState({
    fromEmail: "",
    replyTo: "",
    displayName: "",
    provider: "email_smtp",
  });
  const [testRecipient, setTestRecipient] = useState("");
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const config = await fetchPlatformSmsConfig();
      const emailSettings = await loadPlatformEmailSettings();
      setEmail(emailSettings);
      setSms({
        enabled: config.enabled,
        provider: config.provider ?? "",
        senderId: config.senderId ?? "",
        otpEnabled: config.otpEnabled,
        transactionalEnabled: config.transactionalEnabled,
        credentialsStatus: config.credentialsStatus,
      });
      const { data } = await supabase
        .from("platform_otp_policy" as never)
        .select("preferred_channels")
        .eq("id", "default")
        .maybeSingle();
      const channels = (data as { preferred_channels?: string[] } | null)?.preferred_channels;
      if (channels?.length) setOtpChannels(channels.join(", "));
      setLoading(false);
    })();
  }, []);

  async function saveEmail() {
    try {
      await savePlatformEmailSettings(email);
      toast.success("Platform email settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save email settings");
    }
  }

  async function runEmailTest() {
    if (!testRecipient.trim()) {
      toast.error("Enter a test recipient email");
      return;
    }
    const result = await testPlatformEmailConnection(testRecipient.trim());
    if (result.ok) toast.success("Test email dispatched via send-email edge function");
    else toast.error(result.error ?? "Email test failed");
  }

  async function runSchedulerNow() {
    setSchedulerRunning(true);
    const result = await invokeCommunicationScheduler(true);
    setSchedulerRunning(false);
    if (result.ok) toast.success("Communication scheduler invoked");
    else toast.error(result.error ?? "Scheduler invoke failed");
  }

  async function saveSms() {
    const { error } = await supabase.from("platform_sms_config" as never).upsert({
      id: "default",
      enabled: sms.enabled,
      provider: sms.provider || null,
      sender_id: sms.senderId || null,
      otp_enabled: sms.otpEnabled,
      transactional_enabled: sms.transactionalEnabled,
      credentials_status: sms.provider ? "configured" : "not_configured",
      updated_at: new Date().toISOString(),
    } as never);
    if (error) toast.error(error.message);
    else toast.success("SMS platform settings saved");
  }

  async function saveOtpPolicy() {
    const channels = otpChannels
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const { error } = await supabase.from("platform_otp_policy" as never).upsert({
      id: "default",
      preferred_channels: channels,
      fallback_enabled: true,
      updated_at: new Date().toISOString(),
    } as never);
    if (error) toast.error(error.message);
    else toast.success("OTP channel policy saved");
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading providers…</p>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <div>
        <h2 className="font-serif text-xl">Communication Providers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Central AVS platform controls for Email, WhatsApp, SMS, and In-App notifications.
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <Mail className="h-4 w-4" />
          <h3 className="font-medium">Email</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Platform sender identity persisted to `platform_settings` and consumed by the universal
          `send-email` edge function. SMTP/API secrets remain in the approved vault path.
        </p>
        <div className="grid gap-2">
          <Label>Display name</Label>
          <Input
            value={email.displayName}
            onChange={(e) => setEmail((s) => ({ ...s, displayName: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>From email</Label>
          <Input
            value={email.fromEmail}
            onChange={(e) => setEmail((s) => ({ ...s, fromEmail: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Reply-to</Label>
          <Input
            value={email.replyTo}
            onChange={(e) => setEmail((s) => ({ ...s, replyTo: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Provider type</Label>
          <Input
            value={email.provider}
            onChange={(e) => setEmail((s) => ({ ...s, provider: e.target.value }))}
            placeholder="email_smtp | email_resend | email_ses"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void saveEmail()}>
            Save Email Settings
          </Button>
        </div>
        <div className="grid gap-2 pt-2 border-t border-border">
          <Label>Test recipient</Label>
          <div className="flex gap-2">
            <Input
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="you@example.com"
            />
            <Button size="sm" variant="outline" onClick={() => void runEmailTest()}>
              Send Test
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <MessageSquare className="h-4 w-4" />
          <h3 className="font-medium">WhatsApp</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Meta / AVS BSP, WABA, templates, webhooks, and credits are configured in Meta / WhatsApp
          control centre.
        </p>
      </section>

      <section className="rounded-md border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2 text-gold">
          <Smartphone className="h-4 w-4" />
          <h3 className="font-medium">SMS</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Infrastructure ready — disabled until an SMS provider is purchased and connected. Sends
          are never faked as successful.
        </p>
        <div className="flex items-center justify-between">
          <Label htmlFor="sms-enabled">SMS Enabled</Label>
          <Switch
            id="sms-enabled"
            checked={sms.enabled}
            onCheckedChange={(v) => setSms((s) => ({ ...s, enabled: v }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Provider adapter</Label>
          <Input
            value={sms.provider}
            onChange={(e) => setSms((s) => ({ ...s, provider: e.target.value }))}
            placeholder="e.g. msg91, twilio (not connected)"
          />
        </div>
        <div className="grid gap-2">
          <Label>Sender ID</Label>
          <Input
            value={sms.senderId}
            onChange={(e) => setSms((s) => ({ ...s, senderId: e.target.value }))}
            placeholder="Optional sender ID"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>OTP via SMS</Label>
          <Switch
            checked={sms.otpEnabled}
            onCheckedChange={(v) => setSms((s) => ({ ...s, otpEnabled: v }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Transactional SMS</Label>
          <Switch
            checked={sms.transactionalEnabled}
            onCheckedChange={(v) => setSms((s) => ({ ...s, transactionalEnabled: v }))}
          />
        </div>
        <p className="text-[10px] text-muted-foreground uppercase">
          Credentials: {sms.credentialsStatus}
        </p>
        <Button size="sm" onClick={() => void saveSms()}>
          Save SMS Settings
        </Button>
      </section>

      <section className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <Bell className="h-4 w-4" />
          <h3 className="font-medium">OTP Channel Policy</h3>
        </div>
        <Label>Preferred channels (comma-separated)</Label>
        <Input value={otpChannels} onChange={(e) => setOtpChannels(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Example: email, whatsapp, sms — fallback applies when a channel is unavailable.
        </p>
        <Button size="sm" variant="outline" onClick={() => void saveOtpPolicy()}>
          Save OTP Policy
        </Button>
      </section>

      <section className="rounded-md border border-border bg-card p-4 space-y-3">
        <h3 className="font-medium mb-1">Communication Scheduler</h3>
        <p className="text-xs text-muted-foreground">
          Triggers the `communication-scheduler` edge function (report jobs, outbox retry, AMC/trial
          sweeps). pg_cron also invokes this hourly when configured on staging.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={schedulerRunning}
          onClick={() => void runSchedulerNow()}
        >
          {schedulerRunning ? "Running…" : "Run Scheduler Now"}
        </Button>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h3 className="font-medium mb-1">In-App</h3>
        <p className="text-xs text-muted-foreground">
          Enabled for authenticated ERP users via platform notifications.
        </p>
      </section>
    </div>
  );
}
