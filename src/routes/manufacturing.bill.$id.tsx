/**
 * Manufacturing Bill — View, Print, and Delivery Actions
 *
 * Shows the finalised bill with full gold summary, karigar settlement,
 * and action buttons: Print, Create Delivery Invoice, Mark Delivered.
 */
import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMfgBills, MFG_BILL_STATUS_LABELS } from "@/lib/manufacturing-bill-store";
import { useSettings } from "@/lib/settings-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import {
  ArrowLeft,
  Printer,
  Truck,
  CheckCircle2,
  ArrowRight,
  Scale,
  PackageCheck,
  IndianRupee,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/manufacturing/bill/$id")({
  head: () => ({ meta: [{ title: "Manufacturing Bill · AVS Gold ERP" }] }),
  component: MfgBillView,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted/40 text-muted-foreground border-border",
  finalised: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  delivered: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  settled: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const MG_TO_G = (mg: number) => (mg / 1000).toFixed(3);

export default function MfgBillView() {
  const { id } = useParams({ from: "/manufacturing/bill/$id" });
  const navigate = useNavigate();
  const { bills, patchBill } = useMfgBills();
  const { firm } = useSettings();
  const { config: wf } = useWorkflowEngine();
  const [deliverOpen, setDeliverOpen] = useState(false);

  const bill = bills.find((b) => b.id === id)!;

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(bill ? "manufacturing_bill" : null, id);

  if (!bill) {
    return (
      <div className="p-8 text-center space-y-2">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="font-semibold">Manufacturing Bill not found</p>
        <Link to="/manufacturing">
          <Button variant="outline" size="sm">
            ← Back
          </Button>
        </Link>
      </div>
    );
  }

  const totalPFine = bill.pEntries.reduce((s, e) => s + e.fineMg, 0);
  const totalMpFine = bill.mpEntries.reduce((s, e) => s + e.fineMg, 0);
  const totalCharges =
    bill.labourChargesPaise +
    bill.makingChargesPaise +
    bill.stoneChargesPaise +
    bill.stoneSettingPaise +
    bill.hallmarkChargesPaise +
    bill.huidChargesPaise +
    bill.outsideWorkChargesPaise +
    bill.polishingChargesPaise +
    bill.otherChargesPaise +
    bill.pEntries.reduce((s, e) => s + e.labourPaise, 0);

  const dateStr = new Date(bill.finalisedAt ?? bill.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  async function handleMarkDelivered() {
    await patchBill(bill.id, { status: "delivered" });
    toast.success("Order marked as Delivered");
    setDeliverOpen(false);
  }

  async function handleCreateDeliveryInvoice() {
    // Navigate to billing with pre-filled info from this mfg bill
    navigate({
      to: "/billing/new",
      search: {
        fromMfgBill: bill.id,
        customerId: bill.customerId,
        orderId: bill.orderId,
      } as Record<string, string>,
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/manufacturing">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">{bill.billNo}</h1>
            <p className="text-xs text-muted-foreground">
              {bill.itemName} · {bill.customerName}
            </p>
          </div>
          <Badge className={`border text-xs ${STATUS_COLORS[bill.status]}`}>
            {MFG_BILL_STATUS_LABELS[bill.status]}
          </Badge>
          {wf.mfgApprovalRequired && (
            <Badge
              variant="outline"
              className={`text-xs ${bill.approved ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"}`}
            >
              {bill.approved ? "Approved" : "Pending Approval"}
            </Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {bill.status === "draft" && (
            <Link to="/manufacturing/bill/new/$jobId" params={{ jobId: bill.jobCardId }}>
              <Button variant="outline" size="sm">
                Edit Draft
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handlePrintTrigger}
            data-testid="mfg-bill-print"
          >
            <Printer className="h-4 w-4" />
            {isReprint ? `Reprint (${reprintCount})` : "Print Bill"}
          </Button>
          {bill.status === "finalised" && (
            <>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                onClick={handleCreateDeliveryInvoice}
              >
                <IndianRupee className="h-4 w-4" /> Create Delivery Invoice
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                onClick={() => setDeliverOpen(true)}
              >
                <Truck className="h-4 w-4" /> Mark Delivered
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Gold Position — always visible on screen, not just in the printed
          document, so outstanding gold is never hidden behind a scroll or a
          print action. Gold is the primary accounting unit here; cash is a
          secondary/reference figure shown further down. ── */}
      <div className="print:hidden rounded-2xl border-2 border-gold/40 bg-gold/5 p-4 md:p-5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-gold mb-3">
          Gold Position — Primary Accounting Unit
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-0.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              Gold Required
            </div>
            <div className="font-mono font-bold text-base text-blue-400">
              {MG_TO_G(bill.totalGoldIssuedFineMg)} g
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              Gold Returned
            </div>
            <div className="font-mono font-bold text-base text-emerald-400">
              {MG_TO_G(bill.totalGoldReturnedFineMg)} g
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              Purity
            </div>
            <div className="font-mono font-bold text-base text-muted-foreground">
              {(bill.goldIssuedPurity / 10).toFixed(1)}%
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              Outstanding Gold
            </div>
            <div
              className={`font-mono font-bold text-base ${
                bill.closingBalanceMg === 0
                  ? "text-emerald-400"
                  : bill.closingBalanceMg > 0
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {MG_TO_G(Math.abs(bill.closingBalanceMg))} g
            </div>
            <div className="text-[10px] text-muted-foreground">
              {bill.closingBalanceMg === 0
                ? "Settled"
                : bill.closingBalanceMg > 0
                  ? "Owed to karigar (Jama)"
                  : "Owed by karigar (Udhar)"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Order-Level Gold (Auto-Collected) — covers the newer Order-level
          Issue/Return/Outside-Work flow, distinct from the Job-Card panel
          above. Only shown when this bill actually used that flow. ── */}
      {(bill.goldReceivedFromCustomerFineMg > 0 ||
        bill.orderIssuedFineMg > 0 ||
        bill.orderReturnedFineMg > 0 ||
        bill.outsideWorkIssuedFineMg > 0 ||
        bill.outsideWorkReturnedFineMg > 0) && (
        <div className="print:hidden rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3">
            Order-Level Gold (Auto-Collected)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <MiniStat
              label="Received from Customer"
              value={`${MG_TO_G(bill.goldReceivedFromCustomerFineMg)} g`}
            />
            <MiniStat label="Issued (Order-Level)" value={`${MG_TO_G(bill.orderIssuedFineMg)} g`} />
            <MiniStat
              label="Returned (Order-Level)"
              value={`${MG_TO_G(bill.orderReturnedFineMg)} g`}
            />
            <MiniStat
              label="Outside Work Issued"
              value={`${MG_TO_G(bill.outsideWorkIssuedFineMg)} g`}
            />
            <MiniStat
              label="Outside Work Returned"
              value={`${MG_TO_G(bill.outsideWorkReturnedFineMg)} g`}
            />
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
            <span className="text-muted-foreground">Gold Outstanding (all sources)</span>
            <span
              className={`font-mono font-bold ${bill.goldOutstandingFineMg > 0 ? "text-amber-400" : "text-emerald-400"}`}
            >
              {MG_TO_G(bill.goldOutstandingFineMg)} g
            </span>
          </div>
        </div>
      )}

      {/* ── Final Position — Gold First, Cash Secondary (on-screen) ───────── */}
      <div className="print:hidden rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-gold mb-2">
          Final Gold Position
        </div>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-muted-foreground">Gold Outstanding</span>
          <span
            className={`font-mono font-bold ${bill.goldOutstandingFineMg > 0 ? "text-amber-400" : "text-emerald-400"}`}
          >
            {MG_TO_G(bill.goldOutstandingFineMg)} g
          </span>
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2 pt-2 border-t border-border">
          Final Cash Position (secondary / informational)
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Net Manufacturing Cost</span>
          <span className="font-mono">
            ₹ {(bill.netMfgCostPaise / 100).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Outside Work + Polishing Charges</span>
          <span className="font-mono">
            ₹{" "}
            {((bill.outsideWorkChargesPaise + bill.polishingChargesPaise) / 100).toLocaleString(
              "en-IN",
            )}
          </span>
        </div>
      </div>

      {/* ── A4 Print Document ───────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
        }
      `}</style>
      <div
        className="bg-white text-black shadow-xl mx-auto print:shadow-none"
        style={{
          width: "100%",
          maxWidth: "210mm",
          minHeight: "297mm",
          padding: "10mm 12mm",
          fontFamily: "monospace, sans-serif",
          fontSize: "8.5pt",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            borderBottom: "2px solid #000",
            paddingBottom: "4mm",
            marginBottom: "5mm",
          }}
        >
          <div style={{ fontSize: "16pt", fontWeight: 900, letterSpacing: "0.5mm" }}>
            {firm?.shopName}
          </div>
          {firm?.address && <div style={{ fontSize: "8pt", color: "#444" }}>{firm.address}</div>}
          <div style={{ fontSize: "9pt", fontWeight: 700, marginTop: "2mm", letterSpacing: "1mm" }}>
            MANUFACTURING BILL — कारीगर बिल
          </div>
        </div>

        {/* Bill Meta */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5mm" }}>
          <div>
            <Row label="Bill No" value={bill.billNo} />
            <Row label="Karigar" value={bill.karigarName ?? "—"} />
            <Row label="Job No" value={bill.jobNo} />
            <Row label="Order No" value={bill.orderNo} />
          </div>
          <div style={{ textAlign: "right" }}>
            <Row label="Date" value={dateStr} />
            <Row label="Customer" value={bill.customerName} />
            <Row label="Item" value={bill.itemName} />
            <Row label="Status" value={MFG_BILL_STATUS_LABELS[bill.status]} />
          </div>
        </div>
        {(bill.referenceDesign || bill.itemDescription) && (
          <div style={{ marginBottom: "4mm" }}>
            {bill.referenceDesign && <Row label="Reference Design" value={bill.referenceDesign} />}
            {bill.itemDescription && (
              <Row label="Product Description" value={bill.itemDescription} />
            )}
          </div>
        )}

        {/* Gold Summary — the headline of this document. Printed prominently,
            ahead of every gold detail table and well ahead of the Charges
            (cash) section, so gold is the first and most visually dominant
            figure a reader sees. */}
        <div
          style={{
            border: "2px solid #000",
            borderRadius: "2mm",
            padding: "3mm 4mm",
            marginBottom: "5mm",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              fontSize: "8pt",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.5mm",
              marginBottom: "2mm",
            }}
          >
            Gold Summary
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "3mm",
            }}
          >
            <GoldStat label="Gold Required" value={`${MG_TO_G(bill.totalGoldIssuedFineMg)} g`} />
            <GoldStat label="Gold Returned" value={`${MG_TO_G(bill.totalGoldReturnedFineMg)} g`} />
            <GoldStat
              label="Wastage"
              value={`${MG_TO_G(bill.actualWastageFineMg)} g`}
              sub={`${bill.actualWastagePct.toFixed(2)}%`}
            />
            <GoldStat label="Purity" value={`${(bill.goldIssuedPurity / 10).toFixed(1)}%`} />
            <GoldStat
              label="Outstanding Gold"
              value={`${MG_TO_G(Math.abs(bill.closingBalanceMg))} g`}
              sub={
                bill.closingBalanceMg === 0
                  ? "Settled"
                  : bill.closingBalanceMg > 0
                    ? "Jama (owed to karigar)"
                    : "Udhar (owed by karigar)"
              }
              emphasis
            />
          </div>
        </div>

        {/* Section 1 — Gold Issued */}
        <SectionTitle>1. Gold Issued to Karigar</SectionTitle>
        <table style={tStyle}>
          <thead>
            <tr style={thRowStyle}>
              <Th>Slip No</Th>
              <Th>Gross (g)</Th>
              <Th>Purity%</Th>
              <Th right>Fine (g)</Th>
            </tr>
          </thead>
          <tbody>
            <tr style={trStyle}>
              <Td>{bill.goldIssueSlipNo || "—"}</Td>
              <Td>{MG_TO_G(bill.goldIssuedGrossMg)}</Td>
              <Td>{(bill.goldIssuedPurity / 10).toFixed(1)}</Td>
              <Td right bold>
                {MG_TO_G(bill.goldIssuedFineMg)}
              </Td>
            </tr>
            {bill.pEntries.map((e, i) => (
              <tr key={e.id} style={trStyle}>
                <Td>
                  P{i + 2} — {e.description || e.ref}
                </Td>
                <Td>{MG_TO_G(e.netMg)}</Td>
                <Td>
                  {e.tunchPct.toFixed(1)} + {e.wstgPct.toFixed(1)}%
                </Td>
                <Td right bold>
                  {MG_TO_G(e.fineMg)}
                </Td>
              </tr>
            ))}
            <tr style={{ ...trStyle, fontWeight: 900, borderTop: "1.5px solid #000" }}>
              <Td colSpan={3}>Total Fine Gold Issued</Td>
              <Td right bold>
                {MG_TO_G(bill.totalGoldIssuedFineMg)}
              </Td>
            </tr>
          </tbody>
        </table>

        {/* Section 2 — Karigar Returns */}
        <SectionTitle>2. Karigar Returns</SectionTitle>
        <table style={tStyle}>
          <thead>
            <tr style={thRowStyle}>
              <Th>Type</Th>
              <Th>Gross (g)</Th>
              <Th>Purity%</Th>
              <Th right>Fine (g)</Th>
            </tr>
          </thead>
          <tbody>
            <tr style={trStyle}>
              <Td>Finished Jewellery</Td>
              <Td>{MG_TO_G(bill.finishedGrossMg)}</Td>
              <Td>{(bill.finishedPurity / 10).toFixed(1)}</Td>
              <Td right bold>
                {MG_TO_G(bill.finishedFineMg)}
              </Td>
            </tr>
            {bill.scrapGrossMg > 0 && (
              <tr style={trStyle}>
                <Td>Scrap</Td>
                <Td>{MG_TO_G(bill.scrapGrossMg)}</Td>
                <Td>{(bill.scrapPurity / 10).toFixed(1)}</Td>
                <Td right bold>
                  {MG_TO_G(bill.scrapFineMg)}
                </Td>
              </tr>
            )}
            {bill.filingsGrossMg > 0 && (
              <tr style={trStyle}>
                <Td>Filings</Td>
                <Td>{MG_TO_G(bill.filingsGrossMg)}</Td>
                <Td>{(bill.filingsPurity / 10).toFixed(1)}</Td>
                <Td right bold>
                  {MG_TO_G(bill.filingsFineMg)}
                </Td>
              </tr>
            )}
            {bill.dustFineMg > 0 && (
              <tr style={trStyle}>
                <Td colSpan={3}>Dust (estimated fine)</Td>
                <Td right bold>
                  {MG_TO_G(bill.dustFineMg)}
                </Td>
              </tr>
            )}
            <tr style={{ ...trStyle, fontWeight: 900, borderTop: "1.5px solid #000" }}>
              <Td colSpan={3}>Total Fine Gold Returned</Td>
              <Td right bold>
                {MG_TO_G(bill.totalGoldReturnedFineMg)}
              </Td>
            </tr>
            <tr style={{ ...trStyle, color: "#d97706" }}>
              <Td colSpan={3}>Actual Wastage ({bill.actualWastagePct.toFixed(2)}%)</Td>
              <Td right bold>
                {MG_TO_G(bill.actualWastageFineMg)}
              </Td>
            </tr>
          </tbody>
        </table>

        {/* Section 3 — Charges */}
        {totalCharges > 0 && (
          <>
            <SectionTitle>3. Charges</SectionTitle>
            <table style={tStyle}>
              <tbody>
                {bill.pEntries.some((e) => e.labourPaise > 0) &&
                  bill.pEntries
                    .filter((e) => e.labourPaise > 0)
                    .map((e) => (
                      <tr key={e.id} style={trStyle}>
                        <Td>{e.ref} Labour</Td>
                        <Td right>₹ {(e.labourPaise / 100).toFixed(0)}</Td>
                      </tr>
                    ))}
                {bill.labourChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>Additional Labour</Td>
                    <Td right>₹ {(bill.labourChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                {bill.makingChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>Making Charges</Td>
                    <Td right>₹ {(bill.makingChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                {bill.stoneChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>Stone Setting</Td>
                    <Td right>₹ {(bill.stoneChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                {bill.hallmarkChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>Hallmark / BIS Charges</Td>
                    <Td right>₹ {(bill.hallmarkChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                {bill.huidChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>HUID Charges</Td>
                    <Td right>₹ {(bill.huidChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                {bill.outsideWorkChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>Outside Work Charges</Td>
                    <Td right>₹ {(bill.outsideWorkChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                {bill.polishingChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>Polishing Charges</Td>
                    <Td right>₹ {(bill.polishingChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                {bill.otherChargesPaise > 0 && (
                  <tr style={trStyle}>
                    <Td>Other Charges</Td>
                    <Td right>₹ {(bill.otherChargesPaise / 100).toFixed(0)}</Td>
                  </tr>
                )}
                <tr style={{ ...trStyle, fontWeight: 900, borderTop: "1.5px solid #000" }}>
                  <Td>Total Charges</Td>
                  <Td right>₹ {(totalCharges / 100).toLocaleString("en-IN")}</Td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Section 4 — Karigar Account */}
        <SectionTitle>4. Karigar Account Settlement</SectionTitle>
        {bill.openingBalanceMg !== 0 && (
          <table style={{ ...tStyle, marginBottom: "2mm" }}>
            <tbody>
              <tr style={trStyle}>
                <Td>LB — Opening Balance</Td>
                <Td right bold color={bill.openingBalanceMg < 0 ? "#b91c1c" : "#15803d"}>
                  G {MG_TO_G(bill.openingBalanceMg)}
                </Td>
              </tr>
            </tbody>
          </table>
        )}
        {bill.pEntries.length > 0 && (
          <table style={tStyle}>
            <thead>
              <tr style={thRowStyle}>
                <Th>P Entry (Gold Given)</Th>
                <Th right>Fine (g)</Th>
              </tr>
            </thead>
            <tbody>
              {bill.pEntries.map((e) => (
                <tr key={e.id} style={trStyle}>
                  <Td>
                    {e.ref} — {e.description || e.stamp}
                  </Td>
                  <Td right color="#b91c1c">
                    {MG_TO_G(e.fineMg)}
                  </Td>
                </tr>
              ))}
              <tr style={{ ...trStyle, fontWeight: 900, borderTop: "1px solid #ccc" }}>
                <Td>NET TOTAL</Td>
                <Td right bold color="#b91c1c">
                  G {MG_TO_G(bill.openingBalanceMg - totalPFine)}
                </Td>
              </tr>
            </tbody>
          </table>
        )}
        {bill.mpEntries.length > 0 && (
          <table style={tStyle}>
            <thead>
              <tr style={{ ...thRowStyle, background: "#e8f5e9" }}>
                <Th>MP Entry (Gold Received)</Th>
                <Th>Gross (g)</Th>
                <Th>Tunch%</Th>
                <Th right>Fine (g)</Th>
              </tr>
            </thead>
            <tbody>
              {bill.mpEntries.map((e) => (
                <tr key={e.id} style={trStyle}>
                  <Td>{e.label}</Td>
                  <Td>{MG_TO_G(e.grossMg)}</Td>
                  <Td>{e.tunchPct.toFixed(2)}</Td>
                  <Td right color="#15803d" bold>
                    {MG_TO_G(e.fineMg)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {bill.cashPaymentPaise > 0 && (
          <table style={tStyle}>
            <tbody>
              <tr style={trStyle}>
                <Td>Cash Payment</Td>
                <Td right bold>
                  ₹ {(bill.cashPaymentPaise / 100).toFixed(0)}
                </Td>
                <Td right color="#15803d">
                  ≡ G {MG_TO_G(bill.bhavGoldMg)}
                </Td>
              </tr>
            </tbody>
          </table>
        )}
        {/* Closing balance */}
        <table style={{ ...tStyle, marginTop: "2mm" }}>
          <tbody>
            <tr
              style={{
                ...trStyle,
                fontWeight: 900,
                fontSize: "10pt",
                borderTop: "2px solid #000",
                borderBottom: "2px solid #000",
                background: "#f5f5f5",
              }}
            >
              <Td>Closing Balance</Td>
              <Td
                right
                color={
                  bill.closingBalanceMg < 0
                    ? "#b91c1c"
                    : bill.closingBalanceMg === 0
                      ? "#15803d"
                      : "#d97706"
                }
                bold
              >
                G {MG_TO_G(bill.closingBalanceMg)}
              </Td>
              <Td right style={{ fontStyle: "italic" }}>
                {bill.closingBalanceMg < 0
                  ? "Jama"
                  : bill.closingBalanceMg === 0
                    ? "Settled"
                    : "Udhar"}
              </Td>
              <Td right>
                {bill.cashPaymentPaise > 0
                  ? `₹ ${(bill.cashPaymentPaise / 100).toFixed(0)}`
                  : "Nil"}
              </Td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #ccc",
            paddingTop: "3mm",
            marginTop: "8mm",
            fontSize: "7pt",
            color: "#666",
          }}
        >
          <p>
            Manufacturing Bill | Gold weights in grams (3 decimal places) | Fine = Gross × Tunch% /
            100
          </p>
          <p>
            {firm?.shopName} | {dateStr} | {bill.billNo}
          </p>
        </div>
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
            Authorised — {firm?.shopName}
          </div>
        </div>
      </div>

      {/* Delivery confirm dialog */}
      <AlertDialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Delivered?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that <strong>{bill.itemName}</strong> has been handed over to{" "}
              <strong>{bill.customerName}</strong>. The order will be marked as Delivered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 text-white" onClick={handleMarkDelivered}>
              Confirm Delivery
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reprint confirmation — this bill was already printed once before */}
      <AlertDialog open={reprintOpen} onOpenChange={setReprintOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprint Manufacturing Bill?</AlertDialogTitle>
            <AlertDialogDescription>
              {docNumber} has been printed before ({reprintCount} time
              {reprintCount === 1 ? "" : "s"}). This reprint will be recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => recordReprint("other")}>
              Confirm &amp; Print
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Print table helpers ───────────────────────────────────────────────────────

const tStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: "4mm",
};
const thRowStyle: React.CSSProperties = {
  background: "#f0f0f0",
  borderTop: "1px solid #000",
  borderBottom: "1px solid #000",
};
const trStyle: React.CSSProperties = { borderBottom: "0.5px solid #ddd" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 900,
        fontSize: "8.5pt",
        textTransform: "uppercase",
        letterSpacing: "0.5mm",
        borderBottom: "1px solid #bbb",
        paddingBottom: "1mm",
        marginBottom: "2mm",
        marginTop: "4mm",
        color: "#333",
      }}
    >
      {children}
    </div>
  );
}
function Th({
  children,
  right,
  colSpan,
}: {
  children?: React.ReactNode;
  right?: boolean;
  colSpan?: number;
}) {
  return (
    <th style={{ padding: "1.5mm 2mm", textAlign: right ? "right" : "left" }} colSpan={colSpan}>
      {children}
    </th>
  );
}
function Td({
  children,
  right,
  bold,
  color,
  colSpan,
  style,
}: {
  children?: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  color?: string;
  colSpan?: number;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "1.5mm 2mm",
        textAlign: right ? "right" : "left",
        fontWeight: bold ? 700 : undefined,
        color,
        ...style,
      }}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "1mm" }}>
      <strong>{label}:</strong> {value}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
        {label}
      </div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}

function GoldStat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "6.5pt",
          textTransform: "uppercase",
          letterSpacing: "0.3mm",
          color: "#555",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: emphasis ? "11pt" : "9.5pt", fontWeight: 900 }}>{value}</div>
      {sub && <div style={{ fontSize: "6.5pt", color: "#666" }}>{sub}</div>}
    </div>
  );
}
