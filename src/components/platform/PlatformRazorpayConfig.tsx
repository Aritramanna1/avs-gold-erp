/**
 * Platform Owner — Comprehensive Razorpay Payment Gateway Administration Center
 *
 * Supports TEST and LIVE mode separation, dynamic callback & webhook URL configuration,
 * secret masking, non-charging connectivity diagnostics, and safe mode switching.
 */
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Lock,
  Globe,
  RefreshCw,
} from "lucide-react";

interface GatewaySettingsResponse {
  success: boolean;
  mode: "TEST" | "LIVE";
  is_live: boolean;
  active: {
    is_configured: boolean;
    key_id_masked: string;
    key_secret_masked: string;
    webhook_secret_masked: string;
    return_url: string;
    webhook_url: string;
  };
  test: {
    is_configured: boolean;
    key_id: string;
    key_id_masked: string;
    key_secret_configured: boolean;
    webhook_secret_configured: boolean;
    return_url: string;
    webhook_url: string;
  };
  live: {
    is_configured: boolean;
    key_id: string;
    key_id_masked: string;
    key_secret_configured: boolean;
    webhook_secret_configured: boolean;
    return_url: string;
    webhook_url: string;
  };
  last_verified_at: string | null;
  last_error: string | null;
}

interface DiagnosticResult {
  environment: string;
  credentials_present: boolean;
  key_id_valid_format: boolean;
  return_url_configured: boolean;
  webhook_url_configured: boolean;
  database_connected: boolean;
  server_time: string;
  api_connectivity: string;
}

/** LIVE integration active — unblocked with authorized live credentials. */
const LIVE_FINAL_INTEGRATION_HELD = false;

