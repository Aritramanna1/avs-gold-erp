import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBilling, INVOICE_STATUS_LABELS, paiseToRupees } from "@/lib/billing-store";
import {
  fetchBillingInvoicePage,
  fetchBillingOutstandingSummary,
  type BillingOutstandingRow,
} from "@/lib/billing-query";
import { hydrateCustomerLedgerContext } from "@/lib/customer-ledger-context";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { mgToGrams } from "@/lib/gold";
import { usePeople } from "@/lib/people-store";
import { useCan } from "@/lib/rbac";
import { useSettings } from "@/lib/settings-store";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { FileText, Plus, Receipt, Search, Coins, Printer } from "lucide-react";
import { GoldSettlementTab } from "@/components/GoldSettlementTab";
import { EmptyState, WebAppState } from "@/components/web-app-state";
import { CustomerPaymentAllocationModal } from "@/components/CustomerPaymentAllocationModal";
import {
  useSettlements,
  FINANCIAL_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
} from "@/lib/settlement-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";

type BillingSearch = {
  q?: string;
  page?: number;
};

export const Route = createFileRoute("/billing/")({
  head: () => ({ meta: [{ title: "Billing · AVS Gold ERP" }] }),
  validateSearch: (search: Record<string, unknown>): BillingSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    page:
      typeof search.page === "number"
        ? search.page
        : typeof search.page === "string"
          ? Number(search.page)
          : 1,
  }),
  component: BillingIndex,
});

