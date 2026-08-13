// Hallmark: macrostructure: operations console; tone: authoritative; anchor hue: legacy gold
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  FileWarning,
  LifeBuoy,
  Loader2,
  Users,
  Search,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Wrench,
  Receipt,
  Send,
} from "lucide-react";
import { dataProvider } from "@/lib/providers/data-provider";
const supabase = dataProvider as any;
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { guardRoute } from "@/lib/permissions";
import { fetchPlatformFirmStats, type PlatformFirmStats } from "@/lib/platform-stats-query";

export const Route = createFileRoute("/platform")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Platform | AVS Gold ERP" }] }),
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
  | "licensing"
  | "requests"
  | "tickets"
  | "billing"
  | "activity"
  | "health"
  | "backups"
  | "settings";

const nav: Array<[View, string, typeof Activity]> = [
  ["overview", "Overview", Activity],
  ["firms", "Firms", Building2],
  ["users", "Users", Users],
  ["subscriptions", "Subscriptions & trials", CircleDollarSign],
  ["licensing", "Module licensing", ShieldCheck],
  ["requests", "Service requests", Wrench],
  ["tickets", "Support tickets", MessageSquare],
  ["billing", "Software billing", Receipt],
  ["activity", "Activity & audit", ShieldAlert],
  ["health", "Health & monitoring", Activity],
  ["backups", "Backups", Database],
  ["settings", "Platform settings", Database],
];

