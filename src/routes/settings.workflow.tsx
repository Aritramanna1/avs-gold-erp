/**
 * Workflow Engine Settings
 * Lets the admin configure how the manufacturing lifecycle works,
 * without changing any code. Makes the ERP adaptable to any jeweller.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWorkflowEngine,
  WORKFLOW_PRESETS,
  type BusinessMode,
  type WorkflowConfig,
} from "@/lib/workflow-engine";
import {
  Hammer,
  Settings,
  Zap,
  PackageCheck,
  IndianRupee,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-store";
import { closeFinancialYear } from "@/lib/financial-lock-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export const Route = createFileRoute("/settings/workflow")({
  head: () => ({ meta: [{ title: "Workflow Engine - AVS Gold ERP" }] }),
  component: WorkflowSettings,
});

const MODE_LABELS: Record<BusinessMode, { label: string; description: string }> = {
  retail_only: {
    label: "Retail Only",
    description: "No manufacturing - sell ready-made stock only. Manufacturing Bill disabled.",
  },
  manufacturing_only: {
    label: "Manufacturing Only",
    description: "Pure manufacturer - all items made to order. Retail billing disabled.",
  },
  combined_commerce_manufacturing: {
    label: "Combined Commerce + Manufacturing",
    description: "Both business workflows active: ready-stock sales and custom manufacturing.",
  },
};

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}
function ToggleRow({ label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-3 border-b border-border last:border-0 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function WorkflowSettings() {
  const { config, patch, applyPreset, reset } = useWorkflowEngine();
  const selectedBranchId = useSettings((s) => s.selectedBranchId || "MAIN");
  const [fyYear, setFyYear] = useState(new Date().getFullYear() - 1);
  const [closing, setClosing] = useState(false);

  async function handleCloseYear() {
    if (
      !window.confirm(
        `Are you absolutely sure you want to close Financial Year ${fyYear}-${(fyYear + 1) % 100}? This will lock all months in this FY and carry forward metal balances to April 1st, ${fyYear + 1}.`,
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const actor = {
        id: sessionData.session?.user.id ?? null,
        email: sessionData.session?.user.email ?? null,
      };
      const result = await closeFinancialYear(selectedBranchId, fyYear, actor);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error("Year closing failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to close financial year");
    } finally {
      setClosing(false);
    }
  }

  function applyAndToast(key: keyof typeof WORKFLOW_PRESETS) {
    applyPreset(key);
    toast.success(`Preset "${key}" applied`);
  }

  async function handleFinancialLockToggle(enabled: boolean) {
    const before = config.financialLockEnforcementEnabled;
    patch({ financialLockEnforcementEnabled: enabled });
    const [{ supabase }, { append }] = await Promise.all([
      import("@/lib/providers/data-provider"),
      import("@/lib/security/audit-log"),
    ]);
    const { data } = await supabase.auth.getSession();
    await append({
      actorId: data.session?.user.id ?? null,
      actorEmail: data.session?.user.email ?? null,
      action: "workflow.financial_lock_enforcement_toggled",
      entityType: "workflow_config",
      entityId: "financialLockEnforcementEnabled",
      before: { enabled: before },
      after: { enabled },
    });
    if (enabled) {
      toast.success("Financial lock enforcement re-enabled.");
    } else {
      toast.warning(
        "Financial lock enforcement disabled - locked periods will no longer block postings.",
      );
    }
  }

  const mfgEnabled = config.mfgBillEnabled;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Workflow Engine"
          subtitle="Configure how this ERP behaves for your business model. No code changes needed."
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            reset();
            toast.success("Reset to AVS manufacturing defaults");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset to AVS Default
        </Button>
      </div>

      {/* Presets */}
      <section className="rounded-md border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Quick Presets</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(Object.keys(WORKFLOW_PRESETS) as (keyof typeof WORKFLOW_PRESETS)[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyAndToast(key)}
              className={`rounded-md border p-3 text-left transition-colors hover:border-gold/40 ${
                JSON.stringify(config) === JSON.stringify(WORKFLOW_PRESETS[key])
                  ? "border-gold/50 bg-gold/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="text-xs font-bold mb-1">{key.replace(/_/g, " ").toUpperCase()}</div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                {key === "mtj_default" && "AVS manufacturing-first mode, outstanding allowed"}
                {key === "retail_only" && "No manufacturing. Sell from ready stock only."}
                {key === "manufacturing_strict" && "Full payment required before delivery."}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Business Mode */}
      <section className="rounded-md border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Business Mode</h3>
        </div>
        <Select value={config.mode} onValueChange={(v) => patch({ mode: v as BusinessMode })}>
          <SelectTrigger className="w-72 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(MODE_LABELS) as [
                BusinessMode,
                { label: string; description: string },
              ][]
            ).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{MODE_LABELS[config.mode].description}</p>

        {config.mode === "combined_commerce_manufacturing" && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-md p-3">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Combined business mode keeps manufacturing and ready-stock billing workflows active.
          </div>
        )}
      </section>

      {/* Manufacturing Bill */}
      <section className="rounded-md border border-border bg-card p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Hammer className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Manufacturing Bill</h3>
          {!mfgEnabled && (
            <Badge variant="outline" className="text-muted-foreground text-[10px]">
              Disabled
            </Badge>
          )}
        </div>
        <ToggleRow
          label="Enable Manufacturing Bill"
          description="Show the Manufacturing module and allow generating Manufacturing Bills from Job Cards."
          checked={config.mfgBillEnabled}
          onCheckedChange={(v) => patch({ mfgBillEnabled: v })}
        />
        <ToggleRow
          label="Mandatory before Delivery"
          description="Prevent customer delivery unless a finalised Manufacturing Bill exists for the order."
          checked={config.mfgBillMandatoryBeforeDelivery}
          onCheckedChange={(v) => patch({ mfgBillMandatoryBeforeDelivery: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Auto-close Job Card"
          description="Automatically set Job Card status to Closed when the Manufacturing Bill is finalised."
          checked={config.autoCloseJobCard}
          onCheckedChange={(v) => patch({ autoCloseJobCard: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Auto-update Order Status"
          description="Automatically mark the Customer Order as Ready for Delivery after finalisation."
          checked={config.autoUpdateOrderStatus}
          onCheckedChange={(v) => patch({ autoUpdateOrderStatus: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Charge for Hallmark / BIS"
          description="Show the Hallmark charge line on Manufacturing Bills. When off, it is hidden and forced to Rs. 0 in cost calculations."
          checked={config.mfgChargeHallmarkEnabled}
          onCheckedChange={(v) => patch({ mfgChargeHallmarkEnabled: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Charge for HUID Registration"
          description="Show the HUID charge line on Manufacturing Bills. When off, it is hidden and forced to Rs. 0."
          checked={config.mfgChargeHuidEnabled}
          onCheckedChange={(v) => patch({ mfgChargeHuidEnabled: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Require Approval Before Finalise"
          description="A Manufacturing Bill must be explicitly marked Approved before it can be finalised."
          checked={config.mfgApprovalRequired}
          onCheckedChange={(v) => patch({ mfgApprovalRequired: v })}
          disabled={!mfgEnabled}
        />
      </section>

      {/* Finished Stock */}
      <section className="rounded-md border border-border bg-card p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <PackageCheck className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Finished Stock</h3>
        </div>
        <ToggleRow
          label="Automatic Finished Stock Entry"
          description="Move finished jewellery into stock automatically when Manufacturing Bill is finalised. Disabling requires manual stock entry."
          checked={config.finishedStockAutomatic}
          onCheckedChange={(v) => patch({ finishedStockAutomatic: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Allow Manual Stock Entry"
          description="Allow stock items to be created manually without a Manufacturing Bill (e.g. ready-made imports, pre-existing stock)."
          checked={config.allowManualStockEntry}
          onCheckedChange={(v) => patch({ allowManualStockEntry: v })}
        />
        <ToggleRow
          label="Auto-post Gold Ledger"
          description="Automatically create Gold Ledger entries for issued, returned, scrap, and wastage gold when finalising."
          checked={config.autoPostGoldLedger}
          onCheckedChange={(v) => patch({ autoPostGoldLedger: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Auto-post Worker Gold Book"
          description="Automatically record the karigar settlement in the Worker Gold Book on finalisation."
          checked={config.autoPostWorkerGoldBook}
          onCheckedChange={(v) => patch({ autoPostWorkerGoldBook: v })}
          disabled={!mfgEnabled}
        />
      </section>

      {/* Financial Controls */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg text-gold">Financial Controls</h2>
        <ToggleRow
          label="Enforce Month-End Financial Locks"
          description="Blocks new gold ledger, worker gold book, and expense postings dated inside a locked month (see Reports > Month-End Close). Defaults ON - only turn off for a deliberate one-off data migration/backfill."
          checked={config.financialLockEnforcementEnabled}
          onCheckedChange={handleFinancialLockToggle}
        />
      </section>

      {/* Outside Work (External Jeweller) */}
      <section className="rounded-md border border-border bg-card p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Hammer className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Outside Work</h3>
        </div>
        <div className="flex items-center gap-4 py-3 border-b border-border">
          <div className="flex-1">
            <div className="text-sm font-medium">Default Labour Calculation Method</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Pre-fills a new Labour Charge method - always changeable per charge.
            </div>
          </div>
          <Select
            value={config.outsideWorkDefaultLabourMethod}
            onValueChange={(v) => patch({ outsideWorkDefaultLabourMethod: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_gram">Per Gram (fine)</SelectItem>
              <SelectItem value="per_piece">Per Piece</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
              <SelectItem value="per_gram_gross">Per Gram (gross)</SelectItem>
              <SelectItem value="custom">Custom / Negotiated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ToggleRow
          label="GST on Labour Charges by Default"
          description="Pre-checks the GST switch on a new Labour Charge. Always overridable per-charge."
          checked={config.outsideWorkGstEnabled}
          onCheckedChange={(v) => patch({ outsideWorkGstEnabled: v })}
        />
        <div
          className={`flex items-center gap-4 py-3 border-b border-border ${!config.outsideWorkGstEnabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          <div className="flex-1">
            <div className="text-sm font-medium">Default GST Rate (%)</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Pre-filled GST rate when GST is enabled on a new Labour Charge.
            </div>
          </div>
          <Input
            type="number"
            className="w-24"
            value={config.outsideWorkGstRatePct}
            onChange={(e) => patch({ outsideWorkGstRatePct: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <ToggleRow
          label="Require Approval Before Settlement"
          description="A Labour Charge must be explicitly marked Approved before its amount counts toward what a Settlement can close out."
          checked={config.outsideWorkApprovalRequired}
          onCheckedChange={(v) => patch({ outsideWorkApprovalRequired: v })}
        />
        <ToggleRow
          label="Allow Advance Payments"
          description="When off, a Payment cannot exceed the current Labour Outstanding - prevents recording advances against an outside jeweller."
          checked={config.outsideWorkAllowAdvancePayments}
          onCheckedChange={(v) => patch({ outsideWorkAllowAdvancePayments: v })}
        />
      </section>

      {/* Process & Workshop Delegation */}
      <section className="rounded-md border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Hammer className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Process & Workshop Delegation</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Configure whether specialized workshop processes (Polishing, Meena, Making) are routed to outside workers/vendors or handled by internal in-house karigars.
        </p>

        <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
          <div className="flex-1">
            <div className="text-sm font-medium">Polishing Routing</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Select who performs polishing work. Outside worker restricts selection to outside polishers/vendors.
            </div>
          </div>
          <Select
            value={config.polishingProcessType ?? "outside"}
            onValueChange={(v: "outside" | "in_house") => patch({ polishingProcessType: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outside">Outside Worker / Vendor</SelectItem>
              <SelectItem value="in_house">In-House Karigar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ToggleRow
          label="Polishing Active by Default"
          description="Automatically enable the Polishing step when creating job cards and manufacturing workflows."
          checked={config.polishingEnabledByDefault ?? true}
          onCheckedChange={(v) => patch({ polishingEnabledByDefault: v })}
        />

        <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
          <div className="flex-1">
            <div className="text-sm font-medium">Meena (Enameling) Routing</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Select who performs Meena work.
            </div>
          </div>
          <Select
            value={config.meenaProcessType ?? "outside"}
            onValueChange={(v: "outside" | "in_house") => patch({ meenaProcessType: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outside">Outside Worker / Vendor</SelectItem>
              <SelectItem value="in_house">In-House Karigar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex-1">
            <div className="text-sm font-medium">Making / Manufacturing Routing</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Primary routing for regular jewellery manufacturing.
            </div>
          </div>
          <Select
            value={config.makingProcessType ?? "in_house"}
            onValueChange={(v: "in_house" | "outside") => patch({ makingProcessType: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_house">In-House Karigar</SelectItem>
              <SelectItem value="outside">Outside Worker / Vendor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Payment & Delivery */}
      <section className="rounded-md border border-border bg-card p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <IndianRupee className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Payment & Delivery</h3>
        </div>
        <ToggleRow
          label="Delivery Requires Full Payment"
          description="Block delivery if any balance remains. Disable to allow outstanding deliveries."
          checked={config.deliveryRequiresFullPayment}
          onCheckedChange={(v) =>
            patch({
              deliveryRequiresFullPayment: v,
              outstandingDeliveryAllowed: v ? false : config.outstandingDeliveryAllowed,
            })
          }
        />
        <ToggleRow
          label="Allow Outstanding Delivery"
          description="Allow the customer to take delivery with a partial or zero payment - creates an outstanding balance."
          checked={config.outstandingDeliveryAllowed}
          onCheckedChange={(v) => patch({ outstandingDeliveryAllowed: v })}
          disabled={config.deliveryRequiresFullPayment}
        />
        <ToggleRow
          label="Auto-create Outstanding Bill"
          description="Automatically generate an Outstanding Bill when delivery happens with partial payment."
          checked={config.autoCreateOutstanding}
          onCheckedChange={(v) => patch({ autoCreateOutstanding: v })}
          disabled={!config.outstandingDeliveryAllowed}
        />
        <div
          className={`flex items-center gap-4 py-3 ${!config.autoCreateOutstanding ? "opacity-40 pointer-events-none" : ""}`}
        >
          <div className="flex-1">
            <div className="text-sm font-medium">Payment Reminder After (days)</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Trigger automatic payment reminder this many days after delivery if balance is unpaid.
            </div>
          </div>
          <Input
            type="number"
            min={1}
            max={90}
            value={config.paymentReminderDays}
            onChange={(e) => patch({ paymentReminderDays: parseInt(e.target.value) || 7 })}
            className="h-8 w-20 text-right font-mono text-sm"
          />
        </div>
      </section>

      {/* Communication */}
      <section className="rounded-md border border-border bg-card p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Automatic Communication</h3>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Uses configured providers in Communication Settings
          </Badge>
        </div>
        <ToggleRow
          label="Send Manufacturing Bill to Customer"
          description="Auto-send the Manufacturing Bill PDF/message via the configured WhatsApp or Email provider after finalisation."
          checked={config.autoSendMfgBillComm}
          onCheckedChange={(v) => patch({ autoSendMfgBillComm: v })}
          disabled={!mfgEnabled}
        />
        <ToggleRow
          label="Send Invoice / Delivery Confirmation"
          description="Auto-send the delivery invoice via the configured provider when a Delivery Invoice is created."
          checked={config.autoSendInvoiceComm}
          onCheckedChange={(v) => patch({ autoSendInvoiceComm: v })}
        />
        <ToggleRow
          label="Send Payment Receipt"
          description="Auto-send a payment receipt whenever a payment is recorded against an invoice."
          checked={config.autoSendPaymentReceipt}
          onCheckedChange={(v) => patch({ autoSendPaymentReceipt: v })}
        />
        <ToggleRow
          label="Send Due Reminders"
          description={`Auto-send a payment due reminder ${config.paymentReminderDays} days after delivery if balance is unpaid.`}
          checked={config.autoSendDueReminder}
          onCheckedChange={(v) => patch({ autoSendDueReminder: v })}
        />

        <div className="rounded-md bg-muted/20 border border-border p-3 text-xs text-muted-foreground mt-2">
          <strong>Provider fallback:</strong> If WhatsApp Business API is not configured, the system
          falls back to WhatsApp Deep Link (manual sharing). Email requires SMTP or API credentials
          in Communication Settings. Billing logic never needs to know which provider is active.
        </div>
      </section>

      {/* Financial Year Close */}
      <section className="rounded-md border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm uppercase tracking-wider">
            Financial Year Close &amp; Rollover
          </h3>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Closing a financial year is a permanent action. It automatically locks all 12 months in
            the selected year (preventing modifications to old invoices, payments, and settlements),
            posts closing metal records, and rolls over the derived gold weights as opening balances
            on April 1st of the next year.
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label
                htmlFor="fy-start-year"
                className="text-xs font-semibold text-muted-foreground"
              >
                FY Start Year
              </label>
              <Input
                id="fy-start-year"
                type="number"
                min={2000}
                max={2100}
                value={fyYear}
                onChange={(e) => setFyYear(Number(e.target.value))}
                className="w-36 h-9"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="fy-branch-id" className="text-xs font-semibold text-muted-foreground">
                Branch ID
              </label>
              <Input
                id="fy-branch-id"
                type="text"
                value={selectedBranchId}
                disabled
                className="w-36 h-9 bg-muted"
              />
            </div>
            <Button
              type="button"
              disabled={closing}
              onClick={handleCloseYear}
              className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Lock className="h-3.5 w-3.5" />
              {closing ? "Closing Year..." : "Run Year-End Close"}
            </Button>
          </div>
        </div>
      </section>

      {/* Current config summary */}
      <section className="rounded-md border border-gold/20 bg-gold/5 p-5 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-4 w-4 text-gold" />
          <h3 className="font-bold text-sm">Current Configuration</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Chip label="Mode" value={MODE_LABELS[config.mode].label} />
          <Chip
            label="Mfg Bill"
            value={config.mfgBillEnabled ? "Enabled" : "Disabled"}
            on={config.mfgBillEnabled}
          />
          <Chip
            label="Mandatory before delivery"
            value={config.mfgBillMandatoryBeforeDelivery ? "Yes" : "No"}
            on={config.mfgBillMandatoryBeforeDelivery}
          />
          <Chip
            label="Auto Finished Stock"
            value={config.finishedStockAutomatic ? "Automatic" : "Manual"}
            on={config.finishedStockAutomatic}
          />
          <Chip
            label="Outstanding Delivery"
            value={config.outstandingDeliveryAllowed ? "Allowed" : "Blocked"}
            on={config.outstandingDeliveryAllowed}
          />
          <Chip
            label="Auto Gold Ledger"
            value={config.autoPostGoldLedger ? "Yes" : "No"}
            on={config.autoPostGoldLedger}
          />
        </div>
      </section>
    </div>
  );
}

function Chip({ label, value, on }: { label: string; value: string; on?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-card border border-border px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-semibold ${on === true ? "text-emerald-400" : on === false ? "text-muted-foreground" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}
