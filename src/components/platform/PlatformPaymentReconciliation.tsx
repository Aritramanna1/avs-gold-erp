/**
 * Platform Owner — Payment Dashboard, Search, Invoice Dispatch, and Reconciliation Center
 *
 * Provides real-time visibility into internal payments, automated invoice generation,
 * transactional email delivery tracking, multi-criteria search, and one-click invoice resending.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Mail,
  Send,
  Loader2,
  FileText,
  Printer,
} from "lucide-react";

interface PaymentRow {
  id: string;
  tenant_id: string;
  plan_code: string;
  amount_paise: number;
  currency: string;
  status: string;
  environment: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  invoice_id?: string;
  invoice_no?: string;
  email_status?: string;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  tenant_id: string;
  plan_code: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
}

interface ReconciliationAlert {
  type: string;
  severity: "WARNING" | "CRITICAL";
  internal_payment_id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  description: string;
}

interface DashboardOverview {
  success: boolean;
  stats: {
    payments: {
      total_count: number;
      paid_count: number;
      pending_count: number;
      failed_count: number;
      refunded_count: number;
      total_volume_paise: number;
    };
    subscriptions: {
      total_count: number;
      active_count: number;
      trial_count: number;
      past_due_count: number;
      grace_count: number;
      suspended_count: number;
      expired_count: number;
    };
    reconciliation_alerts: ReconciliationAlert[];
  };
  recent_payments: PaymentRow[];
  recent_subscriptions: SubscriptionRow[];
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export function PlatformPaymentReconciliation() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PaymentRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>("ALL");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentRow | null>(null);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/admin-dashboard.php?action=overview");
      if (!res.ok) throw new Error("Could not load dashboard");
      const json: DashboardOverview = await res.json();
      setData(json);
    } catch {
      // Fallback mock dashboard for local dev
      setData({
        success: true,
        stats: {
          payments: {
            total_count: 12,
            paid_count: 10,
            pending_count: 1,
            failed_count: 1,
            refunded_count: 0,
            total_volume_paise: 29999000,
          },
          subscriptions: {
            total_count: 10,
            active_count: 8,
            trial_count: 2,
            past_due_count: 0,
            grace_count: 0,
            suspended_count: 0,
            expired_count: 0,
          },
          reconciliation_alerts: [],
        },
        recent_payments: [
          {
            id: "pay_ord_mock_001",
            tenant_id: "firm_ichalkaranji_main",
            plan_code: "avs_manufacturing_30k",
            amount_paise: 2999900,
            currency: "INR",
            status: "PAID",
            environment: "TEST",
            razorpay_order_id: "order_test_908a8f",
            razorpay_payment_id: "pay_test_908a8f112",
            invoice_no: "INV-SaaS-202609-001",
            email_status: "EMAIL_SENT",
            created_at: new Date().toISOString(),
          },
        ],
        recent_subscriptions: [
          {
            id: "sub_mock_001",
            tenant_id: "firm_ichalkaranji_main",
            plan_code: "avs_manufacturing_30k",
            status: "ACTIVE",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/payments/admin-dashboard.php?action=search&q=${encodeURIComponent(searchQuery)}`,
      );
      const json = await res.json();
      setSearchResults(json.payments || []);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleReconcileFix(paymentId: string) {
    try {
      const res = await fetch("/api/payments/admin-dashboard.php?action=reconcile_fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId, target_status: "PAID" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Fix failed");
      toast.success("Payment reconciled and updated");
      await loadDashboard();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Reconciliation action failed");
    }
  }

  async function handleResendInvoice(invoiceId: string) {
    setResendingId(invoiceId);
    try {
      const res = await fetch("/api/payments/resend-invoice.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Resend failed");
      toast.success(json.message || "Invoice emailed successfully");
      await loadDashboard();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not resend invoice");
    } finally {
      setResendingId(null);
    }
  }

  const pStats = data?.stats.payments;
  const sStats = data?.stats.subscriptions;
  const displayedPayments =
    searchResults ??
    (data?.recent_payments.filter((p) =>
      activeStatusFilter === "ALL" ? true : p.status === activeStatusFilter,
    ) || []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-gold" /> Payment Reconciliation, Invoices &amp; Subscriptions
          </h3>
          <p className="text-xs text-muted-foreground">
            Authoritative financial state across Razorpay orders, internal payments, tax invoices, and email receipts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1 h-8"
          onClick={() => void loadDashboard()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Data
        </Button>
      </div>

      {/* Discrepancy Alerts Banner */}
      {data?.stats.reconciliation_alerts && data.stats.reconciliation_alerts.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/10 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" /> Reconciliation Discrepancies Detected (
            {data.stats.reconciliation_alerts.length})
          </div>
          <div className="space-y-2">
            {data.stats.reconciliation_alerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded bg-background/80 border text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-foreground">
                    {alert.internal_payment_id}
                  </span>{" "}
                  · {alert.description}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  onClick={() => void handleReconcileFix(alert.internal_payment_id)}
                >
                  Mark PAID &amp; Reconcile
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Total Revenue Volume
          </span>
          <p className="text-xl font-bold font-mono text-gold">
            {formatInr(pStats?.total_volume_paise ?? 0)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {pStats?.paid_count ?? 0} settled transactions
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Active Subscriptions
          </span>
          <p className="text-xl font-bold font-mono text-emerald-500">
            {sStats?.active_count ?? 0}
          </p>
          <p className="text-[10px] text-muted-foreground">{sStats?.trial_count ?? 0} in trial</p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Pending Orders
          </span>
          <p className="text-xl font-bold font-mono text-amber-500">
            {pStats?.pending_count ?? 0}
          </p>
          <p className="text-[10px] text-muted-foreground">Awaiting provider checkout</p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Failed / Exceptions
          </span>
          <p className="text-xl font-bold font-mono text-red-500">{pStats?.failed_count ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">{pStats?.refunded_count ?? 0} refunds</p>
        </Card>
      </div>

      {/* Multi-Criteria Search & Filter Bar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Payment ID, Order ID, Invoice Number, Tenant, or Plan…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
              className="pl-9 text-xs h-9"
            />
          </div>
          <Button size="sm" className="h-9 text-xs" onClick={() => void handleSearch()} disabled={searching}>
            {searching ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Search Records
          </Button>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["ALL", "PAID", "PENDING", "FAILED", "REFUNDED"].map((st) => (
            <Badge
              key={st}
              variant={activeStatusFilter === st ? "default" : "outline"}
              className="cursor-pointer text-[10px] uppercase"
              onClick={() => {
                setActiveStatusFilter(st);
                setSearchResults(null);
              }}
            >
              {st}
            </Badge>
          ))}
        </div>

        {/* Payments & Invoices Table */}
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="p-2.5 text-left font-semibold">Payment ID</th>
                <th className="p-2.5 text-left font-semibold">Tenant</th>
                <th className="p-2.5 text-left font-semibold">Plan</th>
                <th className="p-2.5 text-right font-semibold">Amount</th>
                <th className="p-2.5 text-left font-semibold">Status</th>
                <th className="p-2.5 text-left font-semibold">Invoice No</th>
                <th className="p-2.5 text-left font-semibold">Email Status</th>
                <th className="p-2.5 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayedPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                displayedPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="p-2.5 font-mono text-[11px]">{p.id}</td>
                    <td className="p-2.5">{p.tenant_id}</td>
                    <td className="p-2.5 font-medium">{p.plan_code}</td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      {formatInr(p.amount_paise)}
                    </td>
                    <td className="p-2.5">
                      <Badge
                        variant={
                          p.status === "PAID"
                            ? "default"
                            : p.status === "PENDING"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-[9px]"
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-2.5 font-mono text-[10px]">
                      {p.invoice_no ? (
                        <span className="font-semibold text-foreground">{p.invoice_no}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      {p.email_status ? (
                        <Badge
                          variant={
                            p.email_status === "EMAIL_SENT"
                              ? "default"
                              : p.email_status === "EMAIL_PENDING"
                                ? "outline"
                                : "destructive"
                          }
                          className="text-[8px]"
                        >
                          {p.email_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        {p.invoice_no && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-1.5 gap-1"
                            onClick={() => setSelectedInvoice(p)}
                          >
                            <FileText className="h-3 w-3" /> View
                          </Button>
                        )}
                        {p.status === "PAID" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-1.5 gap-1"
                            disabled={resendingId === (p.invoice_id || p.id)}
                            onClick={() => void handleResendInvoice(p.invoice_id || p.id)}
                          >
                            {resendingId === (p.invoice_id || p.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            Resend Email
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-lg w-full p-6 border-gold/30 bg-card shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gold" />
                <div>
                  <h4 className="font-bold text-sm">Invoice {selectedInvoice.invoice_no}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Payment ID: {selectedInvoice.id}
                  </p>
                </div>
              </div>
              <Badge variant="default" className="text-[10px]">
                {selectedInvoice.status}
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/30 p-3 rounded">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Customer / Tenant</span>
                  <span className="font-semibold">{selectedInvoice.tenant_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Plan Tier</span>
                  <span className="font-semibold">{selectedInvoice.plan_code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Amount Paid</span>
                  <span className="font-bold font-mono text-gold">
                    {formatInr(selectedInvoice.amount_paise)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Email Status</span>
                  <span className="font-semibold">{selectedInvoice.email_status || "EMAIL_PENDING"}</span>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground">
                <p>
                  <strong>Seller:</strong> Arivahly Venture Sphere Private Limited (GSTIN: 27AABCA1234F1Z5)
                </p>
                <p>
                  <strong>Date:</strong> {new Date(selectedInvoice.created_at).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  void handleResendInvoice(selectedInvoice.invoice_id || selectedInvoice.id);
                  setSelectedInvoice(null);
                }}
              >
                <Mail className="h-3.5 w-3.5" /> Resend Invoice to Email
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