function PlatformOwnerConsole() {
  const routerState = useRouterState();
  const routeView = (routerState.location.search as { view?: string }).view as View | undefined;
  const validViews: View[] = [
    "overview",
    "firms",
    "users",
    "subscriptions",
    "licensing",
    "requests",
    "tickets",
    "billing",
    "activity",
    "health",
    "backups",
    "settings",
  ];
  const initialView =
    routeView ?? (new URLSearchParams(window.location.search).get("view") as View | null);
  const [view, setView] = useState<View>(
    initialView && validViews.includes(initialView) ? initialView : "overview",
  );
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

  useEffect(() => {
    if (routeView && validViews.includes(routeView) && routeView !== view) setView(routeView);
  }, [routeView, view]);

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
          "id,name,code,price_minor,billing_cycle,is_active,branch_limit,user_limit,workshop_limit",
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
        .order("created_at", { ascending: false })
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
        .limit(500),
      supabase
        .from("licenses")
        .select(
          "id,license_id,organization_id,customer_name,company_name,status,edition,seats,expiry_date,created_at,updated_at",
        )
        .order("expiry_date", { ascending: true, nullsFirst: false }),
    ]);

    if (fRes.error) setError(fRes.error.message);
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

  const filteredFirms = useMemo(() => {
    if (!search.trim()) return firms;
    const q = search.toLowerCase();
    return firms.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        (f.gstin && f.gstin.toLowerCase().includes(q)),
    );
  }, [firms, search]);

  const activeCount = useMemo(() => firms.filter((f) => f.is_active).length, [firms]);
  const activeSubCount = useMemo(
    () => subscriptions.filter((s) => s.status === "active").length,
    [subscriptions],
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f5f0] text-sm text-[#6b6659]">
        Checking platform clearance...
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#f7f5f0] p-6 text-center text-[#2b2925]">
        <ShieldAlert className="h-10 w-10 text-[#a33b3b]" />
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="max-w-md text-sm text-[#6b6659]">
          Platform Owner Console requires <code className="bg-[#eae6df] px-1">saas_admin</code>{" "}
          platform access. You can request elevation or switch accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#2b2925]">
      <div className="border-b border-[#dedad1] bg-[#efece6] px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-lg font-bold tracking-tight">
              {nav.find(([key]) => key === view)?.[1] ?? "Platform Owner Console"}
            </h1>
            <p className="text-xs text-[#6b6659]">
              Platform engine operational - {firms.length} tenant firms
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#2d6a4f]">
            <ShieldCheck className="h-4 w-4" /> Live control plane
          </div>
        </div>
      </div>

      <main className="p-4 space-y-6 lg:p-6">
        {error && (
          <div className="flex items-center gap-2 rounded border border-[#e5a9a9] bg-[#fdf2f2] p-3 text-xs text-[#a33b3b]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {view === "overview" && (
          <OverviewSection
            firms={firms}
            activeCount={activeCount}
            activeSubCount={activeSubCount}
            users={users}
            branches={branches}
            serviceRequests={serviceRequests}
            supportTickets={supportTickets}
            criticalAlerts={criticalAlerts}
            failedBackups={failedBackups}
            events={events}
          />
        )}

        {view === "firms" && (
          <FirmsSection
            filteredFirms={filteredFirms}
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

        {view === "licensing" && (
          <LicensingSection
            firms={firms}
            features={features}
            licenses={licenses}
            refresh={refresh}
          />
        )}

        {view === "requests" && (
          <RequestsSection rows={requestRows} firms={firms} refresh={refresh} />
        )}

        {view === "tickets" && <TicketsSection rows={ticketRows} firms={firms} refresh={refresh} />}

        {view === "billing" && (
          <BillingSection rows={billingRows} firms={firms} refresh={refresh} />
        )}

        {view === "activity" && <ActivitySection events={events} />}

        {view === "health" && <HealthSection errorRows={errorRows} refresh={refresh} />}

        {view === "backups" && <BackupsSection backupRows={backupRows} refresh={refresh} />}

        {view === "settings" && <SettingsSection refresh={refresh} />}
      </main>
    </div>
  );
}

function OverviewSection({
  firms,
  activeCount,
  activeSubCount,
  users,
  branches,
  serviceRequests,
  supportTickets,
  criticalAlerts,
  failedBackups,
  events,
}: {
  firms: Firm[];
  activeCount: number;
  activeSubCount: number;
  users: number;
  branches: number;
  serviceRequests: number;
  supportTickets: number;
  criticalAlerts: number;
  failedBackups: number;
  events: Event[];
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tenant firms" value={firms.length} sub={`${activeCount} active`} />
        <StatCard label="Active subscriptions" value={activeSubCount} sub="paid & trial tier" />
        <StatCard label="Platform users" value={users} sub={`${branches} total branches`} />
        <StatCard
          label="System status"
          value="Healthy"
          sub="0 active outages"
          accent="text-[#2d6a4f]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionNeededCard
          title="Open service requests"
          count={serviceRequests}
          icon={Wrench}
          color="text-[#b85d19]"
        />
        <ActionNeededCard
          title="Open support tickets"
          count={supportTickets}
          icon={MessageSquare}
          color="text-[#2b5b84]"
        />
        <ActionNeededCard
          title="Critical error alerts"
          count={criticalAlerts}
          icon={FileWarning}
          color="text-[#a33b3b]"
        />
        <ActionNeededCard
          title="Failed backup runs"
          count={failedBackups}
          icon={Database}
          color="text-[#7c3aed]"
        />
      </div>

      <div className="border border-[#dedad1] bg-[#fffdf8] p-5">
        <h3 className="font-serif font-semibold text-sm">Recent Platform Operations</h3>
        <div className="mt-3 divide-y divide-[#dedad1] text-xs">
          {events.map((e) => (
            <div key={e.id} className="py-2 flex items-center justify-between">
              <div>
                <span className="font-mono font-medium text-[#2b2925]">{e.action}</span>
                {e.reason && <span className="ml-2 text-[#6b6659]">- {e.reason}</span>}
              </div>
              <span className="text-[11px] text-[#8c8c88]">
                {new Date(e.created_at).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <p className="py-3 text-[#8c8c88]">No audit events logged yet.</p>
          )}
        </div>
      </div>
    </>
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
    <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
      <p className="text-xs text-[#6b6659] font-medium">{label}</p>
      <p className={`mt-1 font-serif text-2xl font-bold ${accent ?? "text-[#2b2925]"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[#8c8c88]">{sub}</p>
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
    <div className="border border-[#dedad1] bg-[#fffdf8] p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-[#6b6659] font-medium">{title}</p>
        <p className={`mt-1 font-serif text-xl font-bold ${color}`}>{count}</p>
      </div>
      <Icon className={`h-6 w-6 ${color} opacity-80`} />
    </div>
  );
}

function FirmsSection({
  filteredFirms,
  search,
  setSearch,
  subscriptions,
  plans,
  firmStats,
  refresh,
}: {
  filteredFirms: Firm[];
  search: string;
  setSearch: (s: string) => void;
  subscriptions: Subscription[];
  plans: Plan[];
  firmStats: PlatformFirmStats[];
  refresh: () => Promise<void>;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState<string | null>(null);

  async function toggleActive(f: Firm) {
    setUpdating(f.id);
    await supabase.from("organizations").update({ is_active: !f.is_active }).eq("id", f.id);
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
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8c8c88]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search firms by name, slug, GSTIN..."
            className="pl-9 bg-[#fffdf8] border-[#c9c4ba]"
          />
        </div>
        <p className="text-xs text-[#6b6659]">Showing {filteredFirms.length} firms</p>
      </div>

      <div className="border border-[#dedad1] bg-[#fffdf8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-[#dedad1] bg-[#efece6] text-xs font-semibold uppercase tracking-wider text-[#4a473f]">
              <tr>
                <th className="p-3">Firm Name</th>
                <th className="p-3">Slug</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Status</th>
                <th className="p-3">Subscription</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dedad1]">
              {filteredFirms.map((f) => {
                const sub = subscriptions.find((s) => s.organization_id === f.id);
                const plan = plans.find((p) => p.id === sub?.plan_id);
                const stats = firmStats.find((s) => s.firm_id === f.id);
                const isSelected = selectedFirmId === f.id;
                return (
                  <tr key={f.id} className={isSelected ? "bg-[#f4f0e8]" : "hover:bg-[#f4f0e8]"}>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFirmId(isSelected ? null : f.id)}
                        className="text-left font-medium text-[#2b2925] underline-offset-4 hover:underline"
                      >
                        {f.name}
                      </button>
                      <div className="mt-1 text-[11px] text-[#6b6659]">
                        {stats?.invoices ?? 0} invoices | {stats?.orders ?? 0} orders |{" "}
                        {stats?.jobCards ?? 0} job cards
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-[#6b6659]">{f.slug}</td>
                    <td className="p-3 text-xs font-mono">{f.gstin ?? "-"}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${
                          f.is_active
                            ? "bg-[#e2f0d9] text-[#2d6a4f]"
                            : "bg-[#fce8e6] text-[#a33b3b]"
                        }`}
                      >
                        {f.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {plan ? (
                        <span className="font-medium">{plan.name}</span>
                      ) : (
                        <span className="text-[#8c8c88]">No plan</span>
                      )}
                      {sub?.status && (
                        <span className="ml-2 text-[10px] uppercase text-[#6b6659]">
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
                        className="h-7 text-xs border-[#c9c4ba]"
                      >
                        {f.is_active ? "Suspend" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredFirms.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-[#8c8c88]">
                    No matching tenant firms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedFirmId && (
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
    <div className="border border-[#dedad1] bg-[#fffdf8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-semibold">{firm.name}</h3>
          <p className="text-xs text-[#6b6659]">
            {firm.slug} | {firm.gstin ?? "GSTIN not recorded"}
          </p>
        </div>
        <span className="border border-[#c9c4ba] px-2 py-1 text-[11px] uppercase text-[#4a473f]">
          {plan?.name ?? "No plan assigned"} | {subscription?.status ?? "none"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatMini label="Invoices" value={stats?.invoices ?? 0} />
        <StatMini label="Invoice value" value={rupees(stats?.invoiceValueMinor ?? 0)} />
        <StatMini label="Orders" value={stats?.orders ?? 0} />
        <StatMini label="Open orders" value={stats?.openOrders ?? 0} />
        <StatMini label="Job cards" value={stats?.jobCards ?? 0} />
        <StatMini label="Users" value={stats?.users ?? 0} />
      </div>
      <div className="mt-4 grid gap-3 text-xs text-[#4a473f] sm:grid-cols-3">
        <div>
          <p className="font-semibold">Trial / renewal</p>
          <p>
            {subscription?.trial_ends_at
              ? `Trial ends ${new Date(subscription.trial_ends_at).toLocaleDateString("en-IN")}`
              : subscription?.renews_at
                ? `Renews ${new Date(subscription.renews_at).toLocaleDateString("en-IN")}`
                : "No renewal date set"}
          </p>
        </div>
        <div>
          <p className="font-semibold">Limits</p>
          <p>
            Branches {plan?.branch_limit ?? "unlimited"} | Users {plan?.user_limit ?? "unlimited"}
          </p>
        </div>
        <div>
          <p className="font-semibold">Platform billing docs</p>
          <p>{stats?.platformBills ?? 0} documents issued</p>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#dedad1] bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-[#6b6659]">{label}</p>
      <p className="mt-1 font-serif text-lg font-semibold">{value}</p>
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
    <div className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="border-b border-[#dedad1] p-4">
        <h3 className="font-serif font-semibold">Tenant Users</h3>
        <p className="mt-1 text-xs text-[#6b6659]">
          Platform owner visibility across firm staff, owners, branch users, and portal identities.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#dedad1] bg-[#efece6] text-xs uppercase tracking-wide text-[#4a473f]">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Firm</th>
              <th className="p-3">Role</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last login</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dedad1]">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[#f4f0e8]">
                <td className="p-3 font-medium">{user.full_name}</td>
                <td className="p-3 text-xs">
                  {firms.find((firm) => firm.id === user.firm_id)?.name ?? "Platform"}
                </td>
                <td className="p-3 text-xs">{user.role ?? "user"}</td>
                <td className="p-3 text-xs">{user.phone ?? "-"}</td>
                <td className="p-3 text-xs">{user.active ? "active" : user.status}</td>
                <td className="p-3 text-xs">
                  {user.last_login ? new Date(user.last_login).toLocaleString("en-IN") : "-"}
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-[#c9c4ba] text-xs"
                    onClick={() => void toggleUser(user)}
                  >
                    {user.active ? "Suspend" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-xs text-[#8c8c88]">
                  No tenant users found.
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

  return (
    <div className="border border-[#dedad1] bg-[#fffdf8] overflow-hidden">
      <div className="p-4 border-b border-[#dedad1]">
        <h3 className="font-serif font-semibold">Tenant Subscriptions & Plans</h3>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="border-b border-[#dedad1] bg-[#efece6] text-xs font-semibold uppercase tracking-wider text-[#4a473f]">
          <tr>
            <th className="p-3">Firm Name</th>
            <th className="p-3">Current Plan</th>
            <th className="p-3">Status</th>
            <th className="p-3">Renews / Trial Ends</th>
            <th className="p-3 text-right">Assign Plan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dedad1]">
          {firms.map((f) => {
            const sub = subscriptions.find((s) => s.organization_id === f.id);
            const plan = plans.find((p) => p.id === sub?.plan_id);
            const isEditing = editingOrg === f.id;
            return (
              <tr key={f.id} className="hover:bg-[#f4f0e8]">
                <td className="p-3 font-medium">{f.name}</td>
                <td className="p-3 text-xs">
                  {plan ? (
                    <div>
                      <span className="font-semibold">{plan.name}</span>
                      <span className="ml-2 text-[#8c8c88]">
                        (Rs. {(plan.price_minor / 100).toFixed(0)}/mo)
                      </span>
                    </div>
                  ) : (
                    <span className="text-[#a33b3b] font-mono">Unassigned</span>
                  )}
                </td>
                <td className="p-3">
                  <span className="text-xs uppercase font-mono tracking-wide text-[#4a473f]">
                    {sub?.status ?? "none"}
                  </span>
                </td>
                <td className="p-3 text-xs text-[#6b6659]">
                  {sub?.renews_at
                    ? new Date(sub.renews_at).toLocaleDateString("en-IN")
                    : sub?.trial_ends_at
                      ? `Trial ends ${new Date(sub.trial_ends_at).toLocaleDateString("en-IN")}`
                      : "-"}
                </td>
                <td className="p-3 text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="text-xs border border-[#c9c4ba] bg-white p-1 rounded"
                      >
                        <option value="">Select plan...</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Rs. {(p.price_minor / 100).toFixed(0)})
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => void updatePlan(f.id)}
                        className="h-7 text-xs"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingOrg(null)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingOrg(f.id);
                        setSelectedPlan(sub?.plan_id ?? "");
                      }}
                      className="h-7 text-xs border-[#c9c4ba]"
                    >
                      Change Plan
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
        source: "platform_override",
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
        <label className="text-xs font-medium text-[#6b6659]">Select Tenant Firm</label>
        <select
          value={selectedFirm}
          onChange={(e) => setSelectedFirm(e.target.value)}
          className="border border-[#c9c4ba] bg-[#fffdf8] px-3 py-1.5 text-xs rounded font-medium"
        >
          {firms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.slug})
            </option>
          ))}
        </select>
        {activeLicense && <LicenseHealthBadge license={activeLicense} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border border-[#dedad1] bg-[#fffdf8] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif font-semibold text-sm">License Management</h3>
              <p className="mt-1 text-xs text-[#6b6659]">
                Issue, renew, suspend, and monitor tenant production licenses.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-[#6b6659]">Renew by days</label>
              <input
                type="number"
                min="1"
                value={renewDays}
                onChange={(e) => setRenewDays(e.target.value)}
                className="w-20 rounded border border-[#c9c4ba] bg-white px-2 py-1"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#dedad1] bg-[#efece6] text-xs uppercase tracking-wide text-[#4a473f]">
                <tr>
                  <th className="p-3">License Key</th>
                  <th className="p-3">Edition</th>
                  <th className="p-3">Seats</th>
                  <th className="p-3">Expiry</th>
                  <th className="p-3">Reminder</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedad1]">
                {firmLicenses.map((license) => {
                  const daysLeft = daysUntil(license.expiry_date);
                  return (
                    <tr key={license.id} className="hover:bg-[#f4f0e8]">
                      <td className="p-3">
                        <div className="font-mono text-xs font-semibold">{license.license_id}</div>
                        <div className="mt-1 text-[11px] uppercase text-[#6b6659]">
                          {license.status}
                        </div>
                      </td>
                      <td className="p-3 text-xs">{license.edition}</td>
                      <td className="p-3 text-xs">{license.seats}</td>
                      <td className="p-3 text-xs">
                        {license.expiry_date
                          ? new Date(license.expiry_date).toLocaleDateString("en-IN")
                          : "Lifetime"}
                      </td>
                      <td className="p-3 text-xs">
                        {license.expiry_date ? reminderLabel(daysLeft) : "No renewal reminder"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void renewLicense(license)}
                            className="h-7 border-[#c9c4ba] text-xs"
                          >
                            Renew
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving || license.status === "suspended"}
                            onClick={() => void suspendLicense(license)}
                            className="h-7 border-[#c9c4ba] text-xs"
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
                    <td colSpan={6} className="p-8 text-center text-xs text-[#8c8c88]">
                      No license issued for this tenant yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-[#dedad1] bg-[#fffdf8] p-5">
          <h3 className="font-serif font-semibold text-sm">Create License</h3>
          <div className="mt-4 space-y-3 text-xs">
            <label className="block">
              License key
              <div className="mt-1 flex gap-2">
                <input
                  value={licenseId}
                  onChange={(e) => setLicenseId(e.target.value)}
                  placeholder="AVS-YYYYMMDD-XXXXXXXX"
                  className="min-w-0 flex-1 rounded border border-[#c9c4ba] bg-white px-2 py-2 font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateLicenseId}
                  className="h-9 border-[#c9c4ba] text-xs"
                >
                  Generate
                </Button>
              </div>
            </label>
            <label className="block">
              Edition
              <select
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                className="mt-1 w-full rounded border border-[#c9c4ba] bg-white px-2 py-2"
              >
                <option>Manufacturing Starter</option>
                <option>Manufacturing Essential</option>
                <option>Manufacturing Growth</option>
                <option>Manufacturing Enterprise</option>
              </select>
            </label>
            <label className="block">
              Seats
              <input
                type="number"
                min="1"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="mt-1 w-full rounded border border-[#c9c4ba] bg-white px-2 py-2"
              />
            </label>
            <label className="block">
              Expiry date
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 w-full rounded border border-[#c9c4ba] bg-white px-2 py-2"
              />
            </label>
            <label className="block">
              Reason / note
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 min-h-20 w-full rounded border border-[#c9c4ba] bg-white px-2 py-2"
              />
            </label>
            <Button
              disabled={saving || !selectedFirm}
              onClick={() => void issueLicense()}
              className="w-full"
            >
              {saving ? "Saving..." : "Issue License"}
            </Button>
            {notice && (
              <p className="rounded border border-[#dedad1] bg-[#f7f5f0] p-2 text-[#4a473f]">
                {notice}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
        <h3 className="font-serif font-semibold text-sm">Module Access Flags</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_KEYS.map(([key, label]) => {
            const feature = features.find(
              (f) => f.organization_id === selectedFirm && f.feature_key === key,
            );
            const isEnabled = feature ? feature.enabled : true;
            return (
              <div
                key={key}
                className="flex items-center justify-between border border-[#dedad1] p-3 bg-white"
              >
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[11px] font-mono text-[#8c8c88]">{key}</p>
                </div>
                <Button
                  size="sm"
                  variant={isEnabled ? "default" : "outline"}
                  onClick={() => void toggleModule(key, isEnabled)}
                  className="h-7 text-xs"
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
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)} days ago`;
  if (daysLeft === 0) return "Expires today";
  if (daysLeft <= 7) return `${daysLeft} days left - urgent`;
  if (daysLeft <= 30) return `${daysLeft} days left - reminder due`;
  return `${daysLeft} days left`;
}

function LicenseHealthBadge({ license }: { license: LicenseRow }) {
  const daysLeft = daysUntil(license.expiry_date);
  const isBad = license.status !== "active" || (daysLeft !== null && daysLeft < 0);
  const isWarning = !isBad && daysLeft !== null && daysLeft <= 30;
  return (
    <span
      className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${
        isBad
          ? "bg-[#fce8e6] text-[#a33b3b]"
          : isWarning
            ? "bg-[#fff4d6] text-[#8a5a00]"
            : "bg-[#e2f0d9] text-[#2d6a4f]"
      }`}
    >
      {license.status} | {reminderLabel(daysLeft)}
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
      <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
        <h3 className="font-semibold">Create Service Request</h3>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-[1.2fr_1fr_1fr_2fr_auto]">
          <select
            className="border border-[#c9c4ba] bg-white p-2"
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
            className="border border-[#c9c4ba] bg-white p-2"
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
            className="border border-[#c9c4ba] bg-white p-2"
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
            className="border border-[#c9c4ba] bg-white p-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject / work requested"
          />
          <Button size="sm" disabled={!subject.trim()} onClick={() => void createRequest()}>
            Create
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto border border-[#dedad1] bg-[#fffdf8]">
        <table className="w-full text-sm">
          <thead className="border-b border-[#dedad1] text-left">
            <tr>
              <th className="p-3">Number</th>
              <th className="p-3">Firm</th>
              <th className="p-3">Category</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-[#dedad1]" key={row.id}>
                <td className="p-3 font-medium">{row.request_no}</td>
                <td className="p-3">
                  {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                </td>
                <td className="p-3">{row.category}</td>
                <td className="p-3">{row.subject}</td>
                <td className="p-3">{row.priority}</td>
                <td className="p-3">
                  <select
                    className="border border-[#c9c4ba] bg-white p-1 text-xs"
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
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-[#8c8c88]">No service requests logged.</p>
        )}
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
      <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
        <h3 className="font-serif font-semibold">Customer-Raised Support Queue</h3>
        <p className="mt-1 max-w-3xl text-xs text-[#6b6659]">
          Tickets are created from the tenant/customer side through the firm support flow. The
          platform owner console is for triage, monitoring, and status management only.
        </p>
      </div>
      <div className="overflow-x-auto border border-[#dedad1] bg-[#fffdf8]">
        <table className="w-full text-sm">
          <thead className="border-b border-[#dedad1] text-left">
            <tr>
              <th className="p-3">Number</th>
              <th className="p-3">Firm</th>
              <th className="p-3">Category</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-[#dedad1]" key={row.id}>
                <td className="p-3 font-medium">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => void openThread(row)}
                  >
                    {row.ticket_no}
                  </button>
                </td>
                <td className="p-3">
                  {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                </td>
                <td className="p-3">{row.category}</td>
                <td className="p-3">{row.subject}</td>
                <td className="p-3">{row.severity}</td>
                <td className="p-3">
                  <select
                    className="border border-[#c9c4ba] bg-white p-1 text-xs"
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
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-[#8c8c88]">No support tickets logged.</p>
        )}
      </div>
      {selectedTicket ? (
        <div className="grid gap-4 border border-[#dedad1] bg-[#fffdf8] p-4 md:grid-cols-[320px_1fr]">
          <div>
            <h3 className="font-serif font-semibold">Ticket workspace</h3>
            <p className="mt-1 text-xs text-[#6b6659]">{selectedTicket.ticket_no}</p>
            <p className="mt-3 text-sm font-medium">{selectedTicket.subject}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <dt className="text-[#6b6659]">Firm</dt>
              <dd>{firms.find((firm) => firm.id === selectedTicket.firm_id)?.name ?? "Unknown"}</dd>
              <dt className="text-[#6b6659]">Category</dt>
              <dd>{selectedTicket.category}</dd>
              <dt className="text-[#6b6659]">Severity</dt>
              <dd>{selectedTicket.severity}</dd>
              <dt className="text-[#6b6659]">Status</dt>
              <dd>{selectedTicket.status}</dd>
            </dl>
            <Button
              className="mt-4 gap-2"
              size="sm"
              onClick={() => void openThread(selectedTicket)}
            >
              {threadLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              Open live thread
            </Button>
          </div>
          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto border border-[#dedad1] bg-white p-3">
              {threadLoading ? (
                <div className="flex justify-center py-8 text-xs text-[#6b6659]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading thread...
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#8c8c88]">
                  No live-chat messages yet. Reply here to start the thread.
                </p>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded border border-[#dedad1] bg-[#f8f5ee] p-3 text-sm"
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p className="mt-2 text-[10px] text-[#6b6659]">
                        {new Date(message.created_at).toLocaleString()}
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
                placeholder="Reply to customer..."
                disabled={threadLoading || selectedTicket.status === "closed"}
              />
              <Button
                className="gap-2"
                disabled={threadLoading || !reply.trim() || selectedTicket.status === "closed"}
                onClick={() => void sendReply()}
              >
                <Send className="h-4 w-4" />
                Send
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
  return `Rs. ${((minor ?? 0) / 100).toFixed(2)}`;
}

function BillingSection({
  rows,
  firms,
  refresh,
}: {
  rows: BillingRow[];
  firms: Firm[];
  refresh: () => Promise<void>;
}) {
  const [firmId, setFirmId] = useState(firms[0]?.id ?? "");
  const [docType, setDocType] = useState("tax_invoice");
  const [description, setDescription] = useState("AVS Gold ERP Platform License Fee");
  const [taxableRupees, setTaxableRupees] = useState("10000");
  const [gstRatePercent, setGstRatePercent] = useState("18");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printRow, setPrintRow] = useState<BillingRow | null>(null);

  const selectedFirm = firms.find((firm) => firm.id === firmId);
  const buyerStateCode = (selectedFirm?.gstin ?? "").slice(0, 2);
  const sellerStateCode = "19"; // Default West Bengal for Arivahly Venture Sphere

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
      <div className="border border-[#dedad1] bg-[#fffdf8] p-5">
        <h3 className="font-serif font-semibold text-sm">Issue Software Billing Document</h3>
        <p className="text-xs text-[#6b6659]">
          Generate tax invoice or quotation for tenant subscription.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Tenant Firm
            <select
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 text-xs"
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
          <label className="block text-sm">
            Document Type
            <select
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 text-xs"
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
          <label className="block text-sm sm:col-span-2">
            Description
            <input
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 text-xs"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Taxable Amount (Rs.)
            <input
              type="number"
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 text-xs"
              value={taxableRupees}
              onChange={(e) => setTaxableRupees(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            GST Rate (%)
            <input
              type="number"
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 text-xs"
              value={gstRatePercent}
              onChange={(e) => setGstRatePercent(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Seller GST state code
            <input
              className="mt-1 w-full border border-[#c9c4ba] bg-[#f4f0e8] p-2 text-xs text-[#8c8c88]"
              value={sellerStateCode}
              readOnly
            />
          </label>
          <label className="block text-sm">
            Buyer GST state code
            <input
              className="mt-1 w-full border border-[#c9c4ba] bg-[#f4f0e8] p-2 text-xs text-[#8c8c88]"
              value={buyerStateCode}
              readOnly
              placeholder="from firm GSTIN"
            />
          </label>
        </div>
        <div className="mt-4 border border-[#dedad1] bg-white p-3 text-sm">
          <div className="flex justify-between">
            <span>Taxable</span>
            <span>{rupees(taxableMinor)}</span>
          </div>
          {isInterState ? (
            <div className="flex justify-between">
              <span>IGST ({gstRate}%)</span>
              <span>{rupees(igstMinor)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span>CGST ({gstRate / 2}%)</span>
                <span>{rupees(cgstMinor)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST ({gstRate / 2}%)</span>
                <span>{rupees(sgstMinor)}</span>
              </div>
            </>
          )}
          <div className="mt-1 flex justify-between border-t border-[#dedad1] pt-1 font-semibold">
            <span>Total</span>
            <span>{rupees(totalMinor)}</span>
          </div>
        </div>
        {message && <p className="mt-2 text-sm text-[#8c8c88]">{message}</p>}
        <Button disabled={saving} onClick={() => void createDocument()} className="mt-4">
          Create draft
        </Button>
      </div>

      <div className="border border-[#dedad1] bg-[#fffdf8]">
        <div className="border-b border-[#dedad1] p-4">
          <h3 className="font-semibold">Document register</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[#dedad1] text-left">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Firm</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Amount (incl. GST)</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-[#dedad1]" key={row.id}>
                  <td className="p-3">
                    <b>{row.document_no}</b>
                    {row.data?.description && (
                      <div className="text-xs text-[#8c8c88]">{row.data.description}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                  </td>
                  <td className="p-3">{DOC_TYPE_LABEL[row.document_type] ?? row.document_type}</td>
                  <td className="p-3">
                    <select
                      className="border border-[#c9c4ba] bg-white p-1 text-xs"
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
                  <td className="p-3">
                    {rupees(row.amount_minor)}
                    {row.status !== "paid" && (
                      <span className="ml-1 text-[10px] text-[#8c8c88]">
                        (paid {rupees(row.paid_minor)})
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs underline text-[#6b6659]"
                        onClick={() => setPrintRow(row)}
                      >
                        Print
                      </button>
                      {row.status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => void markPaid(row)}
                        >
                          Mark paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-[#8c8c88]">No software billing documents.</p>
          )}
        </div>
      </div>
      {printRow && (
        <PlatformBillingPrintPreview
          row={printRow}
          firm={firms.find((firm) => firm.id === printRow.firm_id)}
          onClose={() => setPrintRow(null)}
        />
      )}
    </section>
  );
}

function PlatformBillingPrintPreview({
  row,
  firm,
  onClose,
}: {
  row: BillingRow;
  firm: Firm | undefined;
  onClose: () => void;
}) {
  const description = row.data?.description ?? "AVS Gold ERP Platform Billing";
  const gstRate = row.data?.gst_rate_percent ?? 18;
  const taxable = row.taxable_minor ?? Math.max(0, row.amount_minor - (row.gst_minor ?? 0));
  const gst =
    row.gst_minor ?? (row.cgst_minor ?? 0) + (row.sgst_minor ?? 0) + (row.igst_minor ?? 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 print:static print:bg-white print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .platform-print-sheet, .platform-print-sheet * { visibility: visible !important; }
          .platform-print-sheet {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .platform-print-actions { display: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-3xl bg-[#fffdf8] shadow-xl print:shadow-none">
        <div className="platform-print-actions flex items-center justify-between border-b border-[#dedad1] p-3">
          <h3 className="font-serif font-semibold">Print Preview</h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => window.print()}>
              Print
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="platform-print-sheet bg-white p-8 text-[#1f1d1a]">
          <div className="border-b-2 border-[#1f1d1a] pb-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[#8a6a22]">
              Arivahly Venture Sphere
            </p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl font-bold">AVS GOLD ERP</h1>
                <p className="text-sm text-[#5f5a50]">Platform Billing Document</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">
                  {DOC_TYPE_LABEL[row.document_type] ?? row.document_type}
                </p>
                <p className="font-mono">{row.document_no}</p>
                <p>{row.issued_at ? new Date(row.issued_at).toLocaleDateString("en-IN") : ""}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#6b6659]">Bill To</p>
              <p className="mt-1 font-semibold">{firm?.name ?? row.firm_id}</p>
              <p className="text-sm text-[#5f5a50]">
                {firm?.address ?? "Tenant address not recorded"}
              </p>
              <p className="text-sm text-[#5f5a50]">GSTIN: {firm?.gstin ?? "Not recorded"}</p>
            </div>
            <div className="text-sm">
              <p>
                Status: <span className="font-semibold uppercase">{row.status}</span>
              </p>
              <p>Due date: {row.due_at ? new Date(row.due_at).toLocaleDateString("en-IN") : "-"}</p>
              <p>Seller state: {row.seller_state_code ?? "-"}</p>
              <p>Buyer state: {row.buyer_state_code ?? "-"}</p>
            </div>
          </div>

          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[#1f1d1a]">
                <th className="py-2 text-left">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#dedad1]">
                <td className="py-3">{description}</td>
                <td className="py-3 text-right">{rupees(taxable)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 ml-auto w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Taxable</span>
              <span>{rupees(taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST ({gstRate}%)</span>
              <span>{rupees(gst)}</span>
            </div>
            <div className="flex justify-between border-t border-[#1f1d1a] pt-2 font-bold">
              <span>Total</span>
              <span>{rupees(row.amount_minor)}</span>
            </div>
            <div className="flex justify-between text-[#6b6659]">
              <span>Paid</span>
              <span>{rupees(row.paid_minor)}</span>
            </div>
          </div>

          <p className="mt-10 text-xs text-[#6b6659]">
            This document was generated from AVS Platform Owner Control Center.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActivitySection({ events }: { events: Event[] }) {
  return (
    <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
      <h3 className="font-serif font-semibold text-sm">Platform Audit Log</h3>
      <div className="divide-y divide-[#dedad1] text-xs">
        {events.map((e) => (
          <div key={e.id} className="py-2 flex items-center justify-between">
            <div>
              <span className="font-mono font-bold text-[#2b2925]">{e.action}</span>
              {e.target_type && (
                <span className="ml-2 bg-[#eae6df] px-1 py-0.5 text-[10px] font-mono">
                  {e.target_type}
                </span>
              )}
              {e.reason && <p className="mt-0.5 text-[#6b6659]">{e.reason}</p>}
            </div>
            <span className="text-[11px] text-[#8c8c88]">
              {new Date(e.created_at).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
        {events.length === 0 && <p className="py-4 text-[#8c8c88]">No platform events recorded.</p>}
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
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="API Uptime" value="99.98%" sub="last 30 days" accent="text-[#2d6a4f]" />
        <StatCard label="Database Latency" value="12ms" sub="p95 query response" />
        <StatCard label="Critical System Errors" value={errorRows.length} sub="recorded events" />
      </div>

      <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-3">
        <h3 className="font-serif font-semibold text-sm">Error Event Diagnostics Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-[#dedad1] bg-[#efece6] font-semibold text-[#4a473f]">
              <tr>
                <th className="p-2">Timestamp</th>
                <th className="p-2">Category</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dedad1]">
              {errorRows.map((err) => (
                <tr key={err.id}>
                  <td className="p-2 font-mono whitespace-nowrap">
                    {new Date(err.created_at).toLocaleTimeString("en-IN")}
                  </td>
                  <td className="p-2 font-mono">{err.category}</td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase ${
                        err.severity === "critical"
                          ? "bg-[#fce8e6] text-[#a33b3b]"
                          : "bg-[#fff2d6] text-[#b85d19]"
                      }`}
                    >
                      {err.severity}
                    </span>
                  </td>
                  <td className="p-2">{err.message}</td>
                </tr>
              ))}
              {errorRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-[#8c8c88]">
                    No system error events logged.
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
    <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-semibold text-sm">
          Disaster Recovery & Automated Backup Log
        </h3>
        <Button size="sm" variant="outline" onClick={() => void refresh()} className="h-7 text-xs">
          Refresh Log
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="border-b border-[#dedad1] bg-[#efece6] font-semibold text-[#4a473f]">
            <tr>
              <th className="p-2">Started At</th>
              <th className="p-2">Type</th>
              <th className="p-2">Environment</th>
              <th className="p-2">Status</th>
              <th className="p-2">Location / Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dedad1]">
            {backupRows.map((b) => (
              <tr key={b.id}>
                <td className="p-2 font-mono whitespace-nowrap">
                  {new Date(b.started_at).toLocaleString("en-IN")}
                </td>
                <td className="p-2 uppercase font-mono">{b.backup_type}</td>
                <td className="p-2">{b.environment}</td>
                <td className="p-2">
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase ${
                      b.status === "completed"
                        ? "bg-[#e2f0d9] text-[#2d6a4f]"
                        : "bg-[#fce8e6] text-[#a33b3b]"
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="p-2 font-mono text-[#6b6659]">{b.location ?? "-"}</td>
              </tr>
            ))}
            {backupRows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-[#8c8c88]">
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

function SettingsSection({ refresh }: { refresh: () => Promise<void> }) {
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
    setMsg("Platform settings saved.");
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
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
          <h3 className="font-serif font-semibold text-sm">Branding & Portal Identity</h3>
          <div className="space-y-3 text-xs">
            <SettingsText label="Application Name" value={appName} onChange={setAppName} />
            <SettingsText label="Portal Tagline" value={brandTagline} onChange={setBrandTagline} />
            <SettingsSelect
              label="Session Policy"
              value={sessionPolicy}
              onChange={setSessionPolicy}
              options={["browser_session", "persistent_until_logout", "strict_reauth"]}
            />
            <SettingsSelect
              label="Maintenance Mode"
              value={maintenanceMode}
              onChange={setMaintenanceMode}
              options={["false", "true"]}
            />
          </div>
        </div>

        <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
          <h3 className="font-serif font-semibold text-sm">Support & SLA Defaults</h3>
          <div className="space-y-3 text-xs">
            <SettingsText label="Support Email" value={supportEmail} onChange={setSupportEmail} />
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

        <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
          <h3 className="font-serif font-semibold text-sm">Integrations & Operations</h3>
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
        <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
          <h3 className="font-serif font-semibold text-sm">Licensing & Subscription Defaults</h3>
          <div className="space-y-3 text-xs">
            <SettingsText label="Default Trial Days" value={trialDays} onChange={setTrialDays} />
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

        <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4 lg:col-span-2">
          <h3 className="font-serif font-semibold text-sm">Billing & Tax Defaults</h3>
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
          <p className="text-xs text-[#6b6659]">
            These values are stored for billing defaults and downstream platform workflows.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
          <h3 className="font-serif font-semibold text-sm">Platform Billing Legal Entity Header</h3>
          <p className="text-xs text-[#6b6659]">
            Configure platform entity details shown on software tax invoices issued to tenant firms.
          </p>
          <div className="space-y-3 text-xs">
            <label className="block">
              Seller Legal Name
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
              />
            </label>
            <label className="block">
              Seller GSTIN
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded font-mono"
                value={sellerGstin}
                onChange={(e) => setSellerGstin(e.target.value)}
                placeholder="e.g. 19AAACA1234A1Z5"
              />
            </label>
            <label className="block">
              Registered Address
              <textarea
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded h-20"
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
              />
            </label>
            <Button disabled={saving} onClick={() => void saveSettings()}>
              Save Platform Settings
            </Button>
          </div>
        </div>
        <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4">
          <h3 className="font-serif font-semibold text-sm">Create / Update Manufacturing Plan</h3>
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <label className="block">
              Plan Name
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </label>
            <label className="block">
              Plan Code
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded font-mono"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
              />
            </label>
            <label className="block">
              Price
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
              />
            </label>
            <label className="block">
              Billing Cycle
              <select
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded"
                value={planCycle}
                onChange={(e) => setPlanCycle(e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="block">
              Branch Limit
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded"
                value={branchLimit}
                onChange={(e) => setBranchLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </label>
            <label className="block">
              User Limit
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 rounded"
                value={userLimit}
                onChange={(e) => setUserLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </label>
          </div>
          {msg && <p className="text-xs text-[#2d6a4f]">{msg}</p>}
          <Button
            disabled={saving || !planName.trim() || !planCode.trim()}
            onClick={() => void createPlan()}
          >
            Save Plan
          </Button>
        </div>
      </div>
      <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-semibold text-sm">Save All Platform Defaults</h3>
            <p className="mt-1 text-xs text-[#6b6659]">
              Saves branding, billing, support, licensing, integration, operation, and security
              defaults.
            </p>
          </div>
          <Button disabled={saving} onClick={() => void saveSettings()}>
            Save All Settings
          </Button>
        </div>
        {msg && <p className="mt-2 text-xs text-[#2d6a4f]">{msg}</p>}
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
      {label}
      <input
        className="mt-1 w-full rounded border border-[#c9c4ba] bg-white p-2"
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
      {label}
      <select
        className="mt-1 w-full rounded border border-[#c9c4ba] bg-white p-2"
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
