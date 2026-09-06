import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { useEffect, useState, type FormEvent } from "react";
import {
  FileText,
  Loader2,
  MessageCircle,
  Package,
  Wrench,
  Scale,
  Coins,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fetchMyPortalContext } from "@/lib/portal/portal-context-service";
import { BusinessSwitcher } from "@/components/identity/BusinessSwitcher";
import { useTenantContext } from "@/lib/identity/tenant-context-store";
import { Badge } from "@/components/ui/badge";
import { formatDateMedium as fmtDate } from "@/lib/format-date";
import { R2ObjectImage } from "@/components/storage/R2ObjectImage";
import { getPortalHubPreferences } from "@/lib/customization-hub-preferences-store";
import { Logo } from "@/components/ui/Logo";
import { ManufacturingCustomerPortal } from "@/components/portal/ManufacturingCustomerPortal";
import { Factory } from "lucide-react";

type PortalData = {
  profile: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    village_city?: string | null;
    current_address?: string | null;
  };
  gold_balance_mg: number;
  gold_entries: Array<{
    id: string;
    ts: string;
    type: string;
    netFineMg: number;
    grossMg: number;
    purity: number;
    notes: string | null;
    reference: string | null;
  }>;
  cash_ledger: Array<{
    id: string;
    ts: string;
    kind: string;
    debit_paise: number;
    credit_paise: number;
    description: string | null;
    ref: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoice_no?: string;
    status?: string;
    gst?: string;
    subtotal_paise?: number;
    gst_paise?: number;
    grand_total_paise?: number;
    paid_paise?: number;
    balance_paise?: number;
    created_at: string;
  }>;
  orders: Array<{
    id: string;
    order_no?: string;
    type?: string;
    status?: string;
    expected_delivery?: string;
    priority?: string;
    created_at: string;
  }>;
  repairs: Array<{
    id: string;
    repair_no?: string;
    kind?: string;
    status?: string;
    estimated_charge_paise?: number;
    advance_paise?: number;
    received_gross_mg?: number;
    created_at: string;
  }>;
  support_tickets: Array<{
    id: string;
    ticket_no?: string;
    status?: string;
    subject?: string;
    description?: string;
    category?: string;
    severity?: string;
    priority?: string;
    resolution?: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

interface CatalogDesign {
  id: string;
  name: string;
  category: string | null;
  design_no: string | null;
  data: any;
}

// Public route — authenticated via customer email OTP (not ERP staff session).
export const Route = createFileRoute("/customer-portal")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({
    meta: [{ title: "Customer Portal · AVS Gold ERP" }],
  }),
  component: CustomerPortal,
});

// helpers
function mg(val: number) {
  const g = val / 1000;
  return g.toFixed(3) + "g";
}

