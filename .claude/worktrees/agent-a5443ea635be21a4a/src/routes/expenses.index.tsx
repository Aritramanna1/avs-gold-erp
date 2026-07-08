import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranchFilter } from "@/lib/branch-filter";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useExpensesStore,
  type ExpensePerson,
  type FamilyWithdrawal,
  type ExpenseRecord,
} from "@/lib/expenses-store";
import { useSettings } from "@/lib/settings-store";
import {
  Plus,
  TrendingDown,
  Users,
  Briefcase,
  Home as HomeIcon,
  PiggyBank,
  AlertTriangle,
  CheckCircle,
  FileText,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/expenses/")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Expenses Tracker · MTJ ERP" }] }),
  component: ExpensesPage,
});

const BUSINESS_CATEGORIES = [
  "Shop Expense",
  "Machinery",
  "Gold Purchase",
  "Repairs & Maintenance",
  "Rent",
  "Electricity",
  "Staff/Worker Related",
  "Packaging",
  "Travel",
  "Office Expense",
  "Software/Subscription",
  "Miscellaneous",
];

const HOME_CATEGORIES = [
  "Home Expense",
  "Food",
  "Medical",
  "Education",
  "Travel",
  "Household",
  "Personal Shopping",
  "Family Support",
  "Miscellaneous",
];

const INVESTMENT_CATEGORIES = [
  "Property Purchase",
  "Vehicle Purchase",
  "Car Loan Repayment",
  "Home Loan Repayment",
  "Personal Loan Repayment",
  "Business Loan Repayment",
  "Insurance",
  "Fixed Deposit / Investment",
  "Asset Purchase",
  "Other Investment",
];

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

function formatRupees(paise: number): string {
  const rs = Math.floor(paise / 100);
  const cs = Math.abs(paise % 100)
    .toString()
    .padStart(2, "0");
  return `₹ ${rs.toLocaleString("en-IN")}.${cs}`;
}

