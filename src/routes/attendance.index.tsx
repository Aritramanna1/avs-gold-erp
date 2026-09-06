import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { usePeople, type Person } from "@/lib/people-store";
import { PersonProfileAvatar } from "@/components/people/PersonProfileAvatar";
import {
  useWorkers,
  ATTENDANCE_LABELS,
  type AttendanceStatus,
  type WorkerStatus,
  type WorkerStay,
  SALARY_RULE_LABELS,
  type SalaryRuleType,
  type PayMode,
  PAY_MODE_LABELS,
  WAGE_PAY_MODE_LABELS,
  type WagePayMode,
  COMPENSATION_MODE_LABELS,
  ALLOWANCE_KIND_LABELS,
  PERFORMANCE_RATING_LABELS,
  type PerformanceRating,
  type WorkerAllowancePayment,
  activeRuleFor,
  loanOutstandingPaise,
  advanceOutstandingPaise,
  rupeesToPaise,
  paiseToRupees,
  todayISO,
  monthKey,
  workerStatus,
  stayDaysForWorker,
  stayDaysInPeriod,
  stayEarnedPaise,
  openStayFor,
  buildWorkerPassbookRows,
  wagePctTotal,
  gramsWorkedMgForWorker,
  computeWorkBasedWageMg,
  wageGoldCashPaise,
  workerAllowsWastage,
} from "@/lib/workers-store";
import { useSettings } from "@/lib/settings-store";
import { COMMON_PURITIES, fineGoldMg, gramsToMg, mgToGrams, parsePurity } from "@/lib/gold";
import { useLedger } from "@/lib/ledger-store";
import { formatDateShort as fmtDate } from "@/lib/format-date";
import { KarigarPeriodSettlementHub } from "@/components/karigar/KarigarPeriodSettlementHub";
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  HandCoins,
  Landmark,
  Wallet,
  Coins,
  FileCheck2,
  BookOpenCheck,
  Printer,
  Plus,
  Hammer,
  AlertTriangle,
  UtensilsCrossed,
} from "lucide-react";