function rs(paise: number) {
  return "₹" + (paise / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  finalised: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  unpaid: "bg-red-500/10 text-red-400 border-red-500/30",
  partial: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  approved: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  in_production: "bg-gold/10 text-gold border-gold/30",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};

const REPAIR_STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  in_progress: "bg-gold/10 text-gold border-gold/30",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

function CustomerPortal() {
  const navigate = useNavigate();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<
    "dashboard" | "invoices" | "orders" | "repairs" | "ledger" | "catalog" | "support"
  >("dashboard");
  const [portalType, setPortalType] = useState<"retail" | "manufacturing">(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("portal") === "manufacturing" || urlParams.get("context") === "manufacturing") {
        return "manufacturing";
      }
      return (localStorage.getItem("avs_customer_portal_context") as "retail" | "manufacturing") || "retail";
    }
    return "retail";
  });

  const portalPrefs = getPortalHubPreferences();

  // Catalog state
  const [catalog, setCatalog] = useState<CatalogDesign[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const tabItems = [
    ["dashboard", "Overview"] as const,
    ["invoices", `Invoices (${data?.invoices.length ?? 0})`] as const,
    portalPrefs.customerOrders
      ? (["orders", `Orders (${data?.orders.length ?? 0})`] as const)
      : null,
    ["repairs", `Repairs (${data?.repairs.length ?? 0})`] as const,
    portalPrefs.customerLedger ? (["ledger", "Wallet Ledger"] as const) : null,
    ["catalog", `Catalog (${catalog.length})`] as const,
    ["support", "Help & Support"] as const,
  ].filter((item) => item !== null) as Array<readonly [string, string]>;

  useEffect(() => {
    if (tab === "ledger" && !portalPrefs.customerLedger) setTab("dashboard");
    if (tab === "orders" && !portalPrefs.customerOrders) setTab("dashboard");
  }, [tab, portalPrefs.customerLedger, portalPrefs.customerOrders]);

  // Ticket creation states
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [threadReply, setThreadReply] = useState("");
  const [threadBusy, setThreadBusy] = useState(false);

  const loadMemberships = useTenantContext((s) => s.loadMemberships);

  useEffect(() => {
    void loadMemberships({ portalType: "customer" });
  }, [loadMemberships]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData.session) {
        void navigate({ to: "/customer-login" });
        return;
      }

      // Check if user is company staff (has role in user_profiles or user_roles)
      const { data: profile } = await supabase
        .from("user_profiles" as never)
        .select("role")
        .eq("auth_id", sessionData.session.user.id)
        .maybeSingle();

      const { data: userRoles } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", sessionData.session.user.id);

      // Only redirect ERP staff who lack a customer portal identity.
      const portalCtx = await fetchMyPortalContext("customer");
      if (!active) return;

      const staffAppRoles = new Set([
        "owner",
        "manager",
        "billing",
        "vault",
        "workshop",
        "accountant",
        "viewer",
        "saas_admin",
        "super_owner",
        "admin",
        "ceo",
      ]);
      const roleList = ((userRoles as { role?: string }[]) ?? []).map((r) =>
        String(r.role ?? "").toLowerCase(),
      );
      const profileRole = String((profile as { role?: string } | null)?.role ?? "").toLowerCase();
      const hasStaffAppRole =
        roleList.some((r) => staffAppRoles.has(r)) ||
        (profileRole && staffAppRoles.has(profileRole));

      if (!portalCtx && hasStaffAppRole) {
        void navigate({ to: "/" });
        return;
      }

      setAuthChecked(true);

      if (!portalCtx) {
        setError("Your customer portal identity is not linked. Please contact the firm.");
        return;
      }

      // 2. Fetch portal data via RPC (uses caller's JWT to scope results)
      const { data: result, error: queryError } = await (supabase as any).rpc(
        "get_customer_portal",
      );
      if (!active) return;
      if (queryError) {
        setError("Your customer portal is not yet configured. Please contact the firm.");
      } else {
        setData(result as PortalData);

        // 3. Fetch Catalog Designs
        setLoadingCatalog(true);
        const { data: catData, error: catError } = await supabase
          .from("catalog_designs" as never)
          .select("id, name, category, design_no, data")
          .order("created_at", { ascending: false } as any)
          .limit(40);
        if (!catError && catData && active) {
          setCatalog(catData as CatalogDesign[]);
        }
        setLoadingCatalog(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="erp-surface rounded-md p-6">
          <h1 className="text-xl font-semibold">Customer portal unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-[50vh] place-items-center">
        <Loader2
          className="h-6 w-6 animate-spin text-primary"
          aria-label="Loading customer portal"
        />
      </main>
    );
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);
    const { data: ticket, error: ticketError } = await (supabase as any).rpc(
      "create_customer_support_ticket",
      {
        p_subject: subject,
        p_description: description,
        p_category: "customer",
        p_priority: "normal",
      },
    );
    setSubmitting(false);
    if (ticketError) {
      setNotice(ticketError.message || "Could not create the support ticket.");
      return;
    }
    setSubject("");
    setDescription("");
    setNotice(`Ticket ${ticket.ticket_no} created successfully.`);
    setData((previous) =>
      previous ? { ...previous, support_tickets: [ticket, ...previous.support_tickets] } : previous,
    );
  }

  async function openThread(ticketId: string) {
    setThreadBusy(true);
    const { data: result, error: threadError } = await (supabase as any).rpc(
      "get_customer_support_thread",
      { p_ticket_id: ticketId },
    );
    setThreadBusy(false);
    if (threadError) {
      setNotice(threadError.message || "Could not load the support conversation.");
      return;
    }
    setThread(result);
  }

  async function sendThreadReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!thread?.ticket?.id || !threadReply.trim()) return;
    setThreadBusy(true);
    const { error: replyError } = await (supabase as any).rpc("reply_customer_support_ticket", {
      p_ticket_id: thread.ticket.id,
      p_body: threadReply,
    });
    setThreadBusy(false);
    if (replyError) {
      setNotice(replyError.message || "Could not send your reply.");
      return;
    }
    setThreadReply("");
    await openThread(thread.ticket.id);
  }

  // Calculate totals
  const totalInvoiced = data.invoices.reduce((sum, inv) => sum + (inv.grand_total_paise || 0), 0);
  const outstandingCash = data.invoices.reduce((sum, inv) => sum + (inv.balance_paise || 0), 0);
  const paidCash = data.invoices.reduce((sum, inv) => sum + (inv.paid_paise || 0), 0);
  if (portalType === "manufacturing") {
    return (
      <ManufacturingCustomerPortal
        customerId={data.profile.id}
        customerName={data.profile.full_name}
        onSwitchPortal={() => {
          setPortalType("retail");
          try {
            localStorage.setItem("avs_customer_portal_context", "retail");
          } catch {
            /* ignore */
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="bg-card border-b border-border shadow-xs sticky top-0 z-40">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-7" />
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-gold" />
                Customer Portal (Retail)
              </div>
              <div className="text-xs text-muted-foreground">{data.profile.full_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPortalType("manufacturing");
                try {
                  localStorage.setItem("avs_customer_portal_context", "manufacturing");
                } catch {
                  /* ignore */
                }
              }}
              className="text-xs px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <Factory className="h-3.5 w-3.5" /> Workshop Portal
            </button>
            <BusinessSwitcher compact />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-gold underline cursor-pointer"
              onClick={() => {
                void supabase.auth.signOut().then(() => {
                  window.location.href = "/customer-login";
                });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Navigation - Mobile select */}
        <div className="block md:hidden">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as any)}
            className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm font-semibold shadow-xs focus:outline-none focus:ring-1 focus:ring-gold text-foreground"
          >
            {tabItems.map(([t, label]) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation - Desktop tabs */}
        <div className="hidden md:flex gap-1 bg-card rounded-md border border-border p-1 shadow-xs">
          {tabItems.map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t as any)}
              className={`flex-1 rounded-md py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                tab === t
                  ? "bg-gold text-black shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content: Dashboard */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border border-border bg-card p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Gold Wallet Balance
                </span>
                <div className="text-xl font-bold font-mono text-gold">
                  {mg(Number(data.gold_balance_mg || 0))}
                </div>
                <span className="text-[10px] text-muted-foreground">Fine gold deposit</span>
              </div>
              <div className="rounded-md border border-border bg-card p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Outstanding Balance
                </span>
                <div className="text-xl font-bold font-mono text-red-600">
                  {rs(outstandingCash)}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {outstandingCash > 0 ? `${mg(Math.round((outstandingCash / 750000) * 1000))} Gold Equiv` : "All dues settled"}
                </span>
              </div>
              <div className="rounded-md border border-border bg-card p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Active Orders
                </span>
                <div className="text-xl font-bold">
                  {
                    data.orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled")
                      .length
                  }
                </div>
                <span className="text-[10px] text-muted-foreground">Jobs currently at work</span>
              </div>
              <div className="rounded-md border border-border bg-card p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Active Repairs
                </span>
                <div className="text-xl font-bold">
                  {data.repairs.filter((r) => r.status !== "delivered").length}
                </div>
                <span className="text-[10px] text-muted-foreground">Items in service</span>
              </div>
            </div>

            {/* Quick Profile Information */}
            <div className="rounded-md border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm text-foreground">Linked Customer Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Full Name</span>
                  <span className="font-medium text-foreground">{data.profile.full_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Phone / Whatsapp</span>
                  <span className="font-medium text-foreground">{data.profile.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Email</span>
                  <span className="font-medium text-foreground">{data.profile.email || "—"}</span>
                </div>
                {data.profile.village_city && (
                  <div>
                    <span className="text-muted-foreground block mb-0.5">City / Village</span>
                    <span className="font-medium text-foreground">{data.profile.village_city}</span>
                  </div>
                )}
                {data.profile.current_address && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground block mb-0.5">Address</span>
                    <span className="font-medium text-foreground">
                      {data.profile.current_address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-md border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm text-foreground">Recent Activities</h2>
              <div className="divide-y divide-border text-xs">
                {[
                  ...data.invoices.map((x) => ({
                    kind: "Invoice",
                    id: x.invoice_no ?? x.id,
                    status: x.status,
                    color: INVOICE_STATUS_COLORS[x.status ?? ""] ?? "bg-gray-100",
                    date: x.created_at,
                  })),
                  ...data.orders.map((x) => ({
                    kind: "Order",
                    id: x.order_no ?? x.id,
                    status: x.status,
                    color: ORDER_STATUS_COLORS[x.status ?? ""] ?? "bg-gray-100",
                    date: x.created_at,
                  })),
                  ...data.repairs.map((x) => ({
                    kind: "Repair",
                    id: x.repair_no ?? x.id,
                    status: x.status,
                    color: REPAIR_STATUS_COLORS[x.status ?? ""] ?? "bg-gray-100",
                    date: x.created_at,
                  })),
                ]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((item) => (
                    <div
                      className="flex justify-between items-center py-3"
                      key={`${item.kind}-${item.id}`}
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">
                          {item.kind} · {item.id}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {fmtDate(item.date)}
                        </span>
                      </div>
                      <Badge
                        className={`${item.color} border px-2 py-0.5 text-[10px] font-medium capitalize`}
                      >
                        {item.status ?? "recorded"}
                      </Badge>
                    </div>
                  ))}
                {data.invoices.length + data.orders.length + data.repairs.length === 0 && (
                  <p className="py-6 text-center text-muted-foreground italic">
                    No recent transactions or orders.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab content: Invoices */}
        {tab === "invoices" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Invoice History</h2>
              <span className="text-xs text-muted-foreground">
                Total Invoiced:{" "}
                <strong className="font-medium text-foreground">{rs(totalInvoiced)}</strong>
              </span>
            </div>
            {data.invoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-md">
                No invoices issued yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-foreground">
                          {inv.invoice_no || "Draft Invoice"}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {fmtDate(inv.created_at)}
                        </span>
                      </div>
                      <Badge
                        className={`${INVOICE_STATUS_COLORS[inv.status ?? ""] ?? "bg-gray-100"} border px-2 py-0.5 text-[10px] capitalize`}
                      >
                        {inv.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center font-mono bg-muted/20 p-2.5 rounded-lg text-[10px]">
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Total
                        </span>
                        <span>{rs(inv.grand_total_paise || 0)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Paid
                        </span>
                        <span className="text-emerald-600 font-semibold">
                          {rs(inv.paid_paise || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Balance
                        </span>
                        <span
                          className={
                            (inv.balance_paise || 0) > 0
                              ? "text-red-600 font-bold"
                              : "text-emerald-600"
                          }
                        >
                          {rs(inv.balance_paise || 0)}
                        </span>
                      </div>
                    </div>

                    {inv.gst && (
                      <div className="text-[10px] text-muted-foreground flex justify-between bg-muted/40 p-2 rounded">
                        <span>
                          GSTIN Applied:{" "}
                          <strong className="font-mono text-foreground">{inv.gst}</strong>
                        </span>
                        <span>GST: {rs(inv.gst_paise || 0)}</span>
                      </div>
                    )}

                    {/* PDF Download — opens the secure public doc viewer */}
                    {inv.invoice_no && (
                      <button
                        type="button"
                        onClick={async () => {
                          // Try to get a signed download URL from Supabase Storage first
                          const { data: urlData } = await (supabase as any).rpc(
                            "get_invoice_document_url",
                            { p_invoice_id: inv.id },
                          );
                          const url = urlData?.url || `/doc/${inv.id}?type=invoice`;
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted/60 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View / Download PDF Invoice
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab content: Orders */}
        {tab === "orders" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-sm">Order Status &amp; Tracking</h2>
            {data.orders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-md">
                No orders placed yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data.orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-foreground">
                          {ord.order_no || "Draft Order"}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          Placed: {fmtDate(ord.created_at)}
                        </span>
                      </div>
                      <Badge
                        className={`${ORDER_STATUS_COLORS[ord.status ?? ""] ?? "bg-gray-100"} border px-2 py-0.5 text-[10px] capitalize`}
                      >
                        {ord.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-muted/20 p-2 rounded-lg text-[10px]">
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Order Type</span>
                        <span className="font-medium text-foreground capitalize">
                          {ord.type || "standard"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Priority</span>
                        <span className="font-medium text-foreground capitalize">
                          {ord.priority || "normal"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Due Delivery</span>
                        <span className="font-mono font-medium text-foreground">
                          {ord.expected_delivery ? fmtDate(ord.expected_delivery) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab content: Repairs */}
        {tab === "repairs" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-sm">Repair &amp; Refurbishing Jobs</h2>
            {data.repairs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-md">
                No repair items in service.
              </div>
            ) : (
              <div className="space-y-3">
                {data.repairs.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-foreground">
                          {rep.repair_no || "Repair Card"}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {fmtDate(rep.created_at)}
                        </span>
                      </div>
                      <Badge
                        className={`${REPAIR_STATUS_COLORS[rep.status ?? ""] ?? "bg-gray-100"} border px-2 py-0.5 text-[10px] capitalize`}
                      >
                        {rep.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-muted/20 p-2 rounded-lg text-[10px]">
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Service Kind</span>
                        <span className="font-medium text-foreground capitalize">
                          {rep.kind || "repair"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Received Wt</span>
                        <span className="font-mono font-medium text-foreground">
                          {rep.received_gross_mg ? mg(rep.received_gross_mg) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block">
                          Estimated Charge
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {rep.estimated_charge_paise ? rs(rep.estimated_charge_paise) : "—"}
                        </span>
                      </div>
                    </div>
                    {rep.advance_paise ? (
                      <div className="text-[10px] text-muted-foreground bg-muted/40 p-2 rounded flex justify-between font-mono">
                        <span>Advance Paid</span>
                        <span className="text-emerald-600 font-semibold">
                          {rs(rep.advance_paise)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab content: Ledger (Gold Wallet & Cash Register) */}
        {tab === "ledger" && (
          <div className="space-y-6">
            {/* Gold Wallet Ledger */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-gold" />
                  <h2 className="font-semibold text-sm">Gold Wallet Ledger (Fine Gold)</h2>
                </div>
                <Badge className="bg-gold/10 text-gold border border-gold/30 font-mono">
                  Wallet Balance: {mg(Number(data.gold_balance_mg || 0))}
                </Badge>
              </div>

              {data.gold_entries.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-md">
                  No gold deposits or transactions on record.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.gold_entries.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] text-gold font-medium">
                          {e.type.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{fmtDate(e.ts)}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-muted/20 p-2.5 rounded-lg text-center font-mono text-[10px]">
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">
                            Gross
                          </span>
                          <span>{e.grossMg != null ? `${mg(e.grossMg)}` : "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">
                            Purity
                          </span>
                          <span>{e.purity ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">
                            Net Fine Change
                          </span>
                          <span
                            className={
                              e.netFineMg >= 0
                                ? "text-emerald-600 font-bold"
                                : "text-rose-600 font-bold"
                            }
                          >
                            {e.netFineMg >= 0 ? "+" : ""}
                            {mg(e.netFineMg)}
                          </span>
                        </div>
                      </div>

                      {e.notes || e.reference ? (
                        <div className="text-[10px] text-muted-foreground bg-muted/40 p-2 rounded">
                          {e.notes ?? e.reference}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cash Ledger */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-emerald-600" />
                  <h2 className="font-semibold text-sm">Monetary Ledger (Payments &amp; Credit)</h2>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                  Outstanding Cash: {rs(outstandingCash)}
                </Badge>
              </div>

              {data.cash_ledger.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-md">
                  No cash transactions or payments recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.cash_ledger.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground capitalize">
                          {c.kind.replace(/_/g, " ")}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{fmtDate(c.ts)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2 rounded-lg text-center font-mono text-[10px]">
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">
                            Debit (Charges)
                          </span>
                          <span className="text-rose-600 font-medium">
                            {c.debit_paise ? rs(c.debit_paise) : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">
                            Credit (Payments)
                          </span>
                          <span className="text-emerald-600 font-semibold">
                            {c.credit_paise ? rs(c.credit_paise) : "—"}
                          </span>
                        </div>
                      </div>

                      {(c.description || c.ref) && (
                        <div className="text-[10px] text-muted-foreground">
                          {c.description} {c.ref ? `(Ref: ${c.ref})` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab content: Catalog */}
        {tab === "catalog" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-sm">Design Catalog Browser</h2>
            {loadingCatalog && (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary inline mr-2" /> Loading
                designs...
              </div>
            )}
            {!loadingCatalog && catalog.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-md">
                No catalog designs listed in the registry.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {catalog.map((cat) => {
                  const d = typeof cat.data === "string" ? {} : (cat.data as any) || {};
                  return (
                    <div
                      key={cat.id}
                      className="rounded-md border border-border bg-card p-3 space-y-2 text-xs flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="aspect-square bg-muted/40 rounded-md flex items-center justify-center text-muted-foreground relative overflow-hidden">
                          {d.imageStoragePath ? (
                            <R2ObjectImage
                              bucket="catalog-designs"
                              storagePath={d.imageStoragePath}
                              alt={cat.name}
                            />
                          ) : (
                            <LayoutGrid className="h-6 w-6 opacity-30" />
                          )}
                          <span className="absolute top-2 left-2 bg-background/90 text-foreground border border-border px-1.5 py-0.5 rounded text-[9px] font-mono">
                            {cat.design_no || cat.category || "item"}
                          </span>
                        </div>
                        <h3 className="font-semibold text-foreground truncate mt-1">{cat.name}</h3>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono border-t border-border pt-2 mt-1">
                        <span>{d.purity || "916"} K</span>
                        <span>{d.weightGrams ? `${d.weightGrams}g` : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab content: Support */}
        {tab === "support" && (
          <div className="space-y-6">
            <div className="rounded-md border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-sm text-foreground font-serif">
                  Support Conversations
                </h2>
              </div>
              <div className="space-y-2">
                {data.support_tickets.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 italic text-center">
                    No support tickets created yet.
                  </p>
                )}
                {data.support_tickets.map((ticket) => (
                  <button
                    className="flex w-full items-center justify-between rounded-md border border-border p-3 text-left text-xs hover:bg-muted/40 transition-colors"
                    key={ticket.id}
                    onClick={() => void openThread(ticket.id)}
                    type="button"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground">
                        {ticket.ticket_no || "Ticket"} · {ticket.subject || "Support request"}
                      </span>
                      <span className="block text-[10px] text-muted-foreground truncate max-w-xs">
                        {ticket.description}
                      </span>
                    </div>
                    <Badge
                      className={`${TICKET_STATUS_COLORS[ticket.status ?? ""] ?? "bg-gray-100"} border px-2 py-0.5 text-[9px] capitalize`}
                    >
                      {ticket.status ?? "open"}
                    </Badge>
                  </button>
                ))}
              </div>

              {thread && (
                <div className="mt-4 rounded-md border border-border p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                    <h3 className="font-semibold text-sm text-foreground">
                      {thread.ticket.subject}
                    </h3>
                    <button
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                      onClick={() => setThread(null)}
                      type="button"
                    >
                      Close Conversation
                    </button>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {(thread.messages ?? []).map((message: any) => (
                      <div
                        className="rounded-md bg-card border border-border p-3 text-xs space-y-1"
                        key={message.id}
                      >
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground border-b border-border/50 pb-1">
                          <span className="font-semibold">{message.sender}</span>
                          <span>{fmtDate(message.created_at || message.ts)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground/80">
                          {message.body}
                        </p>
                      </div>
                    ))}
                  </div>
                  <form
                    className="flex gap-2 pt-2 border-t border-border"
                    onSubmit={sendThreadReply}
                  >
                    <input
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold placeholder:text-muted-foreground"
                      maxLength={10000}
                      required
                      value={threadReply}
                      onChange={(event) => setThreadReply(event.target.value)}
                      placeholder="Type your message reply..."
                    />
                    <button
                      className="rounded-md bg-gold px-4 py-2 text-xs text-black font-semibold hover:bg-gold-dark disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                      disabled={threadBusy}
                      type="submit"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="rounded-md border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-1.5 font-serif">
                <Plus className="h-4 w-4 text-gold" /> Create Support Request
              </h2>
              <form className="space-y-4" onSubmit={submitTicket}>
                <div className="space-y-1">
                  <label
                    htmlFor="ticket-subject"
                    className="text-xs font-semibold text-muted-foreground uppercase"
                  >
                    Subject
                  </label>
                  <input
                    id="ticket-subject"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold placeholder:text-muted-foreground"
                    minLength={3}
                    maxLength={160}
                    required
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Brief summary of your query"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="ticket-desc"
                    className="text-xs font-semibold text-muted-foreground uppercase"
                  >
                    Detailed Description
                  </label>
                  <textarea
                    id="ticket-desc"
                    className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold placeholder:text-muted-foreground"
                    minLength={10}
                    maxLength={10000}
                    required
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Please include invoice numbers, repair details, or specific help topics..."
                  />
                </div>
                <button
                  className="rounded-md bg-gold px-4 py-2.5 text-xs text-black font-semibold hover:bg-gold-dark disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "Submitting…" : "Submit Support Ticket"}
                </button>
                {notice && (
                  <p className="text-xs text-muted-foreground" role="status">
                    {notice}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
