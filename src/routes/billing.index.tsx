import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useBilling,
  INVOICE_STATUS_LABELS,
  customerLedger,
  paiseToRupees,
} from "@/lib/billing-store";
import { usePeople } from "@/lib/people-store";
import { useCan } from "@/lib/rbac";
import { FileText, Plus, Receipt, Search, Coins, Printer } from "lucide-react";
import { GoldSettlementTab } from "@/components/GoldSettlementTab";
import { useEffect } from "react";
import {
  useSettlements,
  FINANCIAL_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
} from "@/lib/settlement-store";

export const Route = createFileRoute("/billing/")({
  head: () => ({ meta: [{ title: "Billing · AVS Gold ERP" }] }),
  component: BillingIndex,
});

function BillingIndex() {
  const invoices = useBilling((s) => s.invoices);
  const people = usePeople((s) => s.people);
  const [q, setQ] = useState("");
  const { can } = useCan();

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return invoices.filter((i) => {
      if (!t) return true;
      return (
        i.invoiceNo.toLowerCase().includes(t) ||
        i.customerName.toLowerCase().includes(t) ||
        (i.customerPhone ?? "").includes(t) ||
        (i.orderNo ?? "").toLowerCase().includes(t)
      );
    });
  }, [invoices, q]);

  const outstanding = useMemo(() => {
    const map = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        phone?: string;
        amount: number;
        days: number;
        latestInv: string;
      }
    >();
    const now = Date.now();
    for (const inv of invoices) {
      if (inv.balancePaise <= 0 || inv.status === "cancelled") continue;
      const days = Math.floor((now - inv.createdAt) / 86400000);
      const ex = map.get(inv.customerId);
      if (ex) {
        ex.amount += inv.balancePaise;
        ex.days = Math.max(ex.days, days);
      } else {
        map.set(inv.customerId, {
          customerId: inv.customerId,
          customerName: inv.customerName,
          phone: inv.customerPhone,
          amount: inv.balancePaise,
          days,
          latestInv: inv.invoiceNo,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  const totalCollected = invoices.reduce((s, i) => s + i.paidPaise, 0);
  const totalOutstanding = outstanding.reduce((s, o) => s + o.amount, 0);
  const totalInvoices = invoices.length;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Billing"
        subtitle="Invoices, payments and customer ledger."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link to="/billing/credit-notes">
              <Button variant="outline" size="sm">
                Credit Notes
              </Button>
            </Link>
            <Link to="/billing/debit-notes">
              <Button variant="outline" size="sm">
                Debit Notes
              </Button>
            </Link>
            <Link to="/billing/estimates">
              <Button variant="outline" size="sm">
                Estimates
              </Button>
            </Link>
            <Link to="/billing/delivery-challans">
              <Button variant="outline" size="sm">
                Delivery Challans
              </Button>
            </Link>
            {can("billing.create") ? (
              <Link to="/settlement/new">
                <Button variant="outline" data-testid="billing-create-settlement" className="gap-2">
                  <Plus className="h-4 w-4" /> New Settlement
                </Button>
              </Link>
            ) : null}
            {can("billing.create") ? (
              <Link to="/billing/new">
                <Button data-testid="billing-create-invoice" className="gap-2">
                  <Plus className="h-4 w-4" /> New Invoice
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Invoices" value={String(totalInvoices)} />
        <Stat
          label="Collected"
          value={`₹ ${paiseToRupees(totalCollected)}`}
          tone="text-emerald-300"
        />
        <Stat
          label="Outstanding"
          value={`₹ ${paiseToRupees(totalOutstanding)}`}
          tone="text-amber-300"
        />
      </div>

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" /> Invoices
          </TabsTrigger>
          <TabsTrigger value="outstanding" className="gap-2">
            <Receipt className="h-4 w-4" /> Outstanding
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2">
            Customer Ledger
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-2">
            <Coins className="h-4 w-4 text-gold" /> Gold Settlements
          </TabsTrigger>
          <TabsTrigger value="customer-settlements" className="gap-2">
            <FileText className="h-4 w-4" /> Customer Settlements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="relative max-w-sm mb-3">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search invoice, customer, phone, order"
                className="pl-9"
              />
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No invoices yet. Create one from an order, a finished stock item, or use New
                Invoice.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left py-2">Invoice</th>
                      <th className="text-left">Customer</th>
                      <th className="text-left">Order</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance</th>
                      <th className="text-left pl-3">Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => (
                      <tr key={i.id} className="border-b border-border/60 hover:bg-background/30">
                        <td className="py-2 font-mono text-xs text-gold">{i.invoiceNo}</td>
                        <td>
                          {i.customerName}
                          <div className="text-[11px] text-muted-foreground">{i.customerPhone}</div>
                        </td>
                        <td className="text-xs text-muted-foreground">{i.orderNo ?? "—"}</td>
                        <td className="text-right">
                          ₹ {paiseToRupees(i.subtotalPaise + i.gstPaise)}
                        </td>
                        <td className="text-right text-emerald-300">
                          ₹ {paiseToRupees(i.paidPaise)}
                        </td>
                        <td className="text-right text-amber-300">
                          ₹ {paiseToRupees(i.balancePaise)}
                        </td>
                        <td className="pl-3">
                          <Badge variant="outline" className="text-[10px]">
                            {INVOICE_STATUS_LABELS[i.status]}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Print Invoice"
                              onClick={() => window.open(`/billing/print/${i.id}`, "_blank")}
                            >
                              <Printer className="h-3 w-3" />
                            </Button>
                            <Link to="/billing/$id" params={{ id: i.id }}>
                              <Button size="sm" variant="outline">
                                Open
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="outstanding" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            {outstanding.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No outstanding balances.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left py-2">Customer</th>
                      <th className="text-left">Phone</th>
                      <th className="text-left">Latest Inv.</th>
                      <th className="text-right">Outstanding</th>
                      <th className="text-right">Days</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.map((o) => (
                      <tr key={o.customerId} className="border-b border-border/60">
                        <td className="py-2">{o.customerName}</td>
                        <td className="text-xs text-muted-foreground">{o.phone ?? "—"}</td>
                        <td className="font-mono text-xs">{o.latestInv}</td>
                        <td className="text-right text-amber-300">₹ {paiseToRupees(o.amount)}</td>
                        <td className="text-right">{o.days}d</td>
                        <td className="text-right">
                          <Link
                            to="/billing/$id"
                            params={{
                              id: invoices.find((iv) => iv.invoiceNo === o.latestInv)?.id ?? "",
                            }}
                          >
                            <Button size="sm" variant="outline">
                              {can("billing.recordPayment") ? "Record Payment" : "Open"}
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <CustomerLedgerView invoices={invoices} customers={people} />
        </TabsContent>

        <TabsContent value="settlements" className="mt-4">
          <GoldSettlementTab />
        </TabsContent>

        <TabsContent value="customer-settlements" className="mt-4">
          <CustomerSettlementsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomerSettlementsList() {
  const settlements = useSettlements((s) => s.settlements);
  const refresh = useSettlements((s) => s.refresh);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...settlements].sort((a, b) => b.createdAt - a.createdAt);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center rounded-2xl border border-border bg-card">
        No settlement drafts yet. Use "New Settlement" above to create one before delivering
        jewellery to a customer.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left py-2">Settlement</th>
            <th className="text-left">Customer</th>
            <th className="text-left">Financial Status</th>
            <th className="text-left">Delivery Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.id} className="border-b border-border/60 hover:bg-background/30">
              <td className="py-2 font-mono text-xs text-gold">{s.settlementNo}</td>
              <td>{s.customerName}</td>
              <td>
                <Badge variant="outline" className="text-[10px]">
                  {FINANCIAL_STATUS_LABELS[s.financialStatus]}
                </Badge>
              </td>
              <td>
                <Badge variant="outline" className="text-[10px]">
                  {DELIVERY_STATUS_LABELS[s.deliveryStatus]}
                </Badge>
              </td>
              <td className="text-right">
                <Link to="/settlement/$id" params={{ id: s.id }}>
                  <Button size="sm" variant="outline">
                    Open
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerLedgerView({
  invoices,
  customers,
}: {
  invoices: ReturnType<typeof useBilling.getState>["invoices"];
  customers: ReturnType<typeof usePeople.getState>["people"];
}) {
  const billing = customers.filter((c) => invoices.some((i) => i.customerId === c.id));
  const [selected, setSelected] = useState<string | null>(billing[0]?.id ?? null);
  const data = useMemo(
    () => (selected ? customerLedger(selected, invoices) : null),
    [selected, invoices],
  );

  if (billing.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center rounded-2xl border border-border bg-card">
        No customer ledgers yet. They appear after an invoice is created.
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <div className="rounded-2xl border border-border bg-card p-2 space-y-1 max-h-[500px] overflow-y-auto">
        {billing.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected === c.id ? "bg-gold/15 text-gold" : "hover:bg-background/40"}`}
          >
            <div className="font-medium">{c.fullName}</div>
            <div className="text-[11px] text-muted-foreground">{c.phone}</div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        {data && (
          <>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <Stat label="Billed" value={`₹ ${paiseToRupees(data.totalDebit)}`} />
              <Stat
                label="Received"
                value={`₹ ${paiseToRupees(data.totalCredit)}`}
                tone="text-emerald-300"
              />
              <Stat
                label="Balance"
                value={`₹ ${paiseToRupees(data.outstanding)}`}
                tone={data.outstanding > 0 ? "text-amber-300" : "text-emerald-300"}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left">Ref</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, idx) => (
                    <tr key={idx} className="border-b border-border/60">
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {new Date(l.ts).toLocaleDateString("en-IN")}
                      </td>
                      <td className="font-mono text-xs">{l.ref}</td>
                      <td className="text-xs">{l.description}</td>
                      <td className="text-right">
                        {l.debitPaise ? `₹ ${paiseToRupees(l.debitPaise)}` : "—"}
                      </td>
                      <td className="text-right text-emerald-300">
                        {l.creditPaise ? `₹ ${paiseToRupees(l.creditPaise)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-serif text-2xl ${tone ?? "text-gold"}`}>{value}</div>
    </div>
  );
}
