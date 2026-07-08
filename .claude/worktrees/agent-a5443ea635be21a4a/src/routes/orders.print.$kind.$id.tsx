import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useOrders, ORDER_TYPE_LABELS, paiseToRupees } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer, RotateCw } from "lucide-react";
import { useRecordPrintOnce } from "@/lib/use-print-recorder";
import { ReprintReasonDialog } from "@/components/reprint-dialog";
import { PrintQR } from "@/components/print-qr";
import type { PrintDocType } from "@/lib/printlog-store";
import { useSettings } from "@/lib/settings-store";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { PrintHeader } from "@/components/print-header";

export const Route = createFileRoute("/orders/print/$kind/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || shopName.slice(0, 3).toUpperCase();
    return {
      meta: [{ title: `Print · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

type Kind = "slip" | "gold-receipt" | "advance-receipt" | "old-gold-receipt";

function PrintPage() {
  const { firm, branches, selectedBranchId, print } = useSettings();
  const params = useParams({ from: "/orders/print/$kind/$id" });
  const id = params.id;
  const KIND_ALIASES: Record<string, string> = {
    "customer-gold": "gold-receipt",
    "old-gold": "old-gold-receipt",
    advance: "advance-receipt",
  };
  const kind = KIND_ALIASES[params.kind] ?? params.kind;
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  const people = usePeople((s) => s.people);

  const docTypeMap: Record<Kind, PrintDocType> = {
    slip: "order_slip",
    "gold-receipt": "gold_receipt",
    "advance-receipt": "advance_receipt",
    "old-gold-receipt": "old_gold_receipt",
  };

  const { reprintOpen, requestReprint, closeReprint, doReprint } = useRecordPrintOnce({
    docType: docTypeMap[kind as Kind] ?? "order_slip",
    docNumber: order?.orderNo ?? "",
    linkedId: order?.id ?? "",
    linkedLabel: order ? `${order.orderNo} · ${order.item.itemName}` : "",
  });

  // Get all orders for this customer to calculate running ledger balances
  const allOrders = useOrders((s) => s.orders);
  const customerOrders = useMemo(() => {
    if (!order) return [];
    return allOrders
      .filter((o) => o.customerId === order.customerId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allOrders, order]);

  const ledgerBalances = useMemo(() => {
    if (!order) {
      return {
        prevGoldMg: 0,
        prevCashPaise: 0,
        todayGoldInMg: 0,
        todayGoldOutMg: 0,
        todayCashInPaise: 0,
        todayCashOutPaise: 0,
        closingGoldMg: 0,
        closingCashPaise: 0,
      };
    }
    let prevGoldMg = 0;
    let prevCashPaise = 0;

    for (const o of customerOrders) {
      if (o.createdAt < order.createdAt) {
        // Prev Gold: what they gave us (advance) - what we made (item)
        const goldInMg = o.advance.goldFineMg || 0;
        const goldOutMg = o.item.fineMg || 0;
        prevGoldMg += goldInMg - goldOutMg;

        // Prev Cash: what they paid us (advance) - what the item cost (amount or labour)
        const cashInPaise = o.advance.cashPaise || 0;
        const itemCostRupees =
          o.item.amountRupees !== undefined
            ? Number(o.item.amountRupees)
            : o.item.labourRupees !== undefined
              ? Number(o.item.labourRupees)
              : 0;
        const cashOutPaise = itemCostRupees * 100;
        prevCashPaise += cashInPaise - cashOutPaise;
      }
    }

    // Today's Entries
    const todayGoldInMg = order.advance.goldFineMg || 0;
    const todayGoldOutMg = order.item.fineMg || 0;

    const todayCashInPaise = order.advance.cashPaise || 0;
    const todayItemCostRupees =
      order.item.amountRupees !== undefined
        ? Number(order.item.amountRupees)
        : order.item.labourRupees !== undefined
          ? Number(order.item.labourRupees)
          : 0;
    const todayCashOutPaise = todayItemCostRupees * 100;

    // Totals
    const closingGoldMg = prevGoldMg + todayGoldInMg - todayGoldOutMg;
    const closingCashPaise = prevCashPaise + todayCashInPaise - todayCashOutPaise;

    return {
      prevGoldMg,
      prevCashPaise,
      todayGoldInMg,
      todayGoldOutMg,
      todayCashInPaise,
      todayCashOutPaise,
      closingGoldMg,
      closingCashPaise,
    };
  }, [customerOrders, order]);

  if (!order) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Order not found</h1>
          <Link to="/orders" className="text-gold underline">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const customer = people.find((p) => p.id === order.customerId);
  const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;

  const titles: Record<Kind, string> = {
    slip: "Order Slip",
    "gold-receipt": "Customer Gold Receipt",
    "advance-receipt": "Cash Advance Receipt",
    "old-gold-receipt": "Old Gold Received Receipt",
  };

  const title = titles[kind as Kind] ?? "Print";

  // Balance Side Labels settings
  const balanceSetting = print?.balanceSideLabels || "jama_naam";
  const jamaLabel = balanceSetting === "jama_naam" ? "Jama (Credit)" : "Credit (Jama)";
  const naamLabel = balanceSetting === "jama_naam" ? "Naam (Debit)" : "Debit (Naam)";

  const bid = (order as any).branchId || (order as any).branch_id || selectedBranchId || "MAIN";
  const branch = branches.find((b) => b.id === bid) || branches[0];
  const address = branch && branch.address ? branch.address : firm.address;
  const phone = branch && branch.phone ? branch.phone : firm.phone;
  const gstin = branch && branch.gstin ? branch.gstin : firm.gstin;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="no-print sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center justify-between">
        <Link
          to="/orders/$id"
          params={{ id: order.id }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to order
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={requestReprint} className="gap-2">
            <RotateCw className="h-4 w-4" /> Reprint
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>
      <ReprintReasonDialog open={reprintOpen} onClose={closeReprint} onConfirm={doReprint} />

      <div className="max-w-3xl mx-auto p-8 print:p-0">
        <div className="bg-white text-black rounded-lg p-8 print:rounded-none print:shadow-none shadow">
          {/* Header */}
          <header className="flex items-center justify-between border-b-2 border-yellow-700 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <Logo variant="svg" className="h-12 w-12 object-contain" />
              <div>
                <div className="font-serif text-2xl text-yellow-800">{firm.shopName}</div>
                {branch && branch.id !== "MAIN" && (
                  <div className="text-xs font-semibold text-gray-700">({branch.name})</div>
                )}
                <div className="text-[10px] text-gray-600 space-y-0.5 mt-1">
                  {address && <div>{address}</div>}
                  {phone && <div>Tel: {phone}</div>}
                  {gstin && <div className="font-mono font-bold">GSTIN: {gstin}</div>}
                  {!address && !phone && !gstin && (
                    <div>Gold Jewellery · Manufacturing &amp; Retail</div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-gray-600">{title}</div>
              <div className="font-mono text-sm">{order.orderNo}</div>
              <div className="text-xs text-gray-600">
                {new Date(order.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
          </header>

          {/* Customer */}
          <section className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="text-xs uppercase text-gray-500">Customer</div>
              <div className="font-medium">{customer?.fullName ?? "—"}</div>
              <div className="text-xs">{customer?.phone ?? ""}</div>
              {customer?.currentAddress && <div className="text-xs">{customer.currentAddress}</div>}
              {customer?.gstin && <div className="text-xs">GSTIN: {customer.gstin}</div>}
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Order type</div>
              <div>{ORDER_TYPE_LABELS[order.type]}</div>
              <div className="text-xs uppercase text-gray-500 mt-2">Expected delivery</div>
              <div>{order.expectedDelivery || "—"}</div>
            </div>
          </section>

          {/* Body by kind */}
          {kind === "slip" && (
            <>
              {/* Item Details Table (12 columns) */}
              <section className="border border-gray-300 rounded mb-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b border-gray-300 font-semibold text-gray-700">
                    <tr>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left">Stamp</th>
                      <th className="p-2 text-right">G. Wt.</th>
                      <th className="p-2 text-right">Add Wt.</th>
                      <th className="p-2 text-right">Less</th>
                      <th className="p-2 text-right">Net Wt.</th>
                      <th className="p-2 text-right">Touch</th>
                      <th className="p-2 text-right">Wstg</th>
                      <th className="p-2 text-right">Pcs</th>
                      <th className="p-2 text-right">Labour</th>
                      <th className="p-2 text-right">Gold</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-200">
                      <td className="p-2 font-medium">{order.item.itemName}</td>
                      <td className="p-2 font-mono text-gray-600">{order.item.stamp || "—"}</td>
                      <td className="p-2 text-right font-mono">{mgToGrams(order.item.grossMg)}</td>
                      <td className="p-2 text-right font-mono">
                        {mgToGrams(order.item.addMg || 0)}
                      </td>
                      <td className="p-2 text-right font-mono">{mgToGrams(order.item.lessMg)}</td>
                      <td className="p-2 text-right font-mono font-semibold">
                        {mgToGrams(order.item.netMg)}
                      </td>
                      <td className="p-2 text-right font-mono">{order.item.purity / 10}%</td>
                      <td className="p-2 text-right font-mono">
                        {order.item.expectedWastagePct || 0}%
                      </td>
                      <td className="p-2 text-right font-mono">{order.item.quantity}</td>
                      <td className="p-2 text-right font-mono">
                        {order.item.labourRupees !== undefined
                          ? `₹${order.item.labourRupees}`
                          : "—"}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold text-yellow-800">
                        {mgToGrams(order.item.fineMg)}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold">
                        {order.item.amountRupees !== undefined
                          ? `₹${order.item.amountRupees}`
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* Ledger Balance Section */}
              <section className="grid md:grid-cols-2 gap-4 text-sm mb-6 border border-gray-200 rounded p-4 bg-gray-50">
                {/* Gold Ledger Side */}
                <div className="space-y-2 border-r border-gray-200 pr-4">
                  <h4 className="font-semibold text-yellow-800 border-b pb-1 flex justify-between">
                    <span>GOLD LEDGER SUMMARY</span>
                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded uppercase font-bold">
                      {balanceSetting === "jama_naam" ? "JAMA / NAAM" : "CREDIT / DEBIT"}
                    </span>
                  </h4>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Previous Gold Balance:</span>
                    <span className="font-mono font-medium">
                      {mgToGrams(Math.abs(ledgerBalances.prevGoldMg))} g{" "}
                      <span className="text-[10px] font-bold text-gray-500">
                        ({ledgerBalances.prevGoldMg >= 0 ? jamaLabel : naamLabel})
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-green-700 bg-green-50 px-1 py-0.5 rounded">
                    <span>Today's Gold Received (Advance):</span>
                    <span className="font-mono font-medium">
                      +{mgToGrams(ledgerBalances.todayGoldInMg)} g ({jamaLabel})
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-red-700 bg-red-50 px-1 py-0.5 rounded">
                    <span>Today's Gold Outstanding (Item):</span>
                    <span className="font-mono font-medium">
                      -{mgToGrams(ledgerBalances.todayGoldOutMg)} g ({naamLabel})
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold pt-1 border-t border-dashed">
                    <span>Net Closing Gold Balance:</span>
                    <span className="font-mono text-yellow-800">
                      {mgToGrams(Math.abs(ledgerBalances.closingGoldMg))} g{" "}
                      <span className="text-[10px] font-bold">
                        (
                        {ledgerBalances.closingGoldMg >= 0
                          ? `${jamaLabel} (We owe customer)`
                          : `${naamLabel} (Customer owes us)`}
                        )
                      </span>
                    </span>
                  </div>
                </div>

                {/* Cash/Amount Ledger Side */}
                <div className="space-y-2 pl-2">
                  <h4 className="font-semibold text-gray-800 border-b pb-1">CASH LEDGER SUMMARY</h4>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Previous Cash Balance:</span>
                    <span className="font-mono font-medium">
                      ₹ {Math.abs(ledgerBalances.prevCashPaise / 100).toLocaleString("en-IN")}{" "}
                      <span className="text-[10px] font-bold text-gray-500">
                        ({ledgerBalances.prevCashPaise >= 0 ? jamaLabel : naamLabel})
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-green-700 bg-green-50 px-1 py-0.5 rounded">
                    <span>Today's Cash Paid (Advance):</span>
                    <span className="font-mono font-medium">
                      +₹ {Math.abs(ledgerBalances.todayCashInPaise / 100).toLocaleString("en-IN")} (
                      {jamaLabel})
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-red-700 bg-red-50 px-1 py-0.5 rounded">
                    <span>Today's Item Value (Charge):</span>
                    <span className="font-mono font-medium">
                      -₹ {Math.abs(ledgerBalances.todayCashOutPaise / 100).toLocaleString("en-IN")}{" "}
                      ({naamLabel})
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold pt-1 border-t border-dashed">
                    <span>Net Closing Cash Balance:</span>
                    <span className="font-mono text-gray-800">
                      ₹ {Math.abs(ledgerBalances.closingCashPaise / 100).toLocaleString("en-IN")}{" "}
                      <span className="text-[10px] font-bold">
                        (
                        {ledgerBalances.closingCashPaise >= 0
                          ? `${jamaLabel} (We owe customer)`
                          : `${naamLabel} (Customer owes us)`}
                        )
                      </span>
                    </span>
                  </div>
                </div>
              </section>

              {karigar && (
                <section className="text-sm mb-4">
                  <div className="font-medium">Assigned karigar: {karigar.fullName}</div>
                </section>
              )}

              {(order.design.designNumber || order.design.pattern || order.design.notes) && (
                <section className="text-sm mb-4">
                  <div className="font-medium">Design &amp; Custom Comments</div>
                  <div className="text-xs">
                    {order.design.designNumber ? `Design no: ${order.design.designNumber} · ` : ""}
                    {order.design.pattern || ""}
                  </div>
                  {order.design.notes && <div className="text-xs italic">{order.design.notes}</div>}
                </section>
              )}

              <div className="text-right text-[10px] text-gray-400 mt-2">Page 1 of 1</div>
            </>
          )}

          {(kind === "gold-receipt" || kind === "old-gold-receipt") && (
            <section className="text-sm mb-4">
              <p className="mb-3">
                Received from <b>{customer?.fullName}</b> the following gold for the above order:
              </p>
              <table className="w-full text-sm border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Kind</th>
                    <th className="text-right p-2">Gross (g)</th>
                    <th className="text-right p-2">Purity</th>
                    <th className="text-right p-2">Fine (g)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="p-2">
                      {order.advance.goldKind === "old_gold"
                        ? "Old gold / jewellery"
                        : "Pure gold advance"}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {mgToGrams(order.advance.goldGrossMg)}
                    </td>
                    <td className="p-2 text-right">{order.advance.goldPurity}</td>
                    <td className="p-2 text-right font-mono">
                      {mgToGrams(order.advance.goldFineMg)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs mt-2">
                Treatment:{" "}
                {order.advance.goldApplyMode === "apply"
                  ? "Applied to this order."
                  : "Held as customer gold credit."}
              </p>
            </section>
          )}

          {kind === "advance-receipt" && (
            <section className="text-sm mb-4">
              <p>
                Received <b>₹ {paiseToRupees(order.advance.cashPaise)}</b> from{" "}
                <b>{customer?.fullName}</b> as cash advance ({order.advance.cashMode}) towards order{" "}
                {order.orderNo}.
              </p>
              {order.advance.cashRef && (
                <p className="text-xs mt-1">Reference: {order.advance.cashRef}</p>
              )}
            </section>
          )}

          {/* Signatures */}
          <footer className="mt-12 grid grid-cols-[1fr_auto_1fr] gap-8 text-sm items-end">
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelLeft || "Customer signature"}
              </div>
            </div>
            <PrintQR
              docType={docTypeMap[kind as Kind] ?? "order_slip"}
              docNumber={order.orderNo}
              recordId={order.id}
              createdAt={order.createdAt}
            />
            <div className="text-right">
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelRight || "Authorised Signatory"}
              </div>
            </div>
          </footer>
          <AvsPrintFooter />
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
        }
      `}</style>
    </div>
  );
}
