/**
 * Chart of Accounts, Dual Metal/Cash Ledgers & Period Control Workspace
 * Master Reference: docs/ACCOUNTING_AND_PERIOD_CONTROL.md
 * Master Reference: docs/ORNEXA_DATA_AND_LEDGER_MODEL.md
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Landmark,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Coins,
  FileSpreadsheet,
  Layers,
  Search,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
} from "lucide-react";
import {
  useChartOfAccountsStore,
  ensureChartOfAccountsLoaded,
  type AccountNature,
} from "@/lib/chart-of-accounts-store";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app-info";

export const Route = createFileRoute("/control/accounts")({
  head: () => ({ meta: [{ title: `Chart of Accounts & Period Control · ${APP_NAME}` }] }),
  component: ChartOfAccountsPage,
});

function ChartOfAccountsPage() {
  const {
    accountGroups,
    ledgerAccounts,
    periodSettings,
    loading,
    hydrated,
    hydrate,
    addAccountGroup,
    addLedgerAccount,
    removeLedgerAccount,
    setFreezeBeforeDate,
    recordDayClose,
  } = useChartOfAccountsStore();

  useEffect(() => {
    void ensureChartOfAccountsLoaded();
  }, [hydrate]);

  const [activeTab, setActiveTab] = useState<
    "accounts" | "groups" | "period_control" | "day_close"
  >("accounts");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNature, setSelectedNature] = useState<AccountNature | "all">("all");

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDayCloseModalOpen, setIsDayCloseModalOpen] = useState(false);

  // New Account Form
  const [accName, setAccName] = useState("");
  const [accCode, setAccCode] = useState("");
  const [accGroupId, setAccGroupId] = useState(accountGroups[0]?.id || "");
  const [accNature, setAccNature] = useState<AccountNature>("asset");
  const [accOpeningPaise, setAccOpeningPaise] = useState(0);
  const [accOpeningGoldG, setAccOpeningGoldG] = useState(0);
  const [accIsBank, setAccIsBank] = useState(false);
  const [accBankNo, setAccBankNo] = useState("");
  const [accIfsc, setAccIfsc] = useState("");

  // New Group Form
  const [grpName, setGrpName] = useState("");
  const [grpCode, setGrpCode] = useState("");
  const [grpNature, setGrpNature] = useState<AccountNature>("asset");
  const [grpParentId, setGrpParentId] = useState("");

  // Day Close Form
  const [dcDate, setDcDate] = useState(new Date().toISOString().split("T")[0]);
  const [dcPhysicalCash, setDcPhysicalCash] = useState(250000);
  const [dcPhysicalGoldG, setDcPhysicalGoldG] = useState(450.0);
  const [dcVerifier, setDcVerifier] = useState("Chief Cashier / Director");
  const [dcNotes, setDcNotes] = useState("");

  // Period Freeze Input
  const [freezeInput, setFreezeInput] = useState(periodSettings.freezeBeforeDate || "");

  useEffect(() => {
    if (periodSettings.freezeBeforeDate) {
      setFreezeInput(periodSettings.freezeBeforeDate);
    }
  }, [periodSettings.freezeBeforeDate]);

  const filteredAccounts = useMemo(() => {
    return ledgerAccounts.filter((acc) => {
      const matchesNature = selectedNature === "all" || acc.nature === selectedNature;
      const matchesQuery =
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesNature && matchesQuery;
    });
  }, [ledgerAccounts, selectedNature, searchQuery]);

  // Aggregate Totals
  const totals = useMemo(() => {
    let totalAssetCash = 0;
    let totalAssetGold = 0;
    let totalLiabCash = 0;
    let totalLiabGold = 0;

    ledgerAccounts.forEach((acc) => {
      if (acc.nature === "asset") {
        totalAssetCash += acc.currentBalancePaise;
        totalAssetGold += acc.currentGoldMg;
      } else if (acc.nature === "liability") {
        totalLiabCash += acc.currentBalancePaise;
        totalLiabGold += acc.currentGoldMg;
      }
    });

    return {
      totalAssetCash,
      totalAssetGold,
      totalLiabCash,
      totalLiabGold,
    };
  }, [ledgerAccounts]);

  const handleSaveAccount = async () => {
    if (!accName.trim()) {
      toast.error("Account Name is required.");
      return;
    }
    const group = accountGroups.find((g) => g.id === accGroupId);
    await addLedgerAccount({
      name: accName.trim(),
      code: accCode.trim() || `ACC-${Date.now().toString().slice(-4)}`,
      groupId: accGroupId,
      nature: group?.nature || accNature,
      openingBalancePaise: Math.round(accOpeningPaise * 100),
      openingGoldMg: Math.round(accOpeningGoldG * 1000),
      isCashOrBank: accIsBank,
      bankAccountNumber: accBankNo.trim() || undefined,
      ifscCode: accIfsc.trim() || undefined,
      isActive: true,
    });
    setIsAccountModalOpen(false);
    setAccName("");
    setAccCode("");
    setAccOpeningPaise(0);
    setAccOpeningGoldG(0);
  };

  const handleSaveGroup = async () => {
    if (!grpName.trim()) {
      toast.error("Group Name is required.");
      return;
    }
    await addAccountGroup({
      name: grpName.trim(),
      code: grpCode.trim() || `GRP-${Date.now().toString().slice(-4)}`,
      nature: grpNature,
      parentGroupId: grpParentId || undefined,
      isSystem: false,
    });
    setIsGroupModalOpen(false);
    setGrpName("");
    setGrpCode("");
  };

  const handleSaveDayClose = async () => {
    const expectedCashPaise = ledgerAccounts
      .filter((a) => a.isCashOrBank && a.isActive)
      .reduce((sum, a) => sum + a.currentBalancePaise, 0);
    const expectedGoldMg = ledgerAccounts
      .filter((a) => a.groupId === "grp_stock_vault" && a.isActive)
      .reduce((sum, a) => sum + a.currentGoldMg, 0);
    const physicalCashPaise = Math.round(dcPhysicalCash * 100);
    const physicalGoldMg = Math.round(dcPhysicalGoldG * 1000);

    const cashVar = physicalCashPaise - expectedCashPaise;
    const goldVar = physicalGoldMg - expectedGoldMg;

    await recordDayClose({
      date: dcDate,
      cashDrawerPhysicalPaise: physicalCashPaise,
      cashSystemExpectedPaise: expectedCashPaise,
      cashVariancePaise: cashVar,
      vaultGoldPhysicalMg: physicalGoldMg,
      vaultGoldSystemExpectedMg: expectedGoldMg,
      goldVarianceMg: goldVar,
      verifiedBy: dcVerifier,
      status: cashVar === 0 && goldVar === 0 ? "reconciled" : "variance_flagged",
      notes: dcNotes.trim() || undefined,
    });
    setIsDayCloseModalOpen(false);
  };

  if (!hydrated && loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading chart of accounts…</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Chart of Accounts & Period Control"
        subtitle="Authoritative parallel double-entry bookkeeping for Cash (₹) and Metal Grams (g). Enforce period lockouts, day-close reconciliations, and Tally Prime interoperability."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/control/tally-export">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-600"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Tally Prime Export
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => setIsAccountModalOpen(true)}
              className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> New Ledger Account
            </Button>
          </div>
        }
      />

      {/* Quick Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Landmark className="h-3.5 w-3.5 text-emerald-500" />
            <span>Total Asset Cash (₹)</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-foreground font-mono mt-1">
            ₹{(totals.totalAssetCash / 100).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-muted-foreground">Bank & Cash Drawer Balances</div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span>Total Asset Metal (999)</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-amber-600 font-mono mt-1">
            {(totals.totalAssetGold / 1000).toFixed(3)} g
          </div>
          <div className="text-[10px] text-muted-foreground">Vault, WIP & Karigar Fine Gold</div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-blue-500" />
            <span>Active Financial Year</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-foreground font-mono mt-1">
            {periodSettings.activeFinancialYear}
          </div>
          <div className="text-[10px] text-muted-foreground">01-Apr-2026 to 31-Mar-2027</div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-rose-500" />
            <span>Period Freeze Status</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-rose-500 font-mono mt-1">
            {periodSettings.freezeBeforeDate ? `< ${periodSettings.freezeBeforeDate}` : "Open"}
          </div>
          <div className="text-[10px] text-muted-foreground">Backdated alterations locked</div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-4 max-w-xl">
          <TabsTrigger value="accounts" className="text-xs gap-1.5">
            <Landmark className="h-3.5 w-3.5" /> Ledger Accounts ({ledgerAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Account Groups ({accountGroups.length})
          </TabsTrigger>
          <TabsTrigger value="period_control" className="text-xs gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Period Freeze & Lock
          </TabsTrigger>
          <TabsTrigger value="day_close" className="text-xs gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Day Close Logs (
            {periodSettings.dayCloseHistory.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Ledger Accounts Registry */}
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search ledger accounts by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <select
                  value={selectedNature}
                  onChange={(e) => setSelectedNature(e.target.value as any)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="all">All Natures</option>
                  <option value="asset">Assets</option>
                  <option value="liability">Liabilities</option>
                  <option value="income">Income</option>
                  <option value="expense">Expenses</option>
                </select>
              </div>

              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
              >
                Dual Cash / Metal Balancing Active
              </Badge>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted text-muted-foreground font-semibold border-b">
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Ledger Name</th>
                    <th className="p-2.5">Parent Group</th>
                    <th className="p-2.5">Nature</th>
                    <th className="p-2.5 text-right">Cash Balance (₹)</th>
                    <th className="p-2.5 text-right">Metal Balance (g)</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAccounts.map((acc) => {
                    const grp = accountGroups.find((g) => g.id === acc.groupId);
                    return (
                      <tr key={acc.id} className="hover:bg-muted/20">
                        <td className="p-2.5 font-mono text-muted-foreground">{acc.code}</td>
                        <td className="p-2.5 font-medium text-foreground">
                          <div>{acc.name}</div>
                          {acc.bankAccountNumber && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              A/C: {acc.bankAccountNumber} · IFSC: {acc.ifscCode}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-muted-foreground">{grp?.name || "General"}</td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="text-[9px] uppercase">
                            {acc.nature}
                          </Badge>
                        </td>
                        <td className="p-2.5 font-mono text-right font-semibold">
                          ₹{(acc.currentBalancePaise / 100).toLocaleString("en-IN")}
                        </td>
                        <td className="p-2.5 font-mono text-right font-semibold text-amber-600">
                          {acc.currentGoldMg > 0
                            ? `${(acc.currentGoldMg / 1000).toFixed(3)} g`
                            : "—"}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge
                            variant={acc.isActive ? "default" : "secondary"}
                            className="text-[9px]"
                          >
                            {acc.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void removeLedgerAccount(acc.id)}
                            className="h-6 w-6 p-0 text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: Account Groups */}
        <TabsContent value="groups" className="mt-4 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-sm">Configurable Account Groups Hierarchy</h3>
                <p className="text-xs text-muted-foreground">
                  Standard chart-of-accounts structure mapping into financial balance sheets.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsGroupModalOpen(true)}
                className="h-8 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Account Group
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {(["asset", "liability", "income", "expense"] as AccountNature[]).map((nature) => {
                const grps = accountGroups.filter((g) => g.nature === nature);
                return (
                  <div key={nature} className="rounded-lg border p-3 bg-muted/10 space-y-2">
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <span className="font-bold text-xs uppercase text-foreground">{nature}s</span>
                      <Badge variant="outline" className="text-[9px]">
                        {grps.length} groups
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs">
                      {grps.map((g) => (
                        <div
                          key={g.id}
                          className="p-2 rounded bg-card border flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-foreground">{g.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {g.code}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: Period Freeze & Lock Controls */}
        <TabsContent value="period_control" className="mt-4 space-y-4">
          <Card className="p-5 space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-rose-500" />
                  Financial Year & Backdated Period Lock Controls
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Protect finalized books from unauthorized retroactive modifications. Alterations
                  require explicit authorization and logging.
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] text-rose-500 border-rose-500/30 bg-rose-500/10"
              >
                Tamper-Proof Audit Enabled
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                <h4 className="font-semibold text-foreground">Freeze All Records Before Date</h4>
                <p className="text-muted-foreground">
                  Prevent creation, editing, or deletion of vouchers dated on or prior to this
                  cutoff date.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={freezeInput}
                    onChange={(e) => setFreezeInput(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => void setFreezeBeforeDate(freezeInput)}
                    className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                  >
                    Lock Period
                  </Button>
                </div>
                {periodSettings.freezeBeforeDate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setFreezeBeforeDate(null)}
                    className="h-7 text-[11px] text-muted-foreground"
                  >
                    Clear Freeze Date
                  </Button>
                )}
              </div>

              <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                <h4 className="font-semibold text-foreground">Financial Year Boundary</h4>
                <div className="space-y-1.5 text-muted-foreground">
                  <div>
                    Active FY:{" "}
                    <strong className="text-foreground">
                      {periodSettings.activeFinancialYear}
                    </strong>
                  </div>
                  <div>
                    Starts:{" "}
                    <span className="font-mono text-foreground">
                      {periodSettings.yearStartDate}
                    </span>
                  </div>
                  <div>
                    Ends:{" "}
                    <span className="font-mono text-foreground">{periodSettings.yearEndDate}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast.info("Year-end rollover wizard runs on 31st March.")}
                  className="h-8 text-xs"
                >
                  Run Year-End Rollover Simulation
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: Daily Day Close History */}
        <TabsContent value="day_close" className="mt-4 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-500" />
                  Daily Day-Close Reconciler Logs
                </h3>
                <p className="text-xs text-muted-foreground">
                  End-of-day physical drawer cash and vault scale reconciliation records.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsDayCloseModalOpen(true)}
                className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Run Today&apos;s Day-Close
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted text-muted-foreground font-semibold border-b">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Closed Timestamp</th>
                    <th className="p-2.5 text-right">Physical Cash</th>
                    <th className="p-2.5 text-right">Physical Gold</th>
                    <th className="p-2.5 text-right">Variance</th>
                    <th className="p-2.5">Verified By</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periodSettings.dayCloseHistory.map((dc) => (
                    <tr key={dc.id} className="hover:bg-muted/20">
                      <td className="p-2.5 font-bold text-foreground">{dc.date}</td>
                      <td className="p-2.5 font-mono text-muted-foreground">
                        {new Date(dc.closedAt).toLocaleTimeString()}
                      </td>
                      <td className="p-2.5 font-mono text-right">
                        ₹{(dc.cashDrawerPhysicalPaise / 100).toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 font-mono text-right text-amber-600">
                        {(dc.vaultGoldPhysicalMg / 1000).toFixed(3)} g
                      </td>
                      <td className="p-2.5 font-mono text-right">
                        {dc.cashVariancePaise === 0 && dc.goldVarianceMg === 0 ? (
                          <span className="text-emerald-500 font-semibold">Balanced (0.00)</span>
                        ) : (
                          <span className="text-rose-500 font-semibold">Variance Flagged</span>
                        )}
                      </td>
                      <td className="p-2.5 text-muted-foreground">{dc.verifiedBy}</td>
                      <td className="p-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            dc.status === "reconciled"
                              ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                              : "text-rose-500 border-rose-500/30 bg-rose-500/10"
                          }`}
                        >
                          {dc.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Modal: Add Ledger Account ────────────────────────────────────── */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Landmark className="h-5 w-5 text-amber-500" />
              Create New Ledger Account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Account Name *</Label>
              <Input
                placeholder="e.g. Surat Polki Vault"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Account Code</Label>
              <Input
                placeholder="e.g. 1105"
                value={accCode}
                onChange={(e) => setAccCode(e.target.value)}
                className="h-8 text-xs font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Account Group *</Label>
              <select
                value={accGroupId}
                onChange={(e) => setAccGroupId(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                {accountGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.nature})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Opening Cash (₹)</Label>
                <Input
                  type="number"
                  value={accOpeningPaise}
                  onChange={(e) => setAccOpeningPaise(parseFloat(e.target.value || "0"))}
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Opening Metal (g)</Label>
                <Input
                  type="number"
                  value={accOpeningGoldG}
                  onChange={(e) => setAccOpeningGoldG(parseFloat(e.target.value || "0"))}
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accIsBank}
                  onChange={(e) => setAccIsBank(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-xs">This is a Bank Account</span>
              </label>
            </div>

            {accIsBank && (
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/20 border">
                <div>
                  <Label className="text-[10px]">A/C Number</Label>
                  <Input
                    value={accBankNo}
                    onChange={(e) => setAccBankNo(e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">IFSC Code</Label>
                  <Input
                    value={accIfsc}
                    onChange={(e) => setAccIfsc(e.target.value.toUpperCase())}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAccountModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAccount}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Save Ledger Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Add Account Group ─────────────────────────────────────── */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-500" />
              Create Account Group
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Group Name *</Label>
              <Input
                placeholder="e.g. Secondary Bullion Safes"
                value={grpName}
                onChange={(e) => setGrpName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nature</Label>
              <select
                value={grpNature}
                onChange={(e) => setGrpNature(e.target.value as any)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsGroupModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveGroup}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Day Close Wizard ──────────────────────────────────────── */}
      <Dialog open={isDayCloseModalOpen} onOpenChange={setIsDayCloseModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-500" />
              Daily Day-Close & Safe Scale Audit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Day Close Date</Label>
              <Input
                type="date"
                value={dcDate}
                onChange={(e) => setDcDate(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Physical Cash in Drawer (₹)</Label>
              <Input
                type="number"
                value={dcPhysicalCash}
                onChange={(e) => setDcPhysicalCash(parseFloat(e.target.value || "0"))}
                className="h-8 text-xs mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Physical Vault Gold Weight (g)</Label>
              <Input
                type="number"
                value={dcPhysicalGoldG}
                onChange={(e) => setDcPhysicalGoldG(parseFloat(e.target.value || "0"))}
                className="h-8 text-xs mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Verified By Officer</Label>
              <Input
                value={dcVerifier}
                onChange={(e) => setDcVerifier(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Notes / Discrepancy Remark</Label>
              <Input
                value={dcNotes}
                onChange={(e) => setDcNotes(e.target.value)}
                placeholder="Balanced without discrepancy"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDayCloseModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveDayClose}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Confirm & Lock Day Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
