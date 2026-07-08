/**
 * Workflow Engine Settings
 * Lets the admin configure how the manufacturing lifecycle works,
 * without changing any code. Makes the ERP adaptable to any jeweller.
 */
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/workflow")({
  head: () => ({ meta: [{ title: "Workflow Engine · MTJ ERP" }] }),
  component: WorkflowSettings,
});

const MODE_LABELS: Record<BusinessMode, { label: string; description: string }> = {
  retail_only: {
    label: "Retail Only",
    description: "No manufacturing — sell ready-made stock only. Manufacturing Bill disabled.",
  },
  manufacturing_only: {
    label: "Manufacturing Only",
    description: "Pure manufacturer — all items made to order. Retail billing disabled.",
  },
  hybrid: {
    label: "Hybrid (Retail + Manufacturing)",
    description: "Both modes active. MTJ default — retail stock sales and custom manufacturing.",
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

export default function WorkflowSettings() {
  const { config, patch, applyPreset, reset } = useWorkflowEngine();

  function applyAndToast(key: keyof typeof WORKFLOW_PRESETS) {
    applyPreset(key);
    toast.success(`Preset "${key}" applied`);
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
            toast.success("Reset to MTJ defaults");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset to MTJ Default
        </Button>
      </div>

      {/* Presets */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
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
              className={`rounded-xl border p-3 text-left transition-colors hover:border-gold/40 ${
                JSON.stringify(config) === JSON.stringify(WORKFLOW_PRESETS[key])
                  ? "border-gold/50 bg-gold/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="text-xs font-bold mb-1">{key.replace(/_/g, " ").toUpperCase()}</div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                {key === "mtj_default" && "MTJ hybrid: manufacturing-first, outstanding allowed"}
                {key === "retail_only" && "No manufacturing. Sell from ready stock only."}
                {key === "manufacturing_strict" && "Full payment required before delivery."}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Business Mode */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
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

        {config.mode === "hybrid" && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-xl p-3">
            <CheckCircle className="h-4 w-4 shrink-0" />
            MTJ uses Hybrid mode — manufacturing and retail billing are both active.
          </div>
        )}
      </section>

      {/* Manufacturing Bill */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-1">
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
      </section>

      {/* Finished Stock */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-1">
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

      {/* Payment & Delivery */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-1">
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
          description="Allow the customer to take delivery with a partial or zero payment — creates an outstanding balance."
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
      <section className="rounded-2xl border border-border bg-card p-5 space-y-1">
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

        <div className="rounded-xl bg-muted/20 border border-border p-3 text-xs text-muted-foreground mt-2">
          <strong>Provider fallback:</strong> If WhatsApp Business API is not configured, the system
          falls back to WhatsApp Deep Link (manual sharing). Email requires SMTP or API credentials
          in Communication Settings. Billing logic never needs to know which provider is active.
        </div>
      </section>

      {/* Current config summary */}
      <section className="rounded-2xl border border-gold/20 bg-gold/5 p-5 space-y-2">
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
