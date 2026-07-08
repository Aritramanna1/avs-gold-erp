import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWaTemplates,
  TEMPLATE_KIND_LABELS,
  type TemplateKind,
  type TemplateTarget,
} from "@/lib/wa-templates-store";
import { renderTemplate, tokensIn } from "@/lib/wa-placeholders";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { buildContext } from "@/lib/wa-placeholders";
import { ArrowLeft, MessageCircle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/whatsapp-templates")({
  head: () => ({ meta: [{ title: "WhatsApp Templates · MTJ ERP" }] }),
  component: WaTemplatesPage,
});

const TARGETS: { value: TemplateTarget; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "karigar", label: "Karigar" },
  { value: "worker", label: "Worker" },
  { value: "owner", label: "Owner" },
  { value: "vendor", label: "Vendor" },
];

function WaTemplatesPage() {
  const templates = useWaTemplates((s) => s.templates);
  const update = useWaTemplates((s) => s.update);
  const reset = useWaTemplates((s) => s.resetToDefault);
  const remove = useWaTemplates((s) => s.remove);
  const add = useWaTemplates((s) => s.add);

  const orders = useOrders((s) => s.orders);
  const jobs = useJobCards((s) => s.jobs);
  const invoices = useBilling((s) => s.invoices);
  const repairs = useRepairs((s) => s.repairs);

  // Sample context for live preview
  const sample = useMemo(() => {
    const order = orders[0];
    const job = jobs[0];
    const invoice = invoices[0];
    const repair = repairs[0];
    return buildContext({
      orderId: order?.id,
      jobId: job?.id,
      invoiceId: invoice?.id,
      repairId: repair?.id,
    });
  }, [orders, jobs, invoices, repairs]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/settings">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Settings
          </Button>
        </Link>
      </div>
      <PageHeader
        title="WhatsApp Templates"
        subtitle="Edit message bodies. Placeholders like {{customer_name}} auto-fill from ERP data when sending."
      />

      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 mb-4 text-sm">
        <b className="text-gold">Placeholders</b> available:
        <code className="block mt-1 text-xs text-muted-foreground">
          {
            "{{firm_name}} {{firm_phone}} {{shop_address}} {{customer_name}} {{customer_phone}} {{karigar_name}} {{karigar_phone}} {{order_number}} {{job_card_number}} {{item_name}} {{category}} {{purity}} {{gross_weight}} {{net_weight}} {{fine_weight}} {{delivery_date}} {{due_date}} {{invoice_number}} {{invoice_amount}} {{paid_amount}} {{outstanding_amount}} {{payment_due_date}} {{repair_number}} {{repair_status}} {{gold_issued}} {{gold_received}} {{current_status}}"
          }
        </code>
      </div>

      <div className="space-y-4">
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            id={t.id}
            kind={t.kind}
            name={t.name}
            target={t.target}
            body={t.body}
            active={t.active}
            isBuiltin={t.isBuiltin}
            sample={sample}
            onChange={(patch) => update(t.id, patch)}
            onReset={() => {
              reset(t.id);
              toast.success("Reset to default");
            }}
            onDelete={() => {
              remove(t.id);
              toast.success("Deleted");
            }}
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-4 flex items-center gap-3">
        <MessageCircle className="h-4 w-4 text-gold" />
        <div className="flex-1 text-sm">Add a custom template you can reuse from any record.</div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => {
            add({
              kind: "custom",
              name: "My custom template",
              target: "customer",
              body: "",
              active: true,
            });
            toast.success("Custom template added");
          }}
        >
          <Plus className="h-3 w-3" /> Add custom
        </Button>
      </div>
    </div>
  );
}

function TemplateCard(props: {
  id: string;
  kind: TemplateKind;
  name: string;
  target: TemplateTarget;
  body: string;
  active: boolean;
  isBuiltin: boolean;
  sample: Record<string, string>;
  onChange: (
    patch: Partial<{ name: string; body: string; active: boolean; target: TemplateTarget }>,
  ) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const preview = renderTemplate(props.body, props.sample);
  const tokens = tokensIn(props.body);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <Badge variant="outline" className="text-[10px]">
          {TEMPLATE_KIND_LABELS[props.kind]}
        </Badge>
        <Input
          value={props.name}
          onChange={(e) => props.onChange({ name: e.target.value })}
          className="max-w-sm h-8"
        />
        <Select
          value={props.target}
          onValueChange={(v) => props.onChange({ target: v as TemplateTarget })}
        >
          <SelectTrigger className="w-40 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGETS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Label className="text-xs">Active</Label>
          <Switch checked={props.active} onCheckedChange={(v) => props.onChange({ active: v })} />
          {props.isBuiltin ? (
            <Button size="sm" variant="ghost" className="gap-1" onClick={props.onReset}>
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 gap-1"
              onClick={props.onDelete}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Message body
          </Label>
          <Textarea
            value={props.body}
            onChange={(e) => props.onChange({ body: e.target.value })}
            className="font-mono text-xs min-h-[180px]"
          />
          {tokens.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tokens.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">{`{{${t}}}`}</Badge>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Live preview (using first record as sample)
          </Label>
          <Textarea readOnly value={preview} className="font-mono text-xs min-h-[180px]" />
        </div>
      </div>
    </div>
  );
}
