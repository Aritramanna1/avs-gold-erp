import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { TrendingDown } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { useExpensesStore } from "@/lib/expenses-store";
export const Route = createFileRoute("/expenses/")({ component: ExpensesWorkspace });
function ExpensesWorkspace() {
  const expenses = useExpensesStore((s) => s.expenses);
  const withdrawals = useExpensesStore((s) => s.withdrawals);
  const refresh = useExpensesStore((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const total = expenses.reduce((n, e) => n + e.amountPaise, 0);
  return (
    <ModuleWorkspace
      eyebrow="Cash control"
      title="Expenses"
      description="Record business spending, family withdrawals, and supporting notes with the existing firm and branch context."
      icon={TrendingDown}
      onRefresh={() => void refresh()}
      metrics={[
        { label: "Expenses", value: expenses.length },
        { label: "This month", value: `₹ ${(total / 100).toLocaleString("en-IN")}` },
        { label: "Withdrawals", value: withdrawals.length },
        { label: "Categories", value: new Set(expenses.map((e) => e.category)).size },
      ]}
      actions={[]}
    >
      <section className="erp-surface rounded-md p-5">
        <h2 className="font-semibold">Recent expenses</h2>
        <div className="mt-4 divide-y">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded.</p>
          ) : (
            expenses
              .slice(-10)
              .reverse()
              .map((expense) => (
                <div className="flex justify-between py-3 text-sm" key={expense.id}>
                  <span>{expense.category}</span>
                  <span className="font-mono">
                    ₹ {(expense.amountPaise / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              ))
          )}
        </div>
      </section>
    </ModuleWorkspace>
  );
}