export function PlatformRazorpayConfig() {
  const [settings, setSettings] = useState<GatewaySettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingHealth, setTestingHealth] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);

  // Form states
  const [testKeyId, setTestKeyId] = useState("");
  const [testKeySecret, setTestKeySecret] = useState("");
  const [testWebhookSecret, setTestWebhookSecret] = useState("");
  const [testReturnUrl, setTestReturnUrl] = useState("");
  const [testWebhookUrl, setTestWebhookUrl] = useState("");

  const [liveKeyId, setLiveKeyId] = useState("");
  const [liveKeySecret, setLiveKeySecret] = useState("");
  const [liveWebhookSecret, setLiveWebhookSecret] = useState("");
  const [liveReturnUrl, setLiveReturnUrl] = useState("");
  const [liveWebhookUrl, setLiveWebhookUrl] = useState("");

  // Mode Switch Dialog
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [confirmLiveAck, setConfirmLiveAck] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/admin-settings.php");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data: GatewaySettingsResponse = await res.json();
      setSettings(data);
      setTestKeyId(data.test.key_id || "rzp_test_TYMMkJFsIR9agE");
      setTestReturnUrl(data.test.return_url || "https://erp.arivahly.in/settings/license?payment=callback");
      setTestWebhookUrl(data.test.webhook_url || "https://erp.arivahly.in/api/webhooks/razorpay.php");

      setLiveKeyId(data.live.key_id || "rzp_live_TbD4vk5htRn2GB");
      setLiveReturnUrl(data.live.return_url || "https://erp.arivahly.in/settings/license?payment=callback");
      setLiveWebhookUrl(data.live.webhook_url || "https://erp.arivahly.in/api/webhooks/razorpay.php");
    } catch {
      // Fallback for local dev
      setSettings({
        success: true,
        mode: "LIVE",
        is_live: true,
        active: {
          is_configured: true,
          key_id_masked: "rzp_live_••••••••2GB",
          key_secret_masked: "••••••••",
          webhook_secret_masked: "••••••••",
          return_url: "https://erp.arivahly.in/settings/license?payment=callback",
          webhook_url: "https://erp.arivahly.in/api/webhooks/razorpay.php",
        },
        test: {
          is_configured: false,
          key_id: "rzp_test_TYMMkJFsIR9agE",
          key_id_masked: "rzp_test_••••••••agE",
          key_secret_configured: false,
          webhook_secret_configured: false,
          return_url: "https://erp.arivahly.in/settings/license?payment=callback",
          webhook_url: "https://erp.arivahly.in/api/webhooks/razorpay.php",
        },
        live: {
          is_configured: true,
          key_id: "rzp_live_TbD4vk5htRn2GB",
          key_id_masked: "rzp_live_••••••••2GB",
          key_secret_configured: true,
          webhook_secret_configured: true,
          return_url: "https://erp.arivahly.in/settings/license?payment=callback",
          webhook_url: "https://erp.arivahly.in/api/webhooks/razorpay.php",
        },
        last_verified_at: null,
        last_error: null,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSettings();
  }, []);

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        action: "save_settings",
        test_key_id: testKeyId,
        test_return_url: testReturnUrl,
        test_webhook_url: testWebhookUrl,
        live_key_id: liveKeyId,
        live_return_url: liveReturnUrl,
        live_webhook_url: liveWebhookUrl,
      };

      if (testKeySecret.trim()) payload.test_key_secret = testKeySecret.trim();
      if (testWebhookSecret.trim()) payload.test_webhook_secret = testWebhookSecret.trim();
      if (liveKeySecret.trim()) payload.live_key_secret = liveKeySecret.trim();
      if (liveWebhookSecret.trim()) payload.live_webhook_secret = liveWebhookSecret.trim();

      const res = await fetch("/api/payments/admin-settings.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");

      toast.success("Payment gateway settings saved securely");
      setTestKeySecret("");
      setTestWebhookSecret("");
      setLiveKeySecret("");
      setLiveWebhookSecret("");
      await fetchSettings();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestingHealth(true);
    setDiagnostics(null);
    try {
      const res = await fetch("/api/payments/admin-settings.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_connection", environment: settings?.mode ?? "TEST" }),
      });
      const data = await res.json();
      if (data.diagnostics) {
        setDiagnostics(data.diagnostics);
        toast.success(data.summary || "Health check completed");
      } else {
        toast.error("Health check returned no diagnostics");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Health check request failed");
    } finally {
      setTestingHealth(false);
    }
  }

  async function handleSwitchMode(targetMode: "TEST" | "LIVE") {
    if (LIVE_FINAL_INTEGRATION_HELD && targetMode === "LIVE") {
      toast.error(
        "LIVE mode is held until final integration greenlight. Save TEST keys and return URLs only.",
      );
      return;
    }
    setSwitchingMode(true);
    try {
      const res = await fetch("/api/payments/admin-settings.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "switch_mode",
          target_mode: targetMode,
          confirm_switch: confirmLiveAck,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Mode switch failed");

      toast.success(data.message || `Switched to ${targetMode} mode`);
      setShowSwitchModal(false);
      setConfirmLiveAck(false);
      await fetchSettings();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to switch mode");
    } finally {
      setSwitchingMode(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 border-gold/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-gold" /> Loading Payment Gateway Settings…
        </div>
      </Card>
    );
  }

  const currentMode = settings?.mode ?? "TEST";

  return (
    <div className="space-y-6">
      {LIVE_FINAL_INTEGRATION_HELD ? (
        <Card className="p-3 border-amber-500/40 bg-amber-500/10">
          <p className="text-xs text-amber-900 dark:text-amber-100">
            <strong>LIVE hold:</strong> configure TEST credentials, return URL, and webhook URL now.
            Final LIVE integration stays blocked until owner greenlight (verification complete).
            Never paste secrets into chat.
          </p>
        </Card>
      ) : null}
      {/* Top Banner: Mode & Status */}
      <Card className="p-4 border-gold/30 bg-gradient-to-r from-background via-card to-background shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg border ${
                currentMode === "LIVE"
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              }`}
            >
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">Razorpay Payment Engine</h3>
                <Badge
                  variant={currentMode === "LIVE" ? "destructive" : "outline"}
                  className="font-mono text-xs uppercase font-bold"
                >
                  CURRENT MODE: {currentMode}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative SaaS subscription billing, checkout redirect, and webhook processing
                for <code>erp.arivahly.in</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8 flex-1 sm:flex-none"
              onClick={() => void handleTestConnection()}
              disabled={testingHealth}
            >
              {testingHealth ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
              )}
              Test Razorpay Configuration
            </Button>

            <Button
              variant={currentMode === "LIVE" ? "outline" : "destructive"}
              size="sm"
              className="text-xs gap-1.5 h-8 flex-1 sm:flex-none"
              onClick={() => {
                if (currentMode === "TEST") {
                  setShowSwitchModal(true);
                } else {
                  void handleSwitchMode("TEST");
                }
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {currentMode === "LIVE" ? "Switch to TEST" : "Activate LIVE Mode"}
            </Button>
          </div>
        </div>

        {/* Diagnostics Output Banner */}
        {diagnostics && (
          <div className="mt-4 pt-3 border-t border-border/50 text-xs">
            <div className="rounded-md border p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Diagnostic Health Report (
                  {diagnostics.environment})
                </span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {diagnostics.api_connectivity}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1">
                <div>
                  Credentials Present:{" "}
                  <span className="font-semibold text-foreground">
                    {diagnostics.credentials_present ? "Yes" : "Ready to enter"}
                  </span>
                </div>
                <div>
                  Key ID Format:{" "}
                  <span className="font-semibold text-foreground">
                    {diagnostics.key_id_valid_format ? "Valid (rzp_)" : "Pending"}
                  </span>
                </div>
                <div>
                  Return URL:{" "}
                  <span className="font-semibold text-foreground">
                    {diagnostics.return_url_configured ? "Configured" : "Missing"}
                  </span>
                </div>
                <div>
                  Webhook URL:{" "}
                  <span className="font-semibold text-foreground">
                    {diagnostics.webhook_url_configured ? "Configured" : "Missing"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Configuration Tabs: TEST vs LIVE */}
      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="test" className="text-xs">
            TEST Configuration (Sandbox)
          </TabsTrigger>
          <TabsTrigger value="live" className="text-xs">
            LIVE Configuration (Production)
          </TabsTrigger>
        </TabsList>

        {/* TEST TAB */}
        <TabsContent value="test" className="mt-4">
          <Card className="p-5 border-border shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-semibold text-sm">TEST Environment Credentials</h4>
                <p className="text-xs text-muted-foreground">
                  Used for mock orders, local QA runs, and sandbox checkout testing.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {settings?.test.is_configured ? "TEST Configured" : "Ready to Enter"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">TEST Key ID (Publishable)</Label>
                <Input
                  placeholder="rzp_test_…"
                  value={testKeyId}
                  onChange={(e) => setTestKeyId(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Masked: <code>{settings?.test.key_id_masked}</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">TEST Key Secret</Label>
                <Input
                  type="password"
                  placeholder={
                    settings?.test.key_secret_configured
                      ? "•••••••• (Leave blank to keep existing)"
                      : "Enter TEST Key Secret"
                  }
                  value={testKeySecret}
                  onChange={(e) => setTestKeySecret(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">TEST Webhook Secret</Label>
                <Input
                  type="password"
                  placeholder={
                    settings?.test.webhook_secret_configured
                      ? "•••••••• (Leave blank to keep existing)"
                      : "Enter TEST Webhook Secret"
                  }
                  value={testWebhookSecret}
                  onChange={(e) => setTestWebhookSecret(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  TEST Return / Callback URL (RAZORPAY_RETURN_URL)
                </Label>
                <Input
                  placeholder="https://erp.arivahly.in/settings/license?payment=callback"
                  value={testReturnUrl}
                  onChange={(e) => setTestReturnUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold">
                  TEST Webhook Endpoint URL (RAZORPAY_WEBHOOK_URL)
                </Label>
                <Input
                  placeholder="https://erp.arivahly.in/api/webhooks/razorpay.php"
                  value={testWebhookUrl}
                  onChange={(e) => setTestWebhookUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Secrets are encrypted server-side and never sent in plaintext to client browsers.
              </span>
              <Button size="sm" onClick={() => void handleSaveSettings()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save TEST Configuration
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* LIVE TAB */}
        <TabsContent value="live" className="mt-4">
          <Card className="p-5 border-border shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-semibold text-sm">LIVE Production Credentials</h4>
                <p className="text-xs text-muted-foreground">
                  Authoritative live merchant keys. Do not activate without verified merchant KYC.
                </p>
              </div>
              <Badge
                variant={settings?.live.is_configured ? "default" : "outline"}
                className="text-[10px]"
              >
                {settings?.live.is_configured ? "LIVE Configured" : "Not Configured"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">LIVE Key ID (Publishable)</Label>
                <Input
                  placeholder="rzp_live_…"
                  value={liveKeyId}
                  onChange={(e) => setLiveKeyId(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Masked: <code>{settings?.live.key_id_masked}</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">LIVE Key Secret</Label>
                <Input
                  type="password"
                  placeholder={
                    settings?.live.key_secret_configured
                      ? "•••••••• (Leave blank to keep existing)"
                      : "Enter LIVE Key Secret"
                  }
                  value={liveKeySecret}
                  onChange={(e) => setLiveKeySecret(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">LIVE Webhook Secret</Label>
                <Input
                  type="password"
                  placeholder={
                    settings?.live.webhook_secret_configured
                      ? "•••••••• (Leave blank to keep existing)"
                      : "Enter LIVE Webhook Secret"
                  }
                  value={liveWebhookSecret}
                  onChange={(e) => setLiveWebhookSecret(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  LIVE Return / Callback URL (RAZORPAY_RETURN_URL)
                </Label>
                <Input
                  placeholder="https://erp.arivahly.in/settings/license?payment=callback"
                  value={liveReturnUrl}
                  onChange={(e) => setLiveReturnUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold">
                  LIVE Webhook Endpoint URL (RAZORPAY_WEBHOOK_URL)
                </Label>
                <Input
                  placeholder="https://erp.arivahly.in/api/webhooks/razorpay.php"
                  value={liveWebhookUrl}
                  onChange={(e) => setLiveWebhookUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Live keys remain inactive until the explicit LIVE activation confirmation is executed.
              </span>
              <Button size="sm" onClick={() => void handleSaveSettings()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save LIVE Configuration
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Safety Confirmation Modal for Switching to LIVE Mode */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-md w-full p-6 border-red-500/40 space-y-4 bg-card shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-base">Switch Razorpay to LIVE Production Mode?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Switching to <strong>LIVE</strong> mode will process real bank and card transactions
              on <code>erp.arivahly.in</code>. Ensure your live Razorpay account is KYC-compliant and
              webhook secret is set.
            </p>

            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md space-y-2 text-xs">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmLiveAck}
                  onChange={(e) => setConfirmLiveAck(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span className="font-medium text-foreground">
                  I confirm that Live API keys are valid and authorize live credit/debit charges.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSwitchModal(false);
                  setConfirmLiveAck(false);
                }}
                disabled={switchingMode}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleSwitchMode("LIVE")}
                disabled={!confirmLiveAck || switchingMode}
              >
                {switchingMode ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Confirm & Switch to LIVE
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
