import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/lib/settings-store";
import { saveBranchSettings } from "@/lib/services/branch-settings-service";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/branch-settings")({
  component: BranchSettingsPage,
});

function BranchSettingsPage() {
  const s = useSettings();
  const branches = s.branches ?? [];
  const [activeBranchId, setActiveBranchId] = useState(branches[0]?.id ?? "MAIN");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    identity: true,
    series: false,
    email: false,
    whatsapp: false,
    hardware: false,
    gold: false,
  });

  const bs = s.getBranchSettings(activeBranchId);
  const branch = branches.find((b) => b.id === activeBranchId);

  function patch(field: string, value: string | number) {
    s.setBranchSettings(activeBranchId, { [field]: value } as any);
  }

  function Section({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children: React.ReactNode;
  }) {
    const open = expanded[id];
    return (
      <Card className="overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
          onClick={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
        >
          <span className="font-medium text-sm">{title}</span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {open && <div className="px-5 pb-5 pt-1 grid gap-4">{children}</div>}
      </Card>
    );
  }

  function Field({
    label,
    field,
    placeholder,
    type = "text",
  }: {
    label: string;
    field: keyof typeof bs;
    placeholder?: string;
    type?: string;
  }) {
    return (
      <div className="grid gap-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          type={type}
          placeholder={placeholder}
          value={(bs[field] as string) ?? ""}
          onChange={(e) => patch(field as string, e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Branch Settings"
        subtitle="Configure each branch independently — logo, GST, invoice series, SMTP, hardware."
      />

      {/* Branch selector */}
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-gold shrink-0" />
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
          value={activeBranchId}
          onChange={(e) => setActiveBranchId(e.target.value)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Editing: <strong>{branch?.name ?? activeBranchId}</strong>
        </span>
      </div>

      {/* Identity */}
      <Section id="identity" title="Branch Identity">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="GSTIN" field="gstin" placeholder="27AABCU9603R1ZX" />
          <Field label="Contact Phone" field="phone" placeholder="+91 XXXXX XXXXX" />
          <Field
            label="Contact Email"
            field="email"
            placeholder="branch@example.com"
            type="email"
          />
        </div>
        <Field label="Address" field="address" placeholder="123, Jewellers Lane, City — 400001" />
        <Field label="Logo URL" field="logoUrl" placeholder="https://..." />
      </Section>

      {/* Series */}
      <Section id="series" title="Invoice & Barcode Series">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Invoice Series Prefix" field="invoiceSeries" placeholder="MTJ/ICH/25-26/" />
          <Field label="Receipt Series Prefix" field="receiptSeries" placeholder="RCT/ICH/25-26/" />
          <Field label="Barcode Series Prefix" field="barcodeSeries" placeholder="BCH-" />
        </div>
      </Section>

      {/* SMTP */}
      <Section id="email" title="Email (SMTP) Settings">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="SMTP Host" field="smtpHost" placeholder="smtp.gmail.com" />
          <Field label="SMTP Port" field="smtpPort" placeholder="587" />
          <Field label="SMTP Username" field="smtpUser" placeholder="user@gmail.com" />
          <Field
            label="SMTP Password"
            field="smtpPassword"
            placeholder="app-password"
            type="password"
          />
          <Field label="From Name" field="smtpFromName" placeholder="Your Shop Name" />
          <Field
            label="From Email"
            field="smtpFromEmail"
            placeholder="noreply@maatarajewellers.com"
          />
        </div>
      </Section>

      {/* WhatsApp */}
      <Section id="whatsapp" title="WhatsApp Business">
        <Field
          label="WhatsApp Business Phone Number"
          field="waPhoneNumber"
          placeholder="+91 XXXXX XXXXX"
        />
        <p className="text-xs text-muted-foreground">
          Global WhatsApp API credentials (access token, WABA ID) are configured in{" "}
          <strong>Settings → Communications</strong>.
        </p>
      </Section>

      {/* Hardware */}
      <Section id="hardware" title="Hardware">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Thermal Printer IP" field="thermalPrinterIp" placeholder="192.168.1.100" />
          <Field label="Thermal Printer Port" field="thermalPrinterPort" placeholder="9100" />
        </div>
      </Section>

      {/* Gold prefs */}
      <Section id="gold" title="Gold Rate Preferences">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Default Karat</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              value={bs.defaultKarat ?? 22}
              onChange={(e) => patch("defaultKarat", Number(e.target.value))}
            >
              <option value={22}>22K</option>
              <option value={24}>24K</option>
              <option value={18}>18K</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Gold Rate Source</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              value={bs.goldRateSource ?? "manual"}
              onChange={(e) => patch("goldRateSource", e.target.value)}
            >
              <option value="manual">Manual (set daily)</option>
              <option value="api">Live API (MCX feed)</option>
            </select>
          </div>
        </div>
      </Section>

      <Button
        className="bg-gold hover:bg-gold/90 text-background"
        onClick={async () => {
          const bs2 = s.getBranchSettings(activeBranchId);
          try {
            await saveBranchSettings(bs2);
            toast.success(`Branch settings saved for ${branch?.name ?? activeBranchId}`);
          } catch (error) {
            toast.error("Save failed: " + (error instanceof Error ? error.message : String(error)));
          }
        }}
      >
        <Save className="h-4 w-4 mr-2" />
        Save All Changes
      </Button>
    </div>
  );
}
