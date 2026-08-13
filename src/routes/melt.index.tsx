import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FlameKindling,
  Plus,
  CheckCircle,
  XCircle,
  Trash2,
  Flame,
  PackageOpen,
  Layers,
  TrendingUp,
} from "lucide-react";
import { useMeltStore, calcMeltJob, type MeltJob } from "@/lib/melt-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { toast } from "sonner";

export const Route = createFileRoute("/melt/")({
  head: () => ({ meta: [{ title: "Melt Account · AVS Gold ERP" }] }),
  component: MeltIndex,
});

const STATUS_BADGE: Record<MeltJob["status"], { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface FormState {
  date: string;
  karigarId: string;
  scrapGross: string;
  scrapPurity: string;
  dustGross: string;
  dustPurity: string;
  otherGross: string;
  otherPurity: string;
  fineGoldRecovered: string;
  scrapReturned: string;
  refineryName: string;
  refineryReceiptNo: string;
  refinerySentDate: string;
  refineryReceivedDate: string;
  notes: string;
  status: MeltJob["status"];
}

const EMPTY_FORM: FormState = {
  date: todayISO(),
  karigarId: "",
  scrapGross: "",
  scrapPurity: "916",
  dustGross: "",
  dustPurity: "500",
  otherGross: "",
  otherPurity: "750",
  fineGoldRecovered: "",
  scrapReturned: "",
  refineryName: "",
  refineryReceiptNo: "",
  refinerySentDate: "",
  refineryReceivedDate: "",
  notes: "",
  status: "open",
};

function safeGramsToMg(val: string): number {
  try {
    return gramsToMg(val);
  } catch {
    return 0;
  }
}

function MeltIndex() {
  const { jobs, refresh, createJob, updateJob, deleteJob, completeJob } = useMeltStore();
  const people = usePeople((s) => s.people);
  const branches = useSettings((s) => s.branches);

  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [branchFilter, setBranchFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const karigars = useMemo(() => people.filter((p) => p.type === "karigar" && p.active), [people]);

  // Live calculation preview
  const preview = useMemo(() => {
    return calcMeltJob({
      scrapInputGrossMg: safeGramsToMg(form.scrapGross),
      scrapInputPurity: parseInt(form.scrapPurity) || 0,
      dustInputGrossMg: safeGramsToMg(form.dustGross),
      dustInputPurity: parseInt(form.dustPurity) || 0,
      otherInputGrossMg: safeGramsToMg(form.otherGross),
      otherInputPurity: parseInt(form.otherPurity) || 0,
      fineGoldRecoveredMg: safeGramsToMg(form.fineGoldRecovered),
    });
  }, [
    form.scrapGross,
    form.scrapPurity,
    form.dustGross,
    form.dustPurity,
    form.otherGross,
    form.otherPurity,
    form.fineGoldRecovered,
  ]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (monthFilter && !j.date.startsWith(monthFilter)) return false;
      if (branchFilter !== "all" && j.branchId !== branchFilter) return false;
      return true;
    });
  }, [jobs, monthFilter, branchFilter]);

  // KPI aggregates from filtered jobs
  const kpis = useMemo(() => {
    const completed = filteredJobs.filter((j) => j.status === "completed");
    const totalScrapMg = filteredJobs.reduce((s, j) => s + j.scrapInputGrossMg, 0);
    const totalDustMg = filteredJobs.reduce((s, j) => s + j.dustInputGrossMg, 0);
    const totalInputFineMg = completed.reduce((s, j) => s + j.totalInputFineMg, 0);
    const totalRecoveredMg = completed.reduce((s, j) => s + j.fineGoldRecoveredMg, 0);
    const totalLossMg = completed.reduce((s, j) => s + j.lossFineMg, 0);
    const avgRecoveryPct =
      completed.length > 0
        ? Math.round(completed.reduce((s, j) => s + j.recoveryPct, 0) / completed.length)
        : 0;
    return {
      totalScrapMg,
      totalDustMg,
      totalInputFineMg,
      totalRecoveredMg,
      totalLossMg,
      avgRecoveryPct,
    };
  }, [filteredJobs]);

  // Daily register: group by date
  const byDate = useMemo(() => {
    const map = new Map<string, MeltJob[]>();
    [...filteredJobs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((j) => {
        const list = map.get(j.date) ?? [];
        list.push(j);
        map.set(j.date, list);
      });
    return map;
  }, [filteredJobs]);

  function openNewDialog() {
    setEditJobId(null);
    setForm({ ...EMPTY_FORM, date: todayISO() });
    setDialogOpen(true);
  }

  function openEditDialog(job: MeltJob) {
    setEditJobId(job.id);
    setForm({
      date: job.date,
      karigarId: job.karigarId ?? "",
      scrapGross: job.scrapInputGrossMg ? mgToGrams(job.scrapInputGrossMg) : "",
      scrapPurity: String(job.scrapInputPurity),
      dustGross: job.dustInputGrossMg ? mgToGrams(job.dustInputGrossMg) : "",
      dustPurity: String(job.dustInputPurity),
      otherGross: job.otherInputGrossMg ? mgToGrams(job.otherInputGrossMg) : "",
      otherPurity: String(job.otherInputPurity),
      fineGoldRecovered: job.fineGoldRecoveredMg ? mgToGrams(job.fineGoldRecoveredMg) : "",
      scrapReturned: job.scrapReturnedMg ? mgToGrams(job.scrapReturnedMg) : "",
      refineryName: job.refineryName ?? "",
      refineryReceiptNo: job.refineryReceiptNo ?? "",
      refinerySentDate: job.refinerySentDate ?? "",
      refineryReceivedDate: job.refineryReceivedDate ?? "",
      notes: job.notes ?? "",
      status: job.status,
    });
    setDialogOpen(true);
  }

  function updateForm<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const karigar = karigars.find((k) => k.id === form.karigarId);
      const branchId =
        branchFilter !== "all" ? branchFilter : useSettings.getState().selectedBranchId || "MAIN";

      const payload = {
        date: form.date,
        branchId,
        karigarId: form.karigarId || undefined,
        karigarName: karigar?.fullName,
        status: form.status,
        scrapInputGrossMg: safeGramsToMg(form.scrapGross),
        scrapInputPurity: parseInt(form.scrapPurity) || 916,
        dustInputGrossMg: safeGramsToMg(form.dustGross),
        dustInputPurity: parseInt(form.dustPurity) || 500,
        otherInputGrossMg: safeGramsToMg(form.otherGross),
        otherInputPurity: parseInt(form.otherPurity) || 750,
        fineGoldRecoveredMg: safeGramsToMg(form.fineGoldRecovered),
        scrapReturnedMg: safeGramsToMg(form.scrapReturned),
        refineryName: form.refineryName || undefined,
        refineryReceiptNo: form.refineryReceiptNo || undefined,
        refinerySentDate: form.refinerySentDate || undefined,
        refineryReceivedDate: form.refineryReceivedDate || undefined,
        notes: form.notes || undefined,
      };

      if (editJobId) {
        await updateJob(editJobId, payload);
        toast.success("Melt job updated.");
      } else {
        await createJob(payload);
        toast.success("Melt job created.");
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(jobId: string) {
    setCompleting(jobId);
    try {
      await completeJob(jobId);
      toast.success("Melt job completed — ledger entries posted.");
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : "Could not complete job"));
    } finally {
      setCompleting(null);
    }
  }

  async function handleDelete(jobId: string) {
    setDeleting(jobId);
    try {
      await deleteJob(jobId);
      toast.success("Melt job deleted.");
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : "Delete failed"));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Melt Account"
        subtitle="Gold melting operations — scrap, dust, refinery and recovery tracking"
        actions={
          <Button onClick={openNewDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            New Melt Job
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Month
          </label>
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-40 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Branch
          </label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <PackageOpen className="h-3.5 w-3.5" />
              Scrap Collected
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="font-serif text-xl text-gold">{mgToGrams(kpis.totalScrapMg)} g</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Dust Collected
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="font-serif text-xl text-gold">{mgToGrams(kpis.totalDustMg)} g</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              Fine Gold Recovered
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="font-serif text-xl text-green-400">
              {mgToGrams(kpis.totalRecoveredMg)} g
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              Total Loss
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="font-serif text-xl text-red-400">{mgToGrams(kpis.totalLossMg)} g</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Avg Recovery
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="font-serif text-xl text-gold">
              {(kpis.avgRecoveryPct / 100).toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Melt Jobs</TabsTrigger>
          <TabsTrigger value="register">Daily Register</TabsTrigger>
        </TabsList>

        {/* Melt Jobs Table */}
        <TabsContent value="jobs" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                        Job No
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                        Karigar
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                        Input Fine (g)
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                        Recovered (g)
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                        Loss (g)
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                        Recovery %
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                          <FlameKindling className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          No melt jobs for this period. Create one to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredJobs.map((job) => {
                        const badge = STATUS_BADGE[job.status];
                        return (
                          <TableRow
                            key={job.id}
                            className="border-border hover:bg-card/60 cursor-pointer"
                            onClick={() => openEditDialog(job)}
                          >
                            <TableCell className="font-mono text-xs font-semibold text-gold">
                              {job.jobNo}
                            </TableCell>
                            <TableCell className="text-sm">{job.date}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {job.karigarName ?? "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {mgToGrams(job.totalInputFineMg)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-green-400">
                              {mgToGrams(job.fineGoldRecoveredMg)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-red-400">
                              {job.lossFineMg > 0 ? mgToGrams(job.lossFineMg) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {job.totalInputFineMg > 0
                                ? `${(job.recoveryPct / 100).toFixed(2)}%`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] border ${badge.className}`}>
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end">
                                {(job.status === "open" || job.status === "processing") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                                    disabled={completing === job.id}
                                    onClick={() => handleComplete(job.id)}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                    Complete
                                  </Button>
                                )}
                                {job.status !== "completed" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10"
                                    disabled={deleting === job.id}
                                    onClick={() => handleDelete(job.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Register */}
        <TabsContent value="register" className="mt-4 space-y-4">
          {byDate.size === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FlameKindling className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No melt jobs for this period.
              </CardContent>
            </Card>
          ) : (
            Array.from(byDate.entries()).map(([date, dayJobs]) => (
              <Card key={date} className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border">
                  <CardTitle className="text-sm font-semibold text-gold">
                    {date}
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">Job No</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Karigar</TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Scrap (g)
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Dust (g)
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Input Fine (g)
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Recovered (g)
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Recovery %
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayJobs.map((j) => (
                        <TableRow key={j.id} className="border-border hover:bg-card/60">
                          <TableCell className="font-mono text-xs text-gold">{j.jobNo}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {j.karigarName ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {mgToGrams(j.scrapInputGrossMg)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {mgToGrams(j.dustInputGrossMg)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {mgToGrams(j.totalInputFineMg)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-green-400">
                            {mgToGrams(j.fineGoldRecoveredMg)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {j.totalInputFineMg > 0 ? `${(j.recoveryPct / 100).toFixed(2)}%` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] border ${STATUS_BADGE[j.status].className}`}
                            >
                              {STATUS_BADGE[j.status].label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Day summary row */}
                      <TableRow className="border-t-2 border-border bg-card/40 font-semibold">
                        <TableCell colSpan={2} className="text-xs text-muted-foreground">
                          Day Total
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mgToGrams(dayJobs.reduce((s, j) => s + j.scrapInputGrossMg, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mgToGrams(dayJobs.reduce((s, j) => s + j.dustInputGrossMg, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mgToGrams(dayJobs.reduce((s, j) => s + j.totalInputFineMg, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-green-400">
                          {mgToGrams(dayJobs.reduce((s, j) => s + j.fineGoldRecoveredMg, 0))}
                        </TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* New / Edit Melt Job Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-gold">
              <FlameKindling className="h-5 w-5" />
              {editJobId ? "Edit Melt Job" : "New Melt Job"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Date
                </label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => updateForm("date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Karigar
                </label>
                <Select value={form.karigarId} onValueChange={(v) => updateForm("karigarId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select karigar (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {karigars.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status (for edit) */}
            {editJobId && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(v) => updateForm("status", v as MeltJob["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Input Materials */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Input Materials
              </div>

              {/* Scrap */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Scrap Weight (g)</label>
                  <Input
                    placeholder="0.000"
                    value={form.scrapGross}
                    onChange={(e) => updateForm("scrapGross", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Purity (‰)</label>
                  <Input
                    placeholder="916"
                    value={form.scrapPurity}
                    onChange={(e) => updateForm("scrapPurity", e.target.value)}
                  />
                </div>
                <div className="col-span-3 text-xs text-muted-foreground text-right">
                  Fine:{" "}
                  <span className="text-gold font-mono">
                    {mgToGrams(preview.scrapInputFineMg)} g
                  </span>
                </div>
              </div>

              {/* Dust */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Dust / Sweepings Weight (g)
                  </label>
                  <Input
                    placeholder="0.000"
                    value={form.dustGross}
                    onChange={(e) => updateForm("dustGross", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Purity (‰)</label>
                  <Input
                    placeholder="500"
                    value={form.dustPurity}
                    onChange={(e) => updateForm("dustPurity", e.target.value)}
                  />
                </div>
                <div className="col-span-3 text-xs text-muted-foreground text-right">
                  Fine:{" "}
                  <span className="text-gold font-mono">
                    {mgToGrams(preview.dustInputFineMg)} g
                  </span>
                </div>
              </div>

              {/* Other */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Other Material Weight (g)</label>
                  <Input
                    placeholder="0.000"
                    value={form.otherGross}
                    onChange={(e) => updateForm("otherGross", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Purity (‰)</label>
                  <Input
                    placeholder="750"
                    value={form.otherPurity}
                    onChange={(e) => updateForm("otherPurity", e.target.value)}
                  />
                </div>
                <div className="col-span-3 text-xs text-muted-foreground text-right">
                  Fine:{" "}
                  <span className="text-gold font-mono">
                    {mgToGrams(preview.otherInputFineMg)} g
                  </span>
                </div>
              </div>

              {/* Total input fine */}
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Input Fine
                </span>
                <span className="font-mono font-bold text-gold">
                  {mgToGrams(preview.totalInputFineMg)} g
                </span>
              </div>
            </div>

            {/* Recovery */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Recovery
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fine Gold Recovered (g)</label>
                  <Input
                    placeholder="0.000"
                    value={form.fineGoldRecovered}
                    onChange={(e) => updateForm("fineGoldRecovered", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Scrap Returned (g)</label>
                  <Input
                    placeholder="0.000"
                    value={form.scrapReturned}
                    onChange={(e) => updateForm("scrapReturned", e.target.value)}
                  />
                </div>
              </div>

              {/* Auto-computed summary */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Recovery %
                  </div>
                  <div className="font-serif text-lg font-bold text-green-400">
                    {(preview.recoveryPct / 100).toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Loss (fine)
                  </div>
                  <div className="font-serif text-lg font-bold text-red-400">
                    {mgToGrams(preview.lossFineMg)} g
                  </div>
                </div>
              </div>
            </div>

            {/* Refinery Info */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Refinery Info (Optional)
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Refinery Name</label>
                  <Input
                    placeholder="e.g. MMTC Refinery"
                    value={form.refineryName}
                    onChange={(e) => updateForm("refineryName", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Receipt / Lot No</label>
                  <Input
                    placeholder="Receipt number"
                    value={form.refineryReceiptNo}
                    onChange={(e) => updateForm("refineryReceiptNo", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Sent Date</label>
                  <Input
                    type="date"
                    value={form.refinerySentDate}
                    onChange={(e) => updateForm("refinerySentDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Received Date</label>
                  <Input
                    type="date"
                    value={form.refineryReceivedDate}
                    onChange={(e) => updateForm("refineryReceivedDate", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Notes
              </label>
              <Input
                placeholder="Any remarks or notes..."
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <FlameKindling className="h-4 w-4" />
              {saving ? "Saving…" : editJobId ? "Update Job" : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
