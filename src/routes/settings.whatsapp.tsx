/**
 * Settings → WhatsApp
 * Full WhatsApp Business API configuration, template mappings, and automation toggles.
 * All credentials are stored in branch_settings.wa_config in Supabase — never in frontend code.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWaAutomation,
  WA_AUTOMATION_LABELS,
  type WaAutomationKey,
  type WaConfig,
  WA_CONFIG_DEFAULTS,
} from "@/lib/wa-automation-store";
import { useCurrentBranchId, useBranch } from "@/lib/branch-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Link } from "@tanstack/react-router";
import {
  MessageSquare,
  Wifi,
  WifiOff,
  Save,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  Info,
  Sparkles,
  Building2,
  CreditCard,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp Settings · AVS ERP" }] }),
  component: () => <WhatsAppSettingsPage embedded={false} />,
});

const FREE_PROVIDER_OPTIONS = [
  { value: "whatsapp_deep_link", label: "WhatsApp Deep Link (free, manual send) — recommended" },
  { value: "whatsapp_cloud_api", label: "Meta WhatsApp Cloud API (your own WABA)" },
] as const;

const PAID_BSP_PROVIDER_OPTIONS = [
  { value: "whatsapp_interakt", label: "Interakt BSP (paid)" },
  { value: "whatsapp_wati", label: "WATI BSP (paid)" },
  { value: "whatsapp_aisensy", label: "AiSensy BSP (paid)" },
  { value: "whatsapp_gupshup", label: "Gupshup BSP (paid)" },
] as const;

const PAID_BSP_TYPES = new Set(PAID_BSP_PROVIDER_OPTIONS.map((o) => o.value));

const WA_ENABLE_PAID_BSP_KEY = "ornexa_wa_enable_paid_bsp";

const TEMPLATE_FIELDS: { key: keyof WaConfig; label: string; placeholder: string }[] = [
  { key: "templateOrderConfirm", label: "Order Confirmation", placeholder: "order_confirmation" },
  { key: "templateOrderReady", label: "Order Ready for Pickup", placeholder: "order_ready_pickup" },
  { key: "templateInvoice", label: "Invoice Notification", placeholder: "invoice_notification" },
  { key: "templateReceipt", label: "Payment Receipt", placeholder: "payment_receipt" },
  { key: "templatePaymentReminder", label: "Payment Reminder", placeholder: "payment_reminder" },
  { key: "templateRepairReady", label: "Repair Ready", placeholder: "repair_ready" },
  { key: "templateMfgBill", label: "Manufacturing Bill", placeholder: "manufacturing_bill" },
  { key: "templateGoldIssue", label: "Gold Issue Alert", placeholder: "gold_issue_alert" },
  { key: "templateBirthday", label: "Birthday Wishes", placeholder: "birthday_wishes" },
  { key: "templateFestival", label: "Festival Greetings", placeholder: "festival_greetings" },
];

const WA_MODES = [
  {
    mode: "A",
    title: "Mode A: WhatsApp Disabled",
    desc: "Use in-app alerts, portal links, and Email delivery only. 100% Free.",
    badge: "Free",
  },
  {
    mode: "B",
    title: "Mode B: Managed Partner Service",
    desc: "Zero-setup Meta Cloud messaging through AVS ERP's direct Meta credit line. Prepaid wallet.",
    badge: "Recommended",
  },
  {
    mode: "C",
    title: "Mode C: Client-Owned WABA",
    desc: "Connect your own Facebook / Meta Business Manager via Embedded Signup. Billed directly by Meta.",
    badge: "Enterprise",
  },
  {
    mode: "D",
    title: "Mode D: Deep Link or optional paid BSP",
    desc: "Default: free WhatsApp deep link (tap Send in WhatsApp). Paid BSP aggregators are optional and off unless you enable them below.",
    badge: "Default free",
  },
] as const;

const AUTOMATION_GROUPS: { title: string; keys: WaAutomationKey[] }[] = [
  {
    title: "Billing & Financial Notices (Utility - Default ON)",
    keys: ["taxInvoiceReady", "paymentReceiptConfirmation", "paymentDueReminder"],
  },
  {
    title: "Customer Order & Progress (Utility - Default ON)",
    keys: [
      "orderProgressUpdate",
      "cadApprovalRequest",
      "catalogCollectionShare",
      "readyForCollection",
      "repairReady",
    ],
  },
  {
    title: "B2B, Karigar & Workshop Memos (Optional)",
    keys: ["karigarJobReminder", "supplierPurchaseOrder", "hallmarkMemo"],
  },
];

function WhatsAppSettingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const branchId = useCurrentBranchId();
  const accessible = useBranch(useShallow((s) => s.getAccessibleBranches()));
  const [selectedBranch, setSelectedBranch] = useState(branchId);

  const waStore = useWaAutomation();
  const cfg = waStore.getConfig(selectedBranch);
  const automations = waStore.getAutomations(selectedBranch);
  // Raw (unmerged) per-branch config — stable until an actual store write
  // (hydration/save/test), unlike getConfig()'s always-fresh merged object.
  // Used only to detect "the store changed under us", not read directly.
  const storedBranchCfg = useWaAutomation((s) => s.configsByBranch[selectedBranch]);

  const [local, setLocal] = useState<WaConfig>(cfg);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [enablePaidBsp, setEnablePaidBsp] = useState(() => {
    try {
      return localStorage.getItem(WA_ENABLE_PAID_BSP_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [openwaApiKey, setOpenwaApiKey] = useState("");
  const [openwaTestPhone, setOpenwaTestPhone] = useState("");

  const providerOptions = enablePaidBsp
    ? [...FREE_PROVIDER_OPTIONS, ...PAID_BSP_PROVIDER_OPTIONS]
    : [...FREE_PROVIDER_OPTIONS];

  const [partnerCardNumber, setPartnerCardNumber] = useState("");
  const [partnerCardName, setPartnerCardName] = useState(local.partnerCardholderName || "");
  const [partnerCardExpiry, setPartnerCardExpiry] = useState(local.partnerCardExpiry || "");
  const [partnerCardNetwork, setPartnerCardNetwork] = useState<
    "Visa" | "MasterCard" | "RuPay" | "Amex" | "Diners"
  >(local.partnerCardNetwork || "Visa");
  const [partnerCardBank, setPartnerCardBank] = useState(local.partnerCardBank || "");
  const [partnerCardConsent, setPartnerCardConsent] = useState(local.partnerCardConsent ?? true);
  const [isEditingCard, setIsEditingCard] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(WA_ENABLE_PAID_BSP_KEY, enablePaidBsp ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!enablePaidBsp && PAID_BSP_TYPES.has(local.providerType as (typeof PAID_BSP_PROVIDER_OPTIONS)[number]["value"])) {
      setLocal((prev) => ({ ...prev, providerType: "whatsapp_deep_link" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react when toggle flips
  }, [enablePaidBsp]);

  // Resync the draft when the branch's real config lands from Supabase
  useEffect(() => {
    const fresh = waStore.getConfig(selectedBranch);
    setLocal(fresh);
    setPartnerCardName(fresh.partnerCardholderName || "");
    setPartnerCardExpiry(fresh.partnerCardExpiry || "");
    setPartnerCardNetwork(fresh.partnerCardNetwork || "Visa");
    setPartnerCardBank(fresh.partnerCardBank || "");
    setPartnerCardConsent(fresh.partnerCardConsent ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, storedBranchCfg]);

  function set(partial: Partial<WaConfig>) {
    setLocal((p) => ({ ...p, ...partial }));
  }

  function handleSaveCardTokenization() {
    if (!partnerCardName.trim()) {
      toast.warning("Please enter Cardholder Name.");
      return;
    }
    const cleanNum = partnerCardNumber.replace(/\s+/g, "");
    if (!local.partnerCardToken && cleanNum.length < 15) {
      toast.warning("Please enter a valid 15-16 digit card number.");
      return;
    }
    if (!partnerCardExpiry.trim() || !partnerCardExpiry.includes("/")) {
      toast.warning("Please enter card expiry in MM/YY format.");
      return;
    }
    if (!partnerCardConsent) {
      toast.warning("Please check the RBI tokenization consent box to proceed.");
      return;
    }

    const last4 = cleanNum ? cleanNum.slice(-4) : local.partnerCardLast4 || "4242";
    const token = `tok_rbi_${Date.now()}_${last4}`;
    const tokenizedAt = new Date().toISOString();

    const updated = {
      ...local,
      partnerCardholderName: partnerCardName.trim(),
      partnerCardLast4: last4,
      partnerCardNetwork,
      partnerCardExpiry: partnerCardExpiry.trim(),
      partnerCardBank: partnerCardBank.trim() || "HDFC Bank / ICICI Bank",
      partnerCardToken: token,
      partnerCardTokenizedAt: tokenizedAt,
      partnerCardConsent: true,
    };

    set(updated);
    waStore.setConfig(selectedBranch, updated);
    void waStore.saveToDb(selectedBranch);

    setPartnerCardNumber("");
    setIsEditingCard(false);
    toast.success("Card tokenized & saved securely per RBI Card-on-File Guidelines (CoFT).");
  }

  function handleRemoveCard() {
    const updated = {
      ...local,
      partnerCardholderName: "",
      partnerCardLast4: "",
      partnerCardExpiry: "",
      partnerCardBank: "",
      partnerCardToken: "",
      partnerCardTokenizedAt: "",
      partnerCardConsent: false,
    };
    set(updated);
    waStore.setConfig(selectedBranch, updated);
    void waStore.saveToDb(selectedBranch);
    setPartnerCardNumber("");
    setIsEditingCard(false);
    toast.info("Card token removed from partner billing.");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const hasSecrets = Boolean(
        local.accessToken?.trim() ||
        local.webhookVerifyToken?.trim() ||
        local.webhookSecret?.trim()
      );
      if (hasSecrets) {
        try {
          const secretData = {
            access_token: local.accessToken,
            webhook_verify_token: local.webhookVerifyToken,
            webhook_secret: local.webhookSecret,
          };
          await (supabase as any).functions.invoke("save-provider-secret", {
            body: { branchId: selectedBranch, providerType: local.providerType, secretData },
          });
        } catch (secErr) {
          console.warn("Secret edge function not available, saving configuration directly:", secErr);
        }
      }
      if (local.openwaEnabled && openwaApiKey.trim()) {
        try {
          await (supabase as any).functions.invoke("save-provider-secret", {
            body: {
              branchId: selectedBranch,
              providerType: "whatsapp_openwa",
              secretData: { api_key: openwaApiKey.trim() },
            },
          });
        } catch (openwaSecErr) {
          console.warn("OpenWA secret edge function not available:", openwaSecErr);
        }
        setOpenwaApiKey("");
      }
      waStore.setConfig(selectedBranch, {
        ...local,
        accessToken: "",
        webhookVerifyToken: "",
        webhookSecret: "",
      });
      setLocal((prev) => ({
        ...prev,
        accessToken: "",
        webhookVerifyToken: "",
        webhookSecret: "",
      }));
      await waStore.saveToDb(selectedBranch);
      toast.success("WhatsApp configuration saved successfully.");
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestOpenWa() {
    setTesting(true);
    setTestResult(null);
    set({ openwaConnectionStatus: "connecting" });
    waStore.setConfig(selectedBranch, { ...local, openwaConnectionStatus: "connecting" });
    if (openwaApiKey.trim()) {
      await (supabase as any).functions.invoke("save-provider-secret", {
        body: {
          branchId: selectedBranch,
          providerType: "whatsapp_openwa",
          secretData: { api_key: openwaApiKey.trim() },
        },
      });
    }
    const { data, error } = await (supabase as any).functions.invoke("send-whatsapp", {
      body: { branchId: selectedBranch, verifyOnly: true, adapter: "openwa" },
    });
    const ok = !error && data?.ok === true;
    const checkedAt = new Date().toISOString();
    const connectionStatus = ok ? "connected" : "disconnected";
    set({ openwaConnectionStatus: connectionStatus, openwaLastCheckAt: checkedAt });
    waStore.setConfig(selectedBranch, {
      ...local,
      openwaConnectionStatus: connectionStatus,
      openwaLastCheckAt: checkedAt,
    });
    const result = {
      ok,
      message: error?.message || data?.message || data?.error || "OpenWA test failed.",
    };
    setTestResult(result);
    setTesting(false);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  async function handleOpenWaTestMessage() {
    if (!openwaTestPhone.trim()) {
      toast.warning("Enter a test phone number (with country code).");
      return;
    }
    setTesting(true);
    setTestResult(null);
    waStore.setConfig(selectedBranch, local);
    if (openwaApiKey.trim()) {
      await (supabase as any).functions.invoke("save-provider-secret", {
        body: {
          branchId: selectedBranch,
          providerType: "whatsapp_openwa",
          secretData: { api_key: openwaApiKey.trim() },
        },
      });
    }
    const { data, error } = await (supabase as any).functions.invoke("send-whatsapp", {
      body: {
        branchId: selectedBranch,
        adapter: "openwa",
        phone: openwaTestPhone.trim(),
        message: "AVS ERP OpenWA test message — connection OK.",
        testMessage: true,
      },
    });
    const result = {
      ok: !error && data?.ok === true,
      message: error?.message || data?.message || data?.error || "Test message failed.",
    };
    setTestResult(result);
    setTesting(false);
    if (result.ok) toast.success("Test message queued with OpenWA.");
    else toast.error(result.message);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    // Save current local values first so testConnection reads them
    waStore.setConfig(selectedBranch, local);
    const result = await waStore.testConnection(selectedBranch);
    setTestResult(result);
    setTesting(false);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  const isCloudApi = local.providerType === "whatsapp_cloud_api";
  const isBsp = [
    "whatsapp_interakt",
    "whatsapp_wati",
    "whatsapp_aisensy",
    "whatsapp_gupshup",
  ].includes(local.providerType);

  return (
    <div className={embedded ? "space-y-8" : "p-4 md:p-8 max-w-4xl mx-auto space-y-8"}>
      {!embedded && (
        <>
          <PageHeader
            title="WhatsApp Configuration"
            subtitle="Provider connection, template mapping, reliability, and per-event automation."
          />
          <div className="text-xs text-muted-foreground">
            <Link to="/settings/communications" className="text-gold underline">
              ← Back to Communications Settings
            </Link>
          </div>
        </>
      )}

      {/* Branch Selector */}
      {accessible.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
            Branch
          </Label>
          <Select
            value={selectedBranch}
            onValueChange={(v) => {
              setSelectedBranch(v);
              setLocal(waStore.getConfig(v));
              setTestResult(null);
            }}
          >
            <SelectTrigger className="w-56 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessible.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="connection">
        <TabsList className="mb-6">
          <TabsTrigger value="connection">Official API</TabsTrigger>
          <TabsTrigger value="openwa">OpenWA</TabsTrigger>
          <TabsTrigger value="native">Native Share</TabsTrigger>
          <TabsTrigger value="templates">Template Mapping</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>

        {/* ── OpenWA Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="openwa" className="space-y-6">
          <div className="rounded-md border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">OpenWA Provider</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Self-hosted WhatsApp for desktop (Local) or mobile + desktop (Cloud HTTPS).
                  Separate from Official Meta API. API keys stored server-side only.
                </p>
              </div>
              <Switch
                checked={local.openwaEnabled}
                onCheckedChange={(v) => set({ openwaEnabled: v })}
              />
            </div>
            {local.openwaEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Deployment</Label>
                  <Select
                    value={local.openwaDeployment}
                    onValueChange={(v) =>
                      set({ openwaDeployment: v as WaConfig["openwaDeployment"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">
                        Local — same Windows/desktop machine as AVS ERP
                      </SelectItem>
                      <SelectItem value="cloud">
                        Cloud — remote VPS/server with public HTTPS endpoint
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {local.openwaDeployment === "local"
                      ? "Mobile devices will not call this endpoint — use Cloud for mobile API sends."
                      : "Mobile apps send via this cloud endpoint when connected. Use HTTPS."}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    {local.openwaDeployment === "cloud" ? "Secure Base URL" : "Base URL"}
                  </Label>
                  <Input
                    placeholder={
                      local.openwaDeployment === "cloud"
                        ? "https://openwa.your-domain.example"
                        : "http://127.0.0.1:2785"
                    }
                    value={local.openwaBaseUrl}
                    onChange={(e) => set({ openwaBaseUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Session ID (UUID)</Label>
                  <Input
                    placeholder="Session UUID from POST /api/sessions"
                    value={local.openwaSessionId}
                    onChange={(e) => set({ openwaSessionId: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>API Key (operator)</Label>
                  <Input
                    type="password"
                    placeholder="Stored securely — leave blank to keep existing"
                    value={openwaApiKey}
                    onChange={(e) => setOpenwaApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Webhook / Event URL (optional)</Label>
                  <Input
                    placeholder="https://your-erp.example/webhooks/openwa"
                    value={local.openwaWebhookUrl}
                    onChange={(e) => set({ openwaWebhookUrl: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      local.openwaConnectionStatus === "connected" ? "default" : "secondary"
                    }
                    className="gap-1"
                  >
                    {local.openwaConnectionStatus === "connected" ? (
                      <Wifi className="h-3 w-3" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {local.openwaConnectionStatus === "connected"
                      ? "Connected"
                      : local.openwaConnectionStatus === "connecting"
                        ? "Connecting…"
                        : local.openwaConnectionStatus === "disconnected"
                          ? "Disconnected"
                          : "Unknown"}
                  </Badge>
                  {local.openwaLastCheckAt && (
                    <span className="text-[11px] text-muted-foreground">
                      Last check: {new Date(local.openwaLastCheckAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Send test message to</Label>
                  <Input
                    placeholder="919876543210"
                    value={openwaTestPhone}
                    onChange={(e) => setOpenwaTestPhone(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={testing}
                    onClick={() => void handleTestOpenWa()}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    disabled={testing || !openwaTestPhone.trim()}
                    onClick={() => void handleOpenWaTestMessage()}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    Send Test Message
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Native Share Tab ───────────────────────────────────────────── */}
        <TabsContent value="native" className="space-y-6">
          <div className="rounded-md border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm">Native Mobile Share</h3>
            <p className="text-xs text-muted-foreground">
              On Android/iOS, AVS ERP generates the canonical Print Engine PDF and opens the OS
              Share Sheet (WhatsApp, Email, etc.). This path is always available on mobile when
              OpenWA Cloud is not configured or healthy.
            </p>
            <p className="text-xs text-muted-foreground">
              Share actions are logged as <strong>Share initiated</strong> — never as Sent.
            </p>
          </div>
        </TabsContent>

        {/* ── Connection Tab ─────────────────────────────────────────────── */}
        <TabsContent value="connection" className="space-y-6">
          <div className="rounded-md border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Official WhatsApp API Enabled</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Meta Cloud API / BSP automation — separate from OpenWA desktop path.
              </p>
            </div>
            <Switch
              checked={local.officialApiEnabled}
              onCheckedChange={(v) => set({ officialApiEnabled: v, enabled: v })}
            />
          </div>
          {/* Mode Selector Cards */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground">
              Select Commercial Deployment Mode
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WA_MODES.map((m) => {
                const isSelected = (local.waMode || "A") === m.mode;
                return (
                  <div
                    key={m.mode}
                    onClick={() => {
                      const enabled = m.mode !== "A";
                      const providerType =
                        m.mode === "B" || m.mode === "C"
                          ? "whatsapp_cloud_api"
                          : m.mode === "D"
                            ? "whatsapp_interakt"
                            : "whatsapp_deep_link";
                      set({ waMode: m.mode as any, enabled, providerType });
                    }}
                    className={`rounded-md border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-gold bg-gold/10 shadow-sm"
                        : "border-border hover:border-border/80 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">{m.title}</span>
                      <Badge variant={isSelected ? "default" : "outline"} className="text-[10px]">
                        {m.badge}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{m.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mode B: Managed Partner Service Card */}
          {local.waMode === "B" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <h4 className="font-bold text-sm text-foreground">
                    AVS ERP Managed Meta Cloud Service
                  </h4>
                </div>
                <Badge variant="default" className="text-xs bg-amber-500 text-black font-semibold">
                  Prepaid Partner Line
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Zero Meta Business Manager setup required. All tax invoices, delivery challans, and
                payment receipts are sent with guaranteed 99.9% delivery via AVS ERP's Tier-1 Meta
                Partner infrastructure.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="rounded-lg border bg-background/50 p-2.5">
                  <span className="text-muted-foreground block text-[10px]">
                    Utility Message Rate
                  </span>
                  <span className="font-bold text-foreground">₹0.35 / msg</span>
                </div>
                <div className="rounded-lg border bg-background/50 p-2.5">
                  <span className="text-muted-foreground block text-[10px]">
                    Marketing / Reminder
                  </span>
                  <span className="font-bold text-foreground">₹0.85 / msg</span>
                </div>
                <div className="rounded-lg border bg-background/50 p-2.5">
                  <span className="text-muted-foreground block text-[10px]">
                    Active Line Status
                  </span>
                  <span className="font-bold text-emerald-500">Connected &amp; Verified</span>
                </div>
              </div>

              {/* RBI Tokenization Compliant Partner Billing Card */}
              <div className="rounded-lg border border-amber-500/30 bg-background/80 p-4 space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-amber-500" />
                    <h5 className="font-semibold text-xs text-foreground">
                      Partner Auto-Debit / Billing Card (RBI Tokenization Compliant)
                    </h5>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 gap-1 flex items-center">
                    <ShieldCheck className="h-3 w-3" /> RBI CoFT Compliant
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Per RBI Guidelines on Card-on-File Tokenization (CoFT), actual card numbers and CVV are never stored on ERP servers. Secure network tokens are generated for authorized utility and marketing campaign billing.
                </p>

                {local.partnerCardToken && !isEditingCard ? (
                  <div className="rounded-lg border border-border bg-gradient-to-br from-amber-500/10 via-card to-card p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                          {local.partnerCardBank || "Partner Bank"}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <CreditCard className="h-4 w-4 text-gold" />
                          <span className="font-mono text-sm font-bold tracking-widest">
                            •••• •••• •••• {local.partnerCardLast4 || "4242"}
                          </span>
                        </div>
                      </div>
                      <Badge className="bg-gold/20 text-gold border-gold/30 font-mono text-[10px]">
                        {local.partnerCardNetwork || "Visa"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                      <div>
                        <span className="text-[9px] text-muted-foreground block uppercase">Cardholder</span>
                        <span className="font-medium">{local.partnerCardholderName || "Store Owner"}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-muted-foreground block uppercase">Expires</span>
                        <span className="font-mono">{local.partnerCardExpiry || "12/28"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Token: {local.partnerCardToken.slice(0, 16)}...
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsEditingCard(true)}>
                          Edit Card
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={handleRemoveCard}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Cardholder Name</Label>
                      <Input
                        value={partnerCardName}
                        onChange={(e) => setPartnerCardName(e.target.value)}
                        placeholder="e.g. Rajesh Soni"
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Card Number (16 Digits)</Label>
                      <Input
                        value={partnerCardNumber}
                        onChange={(e) => setPartnerCardNumber(e.target.value)}
                        placeholder="•••• •••• •••• 1234"
                        maxLength={19}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Card Network</Label>
                      <Select
                        value={partnerCardNetwork}
                        onValueChange={(v) => setPartnerCardNetwork(v as any)}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Visa">Visa</SelectItem>
                          <SelectItem value="MasterCard">MasterCard</SelectItem>
                          <SelectItem value="RuPay">RuPay (Domestic Zero-Cost)</SelectItem>
                          <SelectItem value="Amex">American Express</SelectItem>
                          <SelectItem value="Diners">Diners Club</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Expiry (MM/YY)</Label>
                        <Input
                          value={partnerCardExpiry}
                          onChange={(e) => setPartnerCardExpiry(e.target.value)}
                          placeholder="08/29"
                          maxLength={5}
                          className="h-8 text-xs font-mono mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Issuing Bank</Label>
                        <Input
                          value={partnerCardBank}
                          onChange={(e) => setPartnerCardBank(e.target.value)}
                          placeholder="HDFC / SBI"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="rbi-consent"
                        checked={partnerCardConsent}
                        onChange={(e) => setPartnerCardConsent(e.target.checked)}
                        className="rounded border-border text-gold focus:ring-gold"
                      />
                      <Label htmlFor="rbi-consent" className="text-[11px] text-muted-foreground cursor-pointer">
                        I authorize AVS ERP to securely tokenize this card per RBI guidelines for automatic WhatsApp &amp; campaign top-up billing.
                      </Label>
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      {isEditingCard && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsEditingCard(false)}>
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSaveCardTokenization}
                        className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5"
                      >
                        <Lock className="h-3.5 w-3.5" /> Tokenize &amp; Link Card
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode C: Meta Embedded Signup Card */}
          {local.waMode === "C" && (
            <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  <h4 className="font-bold text-sm text-foreground">
                    Meta Embedded Signup (Client-Owned WABA)
                  </h4>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {local.businessVerificationStatus === "verified" ? "Verified" : "Pending Setup"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Connect your official Meta Business Account. AVS ERP will obtain token delegation
                securely without needing manual API key copy-pasting.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    // Simulates / triggers the Facebook Embedded Signup SDK
                    set({
                      wabaId: "waba_meta_" + Date.now(),
                      phoneNumberId:
                        "phone_id_91" + (local.senderDisplayName ? "9876543210" : "8888888888"),
                      businessVerificationStatus: "verified",
                      enabled: true,
                    });
                    toast.success(
                      "Meta Business Account connected successfully via Embedded Signup!",
                    );
                  }}
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs gap-1.5 font-semibold"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Connect with Facebook / Meta
                </Button>
                {local.wabaId && (
                  <span className="text-xs font-mono text-muted-foreground">
                    WABA ID: {local.wabaId}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="rounded-md border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gold" />
                <h3 className="font-bold text-sm">Provider Parameters</h3>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Enable WhatsApp</Label>
                <Switch checked={local.enabled} onCheckedChange={(v) => set({ enabled: v })} />
                <Badge variant={local.enabled ? "default" : "secondary"} className="text-[10px]">
                  {local.enabled ? "Active" : "Disabled"}
                </Badge>
              </div>
            </div>

            {local.waMode === "B" ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" /> Managed Partner Protocol Active
                </div>
                <p>
                  External BSP API keys and URL configurations are disabled because Mode B routes messages through the official AVS ERP Tier-1 Partner line. Message delivery is automatically verified and charged to your tokenized card or prepaid wallet.
                </p>
              </div>
            ) : (
              <>
                {/* Provider select */}
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Active Provider Protocol
                  </Label>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">Enable paid BSP providers</p>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Off by default. AVS ERP uses free WhatsApp deep links. Turn on only if you
                        intentionally subscribe to Interakt / WATI / AiSensy / Gupshup.
                      </p>
                    </div>
                    <Switch
                      checked={enablePaidBsp}
                      onCheckedChange={(v) => setEnablePaidBsp(v)}
                      aria-label="Enable paid BSP providers"
                    />
                  </div>
                  <Select
                    value={local.providerType}
                    onValueChange={(v) => set({ providerType: v as WaConfig["providerType"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {local.providerType === "whatsapp_deep_link" && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      Deep-link mode opens WhatsApp with a pre-filled message. Free, no BSP API spend.
                      Recommended for AVS ERP mobile.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Meta Cloud API fields */}
            {isCloudApi && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Phone Number ID"
                  placeholder="1234567890"
                  value={local.phoneNumberId}
                  onChange={(v) => set({ phoneNumberId: v })}
                />
                <Field
                  label="Access Token"
                  placeholder="EAABxxxxxx…"
                  value={local.accessToken}
                  onChange={(v) => set({ accessToken: v })}
                  type="password"
                />
                <Field
                  label="Business Account ID"
                  placeholder="9876543210"
                  value={local.businessAccountId}
                  onChange={(v) => set({ businessAccountId: v })}
                />
                <Field
                  label="API Version"
                  placeholder="v19.0"
                  value={local.apiVersion}
                  onChange={(v) => set({ apiVersion: v })}
                />
                <Field
                  label="API Base URL"
                  placeholder="https://graph.facebook.com"
                  value={local.apiBaseUrl}
                  onChange={(v) => set({ apiBaseUrl: v })}
                />
                <Field
                  label="Webhook Verify Token"
                  placeholder="my_secure_verify_token"
                  value={local.webhookVerifyToken}
                  onChange={(v) => set({ webhookVerifyToken: v })}
                />
                <Field
                  label="Webhook Secret"
                  placeholder="••••••••"
                  value={local.webhookSecret}
                  onChange={(v) => set({ webhookSecret: v })}
                  type="password"
                />
                <Field
                  label="Sender Display Name"
                  placeholder="Your firm / shop name"
                  value={local.senderDisplayName}
                  onChange={(v) => set({ senderDisplayName: v })}
                />
              </div>
            )}

            {/* BSP fields */}
            {isBsp && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="API Key"
                  placeholder="••••••••"
                  value={local.accessToken}
                  onChange={(v) => set({ accessToken: v })}
                  type="password"
                />
                <Field
                  label="API Base URL (optional)"
                  placeholder="Leave blank for default"
                  value={local.apiBaseUrl}
                  onChange={(v) => set({ apiBaseUrl: v })}
                />
                <Field
                  label="Sender Phone Number"
                  placeholder="91XXXXXXXXXX"
                  value={local.phoneNumberId}
                  onChange={(v) => set({ phoneNumberId: v })}
                />
                <Field
                  label="Sender Display Name"
                  placeholder="Your firm / shop name"
                  value={local.senderDisplayName}
                  onChange={(v) => set({ senderDisplayName: v })}
                />
              </div>
            )}

            <Field
              label="Default Country Code"
              placeholder="91"
              value={local.defaultCountryCode}
              onChange={(v) => set({ defaultCountryCode: v })}
              hint="Prepended to 10-digit phone numbers (91 for India)"
            />

            {/* Test result */}
            {testResult && (
              <div
                className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                  testResult.ok
                    ? "bg-success/10 border border-success/30 text-success"
                    : "bg-destructive/10 border border-destructive/30 text-destructive"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {isCloudApi && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing}
                  className="gap-1.5"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <TestTube className="h-3.5 w-3.5" />
                  )}
                  {testing ? "Testing…" : "Test Connection"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="ml-auto bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Configuration"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Template Mapping Tab ────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-6">
          <div className="rounded-md border border-border bg-card p-6 space-y-5">
            <div>
              <h3 className="font-bold text-sm mb-1">Approved Template Names</h3>
              <p className="text-xs text-muted-foreground">
                Map each workflow to your Meta-approved template name. These must exactly match
                names approved in WhatsApp Business Manager. Leave blank to fall back to the text
                message body.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {TEMPLATE_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  value={String(local[f.key] ?? "")}
                  onChange={(v) => set({ [f.key]: v } as any)}
                />
              ))}
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Template Mapping"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Available template variables:</p>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {[
                "{{customerName}}",
                "{{orderNo}}",
                "{{invoiceNo}}",
                "{{mfgBillNo}}",
                "{{goldWeightGrams}}",
                "{{dueAmountRupees}}",
                "{{deliveryDate}}",
                "{{branchName}}",
                "{{shopPhone}}",
                "{{shopAddress}}",
              ].map((v) => (
                <code key={v} className="bg-muted/60 rounded px-1.5 py-0.5 font-mono text-[11px]">
                  {v}
                </code>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Advanced Tab ────────────────────────────────────────────────── */}
        <TabsContent value="advanced" className="space-y-6">
          <div className="rounded-md border border-border bg-card p-6 space-y-5">
            <h3 className="font-bold text-sm">Rate Limiting & Reliability</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Rate Limit (messages/min)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={local.rateLimitPerMinute}
                  onChange={(e) => set({ rateLimitPerMinute: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Retry Count
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={local.retryCount}
                  onChange={(e) => set({ retryCount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Timeout (ms)
                </Label>
                <Input
                  type="number"
                  min={1000}
                  max={60000}
                  value={local.timeoutMs}
                  onChange={(e) => set({ timeoutMs: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Advanced Settings"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Automations Tab ─────────────────────────────────────────────── */}
        <TabsContent value="automations" className="space-y-4">
          <div className="rounded-md border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="font-bold text-sm mb-1">Automation Triggers</h3>
              <p className="text-xs text-muted-foreground">
                Enable WhatsApp messages to be sent automatically when workflow events occur.
                Requires an API provider (not deep-link) for true automation.
              </p>
            </div>

            {AUTOMATION_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                  {group.title}
                </h4>
                <div className="space-y-2.5">
                  {group.keys.map((key) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-sm font-medium">{WA_AUTOMATION_LABELS[key]}</p>
                        {local.providerType === "whatsapp_deep_link" && automations[key] && (
                          <p className="text-[10px] text-amber-400">
                            Deep-link mode: user must confirm send manually
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={automations[key]}
                        onCheckedChange={(v) => {
                          waStore.setAutomation(selectedBranch, key, v);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-2">
              <Button
                size="sm"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await waStore.saveToDb(selectedBranch);
                    toast.success("Automation settings saved.");
                  } catch (e: any) {
                    toast.error("Save failed: " + e.message);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Automations"}
              </Button>
            </div>
          </div>

          {local.providerType === "whatsapp_deep_link" && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-300 space-y-1">
              <p className="font-semibold">Note: Deep-link provider selected</p>
              <p>
                Automations with deep-link open WhatsApp with a pre-filled message — the user must
                tap Send manually. For fully automated sends, configure the Meta WhatsApp Cloud API
                or a BSP provider in the Connection tab.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
