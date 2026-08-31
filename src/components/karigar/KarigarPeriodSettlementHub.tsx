import React, { useState, useMemo } from "react";
import { usePeople, type Person } from "@/lib/people-store";
import { useWorkers } from "@/lib/workers-store";
import { useSettings } from "@/lib/settings-store";
import { calculateKarigarPeriodSettlement, type KarigarPeriodSettlementResult } from "@/lib/karigar-period-settlement";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { GoldWeightDisplay } from "@/components/ui/GoldWeightDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Hammer,
  Scale,
  Calendar,
  Clock,
  TrendingUp,
  Percent,
  Coins,
  Banknote,
  Printer,
  FileCheck2,
  AlertTriangle,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";

export function KarigarPeriodSettlementHub({
  workers,
  selectedWorker,
  onWorkerChange,
}: {
  workers: Person[];
  selectedWorker: Person | null;
  onWorkerChange?: (workerId: string) => void;
}) {
  const [workerId, setWorkerId] = useState(selectedWorker?.id ?? workers[0]?.id ?? "");

  // Date range presets
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [activeTab, setActiveTab] = useState<"purity_books" | "efficiency" | "deductions" | "charts">("purity_books");

  // Overrides & settlement parameters
  const [goldWorkedOverride, setGoldWorkedOverride] = useState("");
  const [overlossOverride, setOverlossOverride] = useState("");
  const [chainOverride, setChainOverride] = useState("");
  const [rateOverride, setRateOverride] = useState("");
  const [wagePayOutMode, setWagePayOutMode] = useState<"gold" | "cash">("gold");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settlementSuccessId, setSettlementSuccessId] = useState<string | null>(null);

  const addSettlement = useWorkers((s) => s.addSettlement);

  const handleWorkerSelect = (id: string) => {
    setWorkerId(id);
    if (onWorkerChange) onWorkerChange(id);
  };

  const periodData: KarigarPeriodSettlementResult | null = useMemo(() => {
    if (!workerId) return null;
    return calculateKarigarPeriodSettlement(workerId, fromDate, toDate, {
      goldWorkedOverrideGrams: goldWorkedOverride.trim() ? parseFloat(goldWorkedOverride) : undefined,
      overlossOverrideGrams: overlossOverride.trim() ? parseFloat(overlossOverride) : undefined,
      chainDeductionOverrideGrams: chainOverride.trim() ? parseFloat(chainOverride) : undefined,
      goldRateOverridePaise: rateOverride.trim() ? rupeesToPaise(rateOverride) : undefined,
      wagePayOutMode,
    });
  }, [workerId, fromDate, toDate, goldWorkedOverride, overlossOverride, chainOverride, rateOverride, wagePayOutMode]);

  const handleQuickPreset = (preset: "week" | "fortnight" | "month" | "last_month") => {
    const d = new Date();
    const endStr = d.toISOString().split("T")[0];
    if (preset === "week") {
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().split("T")[0]);
      setToDate(endStr);
    } else if (preset === "fortnight") {
      d.setDate(d.getDate() - 14);
      setFromDate(d.toISOString().split("T")[0]);
      setToDate(endStr);
    } else if (preset === "month") {
      setFromDate(`${endStr.slice(0, 7)}-01`);
      setToDate(endStr);
    } else if (preset === "last_month") {
      const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const prevEnd = new Date(d.getFullYear(), d.getMonth(), 0);
      setFromDate(prev.toISOString().split("T")[0]);
      setToDate(prevEnd.toISOString().split("T")[0]);
    }
  };

  const handleConfirmSettlement = async () => {
    if (!periodData) return;
    try {
      const s = await addSettlement({
        workerId: periodData.workerId,
        fromDate: periodData.fromDate,
        toDate: periodData.toDate,
        presentDays: periodData.attendance.presentDays,
        halfDays: periodData.attendance.halfDays,
        absentDays: periodData.attendance.absentDays,
        leaveDays: periodData.attendance.leaveDays,
        payableDays: periodData.attendance.totalWorkingDays,
        daysWorked: periodData.attendance.totalWorkingDays,
        salaryEarnedPaise: periodData.earnings.baseSalaryEarnedPaise,
        withdrawalsTotalPaise: periodData.deductionsAndAdvances.withdrawalsPaise,
        loanDeductionPaise: periodData.deductionsAndAdvances.loanDeductionsPaise,
        advanceDeductionPaise: periodData.deductionsAndAdvances.cashAdvancesPaise,
        allowanceTotalPaise: periodData.deductionsAndAdvances.allowancesPaise,
        finalCashPayablePaise: periodData.settlement.finalCashPayablePaise,
        loanDeductions: {},
        advanceDeductions: {},
        goldAdvanceFineMg: periodData.deductionsAndAdvances.goldAdvancesFineMg,
        wastageReturnedFineMg: periodData.earnings.workBasedGrossEarningMg,
        netGoldMg: periodData.settlement.finalGoldPayableMg,
        gramsWorkedMg: periodData.totalWorkDoneGrossMg,
        wagePctApplied: 0.50,
        wageGrossMg: periodData.earnings.workBasedGrossEarningMg,
        overlossDeductedMg: periodData.earnings.overlossDeductionMg,
        wageNetMg: periodData.earnings.workBasedNetEarningMg,
        wageBookPurity: 916,
        wageCashPaise: periodData.earnings.workBasedEarningCashPaise,
        wagePayOutMode,
        notes: notes || undefined,
      });
      setSettlementSuccessId(s.id);
      setConfirmOpen(false);
      toast.success("Karigar period settlement successfully posted to ledger.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to confirm settlement.");
    }
  };

  if (!periodData) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Select a valid worker to compute period settlement.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls Panel */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-wider text-gold font-semibold">
                Karigar Performance & Payroll Hub
              </span>
              <Badge variant="outline" className="border-gold/30 text-gold bg-gold/5 font-mono text-[10px]">
                Multi-Purity Book Engine
              </Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">
              {periodData.workerName} · Period Settlement
            </h2>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground font-semibold mb-1 block">Worker / Karigar</Label>
            <Select value={workerId} onValueChange={handleWorkerSelect}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.fullName} ({w.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground font-semibold mb-1 block">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground font-semibold mb-1 block">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground font-semibold mb-1 block">Wage Payout Form</Label>
            <Select value={wagePayOutMode} onValueChange={(v: "gold" | "cash") => setWagePayOutMode(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gold">Physical Gold (Book Purity)</SelectItem>
                <SelectItem value="cash">Cash at Live Gold Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Top Level KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Total Work Done</span>
            <Hammer className="h-3.5 w-3.5 text-gold" />
          </div>
          <div className="text-lg font-bold font-mono text-gold">
            <GoldWeightDisplay mg={periodData.totalWorkDoneGrossMg} kind="gross" />
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {periodData.totalJobsCount} jobs · {periodData.totalPiecesCount} pcs
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Working Days</span>
            <Calendar className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold font-mono text-foreground">
            {periodData.attendance.totalWorkingDays} <span className="text-xs text-muted-foreground font-normal">days</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {periodData.attendance.attendancePct}% attendance rate
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Daily Efficiency</span>
            <Activity className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-bold font-mono text-sky-400">
            {periodData.efficiency.averageWorkPerDayGrams.toFixed(3)} <span className="text-xs text-muted-foreground font-normal">g/day</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {periodData.efficiency.piecesPerDay.toFixed(1)} pcs/day avg
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Wastage Earning</span>
            <Sparkles className="h-3.5 w-3.5 text-gold" />
          </div>
          <div className="text-lg font-bold font-mono text-gold">
            <GoldWeightDisplay mg={periodData.earnings.workBasedGrossEarningMg} kind="fine" />
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Net: <GoldWeightDisplay mg={periodData.earnings.workBasedNetEarningMg} kind="fine" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Over-Loss / Chain</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold font-mono text-destructive">
            <GoldWeightDisplay
              mg={periodData.earnings.overlossDeductionMg + periodData.earnings.chainComponentDeductionMg}
              kind="gross"
            />
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Loss: {periodData.efficiency.lossPct}% of metal
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gold/40 bg-gold/10 shadow-sm space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-gold font-bold flex items-center justify-between">
            <span>Final Gold Payable</span>
            <Coins className="h-3.5 w-3.5 text-gold" />
          </div>
          <div className="text-lg font-extrabold font-mono text-gold">
            <GoldWeightDisplay mg={periodData.settlement.finalGoldPayableMg} kind="fine" />
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Cash: <MoneyDisplay paise={periodData.settlement.finalCashPayablePaise} />
          </div>
        </div>
      </div>

      {/* Main Tabs Hub */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger value="purity_books" className="gap-2 text-xs font-mono">
            <Layers className="h-3.5 w-3.5" /> Purity-Wise Books ({periodData.purityBooks.length})
          </TabsTrigger>
          <TabsTrigger value="efficiency" className="gap-2 text-xs font-mono">
            <TrendingUp className="h-3.5 w-3.5" /> Performance & Efficiency
          </TabsTrigger>
          <TabsTrigger value="deductions" className="gap-2 text-xs font-mono">
            <Scale className="h-3.5 w-3.5" /> Advances & Deductions
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Purity-Wise Books */}
        <TabsContent value="purity_books" className="space-y-4">
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/80 bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Separate Purity Running Ledgers</h3>
                <p className="text-xs text-muted-foreground">Every purity maintains independent opening, issues, returns, wastage, loss, and balances.</p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {periodData.purityBooks.length} Active Purities
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b text-[10px] uppercase font-mono tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Purity / Touch</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[110px]">Opening (g)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[110px]">Issued (g)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[110px]">Received (g)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[110px]">Work Done</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Earning %</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[110px]">Gross Earning</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[100px]">Chain Ded.</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[100px]">Over-Loss</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[110px]">Net Earning</th>
                    <th className="py-3 px-5 text-right whitespace-nowrap min-w-[130px] font-bold">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {periodData.purityBooks.map((pb) => (
                    <tr key={pb.purity} className="hover:bg-muted/15 transition-colors font-mono">
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-foreground">
                        <span className="bg-gold/10 text-gold border border-gold/30 px-2 py-0.5 rounded text-[11px]">
                          {pb.label} ({pb.purity}‰)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-muted-foreground">
                        <GoldWeightDisplay mg={pb.openingBalanceMg} kind="fine" showSign />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-foreground">
                        <GoldWeightDisplay mg={pb.issuedFineMg} kind="fine" />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-foreground">
                        <GoldWeightDisplay mg={pb.receivedFineMg} kind="fine" />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-gold">
                        <GoldWeightDisplay mg={pb.netWorkDoneFineMg} kind="fine" />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap text-muted-foreground">
                        {pb.workerEarningPct.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-gold">
                        <GoldWeightDisplay mg={pb.grossWorkerEarningMg} kind="fine" />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-muted-foreground">
                        {pb.chainComponentDeductionMg > 0 ? (
                          <span className="text-destructive">-<GoldWeightDisplay mg={pb.chainComponentDeductionMg} kind="gross" /></span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-muted-foreground">
                        {pb.overlossMg > 0 ? (
                          <span className="text-destructive">-<GoldWeightDisplay mg={pb.overlossMg} kind="gross" /></span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-emerald-400">
                        <GoldWeightDisplay mg={pb.netWorkerEarningMg} kind="fine" />
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap font-bold">
                        <GoldWeightDisplay mg={pb.closingBalanceMg} kind="fine" showSign showCrDr />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Performance & Efficiency */}
        <TabsContent value="efficiency" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-border bg-card space-y-3">
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" /> Attendance Breakdown
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Present Days:</span>
                  <span className="font-bold text-foreground">{periodData.attendance.presentDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Half Days:</span>
                  <span className="text-foreground">{periodData.attendance.halfDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Absent / Leave:</span>
                  <span className="text-destructive">{periodData.attendance.absentDays + periodData.attendance.leaveDays} days</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 font-bold">
                  <span>Total Working Days:</span>
                  <span className="text-emerald-400">{periodData.attendance.totalWorkingDays} days</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card space-y-3">
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-400" /> Production Efficiency
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Work / Day:</span>
                  <span className="font-bold text-sky-400">{periodData.efficiency.averageWorkPerDayGrams.toFixed(3)} g/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pieces / Day:</span>
                  <span className="text-foreground">{periodData.efficiency.piecesPerDay.toFixed(1)} pcs/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs / Day:</span>
                  <span className="text-foreground">{periodData.efficiency.jobsPerDay.toFixed(1)} jobs/day</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 font-bold">
                  <span>Wastage Efficiency:</span>
                  <span className="text-emerald-400">{periodData.efficiency.wastageEfficiencyPct}%</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card space-y-3">
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Scale className="h-4 w-4 text-amber-400" /> Loss & Quality Metrics
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Actual Loss:</span>
                  <span className="text-destructive font-bold">
                    <GoldWeightDisplay
                      mg={periodData.purityBooks.reduce((s, b) => s + b.actualLossMg, 0)}
                      kind="gross"
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loss % on Worked Gold:</span>
                  <span className="text-amber-400 font-bold">{periodData.efficiency.lossPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Over-Loss Penalized:</span>
                  <span className="text-destructive font-bold">
                    <GoldWeightDisplay mg={periodData.earnings.overlossDeductionMg} kind="gross" />
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 font-bold">
                  <span>On-Time Completion:</span>
                  <span className="text-emerald-400">{periodData.efficiency.onTimeCompletionRatePct}%</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Advances & Deductions */}
        <TabsContent value="deductions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-border bg-card space-y-3">
              <div className="font-semibold text-sm text-gold flex items-center gap-2">
                <Coins className="h-4 w-4" /> Gold Advances & Materials
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gold Advances (Fine):</span>
                  <span className="font-bold text-foreground">
                    <GoldWeightDisplay mg={periodData.deductionsAndAdvances.goldAdvancesFineMg} kind="fine" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chain Deductions:</span>
                  <span className="text-destructive font-bold">
                    -<GoldWeightDisplay mg={periodData.earnings.chainComponentDeductionMg} kind="gross" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Over-Loss Deductions:</span>
                  <span className="text-destructive font-bold">
                    -<GoldWeightDisplay mg={periodData.earnings.overlossDeductionMg} kind="gross" />
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card space-y-3">
              <div className="font-semibold text-sm text-emerald-400 flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Monetary Advances & Loans
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Advances:</span>
                  <span className="font-bold text-foreground">
                    <MoneyDisplay paise={periodData.deductionsAndAdvances.cashAdvancesPaise} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Gold Equiv:</span>
                  <span className="text-gold font-bold">
                    <GoldWeightDisplay mg={periodData.deductionsAndAdvances.cashAdvancesGoldEquivMg} kind="fine" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan Deductions:</span>
                  <span className="text-destructive font-bold">
                    <MoneyDisplay paise={periodData.deductionsAndAdvances.loanDeductionsPaise} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Withdrawals & Allowances:</span>
                  <span className="text-destructive font-bold">
                    <MoneyDisplay paise={periodData.deductionsAndAdvances.withdrawalsPaise + periodData.deductionsAndAdvances.allowancesPaise} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Settlement Action Bar */}
      <div className="p-6 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/10 via-background to-gold/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <div className="text-xs uppercase font-mono tracking-wider text-gold font-bold">
            Settlement Ready · Period {periodData.periodLabel}
          </div>
          <div className="text-sm font-medium text-foreground">
            Net Payable: <span className="font-bold text-gold"><GoldWeightDisplay mg={periodData.settlement.finalGoldPayableMg} kind="fine" /></span> (Gold) + <span className="font-bold text-emerald-400"><MoneyDisplay paise={periodData.settlement.finalCashPayablePaise} /></span> (Cash)
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="bg-gold text-slate-950 font-bold hover:bg-gold/90 h-11 px-6 shadow-md"
            onClick={() => setConfirmOpen(true)}
          >
            <FileCheck2 className="h-4 w-4 mr-2" />
            Confirm Settlement Payout
          </Button>

          {settlementSuccessId && (
            <Link
              to="/attendance/print/$kind/$id"
              params={{ kind: "settlement", id: settlementSuccessId }}
              target="_blank"
              className="inline-flex h-11 items-center rounded-xl bg-secondary border border-border text-foreground font-semibold text-xs px-5 shadow-sm hover:bg-secondary/80"
            >
              <Printer className="h-4 w-4 mr-2 text-gold" />
              Print Settlement Slip
            </Link>
          )}
        </div>
      </div>

      {/* Confirm Settlement Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-gold flex items-center gap-2">
              <FileCheck2 className="h-5 w-5" /> Confirm Period Settlement Payout
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs font-mono py-2">
            <p className="text-muted-foreground font-sans">
              Confirming this payout will record the settlement in the authoritative Karigar Ledger and update all running balances. Partial settlements leave remaining balance outstanding.
            </p>

            {/* Worker & Period Summary */}
            <div className="p-3 bg-muted/40 rounded-lg space-y-1.5 border border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Worker:</span>
                <span className="font-bold text-foreground">{periodData.workerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period:</span>
                <span>{periodData.periodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Working Days:</span>
                <span>{periodData.attendance.totalWorkingDays} days</span>
              </div>
              <div className="flex justify-between text-gold font-bold">
                <span>Total Gold Payable Due:</span>
                <GoldWeightDisplay mg={periodData.settlement.finalGoldPayableMg} kind="fine" />
              </div>
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Total Cash Payable Due:</span>
                <MoneyDisplay paise={periodData.settlement.finalCashPayablePaise} />
              </div>
            </div>

            {/* Settlement Mode Selection: GOLD / CASH */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground font-sans">
                Settle Mode: <span className="text-gold font-bold">SETTLE AS</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={wagePayOutMode === "gold" ? "default" : "outline"}
                  onClick={() => setWagePayOutMode("gold")}
                  className={wagePayOutMode === "gold" ? "bg-gold text-slate-950 font-bold hover:bg-gold/90" : "font-mono"}
                >
                  <Coins className="h-4 w-4 mr-1.5 text-gold" />
                  GOLD (Primary)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={wagePayOutMode === "cash" ? "default" : "outline"}
                  onClick={() => setWagePayOutMode("cash")}
                  className={wagePayOutMode === "cash" ? "bg-emerald-600 text-white font-bold hover:bg-emerald-700" : "font-mono"}
                >
                  <Banknote className="h-4 w-4 mr-1.5 text-emerald-400" />
                  CASH (Secondary)
                </Button>
              </div>
            </div>

            {/* Partial Settlement & Remaining Calculation */}
            <div className="p-3.5 rounded-xl border border-gold/30 bg-gold/5 space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {wagePayOutMode === "gold" ? "Settling Gold Amount (g)" : "Settling Cash Amount (₹)"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  (Supports partial settlement)
                </span>
              </div>

              {wagePayOutMode === "gold" ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    step="0.001"
                    placeholder={`Max: ${mgToGrams(periodData.settlement.finalGoldPayableMg)}`}
                    value={goldWorkedOverride}
                    onChange={(e) => setGoldWorkedOverride(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <div className="flex justify-between text-xs font-mono pt-1">
                    <span className="text-muted-foreground">Remaining Gold Payable:</span>
                    <span className="font-bold text-amber-400">
                      {(
                        periodData.settlement.finalGoldPayableMg / 1000 -
                        (goldWorkedOverride ? parseFloat(goldWorkedOverride) || 0 : 0)
                      ).toFixed(3)} g
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="number"
                    step="1"
                    placeholder={`Max: ₹${paiseToRupees(periodData.settlement.finalCashPayablePaise)}`}
                    value={rateOverride}
                    onChange={(e) => setRateOverride(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <div className="flex justify-between text-xs font-mono pt-1">
                    <span className="text-muted-foreground">Rate Used:</span>
                    <span className="font-bold text-foreground">
                      ₹{paiseToRupees(periodData.goldRatePerGramPaise)} / g
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Gold Equivalent:</span>
                    <span className="font-bold text-gold">
                      {mgToGrams(periodData.settlement.finalGoldPayableMg)} g
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs mb-1 block font-sans">Settlement Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Monthly settlement cleared by Gold voucher / Cash"
                className="h-8 text-xs font-sans"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-gold text-slate-950 font-bold hover:bg-gold/90"
              onClick={handleConfirmSettlement}
            >
              Post &amp; Settle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
