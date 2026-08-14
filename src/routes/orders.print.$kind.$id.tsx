import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  useOrders,
  orderItems,
  orderTotals,
  productionTypeLabel,
  paiseToRupees,
} from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useAttachments, getAttachmentUrl } from "@/lib/attachments-store";
import { referenceImageDocKeys, LINE_REFERENCE_PREFIX } from "@/lib/job-card-engine";
import { mgToGrams } from "@/lib/gold";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { PrintQR } from "@/components/print-qr";
import { toast } from "sonner";
import type { PrintDocType } from "@/lib/printlog-store";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";

export const Route = createFileRoute("/orders/print/$kind/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Print · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

type Kind = "slip" | "gold-receipt" | "advance-receipt" | "old-gold-receipt";

function PrintPage() {
  const { firm, selectedBranchId, print } = useSettings();
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

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(order ? (docTypeMap[kind as Kind] ?? "order_slip") : null, id);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Reference images resolve from Supabase-backed storage. Full-size bytes,
  // not the row's inlined thumbnail, are used because a printed reference
  // photo is what the karigar works from.
  const attachmentItems = useAttachments((s) => s.items);
  const [referenceImages, setReferenceImages] = useState<
    Array<{ docKey: string; label: string; url: string }>
  >([]);
  const [loadingUrls, setLoadingUrls] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoadingUrls(false);
      return;
    }
    let cancelled = false;
    const docKeys = referenceImageDocKeys(id);

    if (docKeys.length === 0) {
      setLoadingUrls(false);
      return;
    }

    void Promise.all(
      docKeys.map(async (docKey) => {
        try {
          const url = await getAttachmentUrl("order", id, docKey);
          if (!url) return null;
          const rec = attachmentItems[`order:${id}:${docKey}`];
          if (rec?.mimeType && !rec.mimeType.startsWith("image/")) return null;
          const label = docKey.startsWith(LINE_REFERENCE_PREFIX)
            ? (rec?.fileName ?? "Reference")
            : docKey.replace(/_/g, " ");
          return { docKey, label, url };
        } catch (err) {
          console.warn(`[orders.print] could not load ${docKey}:`, err);
          return null;
        }
      }),
    ).then((rows) => {
      if (!cancelled) {
        setReferenceImages(rows.filter((r): r is NonNullable<typeof r> => !!r));
        setLoadingUrls(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, attachmentItems]);

  useEffect(() => {
    if (!loadingUrls) {
      document.documentElement.setAttribute("data-print-ready", "true");
    } else {
      document.documentElement.removeAttribute("data-print-ready");
    }
  }, [loadingUrls]);

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

    // An order can hold several pieces, so every gold/cash figure below sums
    // ALL of its line items — billing one line of a five-line order would
    // understate what the customer owes and what the vault is short.
    const itemCostPaise = (o: typeof order) =>
      orderItems(o).reduce((sum, it) => {
        const rupees =
          it.amountRupees !== undefined
            ? Number(it.amountRupees)
            : it.labourRupees !== undefined
              ? Number(it.labourRupees)
              : 0;
        return sum + rupees * 100;
      }, 0);

    for (const o of customerOrders) {
      if (o.createdAt < order.createdAt) {
        // Prev Gold: what they gave us (advance) - what we made (all items)
        const goldInMg = o.advance.goldFineMg || 0;
        const goldOutMg = orderTotals(o).fineMg;
        prevGoldMg += goldInMg - goldOutMg;

        // Prev Cash: what they paid us (advance) - what the items cost
        prevCashPaise += (o.advance.cashPaise || 0) - itemCostPaise(o);
      }
    }

    // Today's Entries
    const todayGoldInMg = order.advance.goldFineMg || 0;
    const todayGoldOutMg = orderTotals(order).fineMg;

    const todayCashInPaise = order.advance.cashPaise || 0;
    const todayCashOutPaise = itemCostPaise(order);

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
  const items = orderItems(order);
  const totals = orderTotals(order);

  const titles: Record<Kind, string> = {
    slip: "Order Slip",
    "gold-receipt": "Customer Gold Receipt",
    "advance-receipt": "Cash Advance Receipt",
    "old-gold-receipt": "Gold Received from Customer",
  };

  const title = titles[kind as Kind] ?? "Print";

  // Balance Side Labels settings
  const balanceSetting = print?.balanceSideLabels || "jama_naam";
  const jamaLabel = balanceSetting === "jama_naam" ? "Jama (Credit)" : "Credit (Jama)";
  const naamLabel = balanceSetting === "jama_naam" ? "Naam (Debit)" : "Debit (Naam)";

  const bid = (order as any).branchId || (order as any).branch_id || selectedBranchId || "MAIN";

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const { generateOrderPdf, generateOrderReceiptPdf } =
        await import("@/lib/pdf/document-pdf-generator");
      const dateStr = new Date(order!.createdAt || Date.now()).toLocaleDateString("en-IN", {
        dateStyle: "medium",
      });
      if (kind === "slip") {
        const blob = generateOrderPdf(order, firm);
        downloadBlob(blob, `Order-Slip-${order!.orderNo || order!.id}.pdf`);
      } else if (kind === "gold-receipt" || kind === "old-gold-receipt") {
        const blob = generateOrderReceiptPdf(
          {
            title,
            docNo: docNumber || order!.id,
            date: dateStr,
            orderNo: order!.orderNo,
            customerName: customer?.fullName ?? "—",
            customerPhone: customer?.phone,
            kind: "gold",
            goldLabel:
              order!.advance.goldKind === "old_gold"
                ? "Gold received from customer"
                : "Pure gold advance",
            goldGrossMg: order!.advance.goldGrossMg,
            goldPurity: order!.advance.goldPurity,
            goldFineMg: order!.advance.goldFineMg,
            goldTreatment:
              order!.advance.goldApplyMode === "apply"
                ? "Applied to this order."
                : "Held as customer gold credit.",
          },
          firm,
        );
        downloadBlob(blob, `${title.replace(/\s+/g, "-")}-${order!.orderNo}.pdf`);
      } else if (kind === "advance-receipt") {
        const blob = generateOrderReceiptPdf(
          {
            title,
            docNo: docNumber || order!.id,
            date: dateStr,
            orderNo: order!.orderNo,
            customerName: customer?.fullName ?? "—",
            customerPhone: customer?.phone,
            kind: "cash",
            cashPaise: order!.advance.cashPaise,
            cashMode: order!.advance.cashMode,
            cashRef: order!.advance.cashRef,
          },
          firm,
        );
        downloadBlob(blob, `Advance-Receipt-${order!.orderNo}.pdf`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title={title}
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/orders/${order.id}`}
        onDownloadPdf={handleDownloadPdf}
        downloadingPdf={downloadingPdf}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title={title}
          docNumber={docNumber}
          docType={docTypeMap[kind as Kind] ?? "order_slip"}
          recordId={order.id}
          createdAt={order.createdAt}
          size="a4"
          branchId={bid}
          showQR={false}
        >
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
              <div className="text-xs uppercase text-gray-500">Production type</div>
              <div>{productionTypeLabel(order)}</div>
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
                    {items.map((it, i) => (
                      <tr key={it.lineId ?? i} className="border-t border-gray-200">
                        <td className="p-2 font-medium">{it.itemName}</td>
                        <td className="p-2 font-mono text-gray-600">{it.stamp || "—"}</td>
                        <td className="p-2 text-right font-mono">{mgToGrams(it.grossMg)}</td>
                        <td className="p-2 text-right font-mono">{mgToGrams(it.addMg || 0)}</td>
                        <td className="p-2 text-right font-mono">{mgToGrams(it.lessMg)}</td>
                        <td className="p-2 text-right font-mono font-semibold">
                          {mgToGrams(it.netMg)}
                        </td>
                        <td className="p-2 text-right font-mono">{it.purity / 10}%</td>
                        <td className="p-2 text-right font-mono">{it.expectedWastagePct || 0}%</td>
                        <td className="p-2 text-right font-mono">{it.quantity}</td>
                        <td className="p-2 text-right font-mono">
                          {it.labourRupees !== undefined ? `₹${it.labourRupees}` : "—"}
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-yellow-800">
                          {mgToGrams(it.fineMg)}
                        </td>
                        <td className="p-2 text-right font-mono font-semibold">
                          {it.amountRupees !== undefined ? `₹${it.amountRupees}` : "—"}
                        </td>
                      </tr>
                    ))}
                    {items.length > 1 && (
                      <tr className="border-t-2 border-gray-400 bg-gray-50 font-semibold">
                        <td className="p-2" colSpan={2}>
                          Total ({items.length} items)
                        </td>
                        <td className="p-2 text-right font-mono">{mgToGrams(totals.grossMg)}</td>
                        <td className="p-2" colSpan={2} />
                        <td className="p-2 text-right font-mono">{mgToGrams(totals.netMg)}</td>
                        <td className="p-2" colSpan={2} />
                        <td className="p-2 text-right font-mono">{totals.quantity}</td>
                        <td className="p-2" />
                        <td className="p-2 text-right font-mono text-yellow-800">
                          {mgToGrams(totals.fineMg)}
                        </td>
                        <td className="p-2" />
                      </tr>
                    )}
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

              {/* Reference images — the piece the karigar is actually making.
                  Resolved full-size from document storage (not the 240px
                  thumbnail), and embedded as data: URLs by the print engine, so
                  they survive the print window. */}
              {referenceImages.length > 0 && (
                <section className="mb-4">
                  <div className="font-medium text-sm mb-2">Reference Images</div>
                  <div className="grid grid-cols-3 gap-2">
                    {referenceImages.map((ref) => (
                      <figure key={ref.docKey} className="border border-gray-300 rounded p-1">
                        <img
                          src={ref.url}
                          alt={ref.label}
                          className="w-full h-32 object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <figcaption className="text-[10px] text-gray-500 text-center mt-1">
                          {ref.label}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
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
                        ? // A jeweller supplying a manufacturer often hands over
                          // fresh bullion or scrap, not worn jewellery — calling
                          // it all "old gold" is retail language and misdescribes
                          // what is actually on the receipt.
                          "Gold received from customer"
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
        </PrintLayout>
      </div>
    </div>
  );
}
