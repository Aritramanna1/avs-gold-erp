import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  useWhatsapp,
  parseWhatsappText,
  parsedSummary,
  WA_STATUS_LABELS,
  type WhatsappStatus,
  type ParsedFields,
} from "@/lib/whatsapp-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { fineGoldMg } from "@/lib/gold";
import { MessageSquare, Sparkles, Trash2, ArrowRight, Copy, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/whatsapp")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "WhatsApp Ingestion · AVS Gold ERP" }] }),
  component: WhatsappPage,
});

const STATUS_FILTERS: (WhatsappStatus | "all")[] = [
  "all",
  "pending",
  "parsed",
  "converted",
  "ignored",
];

function WhatsappPage() {
  const { messages, add, update, remove } = useWhatsapp();
  const people = usePeople((s) => s.people);
  const addPerson = usePeople((s) => s.add);
  const addOrder = useOrders((s) => s.add);
  const navigate = useNavigate();

  const [filter, setFilter] = useState<WhatsappStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [sender, setSender] = useState("");
  const [phone, setPhone] = useState("");
  const [raw, setRaw] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter !== "all" && m.status !== filter) return false;
      if (q) {
        const hay =
          `${m.senderName} ${m.senderPhone} ${m.parsed?.customerName ?? ""} ${m.parsed?.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [messages, filter, query]);

  const handleAdd = () => {
    if (!raw.trim()) return;
    const parsed = parseWhatsappText(raw);
    add({
      senderName: sender || parsed.customerName || "Unknown",
      senderPhone: phone || parsed.phone || "",
      rawText: raw,
      parsed,
      status: parsed.customerName || parsed.itemName ? "parsed" : "pending",
    });
    setSender("");
    setPhone("");
    setRaw("");
    toast.success("Saved & parsed");
  };

  const handleReparse = (id: string) => {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    const parsed = parseWhatsappText(m.rawText);
    update(id, { parsed, status: "parsed" });
    toast.success("Re-parsed from raw text");
  };

  const handleCopy = (id: string) => {
    const m = messages.find((x) => x.id === id);
    if (!m?.parsed) return;
    navigator.clipboard?.writeText(parsedSummary(m.parsed));
    toast.success("Parsed summary copied");
  };

  const handleConvert = async (id: string) => {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    const parsed = m.parsed ?? parseWhatsappText(m.rawText);
    const phoneClean = (parsed.phone || m.senderPhone || "").replace(/\D/g, "").slice(-10);
    let customer = people.find((p) => p.phone.replace(/\D/g, "").slice(-10) === phoneClean);
    const wasNewCustomer = !customer;
    if (!customer && (parsed.customerName || m.senderName)) {
      customer = await addPerson({
        type: "customer",
        active: true,
        fullName: parsed.customerName || m.senderName,
        phone: phoneClean,
      });
    }
    if (!customer) {
      toast.error("Cannot convert: no customer name or phone available.");
      return;
    }
    // Clamped to gold.ts's valid 0..999 range: this value comes from parsing
    // free-text WhatsApp messages, so it isn't guaranteed well-formed, and
    // fineGoldMg() throws outside that range — a bad parse must not crash
    // this handler.
    const purityPM = Math.max(0, Math.min(999, Math.round(parsed.permille ?? 916)));
    const estMg = Math.max(0, Math.round((parsed.estWeightG ?? 0) * 1000));
    const fineMg = fineGoldMg(estMg, purityPM);
    const wastagePct = parsed.wastagePct ?? 10;
    const totalQty = parsed.quantities?.reduce((s, q) => s + q.count, 0) || 1;
    const itemLabel =
      parsed.itemName ||
      parsed.quantities?.map((q) => `${q.count} ${q.kind}${q.count > 1 ? "s" : ""}`).join(", ") ||
      "From WhatsApp";
    const order = await addOrder({
      type: "custom",
      status: "draft",
      customerId: customer.id,
      priority: "normal",
      source: "whatsapp",
      whatsappSourceId: m.id,
      expectedDelivery: parsed.deliveryDate,
      design: { notes: parsed.remarks },
      item: {
        itemName: itemLabel,
        category: parsed.category || "Other",
        quantity: totalQty,
        metal: "gold",
        metalColor: "Yellow",
        purity: purityPM,
        grossMg: estMg,
        lessMg: 0,
        netMg: estMg,
        fineMg,
        expectedWastagePct: wastagePct,
        expectedWastageMg: Math.round((fineMg * wastagePct) / 100),
      },
      advance: { cashPaise: 0, goldGrossMg: 0, goldFineMg: 0 },
      timeline: [
        {
          ts: Date.now(),
          label: "WhatsApp Order Accepted",
          note:
            `From message ${m.id.slice(0, 8)}` +
            (wasNewCustomer ? " · customer auto-created" : " · matched existing customer"),
        },
      ],
    } as any);
    update(id, { status: "converted", convertedOrderId: order.id, linkedPersonId: customer.id });
    toast.success(`Order draft ${order.orderNo} created${wasNewCustomer ? " (new customer)" : ""}`);
    navigate({ to: "/billing" });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="WhatsApp Ingestion"
        subtitle="Paste a customer's WhatsApp message, parse it, edit if needed, and convert to an order draft. Manual paste — no paid API."
      />

      <Card className="p-4 mb-6">
        <div className="grid md:grid-cols-2 gap-3">
          <Input
            placeholder="Sender name (optional)"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          />
          <Input
            placeholder="Sender phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Textarea
          data-testid="whatsapp-raw-message"
          className="mt-3 min-h-[100px]"
          placeholder={`Paste WhatsApp text. Examples:\nCustomer: Amit Sen, Mobile: 9830012345, Item: Kolkata Filigree Ring, Purity: 22K, Est Weight: 8.5g, Delivery: 25/06/2026\n— or —\nAmit Sen 9830012345 wants 22K filigree ring approx 8.5g delivery 25 June`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <Button data-testid="whatsapp-parse" onClick={handleAdd} disabled={!raw.trim()}>
            <Sparkles className="h-4 w-4 mr-1.5" /> Parse & Save
          </Button>
        </div>
      </Card>

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "All" : WA_STATUS_LABELS[s]}{" "}
            <span className="ml-1 text-xs opacity-70">
              ({s === "all" ? messages.length : messages.filter((m) => m.status === s).length})
            </span>
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <div>No WhatsApp messages match.</div>
          <div className="text-xs mt-1">Paste a message above to begin.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((m) => {
            const phoneClean = (m.parsed?.phone || m.senderPhone || "")
              .replace(/\D/g, "")
              .slice(-10);
            const matched = phoneClean
              ? people.find((p) => p.phone.replace(/\D/g, "").slice(-10) === phoneClean)
              : undefined;
            return (
              <MessageCard
                key={m.id}
                id={m.id}
                senderName={m.senderName}
                senderPhone={m.senderPhone}
                createdAt={m.createdAt}
                status={m.status}
                raw={m.rawText}
                parsed={m.parsed}
                convertedOrderId={m.convertedOrderId}
                matchedCustomerName={matched?.fullName}
                onUpdateParsed={(p) => update(m.id, { parsed: p, status: "parsed" })}
                onReparse={() => handleReparse(m.id)}
                onCopy={() => handleCopy(m.id)}
                onConvert={() => handleConvert(m.id)}
                onIgnore={() => update(m.id, { status: "ignored" })}
                onRemove={() => remove(m.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageCard(props: {
  id: string;
  senderName: string;
  senderPhone: string;
  createdAt: number;
  status: WhatsappStatus;
  raw: string;
  parsed?: ParsedFields;
  convertedOrderId?: string;
  matchedCustomerName?: string;
  onUpdateParsed: (p: ParsedFields) => void;
  onReparse: () => void;
  onCopy: () => void;
  onConvert: () => void;
  onIgnore: () => void;
  onRemove: () => void;
}) {
  const [edit, setEdit] = useState<ParsedFields>(props.parsed ?? {});
  // Resync when the store's parsed fields change from outside an edit in
  // this card — e.g. "Reset Parsed" (onReparse) writes straight to the
  // store without going through onUpdateParsed, so without this the form
  // silently kept showing the pre-reparse values.
  useEffect(() => {
    setEdit(props.parsed ?? {});
  }, [props.parsed]);
  function patch<K extends keyof ParsedFields>(k: K, v: ParsedFields[K]) {
    const next = { ...edit, [k]: v };
    setEdit(next);
    props.onUpdateParsed(next);
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium">
            {props.senderName || "Unknown"}{" "}
            <span className="text-muted-foreground text-sm">{props.senderPhone}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(props.createdAt).toLocaleString()}
          </div>
        </div>
        <Badge variant={props.status === "converted" ? "default" : "secondary"}>
          {WA_STATUS_LABELS[props.status]}
        </Badge>
      </div>
      {props.status !== "converted" && (
        <div className="mt-2">
          {props.matchedCustomerName ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px]"
            >
              Customer matched: {props.matchedCustomerName}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px]"
            >
              No existing customer — will be quick-created on accept
            </Badge>
          )}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Raw message
          </div>
          <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-2 border border-border">
            {props.raw}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Parsed fields (editable)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Customer"
              value={edit.customerName ?? ""}
              onChange={(v) => patch("customerName", v)}
            />
            <Field label="Phone" value={edit.phone ?? ""} onChange={(v) => patch("phone", v)} />
            <Field
              label="Item"
              value={edit.itemName ?? ""}
              onChange={(v) => patch("itemName", v)}
            />
            <Field
              label="Category"
              value={edit.category ?? ""}
              onChange={(v) => patch("category", v)}
            />
            <Field
              label="Purity (per-mille)"
              value={edit.permille ? String(edit.permille) : ""}
              onChange={(v) => patch("permille", v ? Number(v) : undefined)}
            />
            <Field
              label="Est Weight (g)"
              value={edit.estWeightG ? String(edit.estWeightG) : ""}
              onChange={(v) => patch("estWeightG", v ? Number(v) : undefined)}
            />
            <Field
              label="Wastage Charged (%)"
              value={edit.wastagePct != null ? String(edit.wastagePct) : ""}
              onChange={(v) => patch("wastagePct", v ? Number(v) : undefined)}
            />
            <Field
              label="Delivery (YYYY-MM-DD)"
              value={edit.deliveryDate ?? ""}
              onChange={(v) => patch("deliveryDate", v)}
            />
            <Field
              label="Remarks"
              value={edit.remarks ?? ""}
              onChange={(v) => patch("remarks", v)}
            />
          </div>
          {edit.quantities && edit.quantities.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              Quantities detected:{" "}
              {edit.quantities
                .map((q) => `${q.count} ${q.kind}${q.count > 1 ? "s" : ""}`)
                .join(", ")}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        {props.status !== "converted" && (
          <Button data-testid="whatsapp-convert-order" size="sm" onClick={props.onConvert}>
            Convert to Order Draft <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
        {props.status === "converted" && props.convertedOrderId && (
          <Link to="/billing">
            <Button size="sm" variant="outline">
              Open Order
            </Button>
          </Link>
        )}
        <Button size="sm" variant="outline" className="gap-1" onClick={props.onReparse}>
          <RotateCcw className="h-3 w-3" /> Reset Parsed
        </Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={props.onCopy}>
          <Copy className="h-3 w-3" /> Copy Summary
        </Button>
        {props.status !== "ignored" && props.status !== "converted" && (
          <Button size="sm" variant="ghost" onClick={props.onIgnore}>
            Ignore
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={props.onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}