export const Route = createFileRoute("/attendance/")({
  validateSearch: (s: Record<string, unknown>): { tab?: string } => {
    const raw = typeof s.tab === "string" ? s.tab : "";
    // Normalize aliases for backward compatibility
    const normalized =
      raw === "loans" || raw === "gold_advance"
        ? "advances"
        : raw === "withdrawals" || raw === "allowances"
          ? "allocation"
          : raw;

    const allowed = new Set([
      "daily",
      "monthly",
      "rules",
      "allocation",
      "advances",
      "settlement",
      "passbook",
    ]);
    return {
      tab: allowed.has(normalized) ? normalized : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Attendance & Workers · AVS ERP" }] }),
  component: AttendancePage,
});

const TABS = [
  { key: "daily", label: "Worker Status & Arrival", icon: CalendarDays },
  { key: "monthly", label: "Stay History", icon: CalendarRange },
  { key: "rules", label: "Salary Rules", icon: ClipboardList },
  { key: "allocation", label: "Weekly Allocation & Wastage", icon: UtensilsCrossed },
  { key: "advances", label: "Gold & Material Advances", icon: Coins },
  { key: "settlement", label: "Karigar Period Settlement", icon: FileCheck2 },
  { key: "passbook", label: "Worker Passbook & Ledger", icon: BookOpenCheck },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function AttendancePage() {
  const people = usePeople((s) => s.people);
  const workers = useMemo(
    () => people.filter((p) => (p.type === "karigar" || p.type === "worker") && p.active),
    [people],
  );
  const navigate = useNavigate();
  const { tab: tabFromSearch } = Route.useSearch();
  const tab: TabKey =
    tabFromSearch && TABS.some((t) => t.key === tabFromSearch)
      ? (tabFromSearch as TabKey)
      : "daily";
  const setTab = (next: TabKey) => {
    void navigate({
      to: "/attendance",
      search: { tab: next },
      replace: true,
    });
  };
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // default-select first worker
  const selectedWorker = useMemo(() => {
    if (selectedWorkerId) return workers.find((w) => w.id === selectedWorkerId) ?? null;
    return workers[0] ?? null;
  }, [workers, selectedWorkerId]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Attendance & Salary"
        subtitle="Stay in/out dates, configurable wage %, allowances, advances, and CA-ready salary sheets — linked to the People register."
      />

      {workers.length === 0 ? (
        <NoWorkersHint />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="flex flex-wrap h-auto bg-card border border-border p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="gap-2 data-[state=active]:bg-accent data-[state=active]:text-gold"
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4 min-w-0">
              <TabsContent value="daily" className="mt-0">
                <WorkerStatusTab workers={workers} />
              </TabsContent>
              <TabsContent value="monthly" className="mt-0">
                <StayHistoryTab workers={workers} />
              </TabsContent>
              <TabsContent value="rules" className="mt-0">
                <SalaryRulesTab workers={workers} selectedWorker={selectedWorker} />
              </TabsContent>
              <TabsContent value="allocation" className="mt-0">
                <AllowancesTab workers={workers} selectedWorker={selectedWorker} />
              </TabsContent>
              <TabsContent value="advances" className="mt-0">
                <GoldAdvanceTab workers={workers} selectedWorker={selectedWorker} />
              </TabsContent>
              <TabsContent value="settlement" className="mt-0">
                <KarigarPeriodSettlementHub
                  workers={workers}
                  selectedWorker={selectedWorker}
                  onWorkerChange={setSelectedWorkerId}
                />
              </TabsContent>
              <TabsContent value="passbook" className="mt-0">
                <PassbookTab selectedWorker={selectedWorker} />
              </TabsContent>
            </div>

            <aside className="lg:sticky lg:top-4 self-start">
              <SelectedWorkerCard
                workers={workers}
                selected={selectedWorker}
                onChange={setSelectedWorkerId}
              />
            </aside>
          </div>
        </Tabs>
      )}
    </div>
  );
}

/* -------------------- Shared bits -------------------- */

function NoWorkersHint() {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 p-10 text-center space-y-3">
      <Hammer className="h-10 w-10 mx-auto text-gold" />
      <div className="font-serif text-xl text-gold">No karigars or workers yet</div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Add a Karigar or Worker from the People / KYC section first. They will then appear here for
        attendance, advances and settlement.
      </p>
      <Link
        to="/people"
        className="inline-flex h-9 items-center rounded-md bg-primary text-primary-foreground text-sm font-medium px-4"
      >
        Go to People / KYC
      </Link>
    </div>
  );
}

function SelectedWorkerCard({
  workers,
  selected,
  onChange,
}: {
  workers: Person[];
  selected: Person | null;
  onChange: (id: string) => void;
}) {
  const rules = useWorkers((s) => s.rules);
  const stays = useWorkers((s) => s.stays);
  const withdrawals = useWorkers((s) => s.withdrawals);
  const loans = useWorkers((s) => s.loans);
  const advances = useWorkers((s) => s.advances);
  const goldAdvances = useWorkers((s) => s.goldAdvances);
  const wastageReturns = useWorkers((s) => s.wastageReturns);
  const settlements = useWorkers((s) => s.settlements);

  if (!selected) return null;

  const rule = activeRuleFor(rules, selected.id);
  const status = workerStatus(selected.id, stays);
  const totalDays = stayDaysForWorker(selected.id, stays);
  const grossSalary = stayEarnedPaise(rule, totalDays);
  const wTotal = withdrawals
    .filter((w) => w.workerId === selected.id)
    .reduce((a, b) => a + b.amountPaise, 0);
  const loanBal = loans
    .filter((l) => l.workerId === selected.id)
    .reduce((a, l) => a + loanOutstandingPaise(l, settlements), 0);
  const advBal = advances
    .filter((a) => a.workerId === selected.id)
    .reduce((s, a) => s + advanceOutstandingPaise(a, settlements), 0);
  const goldAdv = goldAdvances
    .filter((g) => g.workerId === selected.id)
    .reduce((a, b) => a + b.fineMg, 0);
  const wastage = wastageReturns
    .filter((w) => w.workerId === selected.id)
    .reduce((a, b) => a + b.fineMg, 0);
  const netGold = goldAdv - wastage;

  const statusColors: Record<WorkerStatus, string> = {
    not_arrived: "bg-muted text-muted-foreground",
    working: "bg-success/20 text-success border-success/40",
    gone_home: "bg-accent text-gold border-gold/30",
  };
  const statusLabels: Record<WorkerStatus, string> = {
    not_arrived: "Not Arrived",
    working: "Working",
    gone_home: "Gone Home",
  };

  return (
    <div className="rounded-md border border-gold/30 bg-card p-5 shadow-gold space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Selected Worker</Label>
        <Select value={selected.id} onValueChange={onChange}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <PersonProfileAvatar
          personId={selected.id}
          name={selected.fullName}
          className="h-12 w-12 rounded-full"
        />
        <div className="min-w-0">
          <div className="font-serif text-gold truncate">{selected.fullName}</div>
          <div className="text-xs text-muted-foreground">
            {selected.workType ?? "Karigar / Worker"}
          </div>
          <Badge className={`border text-[10px] mt-1 ${statusColors[status]}`}>
            {statusLabels[status]}
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <Row label="Salary rule" value={rule ? SALARY_RULE_LABELS[rule.type] : "Not set"} />
        <Row label="Total days on-site" value={`${totalDays.toFixed(1)} days`} />
        <Row label="Gross salary earned" value={paiseToRupees(grossSalary)} />
        <Row label="Withdrawals total" value={paiseToRupees(wTotal)} />
        <Row label="Loan balance" value={paiseToRupees(loanBal)} />
        <Row label="Advance balance" value={paiseToRupees(advBal)} />
        <Row label="Net payable" value={paiseToRupees(grossSalary - wTotal - loanBal - advBal)} />
        <Row label="Gold advance" value={`${mgToGrams(goldAdv)} g`} />
        <Row label="Wastage returned" value={`${mgToGrams(wastage)} g`} />
        <Row
          label="Net gold"
          value={
            netGold === 0
              ? "0.000 g"
              : netGold > 0
                ? `Worker owes ${mgToGrams(netGold)} g`
                : `Shop holds ${mgToGrams(-netGold)} g credit`
          }
        />
      </div>

      <Link
        to="/attendance/print/$kind/$id"
        params={{ kind: "passbook", id: selected.id }}
        target="_blank"
        className="inline-flex w-full h-9 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium px-3"
      >
        <Printer className="h-3.5 w-3.5 mr-1" /> Print Worker Passbook
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}

function NeedsWorker() {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/30 p-6 text-sm text-muted-foreground text-center">
      Select a worker from the right panel to continue.
    </div>
  );
}

/* -------------------- Worker Status Tab -------------------- */

function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const cls =
    status === "working"
      ? "bg-success/20 text-success border-success/40"
      : status === "gone_home"
        ? "bg-muted text-muted-foreground border-border"
        : "bg-destructive/20 text-destructive border-destructive/40";
  const label =
    status === "working"
      ? "Working (Present)"
      : status === "gone_home"
        ? "Gone Home"
        : "Not Arrived";
  return <Badge className={`border ${cls}`}>{label}</Badge>;
}

function WorkerStatusTab({ workers }: { workers: Person[] }) {
  const attendance = useWorkers((s) => s.attendance);
  const stays = useWorkers((s) => s.stays);
  const markArrived = useWorkers((s) => s.markArrived);
  const markGoneHome = useWorkers((s) => s.markGoneHome);
  const upsertAttendance = useWorkers((s) => s.upsertAttendance);
  const bulkUpsertAttendance = useWorkers((s) => s.bulkUpsertAttendance);
  const rules = useWorkers((s) => s.rules);

  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [arriveDateMap, setArriveDateMap] = useState<Record<string, string>>({});
  const [departDateMap, setDepartDateMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulkDate, setBulkDate] = useState(todayISO());
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("present");
  const [bulkOvertime, setBulkOvertime] = useState("0");
  const [bulkNotes, setBulkNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(workers.map((w) => w.id)),
  );
  const [bulkSaving, setBulkSaving] = useState(false);

  const todaysAttendance = useMemo(
    () => attendance.filter((a) => a.date === bulkDate),
    [attendance, bulkDate],
  );
  const selectedCount = workers.filter((w) => selectedIds.has(w.id)).length;
  const allSelected = workers.length > 0 && selectedCount === workers.length;

  function toggleBulkWorker(workerId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(workerId);
      else next.delete(workerId);
      return next;
    });
  }

  function setAllBulkWorkers(checked: boolean) {
    setSelectedIds(checked ? new Set(workers.map((w) => w.id)) : new Set());
  }

  async function saveBulkAttendance() {
    const selectedWorkers = workers.filter((w) => selectedIds.has(w.id));
    if (!bulkDate) {
      toast.error("Select an attendance date.");
      return;
    }
    if (selectedWorkers.length === 0) {
      toast.error("Select at least one worker.");
      return;
    }
    const overtime = Number(bulkOvertime || "0");
    if (!Number.isFinite(overtime) || overtime < 0 || overtime > 24) {
      toast.error("Overtime must be between 0 and 24 hours.");
      return;
    }

    setBulkSaving(true);
    try {
      const entries = selectedWorkers.map((worker) => ({
        workerId: worker.id,
        date: bulkDate,
        status: bulkStatus,
        overtimeHours: overtime,
        notes: bulkNotes.trim() || undefined,
      }));
      const { captureAttendanceUpsert } = await import("@/lib/offline");
      const queued = await captureAttendanceUpsert({ entries });
      if (queued.mode === "queued") {
        toast.message("Attendance saved offline — Pending Sync");
      } else {
        toast.success(
          `Attendance saved for ${selectedWorkers.length} worker${selectedWorkers.length === 1 ? "" : "s"}.`,
        );
      }
      setBulkNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save bulk attendance.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleArrived(workerId: string) {
    setBusy((b) => ({ ...b, [workerId]: true }));
    try {
      const dateStr = arriveDateMap[workerId] || todayISO();
      const arrivedAt = Date.parse(`${dateStr}T09:00:00`);
      await markArrived(
        workerId,
        notesMap[workerId] || undefined,
        Number.isFinite(arrivedAt) ? arrivedAt : undefined,
      );
      setNotesMap((m) => ({ ...m, [workerId]: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark worker arrived.");
    } finally {
      setBusy((b) => ({ ...b, [workerId]: false }));
    }
  }

  async function handleGoneHome(workerId: string) {
    setBusy((b) => ({ ...b, [workerId]: true }));
    try {
      const dateStr = departDateMap[workerId] || todayISO();
      const departedAt = Date.parse(`${dateStr}T18:00:00`);
      await markGoneHome(
        workerId,
        notesMap[workerId] || undefined,
        Number.isFinite(departedAt) ? departedAt : undefined,
      );
      setNotesMap((m) => ({ ...m, [workerId]: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark worker gone home.");
    } finally {
      setBusy((b) => ({ ...b, [workerId]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-serif text-gold text-lg">Bulk Daily Attendance</div>
            <p className="text-xs text-muted-foreground">
              Mark the daily attendance register for many workers at once. Existing records for the
              same worker and date are updated, not duplicated.
            </p>
          </div>
          <Badge variant="outline">{selectedCount} selected</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-[160px_180px_140px_1fr]">
          <div>
            <Label htmlFor="bulk-attendance-date">Date</Label>
            <Input
              id="bulk-attendance-date"
              type="date"
              value={bulkDate}
              onChange={(event) => setBulkDate(event.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={bulkStatus}
              onValueChange={(value) => setBulkStatus(value as AttendanceStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {ATTENDANCE_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bulk-overtime">Overtime (hours)</Label>
            <Input
              id="bulk-overtime"
              inputMode="decimal"
              value={bulkOvertime}
              onChange={(event) => setBulkOvertime(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bulk-notes">Notes</Label>
            <Input
              id="bulk-notes"
              value={bulkNotes}
              onChange={(event) => setBulkNotes(event.target.value)}
              placeholder="Optional shared note"
            />
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setAllBulkWorkers(checked === true)}
              aria-label="Select all workers"
            />
            <span>Select workers</span>
          </div>
          <div className="max-h-56 overflow-auto divide-y divide-border">
            {workers.map((worker) => {
              const dayRecord = todaysAttendance.find((entry) => entry.workerId === worker.id);
              return (
                <label
                  key={worker.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(worker.id)}
                      onCheckedChange={(checked) => toggleBulkWorker(worker.id, checked === true)}
                      aria-label={`Select ${worker.fullName}`}
                    />
                    <span className="truncate font-medium">{worker.fullName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dayRecord ? ATTENDANCE_LABELS[dayRecord.status] : "Not marked"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Review the selected workers before saving. This writes directly to Supabase attendance.
          </p>
          <Button onClick={saveBulkAttendance} disabled={bulkSaving || selectedCount === 0}>
            {bulkSaving ? "Saving..." : "Save bulk attendance"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div className="font-serif text-gold text-lg">Worker Status</div>
        <p className="text-xs text-muted-foreground">
          Workers from West Bengal stay for weeks or months. Use <strong>Mark Arrived</strong> when
          they arrive and <strong>Gone Home</strong> when they leave. Salary accumulates while
          status is <em>Working</em>.
        </p>
        {workers.length === 0 ? (
          <EmptyHint text="No workers found." />
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden space-y-3">
              {workers.map((w) => {
                const status = workerStatus(w.id, stays);
                const totalDays = stayDaysForWorker(w.id, stays);
                const rule = activeRuleFor(rules, w.id);
                const grossPaise = stayEarnedPaise(rule, totalDays);
                const openStay = openStayFor(w.id, stays);
                const arrivedDate = openStay
                  ? new Date(openStay.arrivedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";
                return (
                  <div key={w.id} className="rounded-md border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{w.fullName}</span>
                      <WorkerStatusBadge status={status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Days</span>
                        <span className="font-medium font-mono">{totalDays.toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">
                          Accrued Salary
                        </span>
                        <span className="font-medium text-gold font-mono">
                          {grossPaise > 0 ? `₹${paiseToRupees(grossPaise)}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">
                          Arrived Date
                        </span>
                        <span className="font-medium">{arrivedDate}</span>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <Input
                        className="h-8 text-xs w-full"
                        placeholder="Notes (optional)"
                        value={notesMap[w.id] ?? ""}
                        onChange={(e) => setNotesMap((m) => ({ ...m, [w.id]: e.target.value }))}
                      />
                      {(status === "not_arrived" || status === "gone_home") && (
                        <Input
                          type="date"
                          className="h-8 text-xs w-full"
                          value={arriveDateMap[w.id] ?? todayISO()}
                          onChange={(e) =>
                            setArriveDateMap((m) => ({ ...m, [w.id]: e.target.value }))
                          }
                        />
                      )}
                      {status === "working" && (
                        <Input
                          type="date"
                          className="h-8 text-xs w-full"
                          value={departDateMap[w.id] ?? todayISO()}
                          onChange={(e) =>
                            setDepartDateMap((m) => ({ ...m, [w.id]: e.target.value }))
                          }
                        />
                      )}
                      <div className="flex gap-2">
                        {(status === "not_arrived" || status === "gone_home") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8 text-success border-success/40"
                            disabled={busy[w.id]}
                            onClick={() => handleArrived(w.id)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Mark Arrived
                          </Button>
                        )}
                        {status === "working" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8 text-muted-foreground"
                            disabled={busy[w.id]}
                            onClick={() => handleGoneHome(w.id)}
                          >
                            Gone Home
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days on-site</TableHead>
                    <TableHead>Salary accrued</TableHead>
                    <TableHead>Arrived</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((w) => {
                    const status = workerStatus(w.id, stays);
                    const totalDays = stayDaysForWorker(w.id, stays);
                    const rule = activeRuleFor(rules, w.id);
                    const grossPaise = stayEarnedPaise(rule, totalDays);
                    const openStay = openStayFor(w.id, stays);
                    const arrivedDate = openStay
                      ? new Date(openStay.arrivedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.fullName}</TableCell>
                        <TableCell>
                          <WorkerStatusBadge status={status} />
                        </TableCell>
                        <TableCell className="tabular-nums">{totalDays.toFixed(1)}</TableCell>
                        <TableCell className="tabular-nums text-gold">
                          {grossPaise > 0 ? `₹${paiseToRupees(grossPaise)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {arrivedDate}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 text-xs w-32"
                            placeholder="Notes (optional)"
                            value={notesMap[w.id] ?? ""}
                            onChange={(e) => setNotesMap((m) => ({ ...m, [w.id]: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {(status === "not_arrived" || status === "gone_home") && (
                              <>
                                <Input
                                  type="date"
                                  className="h-7 text-xs w-36"
                                  value={arriveDateMap[w.id] ?? todayISO()}
                                  onChange={(e) =>
                                    setArriveDateMap((m) => ({ ...m, [w.id]: e.target.value }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 text-success border-success/40"
                                  disabled={busy[w.id]}
                                  onClick={() => handleArrived(w.id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Mark Arrived
                                </Button>
                              </>
                            )}
                            {status === "working" && (
                              <>
                                <Input
                                  type="date"
                                  className="h-7 text-xs w-36"
                                  value={departDateMap[w.id] ?? todayISO()}
                                  onChange={(e) =>
                                    setDepartDateMap((m) => ({ ...m, [w.id]: e.target.value }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 text-muted-foreground"
                                  disabled={busy[w.id]}
                                  onClick={() => handleGoneHome(w.id)}
                                >
                                  Gone Home
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------- Stay History Tab -------------------- */

function StayHistoryTab({ workers }: { workers: Person[] }) {
  const stays = useWorkers((s) => s.stays);
  const rules = useWorkers((s) => s.rules);
  const [filterWorker, setFilterWorker] = useState<string>("all");

  const filteredStays = useMemo(() => {
    return [...stays]
      .filter((s) => filterWorker === "all" || s.workerId === filterWorker)
      .sort((a, b) => b.arrivedAt - a.arrivedAt);
  }, [stays, filterWorker]);

  function stayDays(stay: WorkerStay) {
    const end = stay.departedAt ?? Date.now();
    return Math.max(0, (end - stay.arrivedAt) / 86_400_000);
  }

  return (
    <div className="rounded-md border border-border bg-card p-5 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="font-serif text-gold text-lg">Stay History</div>
        <div>
          <Label className="text-xs">Filter worker</Label>
          <Select value={filterWorker} onValueChange={setFilterWorker}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workers</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {filteredStays.length === 0 ? (
        <EmptyHint text="No stay records yet. Mark workers as Arrived to start tracking." />
      ) : (
        <>
          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {filteredStays.map((stay) => {
              const w = workers.find((x) => x.id === stay.workerId);
              const rule = activeRuleFor(rules, stay.workerId);
              const days = stayDays(stay);
              const earned = stayEarnedPaise(rule, days);
              return (
                <div
                  key={stay.id}
                  className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{w?.fullName ?? "—"}</span>
                    {stay.departedAt ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Departed
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-success/40 text-success bg-success/5 text-[10px]"
                      >
                        Still here
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Arrived</span>
                      <span className="font-medium">{fmtDate(stay.arrivedAt)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Went Home</span>
                      <span className="font-medium">
                        {stay.departedAt ? fmtDate(stay.departedAt) : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Days</span>
                      <span className="font-medium font-mono">{days.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Salary Earned</span>
                      <span className="font-medium text-gold font-mono">
                        {earned > 0 ? `₹${paiseToRupees(earned)}` : "—"}
                      </span>
                    </div>
                  </div>
                  {stay.notes && (
                    <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded">
                      {stay.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Arrived</TableHead>
                  <TableHead>Went Home</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Salary Earned</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStays.map((stay) => {
                  const w = workers.find((x) => x.id === stay.workerId);
                  const rule = activeRuleFor(rules, stay.workerId);
                  const days = stayDays(stay);
                  const earned = stayEarnedPaise(rule, days);
                  return (
                    <TableRow key={stay.id}>
                      <TableCell className="font-medium">{w?.fullName ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(stay.arrivedAt)}</TableCell>
                      <TableCell className="text-xs">
                        {stay.departedAt ? (
                          fmtDate(stay.departedAt)
                        ) : (
                          <span className="text-success text-xs">Still here</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{days.toFixed(1)}</TableCell>
                      <TableCell className="tabular-nums text-gold">
                        {earned > 0 ? `₹${paiseToRupees(earned)}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {stay.notes ?? ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------- Salary Rules -------------------- */

function SalaryRulesTab({
  workers,
  selectedWorker,
}: {
  workers: Person[];
  selectedWorker: Person | null;
}) {
  const setRule = useWorkers((s) => s.setSalaryRule);
  const rules = useWorkers((s) => s.rules);
  const updatePerson = usePeople((s) => s.update);

  const [workerId, setWorkerId] = useState(selectedWorker?.id ?? workers[0]?.id ?? "");
  const selected = workers.find((w) => w.id === workerId) ?? selectedWorker;
  const [type, setType] = useState<SalaryRuleType>("work_based");
  const [monthly, setMonthly] = useState("18000");
  const [perDay, setPerDay] = useState("");
  const [making, setMaking] = useState("");
  const [wastageNotes, setWastageNotes] = useState("");
  const [pctA, setPctA] = useState("1.5");
  const [pctB, setPctB] = useState("");
  const [bookPurity, setBookPurity] = useState("916");
  const [wagePayMode, setWagePayMode] = useState<WagePayMode>("either");
  const [weeklyAllowance, setWeeklyAllowance] = useState("200");
  const [monthlyAllowance, setMonthlyAllowance] = useState("");
  const [compensationMode, setCompensationMode] = useState<
    "wastage_only" | "monthly_only" | "monthly_and_wastage"
  >(selected?.compensationMode ?? "monthly_and_wastage");
  const [effective, setEffective] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  async function submit() {
    if (!workerId) return;
    const components = [pctA, pctB]
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    await setRule({
      workerId,
      type,
      monthlySalaryPaise: type === "fixed_monthly" && monthly ? rupeesToPaise(monthly) : undefined,
      perDayPaise: type === "per_day" && perDay ? rupeesToPaise(perDay) : undefined,
      makingRatePaise: type === "making_charge" && making ? rupeesToPaise(making) : undefined,
      wastageNotes: type === "wastage_basis" ? wastageNotes || undefined : undefined,
      wagePctComponents:
        type === "work_based" ? (components.length ? components : [1.5]) : undefined,
      bookPurityPermille:
        type === "work_based" ? Math.round(Number(bookPurity) || 916) : undefined,
      wagePayMode: type === "work_based" ? wagePayMode : undefined,
      weeklyAllowancePaise: weeklyAllowance ? rupeesToPaise(weeklyAllowance) : undefined,
      monthlyAllowancePaise: monthlyAllowance ? rupeesToPaise(monthlyAllowance) : undefined,
      effectiveDate: effective,
      active: true,
      notes: notes || undefined,
    });
    await updatePerson(workerId, { compensationMode });
    setSavedMsg("Salary rule saved.");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  const pctPreview = [pctA, pctB]
    .map((s) => Number(String(s).trim()) || 0)
    .reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-5">
        <div className="font-serif text-gold text-lg mb-3">Set Salary Rule</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Worker</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Compensation mode</Label>
            <Select
              value={compensationMode}
              onValueChange={(v) =>
                setCompensationMode(v as "wastage_only" | "monthly_only" | "monthly_and_wastage")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(COMPENSATION_MODE_LABELS) as Array<
                    keyof typeof COMPENSATION_MODE_LABELS
                  >
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {COMPENSATION_MODE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Salary-only workers never get wastage settlement.
            </p>
          </div>
          <div>
            <Label>Salary type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SalaryRuleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SALARY_RULE_LABELS) as SalaryRuleType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SALARY_RULE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "fixed_monthly" && (
            <div>
              <Label>Monthly salary (₹)</Label>
              <Input
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="18000"
              />
            </div>
          )}
          {type === "per_day" && (
            <div>
              <Label>Per-day wage (₹)</Label>
              <Input value={perDay} onChange={(e) => setPerDay(e.target.value)} placeholder="600" />
            </div>
          )}
          {type === "making_charge" && (
            <div>
              <Label>Making rate (₹ / g of finished work)</Label>
              <Input value={making} onChange={(e) => setMaking(e.target.value)} placeholder="350" />
            </div>
          )}
          {type === "wastage_basis" && (
            <div className="md:col-span-2">
              <Label>Wastage basis notes</Label>
              <Textarea
                value={wastageNotes}
                onChange={(e) => setWastageNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}
          {type === "work_based" && (
            <>
              <div>
                <Label>Wage % component A</Label>
                <Input value={pctA} onChange={(e) => setPctA(e.target.value)} placeholder="1.5" />
              </div>
              <div>
                <Label>Wage % component B (optional)</Label>
                <Input value={pctB} onChange={(e) => setPctB(e.target.value)} placeholder="1.5" />
              </div>
              <div className="md:col-span-2 text-xs text-muted-foreground">
                Total wage = {pctPreview.toFixed(2)}% of gold worked. Example: 200 g × 1.5% = 3 g,
                then minus overloss. Leave B empty for a single %.
              </div>
              <div>
                <Label>Book purity (‰)</Label>
                <Select value={bookPurity} onValueChange={setBookPurity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_PURITIES.map((p) => (
                      <SelectItem key={p.value} value={String(p.value)}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pay wage as</Label>
                <Select value={wagePayMode} onValueChange={(v) => setWagePayMode(v as WagePayMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WAGE_PAY_MODE_LABELS) as WagePayMode[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {WAGE_PAY_MODE_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div>
            <Label>Configured weekly allowance (₹)</Label>
            <Input
              value={weeklyAllowance}
              onChange={(e) => setWeeklyAllowance(e.target.value)}
              placeholder="200"
            />
          </div>
          <div>
            <Label>Configured monthly allowance (₹)</Label>
            <Input
              value={monthlyAllowance}
              onChange={(e) => setMonthlyAllowance(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div>
            <Label>Effective from</Label>
            <Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button onClick={() => void submit()}>Save salary rule</Button>
            {savedMsg && <span className="text-sm text-success">{savedMsg}</span>}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <div className="font-serif text-gold text-lg mb-3">Active Rules</div>
        {rules.filter((r) => r.active).length === 0 ? (
          <EmptyHint text="No salary rules set yet." />
        ) : (
          <>
            {/* Mobile view */}
            <div className="md:hidden space-y-3">
              {rules
                .filter((r) => r.active)
                .map((r) => {
                  const w = workers.find((x) => x.id === r.workerId);
                  const amount =
                    r.type === "fixed_monthly"
                      ? `${paiseToRupees(r.monthlySalaryPaise ?? 0)} / month`
                      : r.type === "per_day"
                        ? `${paiseToRupees(r.perDayPaise ?? 0)} / day`
                        : r.type === "making_charge"
                          ? `${paiseToRupees(r.makingRatePaise ?? 0)} / g`
                          : r.type === "work_based"
                            ? `${wagePctTotal(r).toFixed(2)}% of gold worked`
                            : "—";
                  return (
                    <div
                      key={r.id}
                      className="rounded-md border border-border bg-muted/20 p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{w?.fullName ?? "—"}</span>
                        <span className="text-muted-foreground">{r.effectiveDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>
                          Type:{" "}
                          <strong className="font-medium">{SALARY_RULE_LABELS[r.type]}</strong>
                        </span>
                        <span className="font-mono text-gold font-semibold">{amount}</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Desktop view */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Effective</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules
                    .filter((r) => r.active)
                    .map((r) => {
                      const w = workers.find((x) => x.id === r.workerId);
                      const amount =
                        r.type === "fixed_monthly"
                          ? `${paiseToRupees(r.monthlySalaryPaise ?? 0)} / month`
                          : r.type === "per_day"
                            ? `${paiseToRupees(r.perDayPaise ?? 0)} / day`
                            : r.type === "making_charge"
                              ? `${paiseToRupees(r.makingRatePaise ?? 0)} / g`
                              : r.type === "work_based"
                                ? `${wagePctTotal(r).toFixed(2)}% · ${r.bookPurityPermille ?? "—"}‰`
                                : "—";
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{w?.fullName ?? "—"}</TableCell>
                          <TableCell>{SALARY_RULE_LABELS[r.type]}</TableCell>
                          <TableCell>{amount}</TableCell>
                          <TableCell>{r.effectiveDate}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------- Withdrawals -------------------- */

function WithdrawalsTab({
  workers,
  selectedWorker,
}: {
  workers: Person[];
  selectedWorker: Person | null;
}) {
  const add = useWorkers((s) => s.addWithdrawal);
  const list = useWorkers((s) => s.withdrawals);

  return (
    <div className="space-y-5">
      <CashEventForm
        title="Add Withdrawal"
        workers={workers}
        selectedWorker={selectedWorker}
        onSubmit={(d) =>
          add({
            workerId: d.workerId,
            date: d.date,
            amountPaise: d.amountPaise,
            mode: d.mode ?? "cash",
            reason: d.reason,
            notes: d.notes,
          })
        }
        printKind="withdrawal"
        list={list}
      />
      <CashEventList
        title="Recent withdrawals"
        items={list}
        workers={workers}
        printKind="withdrawal"
      />
    </div>
  );
}

/* -------------------- Loans -------------------- */

function LoansTab({
  workers,
  selectedWorker,
}: {
  workers: Person[];
  selectedWorker: Person | null;
}) {
  const loans = useWorkers((s) => s.loans);
  const settlements = useWorkers((s) => s.settlements);

  return (
    <div className="space-y-5">
      <CashEventForm
        title="Add Loan"
        workers={workers}
        selectedWorker={selectedWorker}
        onSubmit={(d) => {
          void (async () => {
            const { captureAttendanceLoan, PENDING_SYNC_GENERIC } = await import("@/lib/offline");
            const { OnlineRequiredError } = await import("@/lib/offline/queue");
            try {
              const queued = await captureAttendanceLoan({
                workerId: d.workerId,
                date: d.date,
                amountPaise: d.amountPaise,
                reason: d.reason,
                notes: d.notes,
              });
              if (queued.mode === "queued") {
                const { toast } = await import("sonner");
                toast.message(PENDING_SYNC_GENERIC);
              }
            } catch (err) {
              const { toast } = await import("sonner");
              toast.error(
                err instanceof OnlineRequiredError
                  ? err.message
                  : err instanceof Error
                    ? err.message
                    : "Could not record loan.",
              );
            }
          })();
        }}
        printKind="loan"
        list={loans}
        showMode={false}
      />
      <div className="rounded-md border border-border bg-card p-5">
        <div className="font-serif text-gold text-lg mb-3">Loans</div>
        {loans.length === 0 ? (
          <EmptyHint text="No loans recorded." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Slip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...loans]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((l) => {
                  const w = workers.find((x) => x.id === l.workerId);
                  const out = loanOutstandingPaise(l, settlements);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.date}</TableCell>
                      <TableCell>{w?.fullName ?? "—"}</TableCell>
                      <TableCell>{paiseToRupees(l.amountPaise)}</TableCell>
                      <TableCell className={out === 0 ? "text-success" : "text-gold"}>
                        {paiseToRupees(out)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.reason ?? ""}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/attendance/print/$kind/$id"
                          params={{ kind: "loan", id: l.id }}
                          target="_blank"
                          className="text-xs text-gold underline"
                        >
                          Print
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/* -------------------- Salary advances -------------------- */

function SalaryAdvanceTab({
  workers,
  selectedWorker,
}: {
  workers: Person[];
  selectedWorker: Person | null;
}) {
  const add = useWorkers((s) => s.addAdvance);
  const list = useWorkers((s) => s.advances);

  return (
    <div className="space-y-5">
      <CashEventForm
        title="Add Salary Advance"
        workers={workers}
        selectedWorker={selectedWorker}
        onSubmit={(d) =>
          add({
            workerId: d.workerId,
            date: d.date,
            amountPaise: d.amountPaise,
            mode: d.mode!,
            notes: d.notes,
          })
        }
        printKind="advance"
        list={list}
      />
      <CashEventList title="Salary advances" items={list} workers={workers} printKind="advance" />
    </div>
  );
}

/* -------------------- Cash event reusable form/list -------------------- */

interface CashEventSubmit {
  workerId: string;
  date: string;
  amountPaise: number;
  mode?: PayMode;
  reason?: string;
  notes?: string;
}

function CashEventForm({
  title,
  workers,
  selectedWorker,
  onSubmit,
  showMode = true,
}: {
  title: string;
  workers: Person[];
  selectedWorker: Person | null;
  onSubmit: (d: CashEventSubmit) => void;
  printKind: string;
  list: { workerId: string }[];
  showMode?: boolean;
}) {
  const [workerId, setWorkerId] = useState(selectedWorker?.id ?? workers[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PayMode>("cash");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");

  function submit() {
    setErr("");
    if (!workerId) {
      setErr("Worker is required.");
      return;
    }
    if (!date) {
      setErr("Date is required.");
      return;
    }
    if (!amount) {
      setErr("Amount is required.");
      return;
    }
    try {
      const paise = rupeesToPaise(amount);
      if (paise <= 0) {
        setErr("Amount must be positive.");
        return;
      }
      onSubmit({
        workerId,
        date,
        amountPaise: paise,
        mode: showMode ? mode : undefined,
        reason: reason || undefined,
        notes: notes || undefined,
      });
      setSaved(`Saved ${paiseToRupees(paise)}.`);
      setAmount("");
      setReason("");
      setNotes("");
      setTimeout(() => setSaved(""), 2500);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="font-serif text-gold text-lg mb-3">{title}</div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-1">
          <Label>Worker</Label>
          <Select value={workerId} onValueChange={setWorkerId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Amount (₹)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
        </div>
        {showMode && (
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAY_MODE_LABELS) as PayMode[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PAY_MODE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="md:col-span-2">
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="md:col-span-3 flex items-center gap-3">
          <Button onClick={submit}>
            <Plus className="h-4 w-4 mr-1" />
            Save
          </Button>
          {err && <span className="text-sm text-destructive">{err}</span>}
          {saved && <span className="text-sm text-success">{saved}</span>}
        </div>
      </div>
    </div>
  );
}

function CashEventList({
  title,
  items,
  workers,
  printKind,
}: {
  title: string;
  items: {
    id: string;
    workerId: string;
    date: string;
    amountPaise: number;
    mode?: PayMode;
    reason?: string;
  }[];
  workers: Person[];
  printKind: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="font-serif text-gold text-lg mb-3">{title}</div>
      {items.length === 0 ? (
        <EmptyHint text="Nothing recorded yet." />
      ) : (
        <>
          {/* Mobile view */}
          <div className="md:hidden space-y-3">
            {[...items]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((it) => {
                const w = workers.find((x) => x.id === it.workerId);
                return (
                  <div
                    key={it.id}
                    className="rounded-md border border-border bg-muted/20 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{w?.fullName ?? "—"}</span>
                      <span className="text-muted-foreground">{it.date}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span>
                        Amount:{" "}
                        <strong className="text-gold font-sans font-semibold">
                          ₹{paiseToRupees(it.amountPaise)}
                        </strong>
                      </span>
                      <span>{it.mode ? PAY_MODE_LABELS[it.mode] : "—"}</span>
                    </div>
                    {it.reason && (
                      <div className="text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded">
                        {it.reason}
                      </div>
                    )}
                    <div className="flex justify-end pt-1">
                      <Link
                        to="/attendance/print/$kind/$id"
                        params={{ kind: printKind, id: it.id }}
                        target="_blank"
                        className="text-xs text-gold hover:underline font-semibold"
                      >
                        Print Slip
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Slip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...items]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((it) => {
                    const w = workers.find((x) => x.id === it.workerId);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{it.date}</TableCell>
                        <TableCell>{w?.fullName ?? "—"}</TableCell>
                        <TableCell>{paiseToRupees(it.amountPaise)}</TableCell>
                        <TableCell>{it.mode ? PAY_MODE_LABELS[it.mode] : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {it.reason ?? ""}
                        </TableCell>
                        <TableCell>
                          <Link
                            to="/attendance/print/$kind/$id"
                            params={{ kind: printKind, id: it.id }}
                            target="_blank"
                            className="text-xs text-gold underline"
                          >
                            Print
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------- Gold Advance -------------------- */

function GoldAdvanceTab({
  workers,
  selectedWorker,
}: {
  workers: Person[];
  selectedWorker: Person | null;
}) {
  const add = useWorkers((s) => s.addGoldAdvance);
  const list = useWorkers((s) => s.goldAdvances);

  return (
    <div className="space-y-5">
      <GoldEventForm
        title="Add Gold Advance"
        helpText="Gold given to worker as personal advance. Reduces vault and creates a worker_gold_advance ledger entry."
        workers={workers}
        selectedWorker={selectedWorker}
        onSubmit={async ({ workerId, date, grossMg, purity, fineMg, reason, notes }) => {
          await add({
            workerId,
            date,
            grossMg,
            purity,
            fineMg,
            reason,
            notes,
          });
        }}
      />
      <GoldEventList
        title="Gold advances"
        items={list}
        workers={workers}
        printKind="gold_advance"
      />
    </div>
  );
}



function GoldEventForm({
  title,
  helpText,
  workers,
  selectedWorker,
  onSubmit,
}: {
  title: string;
  helpText: string;
  workers: Person[];
  selectedWorker: Person | null;
  onSubmit: (d: {
    workerId: string;
    date: string;
    grossMg: number;
    purity: number;
    fineMg: number;
    reason?: string;
    notes?: string;
  }) => void;
}) {
  const [workerId, setWorkerId] = useState(selectedWorker?.id ?? workers[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [gross, setGross] = useState("");
  const [purityStr, setPurityStr] = useState("916");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");

  const preview = useMemo(() => {
    try {
      if (!gross) return null;
      const grossMg = gramsToMg(gross);
      const purity = parsePurity(purityStr);
      return { grossMg, purity, fineMg: fineGoldMg(grossMg, purity) };
    } catch {
      return null;
    }
  }, [gross, purityStr]);

  function submit() {
    setErr("");
    if (!workerId) {
      setErr("Worker selection is required.");
      return;
    }
    if (!date) {
      setErr("Date is required.");
      return;
    }
    if (!gross) {
      setErr("Gross weight is required.");
      return;
    }
    try {
      const grossMg = gramsToMg(gross);
      if (grossMg <= 0) {
        setErr("Gross weight must be positive.");
        return;
      }
      const purity = parsePurity(purityStr);
      if (purity <= 0 || purity > 999) {
        setErr("Purity must be a valid number between 1 and 999.");
        return;
      }
      const fine = fineGoldMg(grossMg, purity);
      onSubmit({
        workerId,
        date,
        grossMg,
        purity,
        fineMg: fine,
        reason: reason || undefined,
        notes: notes || undefined,
      });
      setSaved(`Saved. Fine gold = ${mgToGrams(fine)} g.`);
      setGross("");
      setReason("");
      setNotes("");
      setTimeout(() => setSaved(""), 3000);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="font-serif text-gold text-lg">{title}</div>
      <p className="text-xs text-muted-foreground mb-3">{helpText}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label>Worker</Label>
          <Select value={workerId} onValueChange={setWorkerId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Gross weight (g)</Label>
          <Input value={gross} onChange={(e) => setGross(e.target.value)} placeholder="2.000" />
        </div>
        <div>
          <Label>Purity / touch</Label>
          <Select value={purityStr} onValueChange={setPurityStr}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_PURITIES.map((p) => (
                <SelectItem key={p.value} value={String(p.value)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Reason / notes</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <Label>Extra notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="md:col-span-3 flex items-center gap-4 flex-wrap">
          <Button onClick={submit}>
            <Plus className="h-4 w-4 mr-1" />
            Save
          </Button>
          {preview && (
            <div className="text-sm text-muted-foreground">
              Fine gold preview:{" "}
              <span className="text-gold font-medium">{mgToGrams(preview.fineMg)} g</span>
            </div>
          )}
          {err && <span className="text-sm text-destructive">{err}</span>}
          {saved && <span className="text-sm text-success">{saved}</span>}
        </div>
      </div>
    </div>
  );
}

function GoldEventList({
  title,
  items,
  workers,
  printKind,
}: {
  title: string;
  items: {
    id: string;
    workerId: string;
    date: string;
    grossMg: number;
    purity: number;
    fineMg: number;
    reason?: string;
  }[];
  workers: Person[];
  printKind: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="font-serif text-gold text-lg mb-3">{title}</div>
      {items.length === 0 ? (
        <EmptyHint text="Nothing recorded yet." />
      ) : (
        <>
          {/* Mobile view */}
          <div className="md:hidden space-y-3">
            {[...items]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((it) => {
                const w = workers.find((x) => x.id === it.workerId);
                return (
                  <div
                    key={it.id}
                    className="rounded-md border border-border bg-muted/20 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{w?.fullName ?? "—"}</span>
                      <span className="text-muted-foreground">{it.date}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px] bg-muted/40 p-2 rounded-lg">
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Gross
                        </span>
                        <span>{mgToGrams(it.grossMg)} g</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Purity
                        </span>
                        <span>{it.purity}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Fine
                        </span>
                        <span className="text-gold font-semibold">{mgToGrams(it.fineMg)} g</span>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Link
                        to="/attendance/print/$kind/$id"
                        params={{ kind: printKind, id: it.id }}
                        target="_blank"
                        className="text-xs text-gold hover:underline font-semibold"
                      >
                        Print Slip
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Gross (g)</TableHead>
                  <TableHead>Purity</TableHead>
                  <TableHead>Fine (g)</TableHead>
                  <TableHead>Slip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...items]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((it) => {
                    const w = workers.find((x) => x.id === it.workerId);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{it.date}</TableCell>
                        <TableCell>{w?.fullName ?? "—"}</TableCell>
                        <TableCell>{mgToGrams(it.grossMg)}</TableCell>
                        <TableCell>{it.purity}</TableCell>
                        <TableCell className="text-gold">{mgToGrams(it.fineMg)}</TableCell>
                        <TableCell>
                          <Link
                            to="/attendance/print/$kind/$id"
                            params={{ kind: printKind, id: it.id }}
                            target="_blank"
                            className="text-xs text-gold underline"
                          >
                            Print
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------- Salary Settlement -------------------- */

function SettlementTab({
  workers,
  selectedWorker,
}: {
  workers: Person[];
  selectedWorker: Person | null;
}) {
  const stays = useWorkers((s) => s.stays);
  const rules = useWorkers((s) => s.rules);
  const withdrawals = useWorkers((s) => s.withdrawals);
  const loans = useWorkers((s) => s.loans);
  const advances = useWorkers((s) => s.advances);
  const allowances = useWorkers((s) => s.allowances);
  const goldAdvances = useWorkers((s) => s.goldAdvances);
  const wastageReturns = useWorkers((s) => s.wastageReturns);
  const settlements = useWorkers((s) => s.settlements);
  const addSettlement = useWorkers((s) => s.addSettlement);
  const goldRatePerGramPaise = useSettings((s) => s.goldRatePerGramPaise);

  const [workerId, setWorkerId] = useState(selectedWorker?.id ?? workers[0]?.id ?? "");
  const [fromDate, setFromDate] = useState(monthKey(todayISO()) + "-01");
  const [toDate, setToDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [overlossG, setOverlossG] = useState("0");
  const [gramsOverrideG, setGramsOverrideG] = useState("");
  const [wagePayOut, setWagePayOut] = useState<"gold" | "cash">("gold");
  const [performanceRating, setPerformanceRating] = useState<PerformanceRating>("good");
  const [performanceNote, setPerformanceNote] = useState("");
  const [rateOverride, setRateOverride] = useState("");

  if (!workerId) return <NeedsWorker />;

  const worker = workers.find((w) => w.id === workerId);
  const allowsWastage = workerAllowsWastage(worker?.compensationMode);
  const rule = activeRuleFor(rules, workerId);
  const daysWorked = stayDaysInPeriod(workerId, stays, fromDate, toDate);
  const salaryEarned =
    rule?.type === "work_based" ? 0 : stayEarnedPaise(rule, daysWorked);

  const autoWorkedMg = gramsWorkedMgForWorker(workerId, fromDate, toDate);
  const gramsWorkedMg = gramsOverrideG.trim()
    ? gramsToMg(Number(gramsOverrideG) || 0)
    : autoWorkedMg;
  const wagePct = wagePctTotal(rule);
  const overlossMg = gramsToMg(Number(overlossG) || 0);
  const { wageGrossMg, wageNetMg } = computeWorkBasedWageMg({
    gramsWorkedMg,
    wagePct,
    overlossMg,
  });
  const ratePaise =
    rateOverride.trim() !== ""
      ? rupeesToPaise(rateOverride)
      : goldRatePerGramPaise || 0;
  const wageCash = wageGoldCashPaise(wageNetMg, ratePaise);
  const bookPurity = rule?.bookPurityPermille ?? 916;
  const effectivePayOut: "gold" | "cash" =
    rule?.wagePayMode === "cash_at_rate"
      ? "cash"
      : rule?.wagePayMode === "book_purity_gold"
        ? "gold"
        : wagePayOut;

  const workerWithdrawals = withdrawals.filter(
    (w) => w.workerId === workerId && w.date >= fromDate && w.date <= toDate,
  );
  const withdrawalsTotal = workerWithdrawals.reduce((a, b) => a + b.amountPaise, 0);

  const allowanceTotal = allowances
    .filter((a) => a.workerId === workerId && a.date >= fromDate && a.date <= toDate)
    .reduce((a, b) => a + b.amountPaise, 0);

  const workerLoans = loans.filter((l) => l.workerId === workerId);
  const workerAdvances = advances.filter((a) => a.workerId === workerId);

  const wageCashAdd = effectivePayOut === "cash" ? wageCash : 0;
  let remainingCash = Math.max(
    0,
    salaryEarned + wageCashAdd - withdrawalsTotal - allowanceTotal,
  );
  const advanceDeductions: Record<string, number> = {};
  for (const a of workerAdvances) {
    const out = advanceOutstandingPaise(a, settlements);
    if (out <= 0) continue;
    const apply = Math.min(remainingCash, out);
    if (apply > 0) {
      advanceDeductions[a.id] = apply;
      remainingCash -= apply;
    }
  }
  const advanceDeductionTotal = Object.values(advanceDeductions).reduce((a, b) => a + b, 0);

  const loanDeductions: Record<string, number> = {};
  for (const l of workerLoans) {
    const out = loanOutstandingPaise(l, settlements);
    if (out <= 0) continue;
    const apply = Math.min(remainingCash, out);
    if (apply > 0) {
      loanDeductions[l.id] = apply;
      remainingCash -= apply;
    }
  }
  const loanDeductionTotal = Object.values(loanDeductions).reduce((a, b) => a + b, 0);

  const finalCash =
    salaryEarned +
    wageCashAdd -
    withdrawalsTotal -
    allowanceTotal -
    advanceDeductionTotal -
    loanDeductionTotal;

  const goldAdvFine = goldAdvances
    .filter((g) => g.workerId === workerId && g.date >= fromDate && g.date <= toDate)
    .reduce((a, b) => a + b.fineMg, 0);
  const wastageFine = allowsWastage
    ? wastageReturns
        .filter((w) => w.workerId === workerId && w.date >= fromDate && w.date <= toDate)
        .reduce((a, b) => a + b.fineMg, 0)
    : 0;
  const netGoldMg = goldAdvFine - wastageFine;

  const carryLoan = workerLoans.reduce(
    (a, l) => a + Math.max(0, loanOutstandingPaise(l, settlements) - (loanDeductions[l.id] ?? 0)),
    0,
  );

  async function confirm() {
    if (!worker) return;
    try {
      const s = await addSettlement({
        workerId,
        fromDate,
        toDate,
        presentDays: Math.round(daysWorked),
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        payableDays: Math.round(daysWorked),
        daysWorked: Math.round(daysWorked * 10) / 10,
        salaryEarnedPaise: salaryEarned,
        withdrawalsTotalPaise: withdrawalsTotal,
        loanDeductionPaise: loanDeductionTotal,
        advanceDeductionPaise: advanceDeductionTotal,
        allowanceTotalPaise: allowanceTotal,
        finalCashPayablePaise: finalCash,
        loanDeductions,
        advanceDeductions,
        goldAdvanceFineMg: goldAdvFine,
        wastageReturnedFineMg: wastageFine,
        netGoldMg,
        gramsWorkedMg,
        wagePctApplied: wagePct,
        wageGrossMg,
        overlossDeductedMg: overlossMg,
        wageNetMg,
        wageBookPurity: bookPurity,
        wageCashPaise: wageCash,
        wagePayOutMode: effectivePayOut,
        performanceRating,
        performanceNote: performanceNote || undefined,
        notes: notes || undefined,
      });
      setConfirmedId(s.id);
      setOpenConfirm(false);
    } catch {
      // toast is shown by the store on failure
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-5">
        <div className="font-serif text-gold text-lg mb-3">Salary Settlement Sheet</div>
        <p className="text-xs text-muted-foreground mb-3">
          Days worked come from incoming / outgoing stay dates. Work-based wage = % of gold
          issued − overloss, paid in book purity gold or cash at today&apos;s rate.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Worker</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Period from</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label>Period to</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <Label>Gold worked override (g)</Label>
            <Input
              value={gramsOverrideG}
              onChange={(e) => setGramsOverrideG(e.target.value)}
              placeholder={`${mgToGrams(autoWorkedMg)} auto`}
            />
          </div>
          <div>
            <Label>Overloss (g)</Label>
            <Input value={overlossG} onChange={(e) => setOverlossG(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Rate ₹/g (cash conversion)</Label>
            <Input
              value={rateOverride}
              onChange={(e) => setRateOverride(e.target.value)}
              placeholder={
                goldRatePerGramPaise ? String(goldRatePerGramPaise / 100) : "set in settings"
              }
            />
          </div>
          {(rule?.wagePayMode === "either" || !rule?.wagePayMode) && wageNetMg > 0 && (
            <div>
              <Label>Settle wage as</Label>
              <Select
                value={wagePayOut}
                onValueChange={(v) => setWagePayOut(v as "gold" | "cash")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Book purity gold</SelectItem>
                  <SelectItem value="cash">Cash at rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Performance</Label>
            <Select
              value={performanceRating}
              onValueChange={(v) => setPerformanceRating(v as PerformanceRating)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERFORMANCE_RATING_LABELS) as PerformanceRating[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERFORMANCE_RATING_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Performance note</Label>
            <Input
              value={performanceNote}
              onChange={(e) => setPerformanceNote(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="md:col-span-3">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-5 space-y-2">
          <div className="font-serif text-gold text-lg mb-2">Cash Side</div>
          <Row label="Days worked (in → out)" value={daysWorked.toFixed(1)} />
          <Row label="Fixed / stay salary" value={paiseToRupees(salaryEarned)} />
          {effectivePayOut === "cash" && (
            <Row label="+ Wage as cash" value={paiseToRupees(wageCash)} />
          )}
          <Row label="− Withdrawals" value={paiseToRupees(withdrawalsTotal)} />
          <Row label="− Allowances paid" value={paiseToRupees(allowanceTotal)} />
          <Row label="− Salary advances applied" value={paiseToRupees(advanceDeductionTotal)} />
          <Row label="− Loan deducted" value={paiseToRupees(loanDeductionTotal)} />
          <div className="border-t border-border my-2" />
          <div className="flex justify-between text-base">
            <span className="font-medium">Final cash payable</span>
            <span
              className={
                finalCash >= 0
                  ? "text-success font-serif text-xl"
                  : "text-destructive font-serif text-xl"
              }
            >
              {paiseToRupees(finalCash)}
            </span>
          </div>
          {carryLoan > 0 && (
            <p className="text-xs text-warning">
              Loan balance carried forward: {paiseToRupees(carryLoan)}
            </p>
          )}
        </div>

        <div className="rounded-md border border-border bg-card p-5 space-y-2">
          <div className="font-serif text-gold text-lg mb-2">Wage Gold</div>
          <Row label="Gold worked" value={`${mgToGrams(gramsWorkedMg)} g`} />
          <Row label={`Wage ${wagePct.toFixed(2)}%`} value={`${mgToGrams(wageGrossMg)} g`} />
          <Row label="− Overloss" value={`${mgToGrams(overlossMg)} g`} />
          <div className="border-t border-border my-2" />
          <Row
            label={`We owe (book ${bookPurity}‰)`}
            value={`${mgToGrams(wageNetMg)} g`}
          />
          <Row label="Cash equivalent @ rate" value={paiseToRupees(wageCash)} />
          <p className="text-xs text-muted-foreground pt-1">
            {effectivePayOut === "gold"
              ? "Paying in book-purity gold — cash line is for reference / CA."
              : "Paying wage in cash at today's rate."}
          </p>
          {!allowsWastage && (
            <p className="text-xs text-muted-foreground">
              Salary-only worker — wastage not applied on this sheet.
            </p>
          )}
          {allowsWastage && (
            <>
              <div className="border-t border-border my-2" />
              <Row label="Gold advance (fine)" value={`${mgToGrams(goldAdvFine)} g`} />
              <Row label="− Wastage returned (fine)" value={`${mgToGrams(wastageFine)} g`} />
              <Row
                label="Net custody gold"
                value={
                  netGoldMg === 0
                    ? "Settled"
                    : netGoldMg > 0
                      ? `Worker owes ${mgToGrams(netGoldMg)} g`
                      : `Shop holds ${mgToGrams(-netGoldMg)} g credit`
                }
              />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Button size="lg" onClick={() => setOpenConfirm(true)}>
          <FileCheck2 className="h-4 w-4 mr-1" />
          Confirm Salary Sheet
        </Button>
        {confirmedId && (
          <>
            <Link
              to="/attendance/print/$kind/$id"
              params={{ kind: "settlement", id: confirmedId }}
              target="_blank"
              className="inline-flex h-10 items-center rounded-md bg-secondary text-secondary-foreground text-sm px-4"
            >
              <Printer className="h-4 w-4 mr-1" />
              Print Salary Sheet
            </Link>
            <Link
              to="/attendance/print/$kind/$id"
              params={{ kind: "passbook", id: workerId }}
              target="_blank"
              className="inline-flex h-10 items-center rounded-md bg-secondary text-secondary-foreground text-sm px-4"
            >
              <Printer className="h-4 w-4 mr-1" />
              Open Worker Passbook
            </Link>
            <Badge className="bg-success/20 text-success border border-success/40">
              Settlement saved
            </Badge>
          </>
        )}
      </div>

      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm salary settlement?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Worker <span className="font-medium">{worker?.fullName}</span> · period {fromDate} →{" "}
              {toDate} · {daysWorked.toFixed(1)} days worked.
            </p>
            <p>
              Wage gold owed:{" "}
              <span className="text-gold font-medium">{mgToGrams(wageNetMg)} g</span> (
              {effectivePayOut === "cash" ? "as cash" : `at ${bookPurity}‰`})
            </p>
            <p>
              Final cash payable:{" "}
              <span className="text-gold font-medium">{paiseToRupees(finalCash)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Recorded on the salary ledger / passbook. Print the CA-ready salary sheet after
              confirm.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => void confirm()}>Yes, confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Allowances -------------------- */

function AllowancesTab({
  workers,
  selectedWorker,
}: {
  workers: Person[];
  selectedWorker: Person | null;
}) {
  const add = useWorkers((s) => s.addAllowance);
  const list = useWorkers((s) => s.allowances);
  const rules = useWorkers((s) => s.rules);

  const [workerId, setWorkerId] = useState(selectedWorker?.id ?? workers[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("200");
  const [kind, setKind] = useState<WorkerAllowancePayment["kind"]>("weekly_food");
  const [mode, setMode] = useState<PayMode>("cash");
  const [notes, setNotes] = useState("");

  const rule = workerId ? activeRuleFor(rules, workerId) : undefined;

  async function submit() {
    if (!workerId || !amount.trim()) return;
    await add({
      workerId,
      date,
      amountPaise: rupeesToPaise(amount),
      kind,
      mode,
      notes: notes || undefined,
    });
    setNotes("");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-5">
        <div className="font-serif text-gold text-lg mb-3">Record Allowance</div>
        <p className="text-xs text-muted-foreground mb-3">
          Weekly food / pocket money and other allowances post to the salary ledger and appear on
          the final salary sheet.
          {rule?.weeklyAllowancePaise
            ? ` Configured weekly: ${paiseToRupees(rule.weeklyAllowancePaise)}.`
            : ""}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Worker</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Kind</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as WorkerAllowancePayment["kind"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ALLOWANCE_KIND_LABELS) as WorkerAllowancePayment["kind"][]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {ALLOWANCE_KIND_LABELS[k]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAY_MODE_LABELS) as PayMode[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PAY_MODE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => void submit()}>Save allowance</Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <div className="font-serif text-gold text-lg mb-3">Allowances</div>
        {list.length === 0 ? (
          <EmptyHint text="No allowances recorded." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...list]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((a) => {
                  const w = workers.find((x) => x.id === a.workerId);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{a.date}</TableCell>
                      <TableCell>{w?.fullName ?? "—"}</TableCell>
                      <TableCell>{ALLOWANCE_KIND_LABELS[a.kind]}</TableCell>
                      <TableCell>{paiseToRupees(a.amountPaise)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.notes ?? ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/* -------------------- Worker Passbook -------------------- */

function PassbookTab({ selectedWorker }: { selectedWorker: Person | null }) {
  if (!selectedWorker) return <NeedsWorker />;
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-serif text-gold text-lg">
          Worker Passbook — {selectedWorker.fullName}
        </div>
        <Link
          to="/attendance/print/$kind/$id"
          params={{ kind: "passbook", id: selectedWorker.id }}
          target="_blank"
          className="inline-flex h-9 items-center rounded-md bg-secondary text-secondary-foreground text-sm px-3"
        >
          <Printer className="h-3.5 w-3.5 mr-1" />
          Print
        </Link>
      </div>
      <PassbookContent workerId={selectedWorker.id} />
    </div>
  );
}

export function PassbookContent({ workerId }: { workerId: string }) {
  const stays = useWorkers((s) => s.stays);
  const rules = useWorkers((s) => s.rules);
  const withdrawals = useWorkers((s) => s.withdrawals);
  const loans = useWorkers((s) => s.loans);
  const advances = useWorkers((s) => s.advances);
  const allowances = useWorkers((s) => s.allowances);
  const goldAdvances = useWorkers((s) => s.goldAdvances);
  const wastageReturns = useWorkers((s) => s.wastageReturns);
  const settlements = useWorkers((s) => s.settlements);

  const rows = buildWorkerPassbookRows(workerId, {
    withdrawals,
    loans,
    advances,
    allowances,
    goldAdvances,
    wastageReturns,
    settlements,
  });

  // running balances: cashBalance = sum of (cashIn) - (cashOut) (positive means shop has paid out / owes)
  // gold balance: goldIn - goldOut (positive = worker owes)
  let cashBal = 0;
  let goldBal = 0;
  const totalDays = stayDaysForWorker(workerId, stays);
  const rule = activeRuleFor(rules, workerId);
  const grossEarned = stayEarnedPaise(rule, totalDays);
  const openStay = openStayFor(workerId, stays);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryTile label="Total Days On-Site" value={totalDays.toFixed(1)} />
        <SummaryTile label="Current Stay" value={openStay ? "Working" : "Not On-Site"} />
        <SummaryTile label="Gross Salary Earned" value={`₹${paiseToRupees(grossEarned)}`} />
        <SummaryTile
          label="Stay Periods"
          value={String(stays.filter((s) => s.workerId === workerId).length)}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyHint text="No events recorded for this worker yet." />
      ) : (
        <>
          {/* Mobile view */}
          <div className="md:hidden space-y-3">
            {(() => {
              let runningCashBal = 0;
              let runningGoldBal = 0;
              return rows.map((r, i) => {
                runningCashBal += (r.cashIn ?? 0) - (r.cashOut ?? 0);
                runningGoldBal += (r.goldIn ?? 0) - (r.goldOut ?? 0);
                return (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-muted/20 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{r.label}</span>
                      <span className="text-muted-foreground font-normal">{r.date}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-2 text-[11px]">
                      <div>
                        {r.cashOut || r.cashIn ? (
                          <div className="mb-1">
                            <span className="text-muted-foreground block text-[9px]">
                              Cash (In/Out)
                            </span>
                            <span className="font-semibold text-foreground">
                              {r.cashOut ? `−₹${paiseToRupees(r.cashOut)}` : ""}
                              {r.cashIn ? `+₹${paiseToRupees(r.cashIn)}` : ""}
                            </span>
                          </div>
                        ) : null}
                        <span className="text-muted-foreground block text-[9px]">
                          Running Cash Bal
                        </span>
                        <span className="font-bold text-gold">
                          ₹{paiseToRupees(runningCashBal)}
                        </span>
                      </div>
                      <div>
                        {r.goldOut || r.goldIn ? (
                          <div className="mb-1">
                            <span className="text-muted-foreground block text-[9px]">
                              Gold (In/Out)
                            </span>
                            <span className="font-semibold text-foreground font-mono">
                              {r.goldOut ? `−${mgToGrams(r.goldOut)}g` : ""}
                              {r.goldIn ? `+${mgToGrams(r.goldIn)}g` : ""}
                            </span>
                          </div>
                        ) : null}
                        <span className="text-muted-foreground block text-[9px]">
                          Running Gold Bal
                        </span>
                        <span className="font-bold text-gold font-mono">
                          {mgToGrams(runningGoldBal)} g
                        </span>
                      </div>
                    </div>

                    {r.note && (
                      <div className="text-[10px] text-muted-foreground bg-muted/40 p-1.5 rounded">
                        {r.note}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Cash out (₹)</TableHead>
                  <TableHead>Cash in (₹)</TableHead>
                  <TableHead>Cash bal</TableHead>
                  <TableHead>Gold out (g)</TableHead>
                  <TableHead>Gold in (g)</TableHead>
                  <TableHead>Gold bal</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  cashBal += (r.cashIn ?? 0) - (r.cashOut ?? 0);
                  goldBal += (r.goldIn ?? 0) - (r.goldOut ?? 0);
                  return (
                    <TableRow key={i}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell>{r.cashOut ? paiseToRupees(r.cashOut) : ""}</TableCell>
                      <TableCell>{r.cashIn ? paiseToRupees(r.cashIn) : ""}</TableCell>
                      <TableCell className="text-gold">{paiseToRupees(cashBal)}</TableCell>
                      <TableCell>{r.goldOut ? mgToGrams(r.goldOut) : ""}</TableCell>
                      <TableCell>{r.goldIn ? mgToGrams(r.goldIn) : ""}</TableCell>
                      <TableCell className="text-gold">{mgToGrams(goldBal)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.note ?? ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl text-gold mt-1">{value}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background/30 p-6 text-sm text-muted-foreground text-center">
      <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
      {text}
    </div>
  );
}
