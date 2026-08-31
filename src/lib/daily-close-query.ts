import { computeBalances, type LedgerEntry } from "@/lib/ledger-store";
import { karigarCustodySummaries, type JobCard } from "@/lib/jobcards-store";
import type { DailyCloseSnapshot } from "@/lib/dailyclose-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Invoice } from "@/lib/billing-store";
import type { Repair } from "@/lib/repair-store";
import type { Withdrawal } from "@/lib/workers-store";

const SNAPSHOT_LIMIT = 1000;

export interface DailyCloseQueryResult {
  snapshot: DailyCloseSnapshot;
  ordersToday: number;
  stockItemsTotal: number;
  capped: boolean;
}

function dayBounds(date: string) {
  return {
    startMs: new Date(`${date}T00:00:00`).getTime(),
    endMs: new Date(`${date}T23:59:59`).getTime(),
    startIso: `${date}T00:00:00.000Z`,
    endIso: `${date}T23:59:59.999Z`,
  };
}

function inDay(ts: number, startMs: number, endMs: number): boolean {
  return ts >= startMs && ts <= endMs;
}

function withBranch(query: any, branchId?: string | null) {
  return branchId ? query.filter("data->>branchId", "eq", branchId) : query;
}

async function fetchDataRows<T>(
  table: string,
  options: { branchId?: string | null; orderColumn?: string; gte?: string; lte?: string } = {},
): Promise<{ rows: T[]; capped: boolean }> {
  let request = (supabase as any)
    .from(table)
    .select("data")
    .order(options.orderColumn ?? "updated_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);
  if (options.gte) request = request.gte(options.orderColumn ?? "updated_at", options.gte);
  if (options.lte) request = request.lte(options.orderColumn ?? "updated_at", options.lte);
  request = withBranch(request, options.branchId);
  const { data, error } = await request;
  if (error) throw new Error(error.message ?? `Could not load ${table}.`);
  const rows = ((data ?? []) as Array<{ data: T | null }>)
    .map((row) => row.data)
    .filter((row): row is T => !!row);
  return { rows, capped: rows.length >= SNAPSHOT_LIMIT };
}

export async function fetchDailyCloseSnapshot(
  date: string,
  branchId?: string | null,
): Promise<DailyCloseQueryResult> {
  const { startMs, endMs, startIso, endIso } = dayBounds(date);

  const [
    ledgerResult,
    invoicesResult,
    jobsResult,
    repairsResult,
    ordersResult,
    stockResult,
    withdrawalsResult,
  ] = await Promise.all([
    fetchDataRows<LedgerEntry>("gold_ledger", { branchId, orderColumn: "ts", lte: endIso }),
    fetchDataRows<Invoice>("invoices", {
      branchId,
      orderColumn: "created_at",
      gte: startIso,
      lte: endIso,
    }),
    fetchDataRows<JobCard>("job_cards", { branchId, orderColumn: "updated_at", lte: endIso }),
    fetchDataRows<Repair>("repairs", {
      branchId,
      orderColumn: "created_at",
      gte: startIso,
      lte: endIso,
    }),
    fetchDataRows<Record<string, any>>("orders", {
      branchId,
      orderColumn: "created_at",
      gte: startIso,
      lte: endIso,
    }),
    fetchDataRows<Record<string, any>>("inventory", { branchId, orderColumn: "updated_at" }),
    fetchDataRows<Withdrawal>("worker_withdrawals", {
      branchId,
      orderColumn: "created_at",
      gte: startIso,
      lte: endIso,
    }),
  ]);

  const ledger = ledgerResult.rows.filter((entry) => typeof entry.netFineMg === "number");
  const balance = computeBalances(ledger);
  const balanceBefore = computeBalances(ledger.filter((entry) => entry.createdAt < startMs));
  const todaysLedger = ledger.filter((entry) => inDay(entry.createdAt, startMs, endMs));

  const goldIssuedMg = todaysLedger
    .filter((entry) => entry.type === "issue_to_karigar")
    .reduce((sum, entry) => sum + (entry.deltas.karigar ?? 0), 0);
  const goldReceivedMg = todaysLedger
    .filter(
      (entry) => entry.type === "receive_from_karigar" || entry.type === "finished_item_created",
    )
    .reduce((sum, entry) => sum + Math.max(0, -(entry.deltas.karigar ?? 0)), 0);
  const finishedCreatedMg = todaysLedger
    .filter((entry) => entry.type === "finished_item_created")
    .reduce((sum, entry) => sum + (entry.deltas.finished ?? 0), 0);
  const scrapReturnedMg = todaysLedger
    .filter((entry) => entry.type === "scrap_returned")
    .reduce((sum, entry) => sum + (entry.deltas.scrap ?? 0), 0);
  const soldFineMg = -todaysLedger
    .filter((entry) => entry.type === "sale")
    .reduce((sum, entry) => sum + (entry.deltas.finished ?? 0), 0);
  const custody = karigarCustodySummaries(jobsResult.rows).reduce(
    (sum, item) => sum + item.outstandingMg,
    0,
  );

  const invoices = invoicesResult.rows.filter((invoice) => invoice.status !== "cancelled");
  let cash = 0;
  let upi = 0;
  let bank = 0;
  let card = 0;
  let outstanding = 0;
  let gstTotal = 0;
  let salesTotal = 0;
  for (const invoice of invoices) {
    salesTotal += invoice.subtotalPaise + invoice.gstPaise;
    gstTotal += invoice.gstPaise;
    for (const payment of invoice.payments ?? []) {
      if (!inDay(payment.ts, startMs, endMs)) continue;
      if (payment.mode === "cash") cash += payment.amountPaise;
      else if (payment.mode === "upi") upi += payment.amountPaise;
      else if (payment.mode === "bank") bank += payment.amountPaise;
      else if (payment.mode === "card") card += payment.amountPaise;
      else if (payment.mode === "outstanding") outstanding += payment.amountPaise;
    }
  }

  let repairPay = 0;
  for (const repair of repairsResult.rows) {
    if (inDay(repair.createdAt, startMs, endMs)) repairPay += repair.advancePaise;
    for (const payment of repair.payments ?? []) {
      if (!inDay(payment.ts, startMs, endMs) || payment.mode === "outstanding") continue;
      repairPay += payment.amountPaise;
      if (payment.mode === "cash") cash += payment.amountPaise;
      else if (payment.mode === "upi") upi += payment.amountPaise;
      else if (payment.mode === "bank") bank += payment.amountPaise;
      else if (payment.mode === "card") card += payment.amountPaise;
    }
  }

  const workerWithdrawals = withdrawalsResult.rows
    .filter((withdrawal) => withdrawal.date === date)
    .reduce((sum, withdrawal) => sum + withdrawal.amountPaise, 0);

  return {
    snapshot: {
      openingVaultMg: balanceBefore.buckets.vault,
      goldIssuedMg: Math.abs(goldIssuedMg),
      goldReceivedMg,
      finishedCreatedMg,
      scrapReturnedMg,
      soldFineMg,
      closingVaultMg: balance.buckets.vault,
      karigarOutstandingMg: custody,
      balanceSheetBalanced: balance.balanced,
      discrepancyMg: balance.discrepancyMg,
      invoiceCount: invoices.length,
      salesTotalPaise: salesTotal,
      cashTotalPaise: cash,
      upiTotalPaise: upi,
      bankTotalPaise: bank,
      cardTotalPaise: card,
      outstandingTotalPaise: outstanding,
      repairPaymentsPaise: repairPay,
      workerWithdrawalsPaise: workerWithdrawals,
      gstCollectedPaise: gstTotal,
      jobCardsCreated: jobsResult.rows.filter((job) => inDay(job.createdAt, startMs, endMs)).length,
      jobCardsClosed: jobsResult.rows.filter(
        (job) => inDay(job.updatedAt, startMs, endMs) && job.status === "closed",
      ).length,
      repairsCreated: repairsResult.rows.filter((repair) => inDay(repair.createdAt, startMs, endMs))
        .length,
      repairsDelivered: repairsResult.rows.filter(
        (repair) => !!repair.deliveredAt && inDay(repair.deliveredAt, startMs, endMs),
      ).length,
    },
    ordersToday: ordersResult.rows.length,
    stockItemsTotal: stockResult.rows.length,
    capped:
      ledgerResult.capped ||
      invoicesResult.capped ||
      jobsResult.capped ||
      repairsResult.capped ||
      ordersResult.capped ||
      stockResult.capped ||
      withdrawalsResult.capped,
  };
}
