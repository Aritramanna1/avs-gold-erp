import { createRepository } from "@/lib/repositories/base-repository";

export interface BranchKPIs {
  salesThisMonthPaise: number;
  invoiceCount: number;
  outstandingPaise: number;
  pendingOrders: number;
  activeJobCards: number;
  readyJobCards: number;
  pendingRepairs: number;
  totalCustomers: number;
}

const invoices = createRepository<any>("invoices");
const orders = createRepository<any>("orders");
const jobs = createRepository<any>("job_cards");
const repairs = createRepository<any>("repairs");
const people = createRepository<any>("people");

function belongsToBranch(row: any, branchId: string): boolean {
  return (row.branchId ?? row.branch_id ?? "MAIN") === branchId;
}

export async function getBranchKPIs(branchId: string): Promise<BranchKPIs> {
  const [allInvoices, allOrders, allJobs, allRepairs, allPeople] = await Promise.all([
    invoices.readAll(),
    orders.readAll(),
    jobs.readAll(),
    repairs.readAll(),
    people.readAll(),
  ]);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const branchInvoices = allInvoices.filter((row) => belongsToBranch(row, branchId));
  const monthInvoices = branchInvoices.filter((row) => Number(row.createdAt ?? 0) >= monthStart);
  const branchOrders = allOrders.filter((row) => belongsToBranch(row, branchId));
  const branchJobs = allJobs.filter((row) => belongsToBranch(row, branchId));
  const branchRepairs = allRepairs.filter((row) => belongsToBranch(row, branchId));
  const branchPeople = allPeople.filter((row) => belongsToBranch(row, branchId));
  return {
    salesThisMonthPaise: monthInvoices.reduce(
      (sum, row) => sum + Number(row.grandTotalPaise ?? 0),
      0,
    ),
    invoiceCount: monthInvoices.length,
    outstandingPaise: branchInvoices.reduce(
      (sum, row) => sum + Math.max(0, Number(row.balancePaise ?? 0)),
      0,
    ),
    pendingOrders: branchOrders.filter((row) =>
      ["pending", "in_progress", "ready"].includes(row.status),
    ).length,
    activeJobCards: branchJobs.filter((row) => ["open", "in_progress"].includes(row.status)).length,
    readyJobCards: branchJobs.filter((row) => row.status === "ready").length,
    pendingRepairs: branchRepairs.filter((row) => !["delivered", "cancelled"].includes(row.status))
      .length,
    totalCustomers: branchPeople.filter((row) => row.type === "customer").length,
  };
}
