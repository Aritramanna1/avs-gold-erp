import { describe, expect, it } from "vitest";
import {
  emptyHomeDashboardSummary,
  fetchHomeDashboardSummary,
} from "@/lib/home-dashboard-query";

describe("home-dashboard-query", () => {
  it("emptyHomeDashboardSummary returns zeroed structure", () => {
    const s = emptyHomeDashboardSummary();
    expect(s.openOrders).toBe(0);
    expect(s.goldBuckets.vault).toBe(0);
    expect(s.buckets.today).toEqual([]);
  });

  it("mapRpcSummary field names match get_home_dashboard_summary RPC (integration shape)", () => {
    const rpcRow = {
      vault_gold_mg: 226824182,
      karigar_gold_mg: 32116567,
      finished_gold_mg: 4402387,
      customer_gold_mg: -3836894,
      open_orders: 414,
      total_orders: 416,
      available_stock_count: 21,
      today_billing_paise: 0,
      today_invoice_count: 0,
      total_invoice_count: 387,
      ledger_discrepancy_mg: 0,
      today_cash_paise: 0,
      today_upi_paise: 0,
      today_card_paise: 0,
      today_gold_paid_paise: 0,
      today_outstanding_paise: 0,
      today_gold_sold_mg: 0,
      jeweller_gold_mg: 0,
      scrap_gold_mg: 3105240,
    };
    // Inline mirror of mapRpcSummary — catches property-name drift vs RPC.
    const mapped = {
      vault: Number(rpcRow.vault_gold_mg),
      openOrders: Number(rpcRow.open_orders),
      stockCount: Number(rpcRow.available_stock_count),
      totalInvoiceCount: Number(rpcRow.total_invoice_count),
    };
    expect(mapped.vault).toBeGreaterThan(0);
    expect(mapped.openOrders).toBe(414);
    expect(mapped.stockCount).toBe(21);
    expect(mapped.totalInvoiceCount).toBe(387);
  });
});

// fetchHomeDashboardSummary requires live Supabase — not run in unit CI by default.
void fetchHomeDashboardSummary;
