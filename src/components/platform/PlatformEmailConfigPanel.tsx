/**
 * Platform Owner — Central Email & Communications Hub
 * Real Hostinger Email Provider Configuration, Mandatory AVS Branding, Template Manager & Outbox Logs.
 */
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Mail,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Clock,
  Sparkles,
  Eye,
  Check,
  Server,
  ShieldCheck,
  Lock,
  Globe,
  Activity,
  Terminal,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchHostingerProviderConfig,
  saveHostingerProviderConfig,
  testHostingerConnection,
  sendHostingerTestEmail,
  loadPlatformSenderConfig,
  savePlatformSenderConfig,
  loadEmailTemplates,
  saveEmailTemplate,
  dispatchPlatformEmail,
  generateAvsBrandedFooter,
  renderEmailBody,
  type HostingerProviderConfig,
  type PlatformEmailSenderConfig,
  type EmailTemplateConfig,
} from "@/lib/platform-email-service";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export function PlatformEmailConfigPanel() {
  const [activeTab, setActiveTab] = useState("provider");
  
  // Hostinger Provider State
  const [providerConfig, setProviderConfig] = useState<HostingerProviderConfig>({
    provider: "Hostinger Email",
    isConfigured: false,
    hasPassword: false,
    host: "smtp.hostinger.com",
    port: 465,
    encryption: "SSL/TLS",
    username: "",
    password: "",
    fromEmail: "",
    fromName: "AVS Gold ERP Platform",
    replyTo: "support@arivahly.in",
    domain: "arivahly.in",
  });
  const [savingProvider, setSavingProvider] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  // Sender & Templates State
  const [senderConfig, setSenderConfig] = useState<PlatformEmailSenderConfig | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateConfig[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateConfig | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [provCfg, sendCfg, tmpls, logs] = await Promise.all([
        fetchHostingerProviderConfig(),
        loadPlatformSenderConfig(),
        loadEmailTemplates(),
        supabase
          .from("platform_audit_events")
          .select("*")
          .in("action", ["EMAIL_DISPATCHED", "EMAIL_FAILED"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setProviderConfig(provCfg);
      setSenderConfig(sendCfg);
      setTemplates(tmpls);
      setSelectedTemplate(tmpls[0] || null);
      setDeliveryLogs(logs.data || []);
    } catch (err: any) {
      toast.error("Failed to load email configurations: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handleSaveProvider() {
    setSavingProvider(true);
    try {
      const res = await saveHostingerProviderConfig(providerConfig);
      if (res.success) {
        toast.success("Hostinger Email credentials securely saved to server-side vault.");
        setProviderConfig((prev) => ({
          ...prev,
          ...res.config,
          password: "", // clear password from memory
        }));
      } else {
        toast.error("Failed to save credentials: " + (res.error || "Unknown error"));
      }
    } catch (err: any) {
      toast.error("Error saving provider: " + err.message);
    } finally {
      setSavingProvider(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const res = await testHostingerConnection(providerConfig);
      setConnectionTestResult(res);
      if (res.success && res.status === "AUTHENTICATED") {
        toast.success("Hostinger SMTP connected & authenticated successfully!");
      } else {
        toast.error("Connection test failed: " + (res.error || res.status));
      }
    } catch (err: any) {
      toast.error("Failed to run connection test: " + err.message);
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSendTestEmail() {
    if (!testEmailRecipient.trim()) {
      toast.error("Enter a recipient email address for testing.");
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await sendHostingerTestEmail(testEmailRecipient.trim(), providerConfig);
      setTestEmailResult(res);
      if (res.success) {
        toast.success(`Test email dispatched successfully to ${testEmailRecipient}!`);
      } else {
        toast.error("Failed to dispatch test email: " + (res.error || res.status));
      }
    } catch (err: any) {
      toast.error("Error dispatching test email: " + err.message);
    } finally {
      setSendingTestEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-gold flex items-center gap-2">
            <Mail className="h-5 w-5" /> Hostinger Email & Central Communications
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            Authoritative Hostinger SMTP delivery engine, server-side credential vault, and mandatory AVS branding.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void loadAll()}
          disabled={loading}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Hub
        </Button>
      </div>

      {/* Hostinger Configuration Warning / Status Banner */}
      {!providerConfig.isConfigured ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-400 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" /> HOSTINGER EMAIL NOT CONFIGURED
          </div>
          <p>
            Enter your Hostinger mailbox address and SMTP password below to enable reliable production email delivery for Invoices, Quotations, Job Cards, and Tenant Notifications.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>
              <strong>Hostinger SMTP Active:</strong> Authenticated as{" "}
              <code className="bg-emerald-950/40 px-1 py-0.5 rounded font-mono text-emerald-300">
                {providerConfig.username || providerConfig.fromEmail}
              </code>{" "}
              via <span className="font-mono">smtp.hostinger.com:465 (SSL/TLS)</span>
            </span>
          </div>
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-[10px]">
            DEFAULT PLATFORM SENDER
          </Badge>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1 border border-border rounded-lg flex flex-wrap h-auto gap-1">
          <TabsTrigger value="provider" className="text-xs data-[state=active]:bg-card gap-1.5">
            <Server className="h-3.5 w-3.5" /> Hostinger Email Provider
          </TabsTrigger>
          <TabsTrigger value="sender" className="text-xs data-[state=active]:bg-card gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Platform Sender & Branding
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs data-[state=active]:bg-card gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Email Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="outbox" className="text-xs data-[state=active]:bg-card gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Email Outbox & Logs
          </TabsTrigger>
        </TabsList>

        {/* 1. HOSTINGER EMAIL PROVIDER CONFIGURATION */}
        <TabsContent value="provider" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-border bg-card shadow-xs">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-base text-gold flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Hostinger SMTP Server Configuration
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Credentials are encrypted using AES-256-CBC and stored strictly on the server.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-gold/30 text-gold font-mono text-[10px]">
                    PORT 465 / 587
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">SMTP Host</Label>
                    <Input
                      value={providerConfig.host}
                      onChange={(e) => setProviderConfig({ ...providerConfig, host: e.target.value })}
                      placeholder="smtp.hostinger.com"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">SMTP Port</Label>
                    <Input
                      type="number"
                      value={providerConfig.port}
                      onChange={(e) => setProviderConfig({ ...providerConfig, port: Number(e.target.value) })}
                      placeholder="465"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Encryption</Label>
                    <select
                      value={providerConfig.encryption}
                      onChange={(e) => setProviderConfig({ ...providerConfig, encryption: e.target.value as any })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                    >
                      <option value="SSL/TLS">SSL/TLS (Port 465 - Recommended)</option>
                      <option value="STARTTLS">STARTTLS (Port 587)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center justify-between">
                      <span>SMTP Username (Mailbox)</span>
                      <span className="text-gold font-mono text-[10px]">REQUIRED</span>
                    </Label>
                    <Input
                      value={providerConfig.username}
                      onChange={(e) => setProviderConfig({ ...providerConfig, username: e.target.value })}
                      placeholder="billing@arivahly.in"
                      className="h-9 text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Your full Hostinger email address.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center justify-between">
                      <span>SMTP Password</span>
                      {providerConfig.hasPassword && (
                        <span className="text-emerald-400 font-mono text-[10px]">SAVED IN VAULT</span>
                      )}
                    </Label>
                    <Input
                      type="password"
                      value={providerConfig.password || ""}
                      onChange={(e) => setProviderConfig({ ...providerConfig, password: e.target.value })}
                      placeholder={providerConfig.hasPassword ? "•••••••••••• (Leave blank to keep saved)" : "Enter Hostinger mailbox password"}
                      className="h-9 text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Password is never returned to the browser.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Platform Sender Name</Label>
                    <Input
                      value={providerConfig.fromName}
                      onChange={(e) => setProviderConfig({ ...providerConfig, fromName: e.target.value })}
                      placeholder="AVS Gold ERP Platform"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">From Email Address</Label>
                    <Input
                      value={providerConfig.fromEmail}
                      onChange={(e) => setProviderConfig({ ...providerConfig, fromEmail: e.target.value })}
                      placeholder="notifications@arivahly.in"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Reply-To Address</Label>
                    <Input
                      value={providerConfig.replyTo}
                      onChange={(e) => setProviderConfig({ ...providerConfig, replyTo: e.target.value })}
                      placeholder="support@arivahly.in"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleTestConnection()}
                    disabled={testingConnection}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Activity className={`h-3.5 w-3.5 ${testingConnection ? "animate-spin text-gold" : ""}`} />
                    Test Connection
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleSaveProvider()}
                  disabled={savingProvider}
                  className="h-8 text-xs bg-gold hover:bg-gold/90 text-primary-foreground font-medium gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingProvider ? "Encrypting & Saving..." : "Save Credentials"}
                </Button>
              </CardFooter>
            </Card>

            {/* Provider Status & Domain Check Panel */}
            <div className="space-y-6">
              <Card className="border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-gold flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Domain & MX Status
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    {providerConfig.domain || "arivahly.in"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-mono font-bold text-foreground">Hostinger Email</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">SMTP Endpoint</span>
                    <span className="font-mono text-gold">{providerConfig.host}:{providerConfig.port}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">Vault Status</span>
                    <span className="font-mono">
                      {providerConfig.hasPassword ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Encrypted
                        </span>
                      ) : (
                        <span className="text-amber-400">Not Saved</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">Last Verified</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {providerConfig.lastTestedAt ? new Date(providerConfig.lastTestedAt).toLocaleTimeString() : "Never"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Live Test Email Tool */}
              <Card className="border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-gold flex items-center gap-2">
                    <Send className="h-4 w-4" /> Real Test Email
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dispatches a real email through Hostinger SMTP with AVS branding.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Recipient Address</Label>
                    <Input
                      type="email"
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      placeholder="your.email@example.com"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleSendTestEmail()}
                    disabled={sendingTestEmail || !providerConfig.isConfigured}
                    className="w-full h-8 text-xs bg-primary text-primary-foreground gap-1.5"
                  >
                    <Send className={`h-3.5 w-3.5 ${sendingTestEmail ? "animate-spin" : ""}`} />
                    {sendingTestEmail ? "Sending through Hostinger..." : "Send Test Email"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Real-time Diagnostics Output Box */}
          {connectionTestResult && (
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-sm flex items-center gap-2 text-gold">
                  <Terminal className="h-4 w-4" /> Live SMTP Diagnostics Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded bg-muted/60 border border-border font-mono text-xs space-y-1">
                  <div>Status: <span className={connectionTestResult.success ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{connectionTestResult.status}</span></div>
                  {connectionTestResult.error && (
                    <div className="text-red-400">Error: {connectionTestResult.error}</div>
                  )}
                  {connectionTestResult.ipAddress && (
                    <div>DNS IP: {connectionTestResult.ipAddress}</div>
                  )}
                  {connectionTestResult.diagnostics && connectionTestResult.diagnostics.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground space-y-0.5">
                      {connectionTestResult.diagnostics.map((d: string, idx: number) => (
                        <div key={idx}>{d}</div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {testEmailResult && (
            <div className={`p-4 rounded-lg border text-xs ${testEmailResult.success ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
              <div className="font-semibold flex items-center gap-2">
                {testEmailResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testEmailResult.success ? "Test Email Delivered Successfully" : "Test Email Failed"}
              </div>
              {testEmailResult.messageId && (
                <div className="font-mono text-[11px] mt-1">Message-ID: {testEmailResult.messageId}</div>
              )}
              {testEmailResult.error && (
                <div className="mt-1">{testEmailResult.error}</div>
              )}
            </div>
          )}
        </TabsContent>

        {/* 2. PLATFORM SENDER & BRANDING */}
        <TabsContent value="sender" className="space-y-6">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader>
              <CardTitle className="font-serif text-base text-gold">Mandatory AVS Gold ERP Footer & Identity</CardTitle>
              <CardDescription className="text-xs">
                Injected server-side into every outbound email (Invoices, Quotations, Job Cards, Alerts).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <div dangerouslySetInnerHTML={{ __html: generateAvsBrandedFooter(senderConfig || undefined) }} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. EMAIL TEMPLATES */}
        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base text-gold">Template Catalog</CardTitle>
                <CardDescription className="text-xs font-mono">{templates.length} Active Templates</CardDescription>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`w-full text-left p-2.5 rounded text-xs transition-colors ${
                      selectedTemplate?.id === tmpl.id
                        ? "bg-gold/15 text-gold font-medium border border-gold/30"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="font-medium text-foreground">{tmpl.templateName}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{tmpl.templateCode} · {tmpl.category}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-border bg-card shadow-xs">
              {selectedTemplate ? (
                <>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-serif text-base text-gold">{selectedTemplate.templateName}</CardTitle>
                        <CardDescription className="text-xs font-mono">Code: {selectedTemplate.templateCode}</CardDescription>
                      </div>
                      <Badge variant="outline" className="border-gold/30 text-gold text-[10px] uppercase">
                        {selectedTemplate.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Subject Line</Label>
                      <Input
                        value={selectedTemplate.subject}
                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Available Tokens</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTemplate.availableTokens.map((tok) => (
                          <Badge key={tok} variant="secondary" className="font-mono text-[10px]">
                            {tok}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">HTML Body Template</Label>
                      <textarea
                        value={selectedTemplate.bodyHtml}
                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, bodyHtml: e.target.value })}
                        rows={8}
                        className="w-full rounded-md border border-input bg-background p-3 text-xs font-mono leading-relaxed"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end border-t border-border pt-4">
                    <Button
                      size="sm"
                      onClick={async () => {
                        await saveEmailTemplate(selectedTemplate);
                        toast.success("Email template updated successfully.");
                      }}
                      className="h-8 text-xs bg-gold hover:bg-gold/90 text-primary-foreground gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" /> Save Template
                    </Button>
                  </CardFooter>
                </>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">Select a template to view and edit.</div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* 4. EMAIL OUTBOX & LOGS */}
        <TabsContent value="outbox" className="space-y-6">
          <Card className="border-border bg-card shadow-xs overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base text-gold">Email Delivery Outbox</CardTitle>
              <CardDescription className="text-xs">Recent transactional and test email dispatches.</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-mono uppercase text-[10px] border-y border-border">
                  <tr>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Details</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveryLogs.length > 0 ? (
                    deliveryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.reason}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            variant="outline"
                            className={
                              log.action === "EMAIL_DISPATCHED"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                                : "bg-red-500/10 text-red-400 border-red-500/30 text-[10px]"
                            }
                          >
                            {log.action === "EMAIL_DISPATCHED" ? "SENT" : "FAILED"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        No email outbox events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