function BillingIndex() {
  const invoices = useBilling((s) => s.invoices);
  const people = usePeople((s) => s.people);
  const navigate = useNavigate({ from: "/billing" });
  const search = useSearch({ from: "/billing/" });
  const currentUserRole = useSettings((s) => s.currentUserRole);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [pageInvoices, setPageInvoices] = useState<typeof invoices>([]);
  const [invoiceTotalCount, setInvoiceTotalCount] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [serverOutstandingTotal, setServerOutstandingTotal] = useState(0);
  const [outstandingRows, setOutstandingRows] = useState<BillingOutstandingRow[]>([]);
  const [loadingOutstanding, setLoadingOutstanding] = useState(true);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [selectedCustomerIdForPayment, setSelectedCustomerIdForPayment] = useState<string | null>(null);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const { can } = useCan();
  const [activeTab, setActiveTab] = useState("invoices");

  const pageSize = 25;
  const page = Math.max(1, Number(search.page) || 1);
  const q = search.q?.trim() ?? "";
  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotalCount / pageSize));

  const billingBranchId = useMemo(() => {
    const globalRoles = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
      "firm-owner",
      "super_owner",
      "administrator",
    ];
    return currentUserRole && !globalRoles.includes(currentUserRole)
      ? selectedBranchId || "MAIN"
      : null;
  }, [currentUserRole, selectedBranchId]);

  useEffect(() => {
    let cancelled = false;

    void useBilling.getState().refresh();
    setLoadingInvoices(true);
    setInvoiceError(null);
    fetchBillingInvoicePage({ page, pageSize, query: q, branchId: billingBranchId })
      .then((result) => {
        if (cancelled) return;
        setPageInvoices(result.invoices);
        setInvoiceTotalCount(result.totalCount);
        setTotalCollected(result.collectedPaise);
        setServerOutstandingTotal(result.outstandingPaise);
        useBilling.setState((s) => ({
          invoices: [
            ...result.invoices,
            ...s.invoices.filter((i) => !result.invoices.some((r) => r.id === i.id)),
          ],
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setInvoiceError(err instanceof Error ? err.message : "Could not load invoices.");
        setPageInvoices([]);
        setInvoiceTotalCount(0);
        setTotalCollected(0);
        setServerOutstandingTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoices(false);
      });

    return () => {
      cancelled = true;
    };
  }, [billingBranchId, page, q]);

  useEffect(() => {
    let cancelled = false;

    setLoadingOutstanding(true);
    setOutstandingError(null);
    fetchBillingOutstandingSummary({ branchId: billingBranchId })
      .then((rows) => {
        if (cancelled) return;
        setOutstandingRows(rows);
        setServerOutstandingTotal(rows.reduce((sum, row) => sum + row.amount, 0));
      })
      .catch((err) => {
        if (cancelled) return;
        setOutstandingError(err instanceof Error ? err.message : "Could not load outstanding.");
        setOutstandingRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOutstanding(false);
      });

    return () => {
      cancelled = true;
    };
  }, [billingBranchId]);

  const updateSearch = (patch: Partial<BillingSearch>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
      replace: true,
    });
  };

  const goldRatePaise = getCurrentGoldRatePaise() || 750000;

  const totalOutstanding = serverOutstandingTotal;
  const totalInvoices = invoiceTotalCount;
  const collectedPaise = totalCollected || invoices.reduce((sum, inv) => sum + (inv.paidPaise || 0), 0);

  const totalInvoiceGoldMg = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const itemsFine = inv.items?.reduce((s, it) => s + (it.fineMg || 0), 0) || 0;
      if (itemsFine > 0) return sum + itemsFine;
      return sum + Math.round(((inv.grandTotalPaise || inv.subtotalPaise) / goldRatePaise) * 1000);
    }, 0);
  }, [invoices, goldRatePaise]);

  const totalCollectedGoldMg = useMemo(() => {
    return Math.round((collectedPaise / goldRatePaise) * 1000);
  }, [collectedPaise, goldRatePaise]);

  const totalOutstandingGoldMg = useMemo(() => {
    return Math.round((totalOutstanding / goldRatePaise) * 1000);
  }, [totalOutstanding, goldRatePaise]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Billing (Gold-First)"
        subtitle="Fine gold accounting, bullion balances, invoice registry and customer ledger."
        actions={
          <div className="flex gap-2 flex-wrap">
            {can("billing.create") ? (
              <Link to="/settlement/new">
                <Button variant="outline" data-testid="billing-create-settlement" className="gap-2">
                  <Plus className="h-4 w-4" /> New Settlement
                </Button>
              </Link>
            ) : null}
            {can("billing.create") ? (
              <Link to="/billing/new">
                <Button data-testid="billing-create-invoice" className="gap-2 bg-gold hover:bg-gold/90 text-white font-semibold">
                  <Plus className="h-4 w-4" /> New Invoice
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat
          label="Invoices (Gold First)"
          value={`${totalInvoices} Invoices`}
          goldValue={`${mgToGrams(totalInvoiceGoldMg)} g Fine Gold`}
          subvalue={`${totalInvoices} Invoices · ₹ ${paiseToRupees(invoices.reduce((s, i) => s + (i.subtotalPaise + i.gstPaise), 0))}`}
        />
        <Stat
          label="Collected (Gold First)"
          value={`${mgToGrams(totalCollectedGoldMg)} g Gold`}
          goldValue={`${mgToGrams(totalCollectedGoldMg)} g Gold`}
          subvalue={`Cash Equiv: ₹ ${paiseToRupees(totalCollected)}`}
          tone="text-emerald-300"
        />
        <Stat
          label="Outstanding (Gold First)"
          value={`${mgToGrams(totalOutstandingGoldMg)} g Gold`}
          goldValue={`${mgToGrams(totalOutstandingGoldMg)} g Gold Due`}
          subvalue={`Cash Equiv: ₹ ${paiseToRupees(totalOutstanding)}`}
          tone="text-amber-300"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Mobile View: Select Dropdown to keep layout clean */}
        <div className="block md:hidden mb-4">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full bg-white border border-border rounded-md px-4 py-3 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-gold focus:ring-offset-1 focus:border-transparent">
              <SelectValue placeholder="Select billing view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="invoices">Invoices Registry</SelectItem>
              <SelectItem value="outstanding">Outstanding Balances</SelectItem>
              <SelectItem value="ledger">Customer Ledger Statement</SelectItem>
              <SelectItem value="settlements">Gold Settlements (Karigar)</SelectItem>
              <SelectItem value="customer-settlements">Customer Settlements</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop View: Full horizontal tabs triggers bar */}
        <TabsList className="hidden md:flex flex-wrap h-auto">
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" /> Invoices
          </TabsTrigger>
          <TabsTrigger value="outstanding" className="gap-2">
            <Receipt className="h-4 w-4" /> Outstanding
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2">
            Customer Ledger
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-2">
            <Coins className="h-4 w-4 text-gold" /> Gold Settlements
          </TabsTrigger>
          <TabsTrigger value="customer-settlements" className="gap-2">
            <FileText className="h-4 w-4" /> Customer Settlements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="relative max-w-sm mb-3">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => updateSearch({ q: e.target.value })}
                placeholder="Search invoice, customer, phone, order"
                className="pl-9"
              />
            </div>
            {loadingInvoices ? (
              <WebAppState
                title="Loading invoices"
                description="Fetching billing records from Supabase."
              />
            ) : invoiceError ? (
              <WebAppState
                title="Could not load invoices"
                description={invoiceError}
                tone="danger"
                action={{ label: "Retry", onClick: () => updateSearch({ page }) }}
              />
            ) : pageInvoices.length === 0 ? (
              <EmptyState
                title={q ? "No invoices match this search" : "No invoices yet"}
                description={
                  q
                    ? "Clear or change the search text to see other invoices."
                    : "Create one from an order, a finished stock item, or use New Invoice."
                }
              />
            ) : (
              <div>
                {/* Mobile View: Cards */}
                <div className="block md:hidden space-y-3">
                  {pageInvoices.map((i) => {
                    const itemFineMg = i.items?.reduce((s, it) => s + (it.fineMg || 0), 0) || 0;
                    const totalPaise = i.subtotalPaise + i.gstPaise;
                    const rate = i.items?.[0]?.goldRatePerGramPaise || goldRatePaise;
                    const invFineMg = itemFineMg > 0 ? itemFineMg : Math.round((totalPaise / rate) * 1000);
                    const paidFineMg = totalPaise > 0 ? Math.round((invFineMg * (i.paidPaise || 0)) / totalPaise) : 0;
                    const balanceFineMg = Math.max(0, invFineMg - paidFineMg);

                    return (
                      <div
                        key={i.id}
                        className="border border-border rounded-md p-4 bg-card shadow-sm space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-semibold text-gold">
                            {i.invoiceNo}
                          </span>
                          <Badge variant="outline" className="text-[9px]">
                            {INVOICE_STATUS_LABELS[i.status]}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">{i.customerName}</div>
                        {i.customerPhone && (
                          <div className="text-xs text-muted-foreground">{i.customerPhone}</div>
                        )}
                        {i.orderNo && (
                          <div className="text-xs text-muted-foreground">Order: {i.orderNo}</div>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-border/50">
                          <div>
                            <div className="text-muted-foreground text-[10px]">Total (Gold)</div>
                            <div className="font-bold text-gold font-mono">
                              {mgToGrams(invFineMg)} g
                            </div>
                            <div className="text-[9px] text-muted-foreground font-mono">
                              ₹ {paiseToRupees(totalPaise)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-[10px]">Paid</div>
                            <div className="font-bold text-emerald-300 font-mono">
                              {mgToGrams(paidFineMg)} g
                            </div>
                            <div className="text-[9px] text-muted-foreground font-mono">
                              ₹ {paiseToRupees(i.paidPaise)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-[10px]">Balance</div>
                            <div className="font-bold text-amber-300 font-mono">
                              {mgToGrams(balanceFineMg)} g
                            </div>
                            <div className="text-[9px] text-muted-foreground font-mono">
                              ₹ {paiseToRupees(i.balancePaise)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            title="Print Invoice"
                            onClick={() => window.open(`/billing/print/${i.id}`, "_blank")}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Link to="/billing/$id" params={{ id: i.id }}>
                            <Button size="sm" className="h-8">
                              Open
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left py-2">Invoice</th>
                        <th className="text-left">Customer</th>
                        <th className="text-left">Order</th>
                        <th className="text-right">Total (Fine Gold)</th>
                        <th className="text-right">Paid (Gold)</th>
                        <th className="text-right">Balance Due (Gold)</th>
                        <th className="text-left pl-3">Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageInvoices.map((i) => {
                        const itemFineMg = i.items?.reduce((s, it) => s + (it.fineMg || 0), 0) || 0;
                        const totalPaise = i.subtotalPaise + i.gstPaise;
                        const rate = i.items?.[0]?.goldRatePerGramPaise || goldRatePaise;
                        const invFineMg = itemFineMg > 0 ? itemFineMg : Math.round((totalPaise / rate) * 1000);
                        const paidFineMg = totalPaise > 0 ? Math.round((invFineMg * (i.paidPaise || 0)) / totalPaise) : 0;
                        const balanceFineMg = Math.max(0, invFineMg - paidFineMg);

                        return (
                          <tr key={i.id} className="border-b border-border/60 hover:bg-background/30">
                            <td className="py-2 font-mono text-xs text-gold font-semibold">{i.invoiceNo}</td>
                            <td>
                              <div className="font-medium text-foreground">{i.customerName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {i.customerPhone}
                              </div>
                            </td>
                            <td className="text-xs text-muted-foreground">{i.orderNo ?? "—"}</td>
                            <td className="text-right">
                              <div className="font-mono font-bold text-gold">
                                {mgToGrams(invFineMg)} g
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                ₹ {paiseToRupees(totalPaise)}
                              </div>
                            </td>
                            <td className="text-right">
                              <div className="font-mono font-bold text-emerald-400">
                                {mgToGrams(paidFineMg)} g
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                ₹ {paiseToRupees(i.paidPaise)}
                              </div>
                            </td>
                            <td className="text-right">
                              <div className="font-mono font-bold text-amber-400">
                                {mgToGrams(balanceFineMg)} g
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                ₹ {paiseToRupees(i.balancePaise)}
                              </div>
                            </td>
                            <td className="pl-3">
                              <Badge variant="outline" className="text-[10px]">
                                {INVOICE_STATUS_LABELS[i.status]}
                              </Badge>
                            </td>
                            <td className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Print Invoice"
                                  onClick={() => window.open(`/billing/print/${i.id}`, "_blank")}
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                                <Link to="/billing/$id" params={{ id: i.id }}>
                                  <Button size="sm" variant="outline">
                                    Open
                                  </Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Page {page} of {invoiceTotalPages} · {invoiceTotalCount} invoices
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loadingInvoices}
                      onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= invoiceTotalPages || loadingInvoices}
                      onClick={() => updateSearch({ page: page + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="outstanding" className="mt-4">
          <div className="rounded-md border border-border bg-card p-4">
            {loadingOutstanding ? (
              <WebAppState
                title="Loading outstanding balances"
                description="Fetching customer dues from Supabase."
              />
            ) : outstandingError ? (
              <WebAppState
                title="Could not load outstanding balances"
                description={outstandingError}
                tone="danger"
              />
            ) : outstandingRows.length === 0 ? (
              <EmptyState
                title="No outstanding balances"
                description="All visible customer invoices are settled."
              />
            ) : (
              <div>
                {/* Mobile View: Cards */}
                <div className="block md:hidden space-y-3">
                  {outstandingRows.map((o) => (
                    <div
                      key={o.customerId}
                      className="border border-border rounded-md p-4 bg-card shadow-sm space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">{o.customerName}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {o.latestInv}
                        </span>
                      </div>
                      {o.phone && <div className="text-xs text-muted-foreground">{o.phone}</div>}
                      <div className="flex justify-between items-center pt-2 border-t border-border/50">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">
                            Outstanding (Gold Due)
                          </span>
                          <span className="font-bold text-amber-300 text-sm font-mono block">
                            {mgToGrams(Math.round((o.amount / goldRatePaise) * 1000))} g Gold
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ₹ {paiseToRupees(o.amount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Age</span>
                          <span className="font-semibold text-xs text-foreground">
                            {o.days} days
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-gold hover:bg-gold/90 text-white font-semibold gap-1.5"
                          onClick={() => {
                            setSelectedCustomerIdForPayment(o.customerId);
                            setIsAllocationModalOpen(true);
                          }}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          {can("billing.recordPayment") ? "Receive Payment (Auto)" : "Open"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left py-2">Customer</th>
                        <th className="text-left">Phone</th>
                        <th className="text-left">Latest Inv.</th>
                        <th className="text-right">Outstanding (Gold Due)</th>
                        <th className="text-right">Days</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstandingRows.map((o) => (
                        <tr key={o.customerId} className="border-b border-border/60">
                          <td className="py-2 font-medium">{o.customerName}</td>
                          <td className="text-xs text-muted-foreground">{o.phone ?? "—"}</td>
                          <td className="font-mono text-xs">{o.latestInv}</td>
                          <td className="text-right">
                            <div className="font-mono font-bold text-amber-300">
                              {mgToGrams(Math.round((o.amount / goldRatePaise) * 1000))} g
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              ₹ {paiseToRupees(o.amount)}
                            </div>
                          </td>
                          <td className="text-right">{o.days}d</td>
                          <td className="text-right">
                            <Button
                              size="sm"
                              className="bg-gold hover:bg-gold/90 text-white font-semibold gap-1.5"
                              onClick={() => {
                                setSelectedCustomerIdForPayment(o.customerId);
                                setIsAllocationModalOpen(true);
                              }}
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              {can("billing.recordPayment") ? "Receive Payment" : "Open"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <CustomerLedgerView invoices={invoices} customers={people} />
        </TabsContent>

        <TabsContent value="settlements" className="mt-4">
          <GoldSettlementTab />
        </TabsContent>

        <TabsContent value="customer-settlements" className="mt-4">
          <CustomerSettlementsList />
        </TabsContent>
      </Tabs>

      {selectedCustomerIdForPayment && (
        <CustomerPaymentAllocationModal
          customerId={selectedCustomerIdForPayment}
          isOpen={isAllocationModalOpen}
          onClose={() => {
            setIsAllocationModalOpen(false);
            setSelectedCustomerIdForPayment(null);
          }}
          onSuccess={() => {
            fetchBillingOutstandingSummary({ branchId: billingBranchId }).then((rows) => {
              setOutstandingRows(rows);
              setServerOutstandingTotal(rows.reduce((sum, row) => sum + row.amount, 0));
            });
            void useBilling.getState().refresh();
          }}
        />
      )}
    </div>
  );
}

function CustomerSettlementsList() {
  const settlements = useSettlements((s) => s.settlements);
  const refresh = useSettlements((s) => s.refresh);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...settlements].sort((a, b) => b.createdAt - a.createdAt);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center rounded-md border border-border bg-card">
        No settlement drafts yet. Use "New Settlement" above to create one before delivering
        jewellery to a customer.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      {/* Mobile View: Cards */}
      <div className="block md:hidden space-y-3">
        {sorted.map((s) => (
          <div
            key={s.id}
            className="border border-border rounded-md p-4 bg-background/50 shadow-sm space-y-2"
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-semibold text-gold">{s.settlementNo}</span>
              <span className="text-xs font-medium text-foreground">{s.customerName}</span>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/50 text-[10px]">
              <div>
                <span className="text-muted-foreground block mb-0.5">Financial</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {FINANCIAL_STATUS_LABELS[s.financialStatus]}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Delivery</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {DELIVERY_STATUS_LABELS[s.deliveryStatus]}
                </Badge>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Link to="/settlement/$id" params={{ id: s.id }}>
                <Button size="sm" className="h-8 text-xs">
                  Open
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-2">Settlement</th>
              <th className="text-left">Customer</th>
              <th className="text-left">Financial Status</th>
              <th className="text-left">Delivery Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-b border-border/60 hover:bg-background/30">
                <td className="py-2 font-mono text-xs text-gold">{s.settlementNo}</td>
                <td>{s.customerName}</td>
                <td>
                  <Badge variant="outline" className="text-[10px]">
                    {FINANCIAL_STATUS_LABELS[s.financialStatus]}
                  </Badge>
                </td>
                <td>
                  <Badge variant="outline" className="text-[10px]">
                    {DELIVERY_STATUS_LABELS[s.deliveryStatus]}
                  </Badge>
                </td>
                <td className="text-right">
                  <Link to="/settlement/$id" params={{ id: s.id }}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerLedgerView({
  invoices,
  customers,
}: {
  invoices: ReturnType<typeof useBilling.getState>["invoices"];
  customers: ReturnType<typeof usePeople.getState>["people"];
}) {
  // Reactivity note: compileCustomerLedger() reads Orders/Invoices/Gold
  // Settlements via getState() internally, not a selector — so this
  // component must explicitly subscribe to the settlements array (invoices
  // is already a prop/selector), or the ledger would silently go stale the
  // moment a settlement voucher is recorded elsewhere without a reload.
  const settlements = useGoldSettlement((s) => s.settlements);

  const billing = customers.filter(
    (c) =>
      invoices.some((i) => i.customerId === c.id) ||
      settlements.some((s) => s.party_type === "customer" && s.party_id === c.id),
  );
  const [selected, setSelected] = useState<string | null>(billing[0]?.id ?? null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerVersion, setLedgerVersion] = useState(0);

  useEffect(() => {
    if (!selected && billing[0]?.id) setSelected(billing[0].id);
  }, [billing, selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingLedger(true);
    setLedgerError(null);
    hydrateCustomerLedgerContext(selected)
      .then(() => {
        if (!cancelled) setLedgerVersion((value) => value + 1);
      })
      .catch((err) => {
        if (!cancelled) {
          setLedgerError(err instanceof Error ? err.message : "Could not load customer ledger.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLedger(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);
  // Unified running ledger — same compiler the People module's customer
  // profile and ledger print already use, so Billing shows the exact same
  // combined gold + cash position instead of a cash-only, invoice-only view.
  const ledger = useMemo(
    () => (selected ? compileCustomerLedger(selected) : null),
    [selected, invoices, settlements, ledgerVersion],
  );

  if (billing.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center rounded-md border border-border bg-card">
        No customer ledgers yet. They appear after an invoice or gold settlement voucher is created.
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <div className="rounded-md border border-border bg-card p-2 space-y-1 max-h-[500px] overflow-y-auto">
        {billing.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected === c.id ? "bg-gold/15 text-gold" : "hover:bg-background/40"}`}
          >
            <div className="font-medium">{c.fullName}</div>
            <div className="text-[11px] text-muted-foreground">{c.phone}</div>
          </button>
        ))}
      </div>
      <div className="rounded-md border border-border bg-card p-4">
        {loadingLedger ? (
          <WebAppState
            title="Loading customer ledger"
            description="Fetching this customer's ledger context from Supabase."
          />
        ) : ledgerError ? (
          <WebAppState
            title="Could not load customer ledger"
            description={ledgerError}
            tone="danger"
          />
        ) : (
          ledger && (
            <>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <Stat
                  label="Gold Balance"
                  value={`${mgToGrams(Math.abs(ledger.closingGoldMg))} g ${ledger.closingGoldMg >= 0 ? "we owe" : "owed to us"}`}
                  tone={ledger.closingGoldMg > 0 ? "text-amber-300" : "text-emerald-300"}
                />
                <Stat
                  label="Money Balance"
                  value={`₹ ${paiseToRupees(Math.abs(ledger.closingMoneyPaise))} ${ledger.closingMoneyPaise >= 0 ? "due" : "advance"}`}
                  tone={ledger.closingMoneyPaise > 0 ? "text-amber-300" : "text-emerald-300"}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left py-2">Date</th>
                      <th className="text-left">Voucher</th>
                      <th className="text-left">Type</th>
                      <th className="text-left">Description</th>
                      <th className="text-right">Gold In</th>
                      <th className="text-right">Gold Out</th>
                      <th className="text-right">Dr (₹)</th>
                      <th className="text-right">Cr (₹)</th>
                      <th className="text-right border-l border-border/40">Gold Bal</th>
                      <th className="text-right">Money Bal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="font-mono text-xs uppercase">{row.voucherNo}</td>
                        <td className="text-xs">{row.type}</td>
                        <td className="text-xs max-w-[200px] break-words">{row.description}</td>
                        <td className="text-right font-mono text-gold">
                          {row.goldInMg > 0 ? `${mgToGrams(row.goldInMg)} g` : "—"}
                        </td>
                        <td className="text-right font-mono text-muted-foreground">
                          {row.goldOutMg > 0 ? `${mgToGrams(row.goldOutMg)} g` : "—"}
                        </td>
                        <td className="text-right">
                          {row.moneyDebitPaise ? `₹ ${paiseToRupees(row.moneyDebitPaise)}` : "—"}
                        </td>
                        <td className="text-right text-emerald-300">
                          {row.moneyCreditPaise ? `₹ ${paiseToRupees(row.moneyCreditPaise)}` : "—"}
                        </td>
                        <td className="text-right font-mono font-semibold border-l border-border/40">
                          {mgToGrams(row.closingGoldMg)} g
                        </td>
                        <td className="text-right font-mono font-semibold">
                          ₹{paiseToRupees(row.closingMoneyPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  goldValue,
  subvalue,
  tone,
}: {
  label: string;
  value: string;
  goldValue?: string;
  subvalue?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`font-serif text-2xl font-bold ${tone ?? "text-gold"}`}>
        {goldValue || value}
      </div>
      {subvalue && (
        <div className="text-xs text-muted-foreground font-mono mt-0.5">{subvalue}</div>
      )}
    </div>
  );
}
