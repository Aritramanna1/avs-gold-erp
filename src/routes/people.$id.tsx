import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePeople } from "@/lib/people-store";
import { useOrders, ORDER_STATUS_LABELS, paiseToRupees } from "@/lib/orders-store";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useBilling } from "@/lib/billing-store";
import {
  compileCustomerLedger,
  getPartyGoldBalance,
  getPartyCashBalance,
} from "@/lib/customer-account-ledger";
import { mgToGrams } from "@/lib/gold";
import { ArrowLeft, BookOpen, ClipboardList, Hammer, Receipt, Wallet } from "lucide-react";

export const Route = createFileRoute("/people/$id")({
  head: () => ({ meta: [{ title: "Jeweller Account · AVS Gold ERP" }] }),
  component: JewellerAccountPage,
});

function JewellerAccountPage() {
  const { id } = useParams({ from: "/people/$id" });
  const navigate = useNavigate();

  const people = usePeople((s) => s.people);
  const refreshPeople = usePeople((s) => s.refresh);
  const orders = useOrders((s) => s.orders);
  const refreshOrders = useOrders((s) => s.refresh);
  const jobs = useJobCards((s) => s.jobs);
  const refreshJobs = useJobCards((s) => s.refresh);
  const mfgBills = useMfgBills((s) => s.bills);
  const refreshMfgBills = useMfgBills((s) => s.refresh);
  const settlements = useGoldSettlement((s) => s.settlements);
  const refreshSettlements = useGoldSettlement((s) => s.refresh);
  const invoices = useBilling((s) => s.invoices);
  const refreshInvoices = useBilling((s) => s.refresh);

  useEffect(() => {
    refreshPeople();
    refreshOrders();
    refreshJobs();
    refreshMfgBills();
    refreshSettlements();
    refreshInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const person = useMemo(() => people.find((p) => p.id === id), [people, id]);

  const partyOrders = useMemo(() => orders.filter((o) => o.customerId === id), [orders, id]);
  const partyJobs = useMemo(() => jobs.filter((j) => j.customerId === id), [jobs, id]);
  const partyMfgBills = useMemo(() => mfgBills.filter((b) => b.customerId === id), [mfgBills, id]);
  const partySettlements = useMemo(
    () => settlements.filter((s) => s.party_type === "customer" && s.party_id === id),
    [settlements, id],
  );
  const partyInvoices = useMemo(() => invoices.filter((i) => i.customerId === id), [invoices, id]);
  const partyPayments = useMemo(
    () => partyInvoices.flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNo: i.invoiceNo }))),
    [partyInvoices],
  );

  // Single authoritative compiler — reused, not reimplemented (see
  // src/lib/customer-account-ledger.ts).
  const ledger = useMemo(
    () => (id ? compileCustomerLedger(id) : null),
    [id, settlements, orders, invoices],
  );
  const goldBalance = useMemo(
    () => (id ? getPartyGoldBalance(id) : null),
    [id, settlements, orders, invoices],
  );
  const cashBalance = useMemo(
    () => (id ? getPartyCashBalance(id) : null),
    [id, settlements, orders, invoices],
  );

  if (!person) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Jeweller Account" />
        <p className="text-sm text-muted-foreground">Person not found.</p>
        <Button variant="ghost" onClick={() => navigate({ to: "/people" })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to People
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={`Jeweller Account · ${person.fullName}`} />

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/people" })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to People
        </Button>
        <Link to="/orders/new" className="text-sm text-gold hover:underline">
          + New Order for {person.fullName}
        </Link>
      </div>

      {/* Customer info */}
      <section className="rounded-lg border p-4 space-y-1">
        <h2 className="font-semibold text-lg">{person.fullName}</h2>
        <p className="text-sm text-muted-foreground">
          {person.phone} {person.gstin ? `· GSTIN ${person.gstin}` : ""}
        </p>
        {person.currentAddress ? (
          <p className="text-sm text-muted-foreground">{person.currentAddress}</p>
        ) : null}
      </section>

      {/* Outstanding balances — system-generated, single source */}
      <section className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground mb-1">Outstanding Gold</p>
          <p className="text-2xl font-semibold">
            {goldBalance ? mgToGrams(goldBalance.outstandingFineMg) : "0.000"} g
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fine gold the workshop owes back to this jeweller
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground mb-1">Outstanding Cash</p>
          <p className="text-2xl font-semibold">
            ₹{cashBalance ? paiseToRupees(cashBalance.outstandingPaise) : "0.00"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Cash this jeweller owes the workshop</p>
        </div>
      </section>

      {/* Orders */}
      <section className="rounded-lg border p-4 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Orders ({partyOrders.length})
        </h3>
        {partyOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="divide-y">
            {partyOrders.map((o) => (
              <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                <Link to="/orders/$id" params={{ id: o.id }} className="hover:underline">
                  {o.orderNo} · {o.item.itemName}
                </Link>
                <Badge variant="outline">{ORDER_STATUS_LABELS[o.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Job Cards */}
      <section className="rounded-lg border p-4 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Hammer className="h-4 w-4" /> Job Cards ({partyJobs.length})
        </h3>
        {partyJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No job cards yet.</p>
        ) : (
          <ul className="divide-y">
            {partyJobs.map((j) => (
              <li key={j.id} className="py-2 flex items-center justify-between text-sm">
                <span>
                  {j.jobNo} · {j.itemName}
                </span>
                <Badge variant="outline">{JOB_STATUS_LABELS[j.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Manufacturing Bills */}
      <section className="rounded-lg border p-4 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Manufacturing Bills ({partyMfgBills.length})
        </h3>
        {partyMfgBills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manufacturing bills yet.</p>
        ) : (
          <ul className="divide-y">
            {partyMfgBills.map((b) => (
              <li key={b.id} className="py-2 flex items-center justify-between text-sm">
                <span>{b.jobNo}</span>
                <span className="text-muted-foreground">
                  Outstanding: {mgToGrams(b.goldOutstandingFineMg ?? 0)} g
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Gold Settlement vouchers */}
      <section className="rounded-lg border p-4 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Gold Settlement Vouchers ({partySettlements.length})
        </h3>
        {partySettlements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No settlement vouchers yet.</p>
        ) : (
          <ul className="divide-y">
            {partySettlements.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                <span>{s.settlement_type}</span>
                <span className="text-muted-foreground">
                  {new Date(s.settlement_date).toLocaleDateString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Payments */}
      <section className="rounded-lg border p-4 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Payments ({partyPayments.length})
        </h3>
        {partyPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y">
            {partyPayments.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                <span>
                  {p.invoiceNo} · {p.mode}
                </span>
                <span className="text-muted-foreground">₹{paiseToRupees(p.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Full transaction history — running gold + cash ledger */}
      <section className="rounded-lg border p-4 space-y-2">
        <h3 className="font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Full Transaction History
        </h3>
        {!ledger || ledger.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5 pr-3">Voucher</th>
                  <th className="py-1.5 pr-3">Type</th>
                  <th className="py-1.5 pr-3">Description</th>
                  <th className="py-1.5 pr-3 text-right">Gold Bal (g)</th>
                  <th className="py-1.5 pr-3 text-right">Cash Bal (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledger.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.date}</td>
                    <td className="py-1.5 pr-3">{r.voucherNo}</td>
                    <td className="py-1.5 pr-3">{r.type}</td>
                    <td className="py-1.5 pr-3">{r.description}</td>
                    <td className="py-1.5 pr-3 text-right">{mgToGrams(r.closingGoldMg)}</td>
                    <td className="py-1.5 pr-3 text-right">{paiseToRupees(r.closingMoneyPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
