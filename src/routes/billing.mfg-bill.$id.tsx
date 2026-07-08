import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/billing/mfg-bill/$id")({
  head: () => ({ meta: [{ title: "Manufacturing Bill · AVS Gold ERP" }] }),
  component: MfgBillPrint,
});

function MfgBillPrint() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/billing/mfg-bill/$id" });
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));

  if (!inv) return <div className="p-8">Invoice not found.</div>;

  const today = new Date(inv.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Parse manufacturing metadata stored in invoice notes (best-effort)
  // Items are the P (gold given) entries; use item fields with manufacturing semantics:
  //   category = Stamp, stoneWeightMg = Add Wt, otherChargesPaise = Wastage%×100,
  //   diamondWeightMg = Pcs, stoneChargesPaise = Labour (paise), fineMg = Fine gold
  const pEntries = inv.items;
  // Fine = Net × (Tunch% + Wstg%) / 100 — manufacturing formula, NOT standard purity/1000
  const totalPFineMg = pEntries.reduce((s, it) => {
    const tunchPct = (it.purity ?? 0) / 10;
    const wstgPct = it.otherChargesPaise / 100;
    return s + Math.round((it.netMg * (tunchPct + wstgPct)) / 100);
  }, 0);

  const totalCashPaise = inv.payments.reduce((s, p) => {
    if (p.mode === "cash") return s + p.amountPaise;
    return s;
  }, 0);

  // Try to parse MP entries and other mfg data from invoice notes JSON
  let lbMg = 0;
  let bhavRate = 0;
  type MpEntry = {
    label: string;
    grossMg: number;
    purity: number;
    pcs: number;
    fineMg: number;
    type: string;
  };
  let mpEntries: MpEntry[] = [];
  try {
    const jsonMatch = inv.notes?.match(/\[\[MFG:(.*?)\]\]/s);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);
      lbMg = data.lbMg ?? 0;
      bhavRate = data.bhavRate ?? 0;
      mpEntries = data.mpEntries ?? [];
    }
  } catch {
    /* no-op */
  }

  const totalMpFineMg = mpEntries.reduce((s: number, e: MpEntry) => s + e.fineMg, 0);
  // P entries ADD to karigar's debit (they owe more → more negative)
  const netAfterLB = lbMg - totalPFineMg;
  // bhav: cash paid → gold equivalent reduces karigar's debit
  const bhavGoldMg =
    bhavRate > 0 && totalCashPaise > 0 ? Math.round((totalCashPaise / (bhavRate * 10)) * 10000) : 0;
  const closingMg = netAfterLB + totalMpFineMg + bhavGoldMg;

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8 print:bg-white print:p-0">
      {/* Toolbar */}
      <div className="flex gap-2 mb-4 print:hidden">
        <Link to="/billing/$id" params={{ id: inv.id }}>
          <Button variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Button onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print Manufacturing Bill
        </Button>
      </div>

      {/* A4 Bill */}
      <div
        className="bg-white shadow-xl mx-auto print:shadow-none"
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "10mm 12mm",
          fontFamily: "monospace, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "6mm",
            borderBottom: "2px solid #000",
            paddingBottom: "3mm",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2mm" }}>
            <Logo variant="png" className="h-10 w-10 object-contain" />
          </div>
          <div style={{ fontSize: "15pt", fontWeight: 900, letterSpacing: "0.5mm" }}>
            {firm?.shopName}
          </div>
          {firm.address && <div style={{ fontSize: "8pt" }}>{firm.address}</div>}
          <div style={{ fontSize: "9pt", fontWeight: 700, marginTop: "2mm" }}>
            MANUFACTURING BILL — कारीगर बिल
          </div>
        </div>

        {/* Bill Meta */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "8pt",
            marginBottom: "4mm",
          }}
        >
          <div>
            <strong>Bill No:</strong> {inv.invoiceNo}
            <br />
            <strong>Karigar:</strong> {inv.customerName}
            <br />
            {inv.customerPhone && (
              <>
                <strong>Phone:</strong> {inv.customerPhone}
              </>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>Date:</strong> {today}
            <br />
            <strong>Type:</strong> Manufacturing Bill
          </div>
        </div>

        {/* P Entries — Gold Given to Karigar */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "7.5pt",
            marginBottom: "2mm",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f0f0f0",
                borderTop: "1px solid #000",
                borderBottom: "1px solid #000",
              }}
            >
              <th style={{ padding: "1.5mm 2mm", textAlign: "left", width: "5%" }}>Ref</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "left", width: "22%" }}>Description</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "center", width: "8%" }}>Stamp</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "9%" }}>G.Wt (g)</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "8%" }}>Add Wt</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "8%" }}>Less</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "9%" }}>Net Wt</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "7%" }}>Tunch</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "7%" }}>Wstg%</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "6%" }}>Pcs</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "8%" }}>Labour</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "9%" }}>Fine (g)</th>
              <th style={{ padding: "1.5mm 2mm", textAlign: "right", width: "10%" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {pEntries.map((it, i) => {
              const grossG = parseFloat(mgToGrams(it.grossMg));
              const netG = parseFloat(mgToGrams(it.netMg));
              const addWtG = parseFloat(mgToGrams(it.stoneWeightMg ?? 0));
              const tunchPct = (it.purity ?? 0) / 10; // purity per-mille → tunch per 100
              const wstgPct2 = it.otherChargesPaise / 100;
              const fineG = (it.netMg * (tunchPct + wstgPct2)) / 100000; // mg→g
              const addWt = addWtG;
              const tunch = tunchPct.toFixed(2);
              const wstgPct = wstgPct2.toFixed(2);
              const pcs = it.diamondWeightMg ?? 1;
              const labourAmt =
                it.stoneChargesPaise > 0 ? `₹${paiseToRupees(it.stoneChargesPaise)}` : "—";
              const lineTotal =
                it.lineTotalPaise > 0 ? `₹${paiseToRupees(it.lineTotalPaise)}` : "—";
              return (
                <tr key={it.id} style={{ borderBottom: "0.5px solid #ccc" }}>
                  <td style={{ padding: "1.5mm 2mm" }}>P{i + 1}</td>
                  <td style={{ padding: "1.5mm 2mm" }}>{it.itemName}</td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "center" }}>
                    {it.category || "—"}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {grossG.toFixed(3)}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {addWt > 0 ? addWt.toFixed(3) : "—"}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    —
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {netG.toFixed(3)}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {tunch}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {wstgPct}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {pcs}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {labourAmt}
                  </td>
                  <td
                    style={{
                      padding: "1.5mm 2mm",
                      textAlign: "right",
                      fontFamily: "monospace",
                      fontWeight: 700,
                    }}
                  >
                    {fineG.toFixed(3)}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {lineTotal}
                  </td>
                </tr>
              );
            })}
            {/* Total row for P entries */}
            <tr style={{ borderTop: "1px solid #000", fontWeight: 900 }}>
              <td colSpan={11} style={{ padding: "1.5mm 2mm", textAlign: "right" }}>
                Total Fine Gold Given
              </td>
              <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                {(totalPFineMg / 1000).toFixed(3)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* LB — Opening Balance */}
        {lbMg !== 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "8pt",
              marginBottom: "1mm",
            }}
          >
            <tbody>
              <tr style={{ borderBottom: "0.5px solid #ccc" }}>
                <td style={{ padding: "1.5mm 2mm", width: "60%" }}>
                  <strong>LB — Ledger Balance (Previous Karigar Account)</strong>
                </td>
                <td
                  style={{
                    padding: "1.5mm 2mm",
                    textAlign: "right",
                    fontFamily: "monospace",
                    color: lbMg < 0 ? "#b91c1c" : "#15803d",
                  }}
                >
                  G {lbMg >= 0 ? "+" : ""}
                  {(lbMg / 1000).toFixed(3)}
                </td>
                <td style={{ width: "15%" }}></td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Net Total line */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "8pt",
            marginBottom: "2mm",
          }}
        >
          <tbody>
            <tr
              style={{
                background: "#f5f5f5",
                borderTop: "1px solid #000",
                borderBottom: "1px solid #000",
                fontWeight: 900,
              }}
            >
              <td style={{ padding: "1.5mm 2mm", width: "60%" }}>NET TOTAL (After LB)</td>
              <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                G {(netAfterLB / 1000).toFixed(3)}
              </td>
              <td style={{ width: "15%" }}></td>
            </tr>
          </tbody>
        </table>

        {/* MP Entries — Metal Received from Karigar */}
        {mpEntries.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "8pt",
              marginBottom: "2mm",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#e8f5e9",
                  borderTop: "1px solid #000",
                  borderBottom: "1px solid #000",
                }}
              >
                <th style={{ padding: "1.5mm 2mm", textAlign: "left" }}>Receipt Type</th>
                <th style={{ padding: "1.5mm 2mm", textAlign: "right" }}>G.Wt (g)</th>
                <th style={{ padding: "1.5mm 2mm", textAlign: "right" }}>Tunch%</th>
                <th style={{ padding: "1.5mm 2mm", textAlign: "right" }}>Pcs</th>
                <th style={{ padding: "1.5mm 2mm", textAlign: "right" }}>Fine (g)</th>
              </tr>
            </thead>
            <tbody>
              {mpEntries.map((e: MpEntry, i: number) => (
                <tr key={i} style={{ borderBottom: "0.5px solid #ccc" }}>
                  <td style={{ padding: "1.5mm 2mm", fontWeight: 700 }}>{e.label}</td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {(e.grossMg / 1000).toFixed(3)}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {e.purity.toFixed(2)}
                  </td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", fontFamily: "monospace" }}>
                    {e.pcs}
                  </td>
                  <td
                    style={{
                      padding: "1.5mm 2mm",
                      textAlign: "right",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: "#d97706",
                    }}
                  >
                    {(e.fineMg / 1000).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Cash Payment */}
        {totalCashPaise > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "8pt",
              marginBottom: "1mm",
            }}
          >
            <tbody>
              <tr style={{ borderBottom: "0.5px solid #ccc" }}>
                <td style={{ padding: "1.5mm 2mm", width: "60%", fontWeight: 700 }}>
                  PAYMENT CASH
                </td>
                <td
                  style={{
                    padding: "1.5mm 2mm",
                    textAlign: "right",
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                >
                  ₹ {paiseToRupees(totalCashPaise)}
                </td>
                <td style={{ width: "15%" }}></td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Gold Bhav Cash Conversion */}
        {bhavRate > 0 && totalCashPaise > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "8pt",
              marginBottom: "2mm",
            }}
          >
            <tbody>
              <tr style={{ borderBottom: "0.5px solid #ccc" }}>
                <td style={{ padding: "1.5mm 2mm", width: "60%", fontWeight: 700 }}>
                  P.GOLD BHAV @{bhavRate} → Cash → Fine
                </td>
                <td
                  style={{
                    padding: "1.5mm 2mm",
                    textAlign: "right",
                    fontFamily: "monospace",
                    color: "#15803d",
                    fontWeight: 700,
                  }}
                >
                  G {(bhavGoldMg / 1000).toFixed(3)}
                </td>
                <td
                  style={{
                    padding: "1.5mm 2mm",
                    textAlign: "right",
                    fontFamily: "monospace",
                    color: "#b91c1c",
                  }}
                >
                  - ₹ {paiseToRupees(totalCashPaise)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Closing Balance — matches reference format: G -xxx.xxx | Jama | Nil */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10pt",
            marginBottom: "4mm",
          }}
        >
          <tbody>
            <tr
              style={{
                background: "#f8f8f8",
                borderTop: "2px solid #000",
                borderBottom: "2px solid #000",
                fontWeight: 900,
              }}
            >
              <td style={{ padding: "2mm 2mm", fontSize: "9pt", width: "40%" }}>Closing Balance</td>
              <td
                style={{
                  padding: "2mm 2mm",
                  textAlign: "right",
                  fontFamily: "monospace",
                  fontSize: "11pt",
                  color: "#b91c1c",
                  width: "30%",
                }}
              >
                G {(closingMg / 1000).toFixed(3)}
              </td>
              <td
                style={{
                  padding: "2mm 2mm",
                  textAlign: "center",
                  fontSize: "9pt",
                  fontStyle: "italic",
                  width: "15%",
                }}
              >
                {closingMg < 0 ? "Jama" : closingMg === 0 ? "Settled" : "Udhar"}
              </td>
              <td
                style={{
                  padding: "2mm 2mm",
                  textAlign: "right",
                  fontFamily: "monospace",
                  fontSize: "10pt",
                  width: "15%",
                }}
              >
                {totalCashPaise > 0 ? `₹${paiseToRupees(totalCashPaise)}` : "Nil"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Terms */}
        <div
          style={{
            fontSize: "7pt",
            color: "#666",
            borderTop: "1px solid #ccc",
            paddingTop: "3mm",
            marginTop: "4mm",
          }}
        >
          <p>
            This is a manufacturing account ledger bill. Gold weights are in grams. Fine gold is
            calculated as Gross × Tunch / 100.
          </p>
          <p style={{ marginTop: "1mm" }}>
            Karigar Account | {firm.shopName} | {today}
          </p>
        </div>

        {/* Signature */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "12mm",
            fontSize: "8pt",
          }}
        >
          <div
            style={{
              textAlign: "center",
              borderTop: "1px solid #000",
              paddingTop: "2mm",
              minWidth: "50mm",
            }}
          >
            Karigar Signature
          </div>
          <div
            style={{
              textAlign: "center",
              borderTop: "1px solid #000",
              paddingTop: "2mm",
              minWidth: "50mm",
            }}
          >
            Authorised By — {firm.shopName}
          </div>
        </div>
      </div>
    </div>
  );
}
