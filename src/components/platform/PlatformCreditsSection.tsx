import React, { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  TrendingDown,
  Building2,
  PlusCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  History,
} from "lucide-react";
import { toast } from "sonner";

interface TenantWalletRow {
  firm_id: string;
  firm_name?: string;
  balance_credits: number;
  plan_credits_monthly: number;
  purchased_credits: number;
  promo_credits: number;
  low_balance_threshold: number;
  updated_at: string;
}

interface RateCardRow {
  service_code: string;
  service_category: string;
  credit_cost: number;
  description: string;
  is_active: boolean;
}

interface CreditLedgerRow {
  id: string;
  firm_id: string;
  firm_name?: string;
  entry_type: string;
  service_type: string;
  units: number;
  amount_credits: number;
  balance_after_credits: number;
  description: string;
  created_at: string;
}

export function PlatformCreditsSection({ firms, refresh }: { firms: any[]; refresh: () => void }) {
  const [wallets, setWallets] = useState<TenantWalletRow[]>([]);
  const [rateCards, setRateCards] = useState<RateCardRow[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState<string>("");
  const [grantAmount, setGrantAmount] = useState("1000");
  const [grantType, setGrantType] = useState<"promo" | "purchase" | "adjustment">("promo");
  const [grantReason, setGrantReason] = useState("");
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchCreditsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Wallets
      const { data: walletData } = await (supabase as any)
        .from("tenant_credit_wallets")
        .select("*")
        .order("updated_at", { ascending: false });

      // 2. Fetch Rate Cards
      const { data: rateData } = await (supabase as any)
        .from("credit_rate_cards")
        .select("*")
        .order("service_category");

      // 3. Fetch Recent Ledger
      const { data: ledgerData } = await (supabase as any)
        .from("credit_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      const firmMap = new Map(firms.map((f) => [f.id, f.name]));

      setWallets(
        (walletData || []).map((w: any) => ({
          ...w,
          firm_name: firmMap.get(w.firm_id) || "Unknown Firm",
        })),
      );

      setRateCards(rateData || []);

      setLedger(
        (ledgerData || []).map((l: any) => ({
          ...l,
          firm_name: firmMap.get(l.firm_id) || "Unknown Firm",
        })),
      );
    } catch (err: any) {
      console.error("[PlatformCredits] Error loading credits data:", err);
      toast.error("Failed to load platform credit wallets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditsData();
  }, [firms]);

  const handleGrant = async () => {
    if (!selectedFirmId) {
      toast.error("Please select a tenant firm.");
      return;
    }
    const amt = parseFloat(grantAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid credit amount.");
      return;
    }
    setProcessing(true);
    try {
      const { data, error } = await (supabase as any).rpc("grant_tenant_credits", {
        p_credit_amount: amt,
        p_entry_type: grantType,
        p_description: grantReason || `Platform Owner ${grantType} grant of ${amt} credits`,
        p_metadata: { grantedBy: "platform_owner", grantType },
        p_firm_id: selectedFirmId,
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Successfully granted ${amt} credits! New balance: ${data.new_balance}`);
        setIsGrantOpen(false);
        setGrantReason("");
        await fetchCreditsData();
      } else {
        toast.error("Failed to grant credits.");
      }
    } catch (err: any) {
      toast.error(err.message || "Credit grant failed");
    } finally {
      setProcessing(false);
    }
  };

  const filteredWallets = wallets.filter(
    (w) =>
      w.firm_name?.toLowerCase().includes(search.toLowerCase()) ||
      w.firm_id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-5 w-5 text-gold" /> Platform Tenant Credits Control Plane
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage tenant wallets, promotional allowances, service rate cards, and platform-wide
            metered usage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchCreditsData}
            disabled={loading}
            className="h-8 text-xs gap-1.5 border-border bg-background hover:bg-muted/50 text-foreground cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsGrantOpen(!isGrantOpen)}
            className="h-8 text-xs gap-1.5 bg-gold hover:bg-gold-dark text-black font-semibold rounded-md shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Issue Tenant Credits
          </Button>
        </div>
      </div>

      {/* Grant Modal / Box */}
      {isGrantOpen && (
        <Card className="p-4 border-gold/30 bg-gold/5 space-y-3 rounded-md shadow-xs">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <PlusCircle className="h-4 w-4 text-gold" /> Issue Promotional / Purchased Credits to
            Tenant
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase font-mono font-bold">
                Select Tenant Firm
              </Label>
              <select
                value={selectedFirmId}
                onChange={(e) => setSelectedFirmId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
              >
                <option value="">-- Select Firm --</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase font-mono font-bold">
                Credit Amount
              </Label>
              <Input
                type="number"
                min="50"
                step="50"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                className="h-8 text-xs font-mono font-semibold mt-1 bg-background border-border focus:ring-gold"
                placeholder="1000"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase font-mono font-bold">
                Grant Category
              </Label>
              <select
                value={grantType}
                onChange={(e) => setGrantType(e.target.value as any)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
              >
                <option value="promo">Promotional / Complimentary</option>
                <option value="purchase">Manual Offline Purchase</option>
                <option value="adjustment">Administrative Adjustment</option>
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase font-mono font-bold">
                Audit Reason
              </Label>
              <Input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                className="h-8 text-xs mt-1 bg-background border-border focus:ring-gold"
                placeholder="e.g. Onboarding bonus"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsGrantOpen(false)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGrant}
              disabled={processing}
              className="h-8 text-xs bg-gold hover:bg-gold-dark text-black font-semibold rounded-md shadow-xs cursor-pointer"
            >
              {processing ? "Executing..." : "Confirm & Issue Credits"}
            </Button>
          </div>
        </Card>
      )}

      {/* Global Rate Cards */}
      <div className="erp-surface rounded-md border border-border bg-card p-4 space-y-3 shadow-xs">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4 text-gold" /> Platform Service Rate Cards
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {rateCards.map((rc) => (
            <div
              key={rc.service_code}
              className="rounded-md border border-border p-2.5 bg-muted/20 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] uppercase font-bold font-mono">
                  {rc.service_category}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">
                  {rc.service_code}
                </span>
              </div>
              <div className="font-mono font-bold text-gold text-sm">
                {rc.credit_cost.toFixed(1)} cr
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{rc.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tenant Wallets Table */}
      <div className="erp-surface rounded-md border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-gold" /> Tenant Firm Wallets ({wallets.length})
          </h4>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search firm name or ID..."
              className="h-7 pl-8 text-xs bg-background border-border focus:ring-gold"
            />
          </div>
        </div>

        {filteredWallets.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No tenant wallets found.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Tenant Firm</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-right">Plan Monthly</th>
                  <th className="py-2.5 px-3 text-right">Purchased</th>
                  <th className="py-2.5 px-3 text-right">Promo</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {filteredWallets.map((w) => {
                  const isLow = w.balance_credits <= w.low_balance_threshold;
                  return (
                    <tr key={w.firm_id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-semibold text-foreground">{w.firm_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {w.firm_id}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-sm text-gold">
                        {Number(w.balance_credits).toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {w.plan_credits_monthly}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {w.purchased_credits}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {w.promo_credits}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-red-500/10 text-red-400 border border-red-500/30">
                            <AlertTriangle className="h-2.5 w-2.5" /> Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-2.5 w-2.5" /> OK
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {new Date(w.updated_at).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Activity Ledger */}
      <div className="erp-surface rounded-md border border-border bg-card p-4 space-y-3 shadow-xs">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
          <History className="h-4 w-4 text-gold" /> Platform Credit Transactions Log (Last 30)
        </h4>
        {ledger.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No transactions recorded yet.
          </p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Firm</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Units</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {ledger.map((l) => {
                  const isDebit = l.amount_credits < 0;
                  return (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">
                        {l.firm_name}
                      </td>
                      <td className="py-2.5 px-3 font-sans capitalize">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted border border-border text-foreground">
                          {l.entry_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-gold">{l.service_type}</td>
                      <td className="py-2.5 px-3 font-sans text-muted-foreground">
                        {l.description}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{l.units}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${isDebit ? "text-red-400" : "text-emerald-400"}`}
                      >
                        {isDebit ? `${l.amount_credits}` : `+${l.amount_credits}`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                        {Number(l.balance_after_credits).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
