import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpensesStore, RELATIONSHIP_LABELS } from "@/lib/expenses-store";
import { thisMonthRange, fmtRs, fmtG, triggerPrint, exportToCSV } from "@/lib/report-engine";
import { useSettings } from "@/lib/settings-store";
import { Download, Printer, Wallet, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/reports/owner-drawings")({
  head: () => ({ meta: [{ title: "Owner Drawings Report · MTJ ERP" }] }),
  component: OwnerDrawingsReportPage,
});

import { APP_NAME } from "@/lib/app-info";

function OwnerDrawingsReportPage() {
  const month = thisMonthRange();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [selectedPerson, setSelectedPerson] = useState<string>("all");
  const people = useExpensesStore((s) => s.people);
  const withdrawals = useExpensesStore((s) => s.withdrawals);
  const expenses = useExpensesStore((s) => s.expenses);
  const branding = useSettings((s) => s.branding);
  const firm = useSettings((s) => s.firm);
  const companyName = firm?.shopName || branding.companyName || APP_NAME;

  const rows = useMemo(() => {
    // Combine explicit withdrawals and personal-type expenses
    const list: Array<{
      id: string;
      date: string;
      personName: string;
      relationship: string;
      amountPaise: number;
      goldEquivalentMg: number;
      paymentMode: string;
      purpose: string;
    }> = [];

    for (const w of withdrawals) {
      if (w.date >= from && w.date <= to) {
        if (selectedPerson === "all" || w.personId === selectedPerson) {
          const p = people.find((item) => item.id === w.personId);
          list.push({
            id: w.id,
            date: w.date,
            personName: p?.fullName || w.personName || "Family Member",
            relationship: p?.relationship ? RELATIONSHIP_LABELS[p.relationship] : "Home / Family",
            amountPaise: w.amountPaise,
            goldEquivalentMg: w.goldEquivalentMg || 0,
            paymentMode: w.paymentMode,
            purpose: w.purpose || w.reason || w.notes || "Personal Drawing",
          });
        }
      }
    }

    for (const e of expenses) {
      if (e.type === "personal" && e.date >= from && e.date <= to) {
        if (selectedPerson === "all" || e.personId === selectedPerson) {
          const p = people.find((item) => item.id === e.personId);
          list.push({
            id: e.id,
            date: e.date,
            personName: p?.fullName || "Personal / Family",
            relationship: p?.relationship ? RELATIONSHIP_LABELS[p.relationship] : "Home / Family",
            amountPaise: e.amountPaise,
            goldEquivalentMg: Math.round((e.amountPaise / 750000) * 1000),
            paymentMode: e.paymentMode,
            purpose: e.businessPurpose || e.notes || e.category || "Personal Expense",
          });
        }
      }
    }

    return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [withdrawals, expenses, people, from, to, selectedPerson]);

  const totalPaise = rows.reduce((s, r) => s + r.amountPaise, 0);
  const totalGoldMg = rows.reduce((s, r) => s + r.goldEquivalentMg, 0);

  function handleCSV() {
    exportToCSV("owner-drawings-report.csv", [
      ["Date", "Member / Beneficiary", "Relationship", "Amount (₹)", "Gold Equiv (g)", "Payment Mode", "Purpose / Narration"],
      ...rows.map((r) => [
        r.date,
        r.personName,
        r.relationship,
        fmtRs(r.amountPaise),
        `${fmtG(r.goldEquivalentMg)} g`,
        r.paymentMode.toUpperCase(),
        r.purpose,
      ]),
      ["TOTAL", "", "", fmtRs(totalPaise), `${fmtG(totalGoldMg)} g`, "", ""],
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 print:p-4 print:max-w-none print:m-0 print:space-y-4 print:text-black">
      {/* Print-Only Branded Header */}
      <div className="hidden print:block border-b-2 border-black/80 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto max-w-[120px] object-contain" />
              )}
              <h1 className="text-xl font-bold tracking-tight text-black">{companyName}</h1>
            </div>
            {firm?.tagline && <p className="text-xs text-gray-600">{firm.tagline}</p>}
            {firm?.address && <p className="text-[10px] text-gray-500">{firm.address}</p>}
          </div>
          <div className="text-right space-y-0.5">
            <h2 className="text-base font-bold text-black uppercase tracking-wider">Owner Drawings &amp; Personal Report</h2>
            <p className="text-xs text-gray-600 font-medium">Period: {from} to {to}</p>
            <p className="text-[11px] font-bold text-black mt-1">
              Total Drawings: {fmtRs(totalPaise)} ({fmtG(totalGoldMg)} g Gold Equiv)
            </p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Owner Drawings &amp; Personal Withdrawals"
          subtitle="Complete audit trail of owner &amp; family member drawings, accounted separately against equity."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV} disabled={rows.length === 0}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          }
        />
      </div>

      {/* Summary KPI Card */}
      <div className="rounded-lg border border-border print:border-black/30 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Owner Drawings (Gold First)</div>
            <div className="text-2xl font-bold font-mono text-amber-500">{fmtG(totalGoldMg)} g Pure Gold Equivalent</div>
            <div className="text-sm font-semibold font-mono text-foreground mt-0.5">{fmtRs(totalPaise)} Total Cash Withdrawn</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <Badge variant="outline" className="text-amber-500 border-amber-500/40">
              {rows.length} Withdrawal Record(s)
            </Badge>
            <p className="mt-1">Accounting Status: <strong className="text-foreground">Equity Drawings (Not Business Expense)</strong></p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-4 items-end print:hidden">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1.5 min-w-[200px]">
          <Label className="text-xs">Member / Beneficiary</Label>
          <Select value={selectedPerson} onValueChange={setSelectedPerson}>
            <SelectTrigger>
              <SelectValue placeholder="All Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.fullName} ({RELATIONSHIP_LABELS[p.relationship] || p.relationship})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Table */}
      <div className="overflow-x-auto rounded-lg border print:border-black/30 bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 print:bg-gray-100 border-b">
            <tr className="text-left text-muted-foreground print:text-black">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Beneficiary / Member</th>
              <th className="py-2.5 px-3">Relationship</th>
              <th className="py-2.5 px-3">Purpose / Narration</th>
              <th className="py-2.5 px-3">Payment Mode</th>
              <th className="py-2.5 px-3 text-right text-amber-500 font-bold">Gold Equiv (g)</th>
              <th className="py-2.5 px-3 text-right font-bold">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted-foreground">
                  No personal/owner drawings in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40">
                  <td className="py-2 px-3 font-mono">{row.date}</td>
                  <td className="py-2 px-3 font-semibold text-foreground">{row.personName}</td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-[10px]">{row.relationship}</Badge>
                  </td>
                  <td className="py-2 px-3">{row.purpose}</td>
                  <td className="py-2 px-3 uppercase font-mono text-[11px]">{row.paymentMode}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">
                    {fmtG(row.goldEquivalentMg)} g
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                    {fmtRs(row.amountPaise)}
                  </td>
                </tr>
              ))
            )}
            <tr className="border-t font-bold bg-muted/40 print:bg-gray-100">
              <td colSpan={5} className="py-2.5 px-3">Total Drawings in Period</td>
              <td className="py-2.5 px-3 text-right font-mono text-amber-500">{fmtG(totalGoldMg)} g</td>
              <td className="py-2.5 px-3 text-right font-mono">{fmtRs(totalPaise)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