function ExpensesPage() {
  const { t } = useLanguage();
  const store = useExpensesStore();
  const { filter: branchFilter, selectedBranchId, branches } = useBranchFilter();

  // Dialog states
  const [profileOpen, setProfileOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  // New Profile Form fields
  const [profName, setProfName] = useState("");
  const [profRole, setProfRole] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profNotes, setProfNotes] = useState("");

  // New Withdrawal Form fields
  const [wDate, setWDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [wPerson, setWPerson] = useState("");
  const [wAmount, setWAmount] = useState("");
  const [wMode, setWMode] = useState<"cash" | "upi" | "bank" | "other">("cash");
  const [wReason, setWReason] = useState("");
  const [wNotes, setWNotes] = useState("");
  const [wBranch, setWBranch] = useState(selectedBranchId || "MAIN");

  // New Expense Form fields
  const [exDate, setExDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [exType, setExType] = useState<"business" | "personal" | "investment">("business");
  const [exCategory, setExCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [exAmount, setExAmount] = useState("");
  const [exMode, setExMode] = useState<"cash" | "upi" | "bank" | "other">("cash");
  const [exNotes, setExNotes] = useState("");
  const [exPerson, setExPerson] = useState("");
  const [exBranch, setExBranch] = useState(selectedBranchId || "MAIN");

  // Filter states
  const [activeTab, setActiveTab] = useState<
    "all" | "withdrawals" | "business" | "personal" | "investment" | "profiles"
  >("all");
  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [filterPersonId, setFilterPersonId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Auto set category when type changes
  useEffect(() => {
    if (exType === "business") {
      setExCategory(BUSINESS_CATEGORIES[0]);
    } else if (exType === "personal") {
      setExCategory(HOME_CATEGORIES[0]);
    } else {
      setExCategory(INVESTMENT_CATEGORIES[0]);
    }
  }, [exType]);

  // Seed store people if empty
  useEffect(() => {
    store.seedDefaults();
  }, [store]);

  // Handle Add Profile
  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) return;
    store.addPerson({
      fullName: profName.trim(),
      role: profRole.trim() || undefined,
      phone: profPhone.trim() || undefined,
      notes: profNotes.trim() || undefined,
      active: true,
    });
    setProfName("");
    setProfRole("");
    setProfPhone("");
    setProfNotes("");
    setProfileOpen(false);
  };

  // Handle Add Withdrawal
  const handleAddWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wPerson || !wAmount) return;
    const amountVal = Math.round(parseFloat(wAmount) * 100);
    store.addWithdrawal({
      date: wDate,
      personId: wPerson,
      amountPaise: amountVal,
      paymentMode: wMode,
      reason: wReason.trim() || undefined,
      notes: wNotes.trim() || undefined,
      branchId: wBranch,
    });
    setWAmount("");
    setWReason("");
    setWNotes("");
    setWithdrawalOpen(false);
  };

  // Handle Add Expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exAmount) return;
    const amountVal = Math.round(parseFloat(exAmount) * 100);
    store.addExpense({
      date: exDate,
      type: exType,
      category: exCategory,
      amountPaise: amountVal,
      paymentMode: exMode,
      notes: exNotes.trim() || undefined,
      personId: exType === "personal" && exPerson ? exPerson : undefined,
      branchId: exBranch,
    });
    setExAmount("");
    setExNotes("");
    setExPerson("");
    setExpenseOpen(false);
  };

  // Process data with filters
  const filteredWithdrawals = useMemo(() => {
    return store.withdrawals.filter((w) => {
      if (filterBranchId !== "all" && w.branchId !== filterBranchId) return false;
      if (filterPersonId !== "all" && w.personId !== filterPersonId) return false;
      return true;
    });
  }, [store.withdrawals, filterBranchId, filterPersonId]);

  const filteredExpenses = useMemo(() => {
    return store.expenses.filter((e) => {
      if (filterBranchId !== "all" && e.branchId !== filterBranchId) return false;
      if (filterPersonId !== "all" && e.personId && e.personId !== filterPersonId) return false;
      if (filterCategory !== "all" && e.category !== filterCategory) return false;
      return true;
    });
  }, [store.expenses, filterBranchId, filterPersonId, filterCategory]);

  const businessExpensesSum = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.type === "business")
      .reduce((sum, e) => sum + e.amountPaise, 0);
  }, [filteredExpenses]);

  const personalExpensesSum = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.type === "personal")
      .reduce((sum, e) => sum + e.amountPaise, 0);
  }, [filteredExpenses]);

  const investmentsSum = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.type === "investment")
      .reduce((sum, e) => sum + e.amountPaise, 0);
  }, [filteredExpenses]);

  const withdrawalsSum = useMemo(() => {
    return filteredWithdrawals.reduce((sum, w) => sum + w.amountPaise, 0);
  }, [filteredWithdrawals]);

  const personMap = useMemo(() => {
    return new Map(store.people.map((p) => [p.id, p]));
  }, [store.people]);

  const branchMap = useMemo(() => {
    return new Map(branches.map((b) => [b.id, b]));
  }, [branches]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" id="expenses-tracker-root">
      <PageHeader
        title={t("expenses.title") || "Expense Tracker"}
        subtitle={
          t("expenses.subtitle") ||
          "Manage and control shop operations expenses, investments, and personal profiles."
        }
        actions={
          <div className="flex gap-2">
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" id="btn-add-profile">
                  <Users className="h-4 w-4" /> Add Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddProfile}>
                  <DialogHeader>
                    <DialogTitle>Add Family Profile</DialogTitle>
                    <DialogDescription>
                      Register an owner family member to track personal withdrawals and expenses.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1">
                      <Label htmlFor="prof-name">Full Name</Label>
                      <Input
                        id="prof-name"
                        value={profName}
                        onChange={(e) => setProfName(e.target.value)}
                        placeholder="e.g. Aritra Manna"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prof-role">Relation / Role</Label>
                      <Input
                        id="prof-role"
                        value={profRole}
                        onChange={(e) => setProfRole(e.target.value)}
                        placeholder="e.g. Partner / Son"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prof-phone">Phone</Label>
                      <Input
                        id="prof-phone"
                        value={profPhone}
                        onChange={(e) => setProfPhone(e.target.value)}
                        placeholder="e.g. +91 99999 99999"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prof-notes">Notes</Label>
                      <Textarea
                        id="prof-notes"
                        value={profNotes}
                        onChange={(e) => setProfNotes(e.target.value)}
                        placeholder="Any additional details"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setProfileOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Save Profile</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" id="btn-add-withdrawal">
                  <TrendingDown className="h-4 w-4" /> Log Withdrawal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddWithdrawal}>
                  <DialogHeader>
                    <DialogTitle>Log Family Withdrawal</DialogTitle>
                    <DialogDescription>
                      Record internal non-tax family member payments. These will be kept strictly
                      excluded from GST/Billing audits.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="w-date">Date</Label>
                        <Input
                          id="w-date"
                          type="date"
                          value={wDate}
                          onChange={(e) => setWDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="w-person">Family Person</Label>
                        <Select value={wPerson} onValueChange={setWPerson}>
                          <SelectTrigger id="w-person">
                            <SelectValue placeholder="Select Member" />
                          </SelectTrigger>
                          <SelectContent>
                            {store.people.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="w-amount">Amount (Rupees)</Label>
                        <Input
                          id="w-amount"
                          type="number"
                          step="0.01"
                          value={wAmount}
                          onChange={(e) => setWAmount(e.target.value)}
                          placeholder="e.g. 50000"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="w-mode">Payment Source</Label>
                        <Select value={wMode} onValueChange={(v: any) => setWMode(v)}>
                          <SelectTrigger id="w-mode">
                            <SelectValue placeholder="Select Mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_MODES.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="w-branch">Branch</Label>
                        <Select value={wBranch} onValueChange={setWBranch}>
                          <SelectTrigger id="w-branch">
                            <SelectValue placeholder="Branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="w-reason">Reason</Label>
                        <Input
                          id="w-reason"
                          value={wReason}
                          onChange={(e) => setWReason(e.target.value)}
                          placeholder="e.g. Home purchase / personal"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="w-notes">Notes</Label>
                      <Textarea
                        id="w-notes"
                        value={wNotes}
                        onChange={(e) => setWNotes(e.target.value)}
                        placeholder="Additional internal references (e.g. no voucher)"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setWithdrawalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Submit Withdrawal</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" id="btn-add-expense">
                  <Plus className="h-4 w-4" /> Add Expense Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddExpense}>
                  <DialogHeader>
                    <DialogTitle>Log Expense, Asset or Loan Payment</DialogTitle>
                    <DialogDescription>
                      Perfect ledger tracking of business, home expenses or investment
                      disbursements.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="ex-date">Date</Label>
                        <Input
                          id="ex-date"
                          type="date"
                          value={exDate}
                          onChange={(e) => setExDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ex-type">Payment Type</Label>
                        <Select
                          value={exType}
                          onValueChange={(v: any) => setExType(v)}
                          disabled={false}
                        >
                          <SelectTrigger id="ex-type">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="business">Business Expense</SelectItem>
                            <SelectItem value="personal">Home / Personal Expense</SelectItem>
                            <SelectItem value="investment">Investment / Loan / Asset</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="ex-category">Category</Label>
                        <Select value={exCategory} onValueChange={setExCategory}>
                          <SelectTrigger id="ex-category">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {exType === "business" &&
                              BUSINESS_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            {exType === "personal" &&
                              HOME_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            {exType === "investment" &&
                              INVESTMENT_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ex-amount">Amount (Rupees)</Label>
                        <Input
                          id="ex-amount"
                          type="number"
                          step="0.01"
                          value={exAmount}
                          onChange={(e) => setExAmount(e.target.value)}
                          placeholder="e.g. 1500"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="ex-mode">Payment Source</Label>
                        <Select value={exMode} onValueChange={(v: any) => setExMode(v)}>
                          <SelectTrigger id="ex-mode">
                            <SelectValue placeholder="Source" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_MODES.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ex-branch">Branch</Label>
                        <Select value={exBranch} onValueChange={setExBranch}>
                          <SelectTrigger id="ex-branch">
                            <SelectValue placeholder="Branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {exType === "personal" && (
                      <div className="space-y-1">
                        <Label htmlFor="ex-person">Spent on (Person Profile)</Label>
                        <Select value={exPerson} onValueChange={setExPerson}>
                          <SelectTrigger id="ex-person">
                            <SelectValue placeholder="Optional profile link" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- None --</SelectItem>
                            {store.people.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor="ex-notes">Description / Notes</Label>
                      <Textarea
                        id="ex-notes"
                        value={exNotes}
                        onChange={(e) => setExNotes(e.target.value)}
                        placeholder="Purpose description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setExpenseOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Record Payment</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Statistics dashboards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Business Expenses
            </CardDescription>
            <CardTitle className="font-serif text-2xl lg:text-3xl text-gold mt-1">
              {formatRupees(businessExpensesSum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Registered and audit-ready business deductions
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-background border-amber-500/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-500">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Family Withdrawals
            </CardDescription>
            <CardTitle className="font-serif text-2xl lg:text-3xl mt-1 text-amber-400">
              {formatRupees(withdrawalsSum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-amber-200/70 border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 rounded flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              GST / Tax Excluded
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Home & Personal
            </CardDescription>
            <CardTitle className="font-serif text-2xl lg:text-3xl mt-1">
              {formatRupees(personalExpensesSum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Household run expenditures</div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card/80 to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Investments & Loans
            </CardDescription>
            <CardTitle className="font-serif text-2xl lg:text-3xl text-emerald-400 mt-1">
              {formatRupees(investmentsSum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Assets and repayments</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtering Panel */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap gap-4 items-center">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <Label className="text-xs font-semibold">Filter Branch</Label>
          <Select value={filterBranchId} onValueChange={setFilterBranchId}>
            <SelectTrigger>
              <SelectValue placeholder="All Branches" />
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

        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <Label className="text-xs font-semibold">Filter Person Profile</Label>
          <Select value={filterPersonId} onValueChange={setFilterPersonId}>
            <SelectTrigger>
              <SelectValue placeholder="All Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {store.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <Label className="text-xs font-semibold">Filter Category</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Array.from(
                new Set([...BUSINESS_CATEGORIES, ...HOME_CATEGORIES, ...INVESTMENT_CATEGORIES]),
              ).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs list & Main Table display */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="all">All Records</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="personal">Home / Personal</TabsTrigger>
          <TabsTrigger value="investment">Investments</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
        </TabsList>

        <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
          {activeTab === "profiles" ? (
            <div className="p-6">
              <h3 className="font-serif text-lg text-gold mb-4">People & Family Profiles</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {store.people.map((p) => (
                  <Card key={p.id} className="border-border bg-sidebar/40 p-4 relative">
                    <button
                      type="button"
                      onClick={() => store.removePerson(p.id)}
                      className="absolute top-3 right-3 text-red-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="font-serif text-gold text-lg mb-1">{p.fullName}</div>
                    {p.role && (
                      <div className="text-xs text-muted-foreground font-semibold mb-2">
                        {p.role}
                      </div>
                    )}
                    {p.phone && (
                      <div className="text-xs text-muted-foreground mb-1">📱 {p.phone}</div>
                    )}
                    {p.notes && (
                      <p className="text-xs text-muted-foreground/80 mt-2 bg-background/50 p-2 rounded">
                        {p.notes}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-xs font-bold uppercase text-muted-foreground">
                    <th className="p-4">Date</th>
                    <th className="p-4">Branch</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Category / Reason</th>
                    <th className="p-4">Linked Person</th>
                    <th className="p-4">Payment Source</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {/* Render withdrawals if applicable */}
                  {(activeTab === "all" || activeTab === "withdrawals") &&
                    filteredWithdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/10">
                        <td className="p-4 font-mono text-xs">{w.date}</td>
                        <td className="p-4 font-semibold text-xs text-muted-foreground">
                          {branchMap.get(w.branchId)?.name ?? w.branchId}
                        </td>
                        <td className="p-4">
                          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                            Withdrawal
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-amber-400">
                            {w.reason || "Family Outflow"}
                          </div>
                          {w.notes && (
                            <div className="text-xs text-muted-foreground mt-0.5">{w.notes}</div>
                          )}
                        </td>
                        <td className="p-4 font-semibold">
                          {personMap.get(w.personId)?.fullName ?? "Owner"}
                        </td>
                        <td className="p-4 uppercase text-xs font-semibold">{w.paymentMode}</td>
                        <td className="p-4 text-right font-serif font-bold text-amber-400">
                          {formatRupees(w.amountPaise)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <AttachmentButton
                              entityType="expense"
                              entityId={w.id}
                              docKey="withdrawal_proof"
                              docLabel="Withdrawal Slip / Proof"
                              title={`Withdrawal Proof — ${w.id}`}
                              size="icon"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => store.removeWithdrawal(w.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {/* Render general expenses if applicable */}
                  {(activeTab === "all" || activeTab !== "withdrawals") &&
                    filteredExpenses
                      .filter((e) => activeTab === "all" || e.type === activeTab)
                      .map((e) => (
                        <tr key={e.id} className="hover:bg-muted/10">
                          <td className="p-4 font-mono text-xs">{e.date}</td>
                          <td className="p-4 font-semibold text-xs text-muted-foreground">
                            {branchMap.get(e.branchId)?.name ?? e.branchId}
                          </td>
                          <td className="p-4">
                            <Badge
                              className={
                                e.type === "business"
                                  ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                  : e.type === "personal"
                                    ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              }
                            >
                              {e.type}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold">{e.category}</div>
                            {e.notes && (
                              <div className="text-xs text-muted-foreground mt-0.5">{e.notes}</div>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-muted-foreground">
                            {e.personId ? personMap.get(e.personId)?.fullName : "--"}
                          </td>
                          <td className="p-4 uppercase text-xs font-semibold">{e.paymentMode}</td>
                          <td
                            className={`p-4 text-right font-serif font-bold ${
                              e.type === "business"
                                ? "text-blue-300"
                                : e.type === "personal"
                                  ? "text-purple-300"
                                  : "text-emerald-400"
                            }`}
                          >
                            {formatRupees(e.amountPaise)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <AttachmentButton
                                entityType="expense"
                                entityId={e.id}
                                docKey="expense_proof"
                                docLabel="Expense Receipt / Receipt"
                                title={`Expense Receipt — ${e.id}`}
                                size="icon"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                onClick={() => store.removeExpense(e.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}

                  {filteredWithdrawals.length === 0 && filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-muted-foreground">
                        No transactions registered matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
