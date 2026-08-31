import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, TrendingDown, Wallet, Users, Receipt, Building2, UserPlus } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { useExpensesStore, RELATIONSHIP_LABELS, type ExpenseRecord, type FamilyWithdrawal, type ExpensePerson } from "@/lib/expenses-store";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { DrawingFormDialog } from "@/components/expenses/DrawingFormDialog";
import { MemberMasterDialog } from "@/components/expenses/MemberMasterDialog";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fmtRs, fmtG } from "@/lib/report-engine";

export const Route = createFileRoute("/expenses/")({
  validateSearch: (s: Record<string, unknown>) => ({
    new: s.new === "1" || s.new === true ? "1" : undefined,
    tab: typeof s.tab === "string" ? s.tab : "business",
  }),
  component: ExpensesWorkspace,
});

function ExpensesWorkspace() {
  const expenses = useExpensesStore((s) => s.expenses);
  const withdrawals = useExpensesStore((s) => s.withdrawals);
  const expensePeople = useExpensesStore((s) => s.people);
  const refresh = useExpensesStore((s) => s.refresh);
  const branches = useSettings((s) => s.branches);
  const search = useSearch({ from: "/expenses/" });

  const [activeTab, setActiveTab] = useState(search.tab || "business");
  const [expenseFormOpen, setExpenseFormOpen] = useState(search.new === "1");
  const [drawingFormOpen, setDrawingFormOpen] = useState(false);
  const [memberFormOpen, setMemberFormOpen] = useState(false);

  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [editingDrawing, setEditingDrawing] = useState<FamilyWithdrawal | null>(null);
  const [editingMember, setEditingMember] = useState<ExpensePerson | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void refresh()
      .then(() => setLoadError(null))
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Could not load expenses."),
      );
  }, [refresh]);

  useEffect(() => {
    if (search.new === "1") setExpenseFormOpen(true);
  }, [search.new]);

  const personById = useMemo(
    () => new Map(expensePeople.map((p) => [p.id, p.fullName])),
    [expensePeople],
  );
  const branchById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  const businessExpenses = useMemo(
    () => expenses.filter((e) => e.type !== "personal"),
    [expenses],
  );

  const totalBusinessPaise = businessExpenses.reduce((n, e) => n + e.amountPaise, 0);
  const totalDrawingsPaise = withdrawals.reduce((n, w) => n + w.amountPaise, 0);

  return (
    <ModuleWorkspace
      eyebrow="Financial Management"
      title="Expenses &amp; Owner Drawings"
      description="Strictly separated accounting for Business Operating Expenses (P&amp;L) vs Owner Drawings (Equity)."
      icon={TrendingDown}
      onRefresh={() => void refresh()}
      metrics={[
        { label: "Business Overheads (P&L)", value: fmtRs(totalBusinessPaise) },
        { label: "Owner Drawings (Equity)", value: fmtRs(totalDrawingsPaise) },
        { label: "Total Cash Out", value: fmtRs(totalBusinessPaise + totalDrawingsPaise) },
        { label: "Family / Beneficiaries", value: expensePeople.length },
      ]}
      actions={
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            onClick={() => {
              setEditingDrawing(null);
              setDrawingFormOpen(true);
            }}
          >
            <Wallet className="h-3.5 w-3.5" /> + Record Owner Drawing
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => {
              setEditingMember(null);
              setMemberFormOpen(true);
            }}
          >
            <UserPlus className="h-3.5 w-3.5" /> + Add Family / Member
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-gold text-black hover:bg-gold/90"
            onClick={() => {
              setEditingExpense(null);
              setExpenseFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> + New Business Expense
          </Button>
        </div>
      }
    >
      {loadError ? <p className="text-sm text-destructive font-mono mb-3">{loadError}</p> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
        <SourceOfTruthBadge variant="operational" />
        <span>
          <strong>Accounting Invariant:</strong> Business Expenses reduce Net Operating Profit. Personal &amp; Family Drawings post to Owner Equity and do NOT reduce operating profit.
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-lg">
          <TabsTrigger value="business" className="text-xs">
            Business Expenses ({businessExpenses.length})
          </TabsTrigger>
          <TabsTrigger value="drawings" className="text-xs">
            Owner Drawings ({withdrawals.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs">
            Family / Member Master ({expensePeople.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Business Expenses */}
        <TabsContent value="business" className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-semibold text-sm">Business Operating Overheads (Rent, Salaries, Electricity, Transport)</h3>
            <span className="text-xs font-mono font-bold text-destructive">Total: {fmtRs(totalBusinessPaise)}</span>
          </div>

          {businessExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-md border border-border bg-card p-4">
              No business operating expenses recorded.
            </p>
          ) : (
            <div className="rounded-md border border-border bg-card overflow-x-auto">
              <table className="w-full text-xs" data-testid="expenses-cash-book">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Voucher</th>
                    <th className="text-left px-3 py-2 font-medium">Category</th>
                    <th className="text-left px-3 py-2 font-medium">Business Purpose / Vendor</th>
                    <th className="text-left px-3 py-2 font-medium">Payment Mode</th>
                    <th className="text-right px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {businessExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-t border-border hover:bg-muted/20 cursor-pointer"
                      onClick={() => {
                        setEditingExpense(expense);
                        setExpenseFormOpen(true);
                      }}
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-mono">{expense.date}</td>
                      <td className="px-3 py-2 font-mono text-gold">{expense.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{expense.category}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{expense.businessPurpose || expense.notes || "Operating overhead"}</div>
                        {expense.vendorName && <div className="text-[10px] text-muted-foreground">Vendor: {expense.vendorName}</div>}
                      </td>
                      <td className="px-3 py-2 uppercase font-mono text-[10px]">{expense.paymentMode}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                        {fmtRs(expense.amountPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Owner Drawings */}
        <TabsContent value="drawings" className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-semibold text-sm">Owner &amp; Family Drawings (Equity Withdrawals)</h3>
            <span className="text-xs font-mono font-bold text-amber-500">Total: {fmtRs(totalDrawingsPaise)}</span>
          </div>

          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-md border border-border bg-card p-4">
              No owner/family drawings recorded yet.
            </p>
          ) : (
            <div className="rounded-md border border-border bg-card overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Beneficiary / Member</th>
                    <th className="text-left px-3 py-2 font-medium">Relationship</th>
                    <th className="text-left px-3 py-2 font-medium">Purpose / Description</th>
                    <th className="text-right px-3 py-2 font-medium text-gold">Gold Equiv (g)</th>
                    <th className="text-right px-3 py-2 font-medium">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => {
                    const person = expensePeople.find((p) => p.id === w.personId);
                    return (
                      <tr
                        key={w.id}
                        className="border-t border-border hover:bg-muted/20 cursor-pointer"
                        onClick={() => {
                          setEditingDrawing(w);
                          setDrawingFormOpen(true);
                        }}
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{w.date}</td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {person?.fullName || w.personName || "Family Member"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {person?.relationship ? RELATIONSHIP_LABELS[person.relationship] : "Home"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{w.purpose || w.reason || w.notes || "Personal Drawing"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                          {fmtG(w.goldEquivalentMg || 0)} g
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                          {fmtRs(w.amountPaise)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Family / Member Master */}
        <TabsContent value="members" className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-semibold text-sm">Family / Beneficiary Member Master</h3>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1"
              onClick={() => {
                setEditingMember(null);
                setMemberFormOpen(true);
              }}
            >
              <Plus className="h-3 w-3" /> Add Member
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expensePeople.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-card p-4 hover:border-gold/60 cursor-pointer transition-colors"
                onClick={() => {
                  setEditingMember(p);
                  setMemberFormOpen(true);
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{p.fullName}</h4>
                    <p className="text-xs text-muted-foreground">{p.role || RELATIONSHIP_LABELS[p.relationship]}</p>
                  </div>
                  <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                    {p.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-3 text-xs space-y-1 font-mono text-muted-foreground">
                  <div>Relationship: <span className="text-foreground font-sans font-medium">{RELATIONSHIP_LABELS[p.relationship] || p.relationship}</span></div>
                  <div>Treatment: <span className="text-gold font-sans font-medium">{p.compensationMode === "salary" ? "Owner Salary (P&L)" : "Owner Drawing (Equity)"}</span></div>
                  {p.phone && <div>Phone: {p.phone}</div>}
                  {p.notes && <div className="text-[11px] italic font-sans">{p.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ExpenseFormDialog
        key={editingExpense?.id ?? "new-expense"}
        open={expenseFormOpen}
        onOpenChange={(open) => {
          setExpenseFormOpen(open);
          if (!open) setEditingExpense(null);
        }}
        initial={editingExpense}
      />

      <DrawingFormDialog
        key={editingDrawing?.id ?? "new-drawing"}
        open={drawingFormOpen}
        onOpenChange={(open) => {
          setDrawingFormOpen(open);
          if (!open) setEditingDrawing(null);
        }}
        initial={editingDrawing}
      />

      <MemberMasterDialog
        key={editingMember?.id ?? "new-member"}
        open={memberFormOpen}
        onOpenChange={(open) => {
          setMemberFormOpen(open);
          if (!open) setEditingMember(null);
        }}
        initial={editingMember}
      />
    </ModuleWorkspace>
  );
}
