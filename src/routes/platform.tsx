// Platform Owner — AVS SaaS control panel ONLY (tenants, billing, credits, Razorpay, trials).
// Jewellery ERP operations live under /people, /workshop, /stock, /billing, etc. — never here.
// Hallmark: macrostructure: operations console; tone: authoritative; anchor hue: legacy gold
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CircleDollarSign,
  Database,
  FileWarning,
  Loader2,
  Users,
  Search,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Wrench,
  Receipt,
  Send,
  Coins,
  RefreshCw,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { dataProvider } from "@/lib/providers/data-provider";
const supabase = dataProvider as any;
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { guardRoute } from "@/lib/permissions";
import { fetchPlatformFirmStats, type PlatformFirmStats } from "@/lib/platform-stats-query";
import { PlatformCreditsSection } from "@/components/platform/PlatformCreditsSection";
import { PlatformRazorpayConfig } from "@/components/platform/PlatformRazorpayConfig";
import { PlatformCommercialBillingHub } from "@/components/platform/PlatformCommercialBillingHub";
import { PlatformBrandingPanel } from "@/components/platform/PlatformBrandingPanel";
import { PlatformAccountMenu } from "@/components/platform/PlatformAccountMenu";
import { TenantCommunicationsPanel } from "@/components/communications/TenantCommunicationsPanel";
import {
  loadPlatformBillingDefaults,
  getCachedPlatformBillingDefaults,
} from "@/lib/platform-settings-runtime";
import { usePrintEngine } from "@/lib/print-engine";

type PlatformSearch = {
  view: string;
  filter: string;
  billingTab: string;
  settingsTab: string;
  panel?: string;
};

export const Route = createFileRoute("/platform")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  validateSearch: (search: Record<string, unknown>): PlatformSearch => ({
    view: typeof search.view === "string" ? search.view : "overview",
    filter: typeof search.filter === "string" ? search.filter : "all",
    billingTab: typeof search.billingTab === "string" ? search.billingTab : "quotations",
    settingsTab: typeof search.settingsTab === "string" ? search.settingsTab : "branding",
    panel: typeof search.panel === "string" ? search.panel : undefined,
  }),
  head: () => ({ meta: [{ title: "Platform Owner Console · AVS Gold ERP" }] }),
  component: PlatformLayout,
});

function PlatformLayout() {
  const routerState = useRouterState();
  const path = routerState.location.pathname;
  if (path === "/platform" || path === "/platform/") {
    return <PlatformOwnerConsole />;
  }
  return <Outlet />;
}

type Firm = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  gstin: string | null;
  address: string | null;
};
type Subscription = {
  id: string;
  organization_id: string;
  status: string;
  trial_ends_at: string | null;
  renews_at: string | null;
  plan_id: string;
  billing_cycle?: string | null;
};
type Plan = {
  id: string;
  name: string;
  code: string;
  price_minor: number;
  billing_cycle: string;
  is_active: boolean;
  branch_limit: number | null;
  user_limit: number | null;
  workshop_limit?: number | null;
  business_edition?: string | null;
  price_band_code?: string | null;
  edition_family?: string | null;
};
type Event = {
  id: string;
  action: string;
  target_type: string | null;
  reason: string | null;
  created_at: string;
};
type Feature = {
  organization_id: string;
  feature_key: string;
  enabled: boolean;
  source: string | null;
};
type LicenseRow = {
  id: string;
  license_id: string;
  organization_id: string | null;
  customer_name: string;
  company_name: string;
  status: string;
  edition: string;
  seats: number;
  expiry_date: string | null;
  created_at: string;
  updated_at: string | null;
};
type RequestRow = {
  id: string;
  request_no: string;
  firm_id: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
};
type TicketRow = {
  id: string;
  ticket_no: string;
  firm_id: string;
  category: string;
  subject: string;
  severity: string;
  priority: string;
  status: string;
  created_at: string;
};
type BillingRow = {
  id: string;
  firm_id: string;
  document_no: string;
  document_type: string;
  status: string;
  amount_minor: number;
  paid_minor: number;
  due_at: string | null;
  issued_at: string | null;
  taxable_minor: number | null;
  cgst_minor: number | null;
  sgst_minor: number | null;
  igst_minor: number | null;
  gst_minor: number | null;
  buyer_state_code: string | null;
  seller_state_code: string | null;
  data: { description?: string; gst_rate_percent?: number } | null;
};
type ErrorEventRow = {
  id: string;
  firm_id: string | null;
  reference_id: string;
  category: string;
  severity: string;
  context: string | null;
  message: string;
  created_at: string;
};
type BackupRunRow = {
  id: string;
  backup_type: string;
  environment: string;
  status: string;
  location: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  verified_at: string | null;
};
type UserRow = {
  id: string;
  auth_id: string;
  firm_id: string | null;
  branch_id: string | null;
  full_name: string;
  phone: string | null;
  status: string;
  active: boolean;
  role: string | null;
  last_login: string | null;
};
type View =
  | "overview"
  | "firms"
  | "users"
  | "subscriptions"
  | "requests"
  | "tickets"
  | "billing"
  | "licenses"
  | "activity"
  | "health"
  | "backups"
  | "credits"
  | "settings"
  | "help"
  | "account";

const VALID_VIEWS: View[] = [
  "overview",
  "firms",
  "users",
  "subscriptions",
  "credits",
  "requests",
  "tickets",
  "billing",
  "licenses",
  "activity",
  "health",
  "backups",
  "settings",
  "help",
  "account",
];

function PlatformOwnerConsole() {
  const routerState = useRouterState();
  const searchParams = routerState.location.search as PlatformSearch;
  const view = (
    VALID_VIEWS.includes(searchParams.view as View) ? searchParams.view : "overview"
  ) as View;
  const tenantFilter = searchParams.filter || "all";
  const billingTab = searchParams.billingTab || "quotations";
  const settingsTab = searchParams.settingsTab || "branding";
  const showTenant360 = searchParams.panel === "360";
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [serviceRequests, setServiceRequests] = useState(0);
  const [supportTickets, setSupportTickets] = useState(0);
  const [criticalAlerts, setCriticalAlerts] = useState(0);
  const [failedBackups, setFailedBackups] = useState(0);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [users, setUsers] = useState(0);
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [firmStats, setFirmStats] = useState<PlatformFirmStats[]>([]);
  const [branches, setBranches] = useState(0);
  const [search, setSearch] = useState("");
  const [requestRows, setRequestRows] = useState<RequestRow[]>([]);
  const [ticketRows, setTicketRows] = useState<TicketRow[]>([]);
  const [billingRows, setBillingRows] = useState<BillingRow[]>([]);
  const [errorRows, setErrorRows] = useState<ErrorEventRow[]>([]);
  const [backupRows, setBackupRows] = useState<BackupRunRow[]>([]);

  async function refresh() {
    setLoading(true);
    setError(null);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user.id) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    const roles = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.session.user.id);
    const hasPlatformOwner = (roles.data ?? []).some((r: { role: string }) =>
      ["saas_admin", "SaaS Admin", "platform_owner", "Platform Owner"].includes(r.role),
    );
    if (!hasPlatformOwner) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    setAuthorized(true);

    const [
      fRes,
      subRes,
      pRes,
      eRes,
      reqCountRes,
      tickCountRes,
      errCountRes,
      bupCountRes,
      featRes,
      uCountRes,
      bCountRes,
      reqRowsRes,
      tickRowsRes,
      billRowsRes,
      errRowsRes,
      bupRowsRes,
      userRowsRes,
      licenseRowsRes,
    ] = await Promise.all([
      supabase.from("organizations").select("id,name,slug,is_active,created_at,gstin,address"),
      supabase
        .from("organization_subscriptions")
        .select("id,organization_id,status,trial_ends_at,renews_at,plan_id,billing_cycle"),
      supabase
        .from("platform_plans")
        .select(
          "id,name,code,price_minor,billing_cycle,is_active,branch_limit,user_limit,workshop_limit,business_edition,price_band_code,edition_family",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("platform_audit_events")
        .select("id,action,target_type,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("platform_service_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("platform_support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("platform_error_events")
        .select("id", { count: "exact", head: true })
        .eq("severity", "critical"),
      supabase
        .from("platform_backup_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase.from("organization_features").select("organization_id,feature_key,enabled,source"),
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("branches").select("id", { count: "exact", head: true }),
      supabase
        .from("platform_service_requests")
        .select("id,request_no,firm_id,category,subject,priority,status,created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("platform_support_tickets")
        .select("id,ticket_no,firm_id,category,subject,severity,priority,status,created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("platform_billing_documents")
        .select(
          "id,firm_id,document_no,document_type,status,amount_minor,paid_minor,due_at,issued_at,taxable_minor,cgst_minor,sgst_minor,igst_minor,gst_minor,buyer_state_code,seller_state_code,data",
        )
        .order("issued_at", { ascending: false })
        .limit(25),
      supabase
        .from("platform_error_events")
        .select("id,firm_id,reference_id,category,severity,context,message,created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("platform_backup_runs")
        .select(
          "id,backup_type,environment,status,location,error_message,started_at,finished_at,verified_at",
        )
        .order("started_at", { ascending: false })
        .limit(25),
      supabase
        .from("user_profiles")
        .select("id,auth_id,firm_id,branch_id,full_name,phone,status,active,role,last_login")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("platform_licenses")
        .select(
          "id,license_id,organization_id,customer_name,company_name,status,edition,seats,expiry_date,created_at,updated_at",
        )
        .order("created_at", { ascending: false }),
    ]);

    const loadedFirms = (fRes.data as Firm[]) ?? [];
    setFirms(loadedFirms);
    setSubscriptions((subRes.data as Subscription[]) ?? []);
    setPlans((pRes.data as Plan[]) ?? []);
    setEvents((eRes.data as Event[]) ?? []);
    setServiceRequests(reqCountRes.count ?? 0);
    setSupportTickets(tickCountRes.count ?? 0);
    setCriticalAlerts(errCountRes.count ?? 0);
    setFailedBackups(bupCountRes.count ?? 0);
    setFeatures((featRes.data as Feature[]) ?? []);
    setLicenses((licenseRowsRes.data as unknown as LicenseRow[]) ?? []);
    setUsers(uCountRes.count ?? 0);
    const loadedUsers = (userRowsRes.data as unknown as UserRow[]) ?? [];
    setUserRows(loadedUsers);
    setBranches(bCountRes.count ?? 0);
    setRequestRows((reqRowsRes.data as unknown as RequestRow[]) ?? []);
    setTicketRows((tickRowsRes.data as unknown as TicketRow[]) ?? []);
    setBillingRows((billRowsRes.data as unknown as BillingRow[]) ?? []);
    setErrorRows((errRowsRes.data as unknown as ErrorEventRow[]) ?? []);
    setBackupRows((bupRowsRes.data as unknown as BackupRunRow[]) ?? []);
    const statsRows = await fetchPlatformFirmStats(loadedFirms);
    setFirmStats(statsRows);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const trialOrgIds = useMemo(
    () => new Set(subscriptions.filter((s) => s.status === "trial").map((s) => s.organization_id)),
    [subscriptions],
  );

  const filteredFirms = useMemo(() => {
    let list = firms;
    if (tenantFilter === "active") {
      list = list.filter((f) => f.is_active);
    } else if (tenantFilter === "suspended") {
      list = list.filter((f) => !f.is_active);
    } else if (tenantFilter === "trial") {
      list = list.filter((f) => trialOrgIds.has(f.id));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        (f.gstin && f.gstin.toLowerCase().includes(q)),
    );
  }, [firms, search, tenantFilter, trialOrgIds]);

  const activeCount = useMemo(() => firms.filter((f) => f.is_active).length, [firms]);
  const suspendedCount = useMemo(() => firms.filter((f) => !f.is_active).length, [firms]);
  const trialCount = useMemo(
    () => firms.filter((f) => trialOrgIds.has(f.id)).length,
    [firms, trialOrgIds],
  );
  const activeSubCount = useMemo(
    () => subscriptions.filter((s) => s.status === "active").length,
    [subscriptions],
  );
  const expiringTrialCount = useMemo(() => {
    const now = Date.now();
    return subscriptions.filter((s) => {
      if (s.status !== "trial" || !s.trial_ends_at) return false;
      const days = (new Date(s.trial_ends_at).getTime() - now) / 86400000;
      return days >= 0 && days <= 7;
    }).length;
  }, [subscriptions]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        <p className="mt-4 text-xs font-mono text-muted-foreground">Checking platform clearance…</p>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-md rounded-md border border-border bg-card p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-400 mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Access Restricted</h1>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Platform Owner Console requires{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-gold">saas_admin</code>{" "}
            or{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-gold">
              platform_owner
            </code>{" "}
            elevation. Please sign in with authorized platform governance credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-bold text-gold">
            {pageTitle(view, tenantFilter)}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {firms.length} tenant firms · {activeCount} active · {suspendedCount} suspended
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {view === "overview" && (
        <OverviewSection
          firms={firms}
          activeCount={activeCount}
          suspendedCount={suspendedCount}
          trialCount={trialCount}
          expiringTrialCount={expiringTrialCount}
          activeSubCount={activeSubCount}
          users={users}
          branches={branches}
          serviceRequests={serviceRequests}
          supportTickets={supportTickets}
          criticalAlerts={criticalAlerts}
          failedBackups={failedBackups}
          events={events}
          billingRows={billingRows}
        />
      )}

      {view === "firms" && (
        <FirmsSection
          filteredFirms={filteredFirms}
          tenantFilter={tenantFilter}
          showTenant360={showTenant360}
          search={search}
          setSearch={setSearch}
          subscriptions={subscriptions}
          plans={plans}
          firmStats={firmStats}
          refresh={refresh}
        />
      )}

      {view === "users" && <UsersSection users={userRows} firms={firms} refresh={refresh} />}

      {view === "subscriptions" && (
        <SubscriptionsSection
          firms={firms}
          subscriptions={subscriptions}
          plans={plans}
          refresh={refresh}
        />
      )}

      {view === "requests" && (
        <RequestsSection rows={requestRows} firms={firms} refresh={refresh} />
      )}

      {view === "tickets" && <TicketsSection rows={ticketRows} firms={firms} refresh={refresh} />}

      {view === "billing" && (
        <BillingSection
          rows={billingRows}
          firms={firms}
          refresh={refresh}
          billingTab={billingTab}
        />
      )}

      {view === "licenses" && (
        <LicensingSection firms={firms} features={features} licenses={licenses} refresh={refresh} />
      )}

      {view === "activity" && <ActivitySection events={events} />}

      {view === "health" && <HealthSection errorRows={errorRows} refresh={refresh} />}

      {view === "backups" && <BackupsSection backupRows={backupRows} refresh={refresh} />}

      {view === "credits" && <PlatformCreditsSection firms={firms} refresh={refresh} />}

      {view === "settings" && <SettingsSection refresh={refresh} settingsTab={settingsTab} />}

      {view === "help" && <HelpSection />}

      {view === "account" && <AccountSection />}
    </div>
  );
}

function pageTitle(view: View, filter: string): string {
  if (view === "firms") {
    if (filter === "active") return "Active Tenants";
    if (filter === "suspended") return "Suspended Tenants";
    if (filter === "trial") return "Trial Tenants";
    return "All Tenants";
  }
  const titles: Record<View, string> = {
    overview: "Dashboard",
    users: "Users / Admin Accounts",
    subscriptions: "Subscriptions",
    requests: "Service Requests",
    tickets: "Support Requests",
    billing: "Billing & Payments",
    activity: "Audit Logs",
    health: "Security & Health",
    backups: "Backups & DR",
    licenses: "Licences & Entitlements",
    credits: "Credits & Wallets",
    settings: "Platform Configuration",
    help: "Help / Knowledge Base",
    account: "My Account",
    firms: "All Tenants",
  };
  return titles[view] ?? "Platform Owner Console";
}

function OverviewSection({
  firms,
  activeCount,
  suspendedCount,
  trialCount,
  expiringTrialCount,
  activeSubCount,
  users,
  branches,
  serviceRequests,
  supportTickets,
  criticalAlerts,
  failedBackups,
  events,
  billingRows,
}: {
  firms: Firm[];
  activeCount: number;
  suspendedCount: number;
  trialCount: number;
  expiringTrialCount: number;
  activeSubCount: number;
  users: number;
  branches: number;
  serviceRequests: number;
  supportTickets: number;
  criticalAlerts: number;
  failedBackups: number;
  events: Event[];
  billingRows: BillingRow[];
}) {
  const outstandingPayments = billingRows.filter(
    (r) => r.status !== "paid" && r.status !== "cancelled",
  ).length;
  const recentPayments = billingRows.filter((r) => r.status === "paid").slice(0, 5);

  return (
    <div data-tour="platform-dashboard" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardLinkCard
          label="Total Tenants"
          value={firms.length}
          sub={`${activeCount} active`}
          to="/platform"
          search={{ view: "firms", filter: "all" }}
        />
        <DashboardLinkCard
          label="Active Tenants"
          value={activeCount}
          sub="Currently active"
          to="/platform"
          search={{ view: "firms", filter: "active" }}
        />
        <DashboardLinkCard
          label="Suspended Tenants"
          value={suspendedCount}
          sub="Inactive accounts"
          to="/platform"
          search={{ view: "firms", filter: "suspended" }}
          accent="text-red-400"
        />
        <DashboardLinkCard
          label="Trial Tenants"
          value={trialCount}
          sub={`${expiringTrialCount} expiring soon`}
          to="/platform/trials"
          search={{ filter: "active" }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardLinkCard
          label="Active Subscriptions"
          value={activeSubCount}
          sub="Paid subscriptions"
          to="/platform"
          search={{ view: "subscriptions" }}
        />
        <DashboardLinkCard
          label="Outstanding Payments"
          value={outstandingPayments}
          sub="Unpaid documents"
          to="/platform"
          search={{ view: "billing", billingTab: "invoices" }}
        />
        <DashboardLinkCard
          label="Platform Users"
          value={users}
          sub={`${branches} branches`}
          to="/platform"
          search={{ view: "users" }}
        />
        <DashboardLinkCard
          label="Open Support Tickets"
          value={supportTickets}
          sub={`${serviceRequests} service requests`}
          to="/platform"
          search={{ view: "tickets" }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionNeededCard
          title="Critical Error Alerts"
          count={criticalAlerts}
          icon={FileWarning}
          color="text-red-400"
        />
        <ActionNeededCard
          title="Failed Backup Runs"
          count={failedBackups}
          icon={Database}
          color="text-purple-400"
        />
      </div>

      <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs">
        <h3 className="font-serif font-bold text-base text-gold">Recent Payments</h3>
        <div className="mt-4 divide-y divide-border text-xs">
          {recentPayments.map((r) => (
            <div key={r.id} className="py-2.5 flex items-center justify-between">
              <span className="font-mono">{r.document_no}</span>
              <span className="font-semibold">{rupees(r.amount_minor)}</span>
            </div>
          ))}
          {recentPayments.length === 0 && (
            <p className="py-4 text-center text-muted-foreground">No recent payments recorded.</p>
          )}
        </div>
      </div>

      <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs">
        <h3 className="font-serif font-bold text-base text-gold">Recent Platform Operations</h3>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Real-time tenant activity and administrative events
        </p>
        <div className="mt-4 divide-y divide-border text-xs">
          {events.map((e) => (
            <div key={e.id} className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono font-semibold text-foreground">{e.action}</span>
                {e.reason && (
                  <span className="ml-2 text-muted-foreground font-sans">- {e.reason}</span>
                )}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {new Date(e.created_at).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No audit events logged yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardLinkCard({
  label,
  value,
  sub,
  to,
  search,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  to: string;
  search: Record<string, string>;
  accent?: string;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="erp-surface rounded-md border border-border bg-card p-4 shadow-xs hover:border-gold/40 transition block"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </Link>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="erp-surface rounded-md border border-border bg-card p-4 shadow-xs">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function ActionNeededCard({
  title,
  count,
  icon: Icon,
  color,
}: {
  title: string;
  count: number;
  icon: typeof Wrench;
  color: string;
}) {
  return (
    <div className="erp-surface rounded-md border border-border bg-card p-4 shadow-xs flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
          {title}
        </p>
        <p className={`mt-1 font-mono text-2xl font-bold ${color}`}>{count}</p>
      </div>
      <div className={`p-2 rounded-md bg-muted/40 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function FirmsSection({
  filteredFirms,
  tenantFilter,
  showTenant360,
  search,
  setSearch,
  subscriptions,
  plans,
  firmStats,
  refresh,
}: {
  filteredFirms: Firm[];
  tenantFilter: string;
  showTenant360: boolean;
  search: string;
  setSearch: (s: string) => void;
  subscriptions: Subscription[];
  plans: Plan[];
  firmStats: PlatformFirmStats[];
  refresh: () => Promise<void>;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filterLabel =
    tenantFilter === "active"
      ? "active tenants"
      : tenantFilter === "suspended"
        ? "suspended tenants"
        : tenantFilter === "trial"
          ? "trial tenants"
          : "tenant firms";

  async function toggleActive(f: Firm) {
    setUpdating(f.id);
    setActionError(null);
    const { error } = await supabase
      .from("organizations")
      .update({ is_active: !f.is_active })
      .eq("id", f.id);
    if (error) {
      setActionError(`Unable to ${f.is_active ? "suspend" : "activate"} tenant. Please try again.`);
      setUpdating(null);
      return;
    }
    await supabase.from("platform_audit_events").insert({
      action: f.is_active ? "TENANT_SUSPENDED" : "TENANT_ACTIVATED",
      target_type: "organization",
      reason: `Platform owner toggled status for ${f.slug}`,
    });
    await refresh();
    setUpdating(null);
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {actionError}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search firms by name, slug, GSTIN..."
            className="pl-9 bg-background border-border focus:ring-gold text-xs"
          />
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          Showing {filteredFirms.length} {filterLabel}
        </p>
      </div>

      <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
              <tr>
                <th className="p-3">Firm Name</th>
                <th className="p-3">Slug</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Status</th>
                <th className="p-3">Subscription</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredFirms.map((f) => {
                const sub = subscriptions.find((s) => s.organization_id === f.id);
                const plan = plans.find((p) => p.id === sub?.plan_id);
                const stats = firmStats.find((s) => s.firm_id === f.id);
                const isSelected = selectedFirmId === f.id;
                return (
                  <tr key={f.id} className={isSelected ? "bg-muted/50" : "hover:bg-muted/30"}>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFirmId(isSelected ? null : f.id)}
                        className="text-left font-semibold text-foreground hover:text-gold transition-colors cursor-pointer"
                      >
                        {f.name}
                      </button>
                      <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                        {stats?.invoices ?? 0} invoices · {stats?.orders ?? 0} orders ·{" "}
                        {stats?.jobCards ?? 0} jobs
                      </div>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">{f.slug}</td>
                    <td className="p-3 font-mono">{f.gstin ?? "—"}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${
                          f.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/10 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {f.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="p-3">
                      {plan ? (
                        <span className="font-semibold text-foreground">{plan.name}</span>
                      ) : (
                        <span className="text-muted-foreground font-mono">No plan</span>
                      )}
                      {sub?.status && (
                        <span className="ml-1.5 text-[10px] uppercase font-mono text-gold">
                          ({sub.status})
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating === f.id}
                        onClick={() => void toggleActive(f)}
                        className="h-7 text-xs border-border bg-background hover:bg-muted/50 text-foreground cursor-pointer"
                      >
                        {f.is_active ? "Suspend" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredFirms.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    No matching tenant firms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedFirmId && (showTenant360 || selectedFirmId) && (
        <FirmDetailPanel
          firm={filteredFirms.find((f) => f.id === selectedFirmId)}
          subscription={subscriptions.find((s) => s.organization_id === selectedFirmId)}
          plan={plans.find(
            (p) =>
              p.id === subscriptions.find((s) => s.organization_id === selectedFirmId)?.plan_id,
          )}
          stats={firmStats.find((s) => s.firm_id === selectedFirmId)}
        />
      )}
    </div>
  );
}

function FirmDetailPanel({
  firm,
  subscription,
  plan,
  stats,
}: {
  firm: Firm | undefined;
  subscription: Subscription | undefined;
  plan: Plan | undefined;
  stats: PlatformFirmStats | undefined;
}) {
  if (!firm) return null;
  return (
    <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-gold">{firm.name}</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Slug: {firm.slug} · GSTIN: {firm.gstin ?? "Not recorded"}
          </p>
        </div>
        <span className="rounded-md border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold uppercase text-gold font-mono">
          {plan?.name ?? "No plan"} · {subscription?.status ?? "none"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatMini label="Invoices" value={stats?.invoices ?? 0} />
        <StatMini label="Invoice Value" value={rupees(stats?.invoiceValueMinor ?? 0)} />
        <StatMini label="Orders" value={stats?.orders ?? 0} />
        <StatMini label="Open Orders" value={stats?.openOrders ?? 0} />
        <StatMini label="Job Cards" value={stats?.jobCards ?? 0} />
        <StatMini label="Users" value={stats?.users ?? 0} />
      </div>
      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3 pt-2 border-t border-border font-mono">
        <div>
          <p className="font-semibold text-foreground uppercase text-[10px]">Renewal / Lifecycle</p>
          <p className="mt-0.5">
            {subscription?.trial_ends_at
              ? `Trial ends ${new Date(subscription.trial_ends_at).toLocaleDateString("en-IN")}`
              : subscription?.renews_at
                ? `Renews ${new Date(subscription.renews_at).toLocaleDateString("en-IN")}`
                : "No renewal date set"}
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground uppercase text-[10px]">Plan Capacity</p>
          <p className="mt-0.5">
            Branches: {plan?.branch_limit ?? "Unlimited"} · Users: {plan?.user_limit ?? "Unlimited"}
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground uppercase text-[10px]">Platform Documents</p>
          <p className="mt-0.5">{stats?.platformBills ?? 0} invoices issued</p>
        </div>
      </div>
      <TenantCommunicationsPanel firmId={firm.id} title="Tenant 360 · Communications" />
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

function UsersSection({
  users,
  firms,
  refresh,
}: {
  users: UserRow[];
  firms: Firm[];
  refresh: () => Promise<void>;
}) {
  async function toggleUser(user: UserRow) {
    await supabase
      .from("user_profiles")
      .update({ active: !user.active, status: user.active ? "suspended" : "active" })
      .eq("id", user.id);
    await refresh();
  }

  return (
    <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
      <div className="p-4 border-b border-border">
        <h3 className="font-serif font-bold text-base text-gold">Tenant Identities & Staff</h3>
        <p className="mt-0.5 text-xs text-muted-foreground font-mono">
          Global visibility across firm managers, artisans, branch counters, and system users
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
            <tr>
              <th className="p-3">User Name</th>
              <th className="p-3">Firm</th>
              <th className="p-3">Role</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last Login</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/30">
                <td className="p-3 font-semibold text-foreground">{user.full_name}</td>
                <td className="p-3 text-muted-foreground">
                  {firms.find((firm) => firm.id === user.firm_id)?.name ?? "Platform Engine"}
                </td>
                <td className="p-3">
                  <span className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono uppercase">
                    {user.role ?? "user"}
                  </span>
                </td>
                <td className="p-3 font-mono">{user.phone ?? "—"}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                      user.active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {user.active ? "Active" : user.status}
                  </span>
                </td>
                <td className="p-3 font-mono text-muted-foreground">
                  {user.last_login ? new Date(user.last_login).toLocaleString("en-IN") : "—"}
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-border bg-background hover:bg-muted/50 text-foreground text-xs cursor-pointer"
                    onClick={() => void toggleUser(user)}
                  >
                    {user.active ? "Suspend" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground">
                  No tenant users registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscriptionsSection({
  firms,
  subscriptions,
  plans,
  refresh,
}: {
  firms: Firm[];
  subscriptions: Subscription[];
  plans: Plan[];
  refresh: () => Promise<void>;
}) {
  const [editingOrg, setEditingOrg] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  async function updatePlan(orgId: string) {
    if (!selectedPlan) return;
    const existing = subscriptions.find((s) => s.organization_id === orgId);
    if (existing) {
      await supabase
        .from("organization_subscriptions")
        .update({ plan_id: selectedPlan, status: "active" })
        .eq("organization_id", orgId);
    } else {
      await supabase.from("organization_subscriptions").insert({
        organization_id: orgId,
        plan_id: selectedPlan,
        status: "active",
        starts_at: new Date().toISOString(),
      });
    }
    await supabase.rpc("apply_plan_entitlements", {
      p_organization_id: orgId,
      p_plan_id: selectedPlan,
      p_reason: "Platform owner changed tenant plan",
    });
    await supabase.from("platform_audit_events").insert({
      action: "SUBSCRIPTION_UPDATED",
      target_type: "organization",
      reason: `Plan changed for firm ID ${orgId}`,
    });
    setEditingOrg(null);
    await refresh();
  }

  async function setSubscriptionStatus(orgId: string, status: "active" | "suspended") {
    const existing = subscriptions.find((s) => s.organization_id === orgId);
    if (!existing) return;
    await supabase
      .from("organization_subscriptions")
      .update({ status })
      .eq("organization_id", orgId);
    await supabase.from("platform_audit_events").insert({
      action: status === "suspended" ? "SUBSCRIPTION_SUSPENDED" : "SUBSCRIPTION_ACTIVATED",
      target_type: "organization",
      reason: `Subscription ${status} for firm ID ${orgId}`,
    });
    await refresh();
  }

  return (
    <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
      <div className="p-4 border-b border-border">
        <h3 className="font-serif font-bold text-base text-gold">
          Tenant Subscriptions &amp; Tiers
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground font-mono">
          Manage commercial plans, trial entitlements, and license renewals
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
            <tr>
              <th className="p-3">Firm Name</th>
              <th className="p-3">Current Plan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Renewal / Expiry</th>
              <th className="p-3 text-right">Assign Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {firms.map((f) => {
              const sub = subscriptions.find((s) => s.organization_id === f.id);
              const plan = plans.find((p) => p.id === sub?.plan_id);
              const isEditing = editingOrg === f.id;
              return (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="p-3 font-semibold text-foreground">{f.name}</td>
                  <td className="p-3">
                    {plan ? (
                      <div>
                        <span className="font-semibold text-foreground">{plan.name}</span>
                        <span className="ml-2 text-gold font-mono">
                          {plan.price_minor > 0
                            ? `(₹${(plan.price_minor / 100).toFixed(0)}/mo)`
                            : "(price unset)"}
                        </span>
                        {(plan.business_edition || plan.edition_family) && (
                          <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                            {[plan.edition_family, plan.business_edition, plan.price_band_code]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-red-400 font-mono">Unassigned</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-muted text-foreground border border-border">
                      {sub?.status ?? "none"}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-muted-foreground">
                    {sub?.renews_at
                      ? new Date(sub.renews_at).toLocaleDateString("en-IN")
                      : sub?.trial_ends_at
                        ? `Trial ends ${new Date(sub.trial_ends_at).toLocaleDateString("en-IN")}`
                        : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={selectedPlan}
                          onChange={(e) => setSelectedPlan(e.target.value)}
                          className="text-xs border border-border bg-background text-foreground p-1.5 rounded-md focus:ring-gold"
                        >
                          <option value="">Select plan...</option>
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code}
                              {p.business_edition ? ` · ${p.business_edition}` : ""}
                              {p.edition_family === "mtg" ? " · MTG" : ""}
                              {p.price_minor > 0
                                ? ` (₹${(p.price_minor / 100).toFixed(0)})`
                                : " (set price)"}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={() => void updatePlan(f.id)}
                          className="h-7 text-xs bg-gold text-black font-semibold hover:bg-gold-dark"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingOrg(null)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingOrg(f.id);
                            setSelectedPlan(sub?.plan_id ?? "");
                          }}
                          className="h-7 text-xs border-border bg-background hover:bg-muted/50 text-foreground cursor-pointer"
                        >
                          Change Plan
                        </Button>
                        {sub ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void setSubscriptionStatus(
                                f.id,
                                sub.status === "suspended" ? "active" : "suspended",
                              )
                            }
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {sub.status === "suspended" ? "Activate" : "Suspend"}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MODULE_KEYS = [
  ["catalog", "Design Catalog & Showcase"],
  ["workshop", "Workshop Operations"],
  ["billing", "Billing & Invoicing"],
  ["inventory", "Inventory & Stock"],
  ["crm", "CRM & Dealers"],
  ["reports", "Reports & Analytics"],
  ["multi_branch", "Multi-Branch Sync"],
];

function LicensingSection({
  firms,
  features,
  licenses,
  refresh,
}: {
  firms: Firm[];
  features: Feature[];
  licenses: LicenseRow[];
  refresh: () => Promise<void>;
}) {
  const [selectedFirm, setSelectedFirm] = useState<string>(firms[0]?.id ?? "");
  const [licenseId, setLicenseId] = useState("");
  const [edition, setEdition] = useState("Manufacturing Essential");
  const [seats, setSeats] = useState("5");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason] = useState("Platform owner license update");
  const [renewDays, setRenewDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedFirmRow = firms.find((f) => f.id === selectedFirm);
  const firmLicenses = licenses.filter((license) => license.organization_id === selectedFirm);
  const activeLicense =
    firmLicenses.find((license) => license.status === "active") ?? firmLicenses[0] ?? null;

  async function toggleModule(featureKey: string, currentVal: boolean) {
    if (!selectedFirm) return;
    const existing = features.find(
      (f) => f.organization_id === selectedFirm && f.feature_key === featureKey,
    );
    if (existing) {
      await supabase
        .from("organization_features")
        .update({ enabled: !currentVal })
        .eq("organization_id", selectedFirm)
        .eq("feature_key", featureKey);
    } else {
      await supabase.from("organization_features").insert({
        organization_id: selectedFirm,
        feature_key: featureKey,
        enabled: true,
        source: "manual",
      });
    }
    await refresh();
  }

  function generateLicenseId() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
        : Math.random().toString(36).slice(2, 10).toUpperCase();
    setLicenseId(`AVS-${stamp}-${suffix}`);
  }

  async function issueLicense() {
    if (!selectedFirmRow) return;
    const finalLicenseId = licenseId.trim() || `AVS-${Date.now().toString(36).toUpperCase()}`;
    const expiry = expiryDate ? new Date(`${expiryDate}T23:59:59`).toISOString() : null;
    setSaving(true);
    setNotice(null);
    const enabledFeatures = MODULE_KEYS.filter(([key]) => {
      const feature = features.find(
        (f) => f.organization_id === selectedFirm && f.feature_key === key,
      );
      return feature ? feature.enabled : true;
    }).map(([key]) => key);
    const { error: rpcError } = await supabase.rpc(
      "issue_platform_license" as never,
      {
        p_license_id: finalLicenseId,
        p_customer_name: selectedFirmRow.name,
        p_company_name: selectedFirmRow.name,
        p_edition: edition.trim() || "Manufacturing Essential",
        p_seats: Math.max(1, Number(seats) || 1),
        p_expiry: expiry,
        p_features: enabledFeatures,
        p_reason: reason,
        p_organization_id: selectedFirm,
      } as never,
    );
    if (rpcError) {
      setNotice(rpcError.message);
    } else {
      setLicenseId(finalLicenseId);
      setNotice(`License ${finalLicenseId} issued for ${selectedFirmRow.name}.`);
      await refresh();
    }
    setSaving(false);
  }

  async function renewLicense(row: LicenseRow) {
    const days = Math.max(1, Number(renewDays) || 30);
    const base =
      row.expiry_date && new Date(row.expiry_date) > new Date()
        ? new Date(row.expiry_date)
        : new Date();
    base.setDate(base.getDate() + days);
    setSaving(true);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc(
      "renew_platform_license" as never,
      {
        p_license_id: row.license_id,
        p_new_expiry: base.toISOString(),
        p_reason: reason || `Renewed by ${days} days from Platform Owner`,
      } as never,
    );
    if (rpcError) setNotice(rpcError.message);
    else {
      setNotice(`License ${row.license_id} renewed by ${days} days.`);
      await refresh();
    }
    setSaving(false);
  }

  async function suspendLicense(row: LicenseRow) {
    setSaving(true);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc(
      "suspend_platform_license" as never,
      {
        p_license_id: row.license_id,
        p_reason: reason || "Suspended from Platform Owner",
      } as never,
    );
    if (rpcError) setNotice(rpcError.message);
    else {
      setNotice(`License ${row.license_id} suspended.`);
      await refresh();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase font-mono">
          Select Tenant Firm
        </label>
        <select
          value={selectedFirm}
          onChange={(e) => setSelectedFirm(e.target.value)}
          className="border border-border bg-card px-3 py-1.5 text-xs rounded-md font-semibold text-foreground focus:ring-gold"
        >
          {firms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.slug})
            </option>
          ))}
        </select>
        {activeLicense && <LicenseHealthBadge license={activeLicense} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="font-serif font-bold text-base text-gold">License Management</h3>
              <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                Issue, renew, suspend, and audit tenant cryptographic license seats
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-muted-foreground font-mono text-[10px] uppercase">
                Renew by days
              </label>
              <input
                type="number"
                min="1"
                value={renewDays}
                onChange={(e) => setRenewDays(e.target.value)}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono text-foreground focus:ring-gold"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
                <tr>
                  <th className="p-3">License Key</th>
                  <th className="p-3">Edition</th>
                  <th className="p-3">Seats</th>
                  <th className="p-3">Expiry</th>
                  <th className="p-3">Reminder</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {firmLicenses.map((license) => {
                  const daysLeft = daysUntil(license.expiry_date);
                  return (
                    <tr key={license.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-mono text-xs font-semibold text-gold">
                          {license.license_id}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase font-mono text-muted-foreground">
                          {license.status}
                        </div>
                      </td>
                      <td className="p-3">{license.edition}</td>
                      <td className="p-3 font-mono">{license.seats}</td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {license.expiry_date
                          ? new Date(license.expiry_date).toLocaleDateString("en-IN")
                          : "Lifetime"}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {license.expiry_date ? reminderLabel(daysLeft) : "No expiry"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void renewLicense(license)}
                            className="h-7 border-border bg-background hover:bg-muted/50 text-foreground text-xs cursor-pointer"
                          >
                            Renew
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving || license.status === "suspended"}
                            onClick={() => void suspendLicense(license)}
                            className="h-7 border-border bg-background hover:bg-muted/50 text-foreground text-xs cursor-pointer"
                          >
                            Suspend
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {firmLicenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                      No license issued for this tenant yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-3">
          <h3 className="font-serif font-bold text-base text-gold">Issue New License</h3>
          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                License Key
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  value={licenseId}
                  onChange={(e) => setLicenseId(e.target.value)}
                  placeholder="AVS-YYYYMMDD-XXXXXXXX"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-foreground text-xs focus:ring-gold"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateLicenseId}
                  className="h-8 border-border bg-background text-foreground text-xs hover:bg-muted/50 cursor-pointer"
                >
                  Gen
                </Button>
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                Edition
              </span>
              <select
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-xs focus:ring-gold"
              >
                <option>Manufacturing Starter</option>
                <option>Manufacturing Essential</option>
                <option>Manufacturing Growth</option>
                <option>Manufacturing Enterprise</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                Seats
              </span>
              <input
                type="number"
                min="1"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-foreground text-xs focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                Expiry Date
              </span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-foreground text-xs focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                Reason / Note
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 min-h-16 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-xs focus:ring-gold"
              />
            </label>
            <Button
              disabled={saving || !selectedFirm}
              onClick={() => void issueLicense()}
              className="w-full bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs"
            >
              {saving ? "Saving..." : "Issue License"}
            </Button>
            {notice && (
              <p className="rounded-md border border-gold/30 bg-gold/10 p-2 text-gold text-xs font-mono">
                {notice}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-4">
        <h3 className="font-serif font-bold text-base text-gold">Feature &amp; Module Flags</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_KEYS.map(([key, label]) => {
            const feature = features.find(
              (f) => f.organization_id === selectedFirm && f.feature_key === key,
            );
            const isEnabled = feature ? feature.enabled : true;
            return (
              <div
                key={key}
                className="flex items-center justify-between border border-border rounded-md p-3 bg-muted/20"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{key}</p>
                </div>
                <Button
                  size="sm"
                  variant={isEnabled ? "default" : "outline"}
                  onClick={() => void toggleModule(key, isEnabled)}
                  className={`h-7 text-xs font-semibold rounded-md ${
                    isEnabled
                      ? "bg-gold text-black hover:bg-gold-dark"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isEnabled ? "Licensed" : "Locked"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

function reminderLabel(daysLeft: number | null) {
  if (daysLeft === null) return "No expiry";
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)}d ago`;
  if (daysLeft === 0) return "Expires today";
  if (daysLeft <= 7) return `${daysLeft}d left - urgent`;
  if (daysLeft <= 30) return `${daysLeft}d left - reminder due`;
  return `${daysLeft}d left`;
}

function LicenseHealthBadge({ license }: { license: LicenseRow }) {
  const daysLeft = daysUntil(license.expiry_date);
  const isBad = license.status !== "active" || (daysLeft !== null && daysLeft < 0);
  const isWarning = !isBad && daysLeft !== null && daysLeft <= 30;
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-[10px] font-semibold font-mono uppercase ${
        isBad
          ? "bg-red-500/10 text-red-400 border border-red-500/30"
          : isWarning
            ? "bg-gold/10 text-gold border border-gold/30"
            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
      }`}
    >
      {license.status} · {reminderLabel(daysLeft)}
    </span>
  );
}

function RequestsSection({
  rows,
  firms,
  refresh,
}: {
  rows: RequestRow[];
  firms: Firm[];
  refresh: () => Promise<void>;
}) {
  const [firmId, setFirmId] = useState(firms[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("implementation");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (!firmId && firms[0]?.id) setFirmId(firms[0].id);
  }, [firms, firmId]);

  async function updateStatus(r: RequestRow, status: string) {
    await supabase.from("platform_service_requests").update({ status }).eq("id", r.id);
    await refresh();
  }

  async function createRequest() {
    const { data } = await supabase.auth.getSession();
    const requester = data.session?.user.id;
    if (!firmId || !subject.trim() || !requester) return;
    await supabase.from("platform_service_requests").insert({
      request_no: `SR-${Date.now().toString().slice(-8)}`,
      firm_id: firmId,
      requester_id: requester,
      category,
      subject: subject.trim(),
      description: subject.trim(),
      priority,
      status: "open",
    });
    setSubject("");
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-3">
        <h3 className="font-serif font-bold text-base text-gold">Create Service Request</h3>
        <div className="grid gap-2 text-xs md:grid-cols-[1.2fr_1fr_1fr_2fr_auto]">
          <select
            className="border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold text-xs"
            value={firmId}
            onChange={(e) => setFirmId(e.target.value)}
          >
            {firms.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name}
              </option>
            ))}
          </select>
          <select
            className="border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold text-xs"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "implementation",
              "training",
              "data_migration",
              "printing",
              "whatsapp",
              "billing",
            ].map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <select
            className="border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold text-xs"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {["low", "medium", "high", "urgent"].map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <input
            className="border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold text-xs"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject / work requested"
          />
          <Button
            size="sm"
            disabled={!subject.trim()}
            onClick={() => void createRequest()}
            className="bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs"
          >
            Create
          </Button>
        </div>
      </div>
      <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Firm</th>
                <th className="p-3">Category</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono font-semibold text-gold">{row.request_no}</td>
                  <td className="p-3 text-foreground font-medium">
                    {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                  </td>
                  <td className="p-3 uppercase font-mono text-[10px]">{row.category}</td>
                  <td className="p-3 text-foreground">{row.subject}</td>
                  <td className="p-3 font-mono uppercase text-[10px]">{row.priority}</td>
                  <td className="p-3">
                    <select
                      className="border border-border bg-background text-foreground p-1 text-xs rounded-md focus:ring-gold"
                      value={row.status}
                      onChange={(e) => void updateStatus(row, e.target.value)}
                    >
                      {["open", "in_progress", "resolved", "closed"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    No service requests logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TicketsSection({
  rows,
  firms,
  refresh,
}: {
  rows: TicketRow[];
  firms: Firm[];
  refresh: () => Promise<void>;
}) {
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(rows[0] ?? null);
  const [messages, setMessages] = useState<
    Array<{ id: string; body: string; created_at: string; sender_id: string }>
  >([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (!selectedTicket && rows[0]) setSelectedTicket(rows[0]);
  }, [rows, selectedTicket]);

  async function updateStatus(r: TicketRow, status: string) {
    await supabase.from("platform_support_tickets").update({ status }).eq("id", r.id);
    await refresh();
  }

  async function openThread(row: TicketRow) {
    setSelectedTicket(row);
    setThreadLoading(true);
    const conversation = await supabase
      .from("platform_conversations")
      .select("id")
      .eq("ticket_id", row.id)
      .maybeSingle();
    if (conversation.error) {
      setMessages([]);
      setThreadLoading(false);
      return;
    }
    let conversationId = conversation.data?.id as string | undefined;
    if (!conversationId) {
      const created = await supabase
        .from("platform_conversations")
        .insert({ ticket_id: row.id, firm_id: row.firm_id, status: "open" })
        .select("id")
        .single();
      conversationId = created.data?.id as string | undefined;
    }
    if (!conversationId) {
      setMessages([]);
      setThreadLoading(false);
      return;
    }
    const thread = await supabase
      .from("platform_conversation_messages")
      .select("id,body,created_at,sender_id")
      .eq("conversation_id", conversationId)
      .eq("visibility", "customer")
      .order("created_at", { ascending: true });
    setMessages(
      (thread.data ?? []) as Array<{
        id: string;
        body: string;
        created_at: string;
        sender_id: string;
      }>,
    );
    setThreadLoading(false);
  }

  async function sendReply() {
    if (!selectedTicket || !reply.trim()) return;
    setThreadLoading(true);
    const { data: authData } = await supabase.auth.getSession();
    const userId = authData?.session?.user?.id;
    const conversation = await supabase
      .from("platform_conversations")
      .select("id")
      .eq("ticket_id", selectedTicket.id)
      .maybeSingle();
    let conversationId = conversation.data?.id as string | undefined;
    if (!conversationId) {
      const created = await supabase
        .from("platform_conversations")
        .insert({ ticket_id: selectedTicket.id, firm_id: selectedTicket.firm_id, status: "open" })
        .select("id")
        .single();
      conversationId = created.data?.id as string | undefined;
    }
    if (userId && conversationId) {
      await supabase.from("platform_conversation_messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        body: reply.trim(),
        visibility: "customer",
      });
      await supabase
        .from("platform_support_tickets")
        .update({ status: "waiting_customer" })
        .eq("id", selectedTicket.id)
        .in("status", ["open", "acknowledged", "in_progress", "reopened"]);
      setReply("");
      await openThread(selectedTicket);
      await refresh();
    }
    setThreadLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs">
        <h3 className="font-serif font-bold text-base text-gold">Customer-Raised Support Queue</h3>
        <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground font-mono">
          Tickets generated from customer portals and firm staff. Manage resolution triage,
          messaging, and ticket state.
        </p>
      </div>

      <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Firm</th>
                <th className="p-3">Category</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono font-semibold text-gold">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline cursor-pointer"
                      onClick={() => void openThread(row)}
                    >
                      {row.ticket_no}
                    </button>
                  </td>
                  <td className="p-3 font-medium text-foreground">
                    {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                  </td>
                  <td className="p-3 uppercase font-mono text-[10px]">{row.category}</td>
                  <td className="p-3 text-foreground">{row.subject}</td>
                  <td className="p-3">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase ${
                        row.severity === "critical"
                          ? "bg-red-500/10 text-red-400 border border-red-500/30"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    <select
                      className="border border-border bg-background text-foreground p-1 text-xs rounded-md focus:ring-gold"
                      value={row.status}
                      onChange={(e) => void updateStatus(row, e.target.value)}
                    >
                      {[
                        "open",
                        "acknowledged",
                        "in_progress",
                        "waiting_customer",
                        "resolved",
                        "closed",
                        "reopened",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    No support tickets logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket ? (
        <div className="grid gap-4 erp-surface rounded-md border border-border bg-card p-5 shadow-xs md:grid-cols-[320px_1fr]">
          <div className="space-y-3 border-b md:border-b-0 md:border-r border-border md:pr-4 pb-4 md:pb-0">
            <div>
              <h3 className="font-serif font-bold text-base text-gold">Ticket Workspace</h3>
              <p className="text-xs font-mono text-muted-foreground">{selectedTicket.ticket_no}</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{selectedTicket.subject}</p>
            <dl className="grid grid-cols-2 gap-2 text-xs font-mono">
              <dt className="text-muted-foreground">Firm</dt>
              <dd className="text-foreground font-sans font-semibold">
                {firms.find((firm) => firm.id === selectedTicket.firm_id)?.name ?? "Unknown"}
              </dd>
              <dt className="text-muted-foreground">Category</dt>
              <dd className="text-foreground">{selectedTicket.category}</dd>
              <dt className="text-muted-foreground">Severity</dt>
              <dd className="text-foreground">{selectedTicket.severity}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-gold uppercase font-bold">{selectedTicket.status}</dd>
            </dl>
            <Button
              className="mt-4 gap-2 bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs w-full"
              size="sm"
              onClick={() => void openThread(selectedTicket)}
            >
              {threadLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              Sync Live Thread
            </Button>
          </div>

          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
              {threadLoading ? (
                <div className="flex justify-center py-8 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-gold" />
                  Loading thread…
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No chat messages yet. Reply below to send response to tenant.
                </p>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-md border border-border bg-card p-3 text-xs shadow-xs space-y-1"
                    >
                      <p className="whitespace-pre-wrap text-foreground">{message.body}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(message.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Type response to tenant firm customer..."
                disabled={threadLoading || selectedTicket.status === "closed"}
                className="bg-background border-border text-xs focus:ring-gold"
              />
              <Button
                className="gap-1.5 bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs"
                disabled={threadLoading || !reply.trim() || selectedTicket.status === "closed"}
                onClick={() => void sendReply()}
              >
                <Send className="h-4 w-4" />
                Reply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DOC_TYPE_LABEL: Record<string, string> = {
  quotation: "Quotation",
  proforma: "Proforma Invoice",
  tax_invoice: "Tax Invoice",
  renewal_invoice: "Renewal Invoice",
  credit_note: "Credit Note",
  payment_receipt: "Payment Receipt",
};

function rupees(minor: number | null | undefined): string {
  return `₹${((minor ?? 0) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function BillingSection({
  rows,
  firms,
  refresh,
  billingTab,
}: {
  rows: BillingRow[];
  firms: Firm[];
  refresh: () => Promise<void>;
  billingTab: string;
}) {
  const [firmId, setFirmId] = useState(firms[0]?.id ?? "");
  const [docType, setDocType] = useState(billingTab === "quotations" ? "quotation" : "tax_invoice");
  const [description, setDescription] = useState("AVS Gold ERP Platform Subscription");
  const [taxableRupees, setTaxableRupees] = useState("10000");
  const [gstRatePercent, setGstRatePercent] = useState("18");
  const [sellerStateCode, setSellerStateCode] = useState(
    () => getCachedPlatformBillingDefaults().sellerStateCode,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { triggerPrint } = usePrintEngine();

  useEffect(() => {
    void loadPlatformBillingDefaults().then((defaults) => {
      setSellerStateCode(defaults.sellerStateCode);
      setGstRatePercent(String(defaults.defaultGstRatePercent));
    });
  }, []);

  const visibleRows = useMemo(() => {
    if (billingTab === "quotations") {
      return rows.filter((r) => ["quotation", "proforma"].includes(r.document_type));
    }
    if (billingTab === "invoices") {
      return rows.filter((r) =>
        ["tax_invoice", "renewal_invoice", "proforma"].includes(r.document_type),
      );
    }
    if (billingTab === "payments") {
      return rows.filter((r) => r.status === "paid" || r.document_type === "payment_receipt");
    }
    return rows;
  }, [rows, billingTab]);

  const selectedFirm = firms.find((firm) => firm.id === firmId);
  const buyerStateCode = (selectedFirm?.gstin ?? "").slice(0, 2);

  const isInterState =
    buyerStateCode && sellerStateCode ? buyerStateCode !== sellerStateCode : false;

  const taxableMinor = Math.round((parseFloat(taxableRupees) || 0) * 100);
  const gstRate = parseFloat(gstRatePercent) || 0;
  const gstMinor = Math.round((taxableMinor * gstRate) / 100);
  const totalMinor = taxableMinor + gstMinor;

  const cgstMinor = isInterState ? 0 : Math.round(gstMinor / 2);
  const sgstMinor = isInterState ? 0 : gstMinor - cgstMinor;
  const igstMinor = isInterState ? gstMinor : 0;

  async function createDocument() {
    if (!firmId) {
      setMessage("Please select a tenant firm.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const docNo = `AVS-BIL-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from("platform_billing_documents").insert({
      firm_id: firmId,
      document_no: docNo,
      document_type: docType,
      status: "draft",
      amount_minor: totalMinor,
      paid_minor: 0,
      taxable_minor: taxableMinor,
      cgst_minor: cgstMinor,
      sgst_minor: sgstMinor,
      igst_minor: igstMinor,
      gst_minor: gstMinor,
      buyer_state_code: buyerStateCode || null,
      seller_state_code: sellerStateCode,
      issued_at: new Date().toISOString(),
      due_at: new Date(Date.now() + 15 * 86400000).toISOString(),
      data: { description, gst_rate_percent: gstRate },
    });
    if (error) {
      setMessage(`Failed: ${error.message}`);
    } else {
      setMessage(`Created ${docNo} successfully.`);
      await refresh();
    }
    setSaving(false);
  }

  async function markPaid(row: BillingRow) {
    await supabase
      .from("platform_billing_documents")
      .update({ status: "paid", paid_minor: row.amount_minor })
      .eq("id", row.id);
    await refresh();
  }

  async function updateStatus(row: BillingRow, status: string) {
    await supabase.from("platform_billing_documents").update({ status }).eq("id", row.id);
    await refresh();
  }

  return (
    <section className="space-y-6">
      {billingTab !== "payments" && (
        <>
          <PlatformCommercialBillingHub firms={firms.map((f) => ({ id: f.id, name: f.name }))} />
          <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-base text-gold">
              Issue {billingTab === "quotations" ? "Quotation" : "Invoice"}
            </h3>
            <p className="text-xs text-muted-foreground font-mono">
              Generate official tax invoice or quotation for tenant subscription and modules
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <label className="block">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  Tenant Firm
                </span>
                <select
                  className="mt-1 w-full border border-border bg-background p-2 text-xs rounded-md text-foreground focus:ring-gold"
                  value={firmId}
                  onChange={(e) => setFirmId(e.target.value)}
                >
                  {firms.map((firm) => (
                    <option key={firm.id} value={firm.id}>
                      {firm.name} ({firm.slug})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  Document Type
                </span>
                <select
                  className="mt-1 w-full border border-border bg-background p-2 text-xs rounded-md text-foreground focus:ring-gold"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  Description
                </span>
                <input
                  className="mt-1 w-full border border-border bg-background p-2 text-xs rounded-md text-foreground focus:ring-gold"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  Taxable Amount (₹)
                </span>
                <input
                  type="number"
                  className="mt-1 w-full border border-border bg-background p-2 text-xs rounded-md font-mono text-foreground focus:ring-gold"
                  value={taxableRupees}
                  onChange={(e) => setTaxableRupees(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  GST Rate (%)
                </span>
                <input
                  type="number"
                  className="mt-1 w-full border border-border bg-background p-2 text-xs rounded-md font-mono text-foreground focus:ring-gold"
                  value={gstRatePercent}
                  onChange={(e) => setGstRatePercent(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  Seller GST State Code
                </span>
                <input
                  className="mt-1 w-full border border-border bg-muted/40 p-2 text-xs rounded-md text-muted-foreground font-mono"
                  value={sellerStateCode}
                  readOnly
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  Buyer GST State Code
                </span>
                <input
                  className="mt-1 w-full border border-border bg-muted/40 p-2 text-xs rounded-md text-muted-foreground font-mono"
                  value={buyerStateCode}
                  readOnly
                  placeholder="From firm GSTIN"
                />
              </label>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-4 text-xs font-mono space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Taxable Amount</span>
                <span className="text-foreground font-semibold">{rupees(taxableMinor)}</span>
              </div>
              {isInterState ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST ({gstRate}%)</span>
                  <span className="text-foreground font-semibold">{rupees(igstMinor)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST ({gstRate / 2}%)</span>
                    <span className="text-foreground font-semibold">{rupees(cgstMinor)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST ({gstRate / 2}%)</span>
                    <span className="text-foreground font-semibold">{rupees(sgstMinor)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-gold">
                <span>Grand Total (incl. GST)</span>
                <span>{rupees(totalMinor)}</span>
              </div>
            </div>

            {message && <p className="text-xs font-mono text-gold">{message}</p>}
            <Button
              disabled={saving}
              onClick={() => void createDocument()}
              className="bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs"
            >
              {saving
                ? "Generating..."
                : billingTab === "quotations"
                  ? "Create Draft Quotation"
                  : "Create Draft Invoice"}
            </Button>
          </div>
        </>
      )}

      <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
        <div className="border-b border-border p-4">
          <h3 className="font-serif font-bold text-base text-gold">
            {billingTab === "quotations"
              ? "Quotations"
              : billingTab === "payments"
                ? "Payments"
                : "Invoices"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground font-mono">
            Platform invoices and commercial billing receipts
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Firm</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Amount (incl. GST)</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono font-semibold text-gold">
                    {row.document_no}
                    {row.data?.description && (
                      <div className="text-[10px] text-muted-foreground font-sans font-normal">
                        {row.data.description}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-foreground font-medium">
                    {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                  </td>
                  <td className="p-3 uppercase font-mono text-[10px]">
                    {DOC_TYPE_LABEL[row.document_type] ?? row.document_type}
                  </td>
                  <td className="p-3">
                    <select
                      className="border border-border bg-background text-foreground p-1 text-xs rounded-md focus:ring-gold"
                      value={row.status}
                      onChange={(e) => void updateStatus(row, e.target.value)}
                    >
                      {["draft", "sent", "paid", "overdue", "void"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 font-mono font-semibold text-foreground">
                    {rupees(row.amount_minor)}
                    {row.status !== "paid" && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        (Paid: {rupees(row.paid_minor)})
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          triggerPrint(
                            `/platform/billing-print/${row.id}`,
                            `${row.document_no} · ${row.document_type}`,
                          )
                        }
                      >
                        <Printer className="h-3 w-3 mr-1" /> Preview / PDF
                      </Button>
                      {row.status !== "paid" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-gold text-black hover:bg-gold-dark font-semibold cursor-pointer"
                          onClick={() => void markPaid(row)}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    No documents in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ActivitySection({ events }: { events: Event[] }) {
  return (
    <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-4">
      <div>
        <h3 className="font-serif font-bold text-base text-gold">Platform Audit Trail</h3>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          Cryptographically logged administrative actions and state mutations
        </p>
      </div>
      <div className="divide-y divide-border text-xs">
        {events.map((e) => (
          <div key={e.id} className="py-3 flex items-center justify-between">
            <div>
              <span className="font-mono font-bold text-foreground">{e.action}</span>
              {e.target_type && (
                <span className="ml-2 bg-muted border border-border px-1.5 py-0.5 rounded text-[10px] font-mono uppercase text-muted-foreground">
                  {e.target_type}
                </span>
              )}
              {e.reason && <p className="mt-0.5 text-muted-foreground font-sans">{e.reason}</p>}
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {new Date(e.created_at).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
        {events.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No platform events recorded.
          </p>
        )}
      </div>
    </div>
  );
}

function HealthSection({
  errorRows,
  refresh,
}: {
  errorRows: ErrorEventRow[];
  refresh: () => Promise<void>;
}) {
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [activePlans, setActivePlans] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    void supabase
      .rpc("platform_health_ping" as never)
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (cancelled || error) return;
        const payload = data as { latency_ms?: number; active_plans?: number } | null;
        if (payload?.latency_ms != null) setLatencyMs(payload.latency_ms);
        if (payload?.active_plans != null) setActivePlans(payload.active_plans);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [errorRows.length]);

  const uptimeLabel =
    errorRows.length === 0
      ? "100%"
      : `${Math.max(0, 100 - Math.min(99, errorRows.length * 2)).toFixed(1)}%`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="API Uptime (proxy)"
          value={uptimeLabel}
          sub={`${errorRows.length} critical events in window`}
          accent={errorRows.length > 0 ? "text-amber-400" : "text-emerald-400"}
        />
        <StatCard
          label="Database Latency"
          value={latencyMs != null ? `${latencyMs}ms` : checking ? "…" : "—"}
          sub={
            activePlans != null
              ? `${activePlans} active commercial plans`
              : "platform_health_ping RPC"
          }
        />
        <StatCard
          label="Critical Errors"
          value={errorRows.length}
          sub="Recorded events"
          accent={errorRows.length > 0 ? "text-red-400" : "text-emerald-400"}
        />
      </div>

      <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-3">
        <h3 className="font-serif font-bold text-base text-gold">Error Event Diagnostics Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
              <tr>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Severity</th>
                <th className="p-2.5">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {errorRows.map((err) => (
                <tr key={err.id} className="hover:bg-muted/30">
                  <td className="p-2.5 font-mono whitespace-nowrap text-muted-foreground">
                    {new Date(err.created_at).toLocaleTimeString("en-IN")}
                  </td>
                  <td className="p-2.5 font-mono text-gold">{err.category}</td>
                  <td className="p-2.5">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-semibold ${
                        err.severity === "critical"
                          ? "bg-red-500/10 text-red-400 border border-red-500/30"
                          : "bg-gold/10 text-gold border border-gold/30"
                      }`}
                    >
                      {err.severity}
                    </span>
                  </td>
                  <td className="p-2.5 text-foreground">{err.message}</td>
                </tr>
              ))}
              {errorRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">
                    No system error events logged. Platform healthy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BackupsSection({
  backupRows,
  refresh,
}: {
  backupRows: BackupRunRow[];
  refresh: () => Promise<void>;
}) {
  return (
    <div className="erp-surface rounded-md border border-border bg-card p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="font-serif font-bold text-base text-gold">
            Disaster Recovery &amp; Automated Backups
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Scheduled snapshots and verification runs
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
          className="h-7 text-xs border-border bg-background hover:bg-muted/50 text-foreground cursor-pointer"
        >
          Refresh Log
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
            <tr>
              <th className="p-2.5">Started At</th>
              <th className="p-2.5">Type</th>
              <th className="p-2.5">Environment</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Location / Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {backupRows.map((b) => (
              <tr key={b.id} className="hover:bg-muted/30">
                <td className="p-2.5 font-mono whitespace-nowrap text-muted-foreground">
                  {new Date(b.started_at).toLocaleString("en-IN")}
                </td>
                <td className="p-2.5 uppercase font-mono text-gold">{b.backup_type}</td>
                <td className="p-2.5">{b.environment}</td>
                <td className="p-2.5">
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-semibold ${
                      b.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="p-2.5 font-mono text-muted-foreground">{b.location ?? "—"}</td>
              </tr>
            ))}
            {backupRows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">
                  No automated backup runs logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsSection({
  refresh,
  settingsTab,
}: {
  refresh: () => Promise<void>;
  settingsTab: string;
}) {
  const [sellerName, setSellerName] = useState("Arivahly Venture Sphere");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerGstin, setSellerGstin] = useState("");
  const [appName, setAppName] = useState("AVS Gold ERP");
  const [brandTagline, setBrandTagline] = useState("Jewellery ERP - Production Portal");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [whatsappProvider, setWhatsappProvider] = useState("wasenderapi");
  const [whatsappEnabled, setWhatsappEnabled] = useState("true");
  const [trialDays, setTrialDays] = useState("180");
  const [renewalReminderDays, setRenewalReminderDays] = useState("30,15,7,1");
  const [invoiceDueDays, setInvoiceDueDays] = useState("15");
  const [defaultGstRate, setDefaultGstRate] = useState("18");
  const [sellerStateCodeSetting, setSellerStateCodeSetting] = useState("19");
  const [ticketSlaHours, setTicketSlaHours] = useState("24");
  const [criticalSlaHours, setCriticalSlaHours] = useState("4");
  const [backupFrequency, setBackupFrequency] = useState("daily");
  const [backupRetentionDays, setBackupRetentionDays] = useState("30");
  const [maxBranchesDefault, setMaxBranchesDefault] = useState("");
  const [maxUsersDefault, setMaxUsersDefault] = useState("");
  const [sessionPolicy, setSessionPolicy] = useState("browser_session");
  const [maintenanceMode, setMaintenanceMode] = useState("false");
  const [planName, setPlanName] = useState("Manufacturing Growth");
  const [planCode, setPlanCode] = useState("manufacturing_growth");
  const [planPrice, setPlanPrice] = useState("9999");
  const [planCycle, setPlanCycle] = useState("monthly");
  const [branchLimit, setBranchLimit] = useState("");
  const [userLimit, setUserLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key,value")
        .in("key", [
          "branding.app_name",
          "branding.tagline",
          "billing.seller_name",
          "billing.seller_address",
          "billing.seller_gstin",
          "billing.seller_state_code",
          "billing.default_gst_rate",
          "billing.invoice_due_days",
          "support.email",
          "support.phone",
          "support.ticket_sla_hours",
          "support.critical_sla_hours",
          "integrations.whatsapp_provider",
          "integrations.whatsapp_enabled",
          "licensing.trial_days",
          "licensing.renewal_reminder_days",
          "operations.backup_frequency",
          "operations.backup_retention_days",
          "operations.max_branches_default",
          "operations.max_users_default",
          "security.session_policy",
          "security.maintenance_mode",
        ]);
      if (data) {
        const m = new Map(
          (data as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
        );
        if (m.get("billing.seller_name")) setSellerName(m.get("billing.seller_name") as string);
        if (m.get("billing.seller_address"))
          setSellerAddress(m.get("billing.seller_address") as string);
        if (m.get("billing.seller_gstin")) setSellerGstin(m.get("billing.seller_gstin") as string);
        if (m.get("branding.app_name")) setAppName(m.get("branding.app_name") as string);
        if (m.get("branding.tagline")) setBrandTagline(m.get("branding.tagline") as string);
        if (m.get("billing.seller_state_code"))
          setSellerStateCodeSetting(m.get("billing.seller_state_code") as string);
        if (m.get("billing.default_gst_rate"))
          setDefaultGstRate(String(m.get("billing.default_gst_rate")));
        if (m.get("billing.invoice_due_days"))
          setInvoiceDueDays(String(m.get("billing.invoice_due_days")));
        if (m.get("support.email")) setSupportEmail(m.get("support.email") as string);
        if (m.get("support.phone")) setSupportPhone(m.get("support.phone") as string);
        if (m.get("support.ticket_sla_hours"))
          setTicketSlaHours(String(m.get("support.ticket_sla_hours")));
        if (m.get("support.critical_sla_hours"))
          setCriticalSlaHours(String(m.get("support.critical_sla_hours")));
        if (m.get("integrations.whatsapp_provider"))
          setWhatsappProvider(m.get("integrations.whatsapp_provider") as string);
        if (m.get("integrations.whatsapp_enabled"))
          setWhatsappEnabled(String(m.get("integrations.whatsapp_enabled")));
        if (m.get("licensing.trial_days")) setTrialDays(String(m.get("licensing.trial_days")));
        if (m.get("licensing.renewal_reminder_days"))
          setRenewalReminderDays(String(m.get("licensing.renewal_reminder_days")));
        if (m.get("operations.backup_frequency"))
          setBackupFrequency(m.get("operations.backup_frequency") as string);
        if (m.get("operations.backup_retention_days"))
          setBackupRetentionDays(String(m.get("operations.backup_retention_days")));
        if (m.get("operations.max_branches_default"))
          setMaxBranchesDefault(String(m.get("operations.max_branches_default")));
        if (m.get("operations.max_users_default"))
          setMaxUsersDefault(String(m.get("operations.max_users_default")));
        if (m.get("security.session_policy"))
          setSessionPolicy(m.get("security.session_policy") as string);
        if (m.get("security.maintenance_mode"))
          setMaintenanceMode(String(m.get("security.maintenance_mode")));
      }
    })();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMsg(null);
    await Promise.all([
      supabase.from("platform_settings").upsert({ key: "branding.app_name", value: appName }),
      supabase.from("platform_settings").upsert({ key: "branding.tagline", value: brandTagline }),
      supabase.from("platform_settings").upsert({
        key: "billing.seller_name",
        value: sellerName,
      }),
      supabase.from("platform_settings").upsert({
        key: "billing.seller_address",
        value: sellerAddress,
      }),
      supabase.from("platform_settings").upsert({
        key: "billing.seller_gstin",
        value: sellerGstin,
      }),
      supabase
        .from("platform_settings")
        .upsert({ key: "billing.seller_state_code", value: sellerStateCodeSetting }),
      supabase
        .from("platform_settings")
        .upsert({ key: "billing.default_gst_rate", value: Number(defaultGstRate) || 0 }),
      supabase
        .from("platform_settings")
        .upsert({ key: "billing.invoice_due_days", value: Number(invoiceDueDays) || 0 }),
      supabase.from("platform_settings").upsert({ key: "support.email", value: supportEmail }),
      supabase.from("platform_settings").upsert({ key: "support.phone", value: supportPhone }),
      supabase
        .from("platform_settings")
        .upsert({ key: "support.ticket_sla_hours", value: Number(ticketSlaHours) || 0 }),
      supabase
        .from("platform_settings")
        .upsert({ key: "support.critical_sla_hours", value: Number(criticalSlaHours) || 0 }),
      supabase
        .from("platform_settings")
        .upsert({ key: "integrations.whatsapp_provider", value: whatsappProvider }),
      supabase
        .from("platform_settings")
        .upsert({ key: "integrations.whatsapp_enabled", value: whatsappEnabled === "true" }),
      supabase
        .from("platform_settings")
        .upsert({ key: "licensing.trial_days", value: Number(trialDays) || 0 }),
      supabase.from("platform_settings").upsert({
        key: "licensing.default_trial_days",
        value: Number(trialDays) || 0,
      }),
      supabase
        .from("platform_settings")
        .upsert({ key: "licensing.renewal_reminder_days", value: renewalReminderDays }),
      supabase
        .from("platform_settings")
        .upsert({ key: "operations.backup_frequency", value: backupFrequency }),
      supabase.from("platform_settings").upsert({
        key: "operations.backup_retention_days",
        value: Number(backupRetentionDays) || 0,
      }),
      supabase.from("platform_settings").upsert({
        key: "operations.max_branches_default",
        value: maxBranchesDefault ? Number(maxBranchesDefault) : null,
      }),
      supabase.from("platform_settings").upsert({
        key: "operations.max_users_default",
        value: maxUsersDefault ? Number(maxUsersDefault) : null,
      }),
      supabase
        .from("platform_settings")
        .upsert({ key: "security.session_policy", value: sessionPolicy }),
      supabase
        .from("platform_settings")
        .upsert({ key: "security.maintenance_mode", value: maintenanceMode === "true" }),
    ]);
    setMsg("Platform settings saved successfully.");
    setSaving(false);
    await refresh();
  }

  async function createPlan() {
    setSaving(true);
    setMsg(null);
    const cleanCode = planCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_");
    const { error } = await supabase.from("platform_plans").upsert(
      {
        code: cleanCode,
        edition_code: cleanCode,
        name: planName.trim(),
        description: "Manufacturing-heavy AVS ERP plan managed from Platform Owner.",
        billing_cycle: planCycle,
        price_minor: Math.round((parseFloat(planPrice) || 0) * 100),
        branch_limit: branchLimit ? Number(branchLimit) : null,
        user_limit: userLimit ? Number(userLimit) : null,
        workshop_limit: null,
        storage_limit_bytes: null,
        feature_limits: {
          manufacturing: true,
          workshop: true,
          job_cards: true,
          orders: true,
          billing: true,
          inventory: true,
          customer_portal: true,
          karigar_portal: true,
          whatsapp: true,
          print_templates: true,
          reports: true,
          export: true,
        },
        commercial_config: {},
        is_active: true,
      },
      { onConflict: "code" },
    );
    setMsg(error ? error.message : "Plan saved. It is now available in Change Plan.");
    setSaving(false);
    await refresh();
  }

  return (
    <div className="space-y-4">
      {settingsTab === "razorpay" && <PlatformRazorpayConfig />}

      {settingsTab === "branding" && <PlatformBrandingPanel />}

      {settingsTab === "documents" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs lg:col-span-2">
              <h3 className="font-serif font-bold text-base text-gold">
                Billing &amp; Tax Defaults
              </h3>
              <div className="grid gap-3 text-xs sm:grid-cols-3">
                <SettingsText
                  label="Default GST Rate (%)"
                  value={defaultGstRate}
                  onChange={setDefaultGstRate}
                />
                <SettingsText
                  label="Invoice Due Days"
                  value={invoiceDueDays}
                  onChange={setInvoiceDueDays}
                />
                <SettingsText
                  label="Seller GST State Code"
                  value={sellerStateCodeSetting}
                  onChange={setSellerStateCodeSetting}
                />
              </div>
            </div>
            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs">
              <h3 className="font-serif font-bold text-base text-gold">
                Platform Legal Entity Details
              </h3>
              <div className="space-y-3 text-xs">
                <SettingsText
                  label="Seller Legal Name"
                  value={sellerName}
                  onChange={setSellerName}
                />
                <SettingsText label="Seller GSTIN" value={sellerGstin} onChange={setSellerGstin} />
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Registered Address
                  </span>
                  <textarea
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold h-20 text-xs"
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={saving}
              onClick={() => void saveSettings()}
              className="bg-gold text-black hover:bg-gold-dark text-xs"
            >
              Save Document Settings
            </Button>
          </div>
        </div>
      )}

      {settingsTab === "platform" && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs">
              <h3 className="font-serif font-bold text-base text-gold">
                Support &amp; SLA Defaults
              </h3>
              <div className="space-y-3 text-xs">
                <SettingsText
                  label="Support Email"
                  value={supportEmail}
                  onChange={setSupportEmail}
                />
                <SettingsText
                  label="Support Phone / WhatsApp"
                  value={supportPhone}
                  onChange={setSupportPhone}
                />
                <SettingsText
                  label="Normal Ticket SLA Hours"
                  value={ticketSlaHours}
                  onChange={setTicketSlaHours}
                />
                <SettingsText
                  label="Critical Ticket SLA Hours"
                  value={criticalSlaHours}
                  onChange={setCriticalSlaHours}
                />
              </div>
            </div>

            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs">
              <h3 className="font-serif font-bold text-base text-gold">
                Integrations &amp; Operations
              </h3>
              <div className="space-y-3 text-xs">
                <SettingsSelect
                  label="WhatsApp Provider"
                  value={whatsappProvider}
                  onChange={setWhatsappProvider}
                  options={["wasenderapi", "wa_deeplink", "disabled"]}
                />
                <SettingsSelect
                  label="WhatsApp Enabled"
                  value={whatsappEnabled}
                  onChange={setWhatsappEnabled}
                  options={["true", "false"]}
                />
                <SettingsSelect
                  label="Backup Frequency"
                  value={backupFrequency}
                  onChange={setBackupFrequency}
                  options={["hourly", "daily", "weekly", "monthly"]}
                />
                <SettingsText
                  label="Backup Retention Days"
                  value={backupRetentionDays}
                  onChange={setBackupRetentionDays}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs">
              <h3 className="font-serif font-bold text-base text-gold">Licensing Defaults</h3>
              <div className="space-y-3 text-xs">
                <SettingsText
                  label="Default Trial Days"
                  value={trialDays}
                  onChange={setTrialDays}
                />
                <SettingsText
                  label="Renewal Reminder Days"
                  value={renewalReminderDays}
                  onChange={setRenewalReminderDays}
                />
                <SettingsText
                  label="Default Branch Limit"
                  value={maxBranchesDefault}
                  onChange={setMaxBranchesDefault}
                  placeholder="Unlimited"
                />
                <SettingsText
                  label="Default User Limit"
                  value={maxUsersDefault}
                  onChange={setMaxUsersDefault}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs lg:col-span-2">
              <h3 className="font-serif font-bold text-base text-gold">
                Billing &amp; Tax Defaults
              </h3>
              <div className="grid gap-3 text-xs sm:grid-cols-3">
                <SettingsText
                  label="Default GST Rate (%)"
                  value={defaultGstRate}
                  onChange={setDefaultGstRate}
                />
                <SettingsText
                  label="Invoice Due Days"
                  value={invoiceDueDays}
                  onChange={setInvoiceDueDays}
                />
                <SettingsText
                  label="Seller GST State Code"
                  value={sellerStateCodeSetting}
                  onChange={setSellerStateCodeSetting}
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Platform governance rules used as system defaults for new organizations and billing
                calculations.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs">
              <h3 className="font-serif font-bold text-base text-gold">
                Platform Legal Entity Details
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Entity information displayed on platform software invoices issued to subscriber
                tenants
              </p>
              <div className="space-y-3 text-xs">
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Seller Legal Name
                  </span>
                  <input
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Seller GSTIN
                  </span>
                  <input
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md font-mono text-foreground focus:ring-gold"
                    value={sellerGstin}
                    onChange={(e) => setSellerGstin(e.target.value)}
                    placeholder="e.g. 19AAACA1234A1Z5"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Registered Address
                  </span>
                  <textarea
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold h-20"
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                  />
                </label>
                <Button
                  disabled={saving}
                  onClick={() => void saveSettings()}
                  className="bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs"
                >
                  Save Platform Settings
                </Button>
              </div>
            </div>

            <div className="erp-surface rounded-md border border-border bg-card p-5 space-y-4 shadow-xs">
              <h3 className="font-serif font-bold text-base text-gold">Create / Update Plan</h3>
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Plan Name
                  </span>
                  <input
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Plan Code
                  </span>
                  <input
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md font-mono text-foreground focus:ring-gold"
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Price (₹)
                  </span>
                  <input
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md font-mono text-foreground focus:ring-gold"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Billing Cycle
                  </span>
                  <select
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md text-foreground focus:ring-gold"
                    value={planCycle}
                    onChange={(e) => setPlanCycle(e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    Branch Limit
                  </span>
                  <input
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md font-mono text-foreground focus:ring-gold"
                    value={branchLimit}
                    onChange={(e) => setBranchLimit(e.target.value)}
                    placeholder="Unlimited"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
                    User Limit
                  </span>
                  <input
                    className="mt-1 w-full border border-border bg-background p-2 rounded-md font-mono text-foreground focus:ring-gold"
                    value={userLimit}
                    onChange={(e) => setUserLimit(e.target.value)}
                    placeholder="Unlimited"
                  />
                </label>
              </div>
              {msg && <p className="text-xs font-mono text-emerald-400">{msg}</p>}
              <Button
                disabled={saving || !planName.trim() || !planCode.trim()}
                onClick={() => void createPlan()}
                className="bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs"
              >
                Save Commercial Plan
              </Button>
            </div>
          </div>

          <div className="erp-surface rounded-md border border-border bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif font-bold text-base text-gold">Save Platform Settings</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Persist SLA, integration, operations, and security policies
                </p>
              </div>
              <Button
                disabled={saving}
                onClick={() => void saveSettings()}
                className="bg-gold text-black hover:bg-gold-dark font-semibold shadow-xs cursor-pointer text-xs"
              >
                Save Settings
              </Button>
            </div>
            {msg && <p className="mt-2 text-xs font-mono text-emerald-400">{msg}</p>}
          </div>
        </>
      )}

      {(settingsTab === "documents" || settingsTab === "branding") && msg && (
        <p className="text-xs font-mono text-emerald-400">{msg}</p>
      )}
    </div>
  );
}

function HelpSection() {
  return (
    <div className="space-y-4">
      <div className="erp-surface rounded-md border border-border bg-card p-6 shadow-xs space-y-4">
        <h2 className="font-serif text-lg font-bold text-gold">Platform Owner Help</h2>
        <p className="text-sm text-muted-foreground">
          Knowledge base for operating the AVS Gold ERP platform control plane.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <HelpCard
            title="Tenant Management"
            body="Use All Tenants, Active Tenants, and Suspended Tenants to filter organizations. Suspend/Activate actions update the database immediately."
          />
          <HelpCard
            title="Billing Documents"
            body="Create quotations and invoices from Billing & Payments. Use Preview / PDF to download A4 documents with platform branding."
          />
          <HelpCard
            title="Branding"
            body="Upload primary, compact, and document logos under Platform Configuration → Branding. Logos appear on generated PDFs."
          />
          <HelpCard
            title="Trials & Onboarding"
            body="Monitor active and expiring trials from Onboarding & Trials. Extend trials using the extension controls."
          />
        </div>
      </div>
    </div>
  );
}

function HelpCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function AccountSection() {
  return (
    <div className="max-w-lg">
      <div className="erp-surface rounded-md border border-border bg-card p-6 shadow-xs">
        <h2 className="font-serif text-lg font-bold text-gold mb-4">My Account</h2>
        <PlatformAccountMenu className="border-0 p-0" />
      </div>
    </div>
  );
}

function SettingsText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
        {label}
      </span>
      <input
        className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-gold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function SettingsSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">
        {label}
      </span>
      <select
        className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:ring-gold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
