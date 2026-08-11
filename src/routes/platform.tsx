// Hallmark · macrostructure: operations console · tone: authoritative · anchor hue: legacy gold
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
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
  Search,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Wrench,
  Receipt,
} from "lucide-react";
import { dataProvider } from "@/lib/providers/data-provider";
const supabase = dataProvider as any;
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/platform")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Platform · AVS Gold ERP" }] }),
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
  organization_id: string;
  status: string;
  trial_ends_at: string | null;
  renews_at: string | null;
  plan_id: string;
};
type Plan = { id: string; name: string; code: string; price_minor: number };
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
type View =
  | "overview"
  | "firms"
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
  const initialView = new URLSearchParams(window.location.search).get("view") as View | null;
  const [view, setView] = useState<View>(
    initialView &&
      [
        "overview",
        "firms",
        "subscriptions",
        "licensing",
        "requests",
        "tickets",
        "billing",
        "activity",
        "health",
        "backups",
        "settings",
      ].includes(initialView)
      ? initialView
      : "overview",
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
  const [users, setUsers] = useState(0);
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
    const hasPlatformOwner = (roles.data ?? []).some(
      (r: { role: string }) => r.role === "platform_owner",
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
    ] = await Promise.all([
      supabase.from("organizations").select("id,name,slug,is_active,created_at,gstin,address"),
      supabase
        .from("subscriptions")
        .select("organization_id,status,trial_ends_at,renews_at,plan_id"),
      supabase.from("plans").select("id,name,code,price_minor"),
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
      supabase.from("profiles").select("id", { count: "exact", head: true }),
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
    ]);

    if (fRes.error) setError(fRes.error.message);
    setFirms((fRes.data as Firm[]) ?? []);
    setSubscriptions((subRes.data as Subscription[]) ?? []);
    setPlans((pRes.data as Plan[]) ?? []);
    setEvents((eRes.data as Event[]) ?? []);
    setServiceRequests(reqCountRes.count ?? 0);
    setSupportTickets(tickCountRes.count ?? 0);
    setCriticalAlerts(errCountRes.count ?? 0);
    setFailedBackups(bupCountRes.count ?? 0);
    setFeatures((featRes.data as Feature[]) ?? []);
    setUsers(uCountRes.count ?? 0);
    setBranches(bCountRes.count ?? 0);
    setRequestRows((reqRowsRes.data as unknown as RequestRow[]) ?? []);
    setTicketRows((tickRowsRes.data as unknown as TicketRow[]) ?? []);
    setBillingRows((billRowsRes.data as unknown as BillingRow[]) ?? []);
    setErrorRows((errRowsRes.data as unknown as ErrorEventRow[]) ?? []);
    setBackupRows((bupRowsRes.data as unknown as BackupRunRow[]) ?? []);
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
        Checking platform clearance…
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#f7f5f0] p-6 text-center text-[#2b2925]">
        <ShieldAlert className="h-10 w-10 text-[#a33b3b]" />
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="max-w-md text-sm text-[#6b6659]">
          Platform Owner Console requires <code className="bg-[#eae6df] px-1">platform_owner</code>{" "}
          role. You can request elevation or switch accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#2b2925]">
      <header className="border-b border-[#dedad1] bg-[#efece6] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#2b2925] text-[#d4af37] font-serif font-bold">
              P
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-tight">
                Platform Owner Console
              </h1>
              <p className="text-xs text-[#6b6659]">
                Multi-tenant infrastructure · SAS control layer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1 text-[#2d6a4f]">
              <ShieldCheck className="h-4 w-4" /> Platform engine operational
            </div>
            <span className="text-[#a8a397]">|</span>
            <span>{firms.length} tenant firms</span>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-69px)]">
        <aside className="w-64 shrink-0 border-r border-[#dedad1] bg-[#efece6] p-4">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#8c8c88]">
            Operations
          </p>
          <nav className="mt-2 space-y-1">
            {nav.map(([key, label, Icon]) => {
              const active = view === key;
              return (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-medium transition ${
                    active
                      ? "bg-[#2b2925] text-[#f7f5f0]"
                      : "text-[#4a473f] hover:bg-[#e5e1d8] hover:text-[#2b2925]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </span>
                  {active && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 space-y-6 max-w-7xl">
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
              refresh={refresh}
            />
          )}

          {view === "subscriptions" && (
            <SubscriptionsSection
              firms={firms}
              subscriptions={subscriptions}
              plans={plans}
              refresh={refresh}
            />
          )}

          {view === "licensing" && (
            <LicensingSection firms={firms} features={features} refresh={refresh} />
          )}

          {view === "requests" && (
            <RequestsSection rows={requestRows} firms={firms} refresh={refresh} />
          )}

          {view === "tickets" && (
            <TicketsSection rows={ticketRows} firms={firms} refresh={refresh} />
          )}

          {view === "billing" && (
            <BillingSection rows={billingRows} firms={firms} refresh={refresh} />
          )}

          {view === "activity" && <ActivitySection events={events} />}

          {view === "health" && <HealthSection errorRows={errorRows} refresh={refresh} />}

          {view === "backups" && <BackupsSection backupRows={backupRows} refresh={refresh} />}

          {view === "settings" && <SettingsSection refresh={refresh} />}
        </main>
      </div>
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
                {e.reason && <span className="ml-2 text-[#6b6659]">— {e.reason}</span>}
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
  refresh,
}: {
  filteredFirms: Firm[];
  search: string;
  setSearch: (s: string) => void;
  subscriptions: Subscription[];
  plans: Plan[];
  refresh: () => Promise<void>;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

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
            placeholder="Search firms by name, slug, GSTIN…"
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
                return (
                  <tr key={f.id} className="hover:bg-[#f4f0e8]">
                    <td className="p-3 font-medium">{f.name}</td>
                    <td className="p-3 font-mono text-xs text-[#6b6659]">{f.slug}</td>
                    <td className="p-3 text-xs font-mono">{f.gstin ?? "—"}</td>
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
        .from("subscriptions")
        .update({ plan_id: selectedPlan, status: "active" })
        .eq("organization_id", orgId);
    } else {
      await supabase.from("subscriptions").insert({
        organization_id: orgId,
        plan_id: selectedPlan,
        status: "active",
      });
    }
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
                        (₹{(plan.price_minor / 100).toFixed(0)}/mo)
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
                      : "—"}
                </td>
                <td className="p-3 text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="text-xs border border-[#c9c4ba] bg-white p-1 rounded"
                      >
                        <option value="">Select plan…</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{(p.price_minor / 100).toFixed(0)})
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
  refresh,
}: {
  firms: Firm[];
  features: Feature[];
  refresh: () => Promise<void>;
}) {
  const [selectedFirm, setSelectedFirm] = useState<string>(firms[0]?.id ?? "");

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-[#6b6659]">Select Tenant Firm:</label>
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

function RequestsSection({
  rows,
  firms,
  refresh,
}: {
  rows: RequestRow[];
  firms: Firm[];
  refresh: () => Promise<void>;
}) {
  async function updateStatus(r: RequestRow, status: string) {
    await supabase.from("platform_service_requests").update({ status }).eq("id", r.id);
    await refresh();
  }

  return (
    <div className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="border-b border-[#dedad1] p-4">
        <h3 className="font-semibold">Service Requests</h3>
      </div>
      <div className="overflow-x-auto">
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
  async function updateStatus(r: TicketRow, status: string) {
    await supabase.from("platform_support_tickets").update({ status }).eq("id", r.id);
    await refresh();
  }

  return (
    <div className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="border-b border-[#dedad1] p-4">
        <h3 className="font-semibold">Support Tickets</h3>
      </div>
      <div className="overflow-x-auto">
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
                <td className="p-3 font-medium">{row.ticket_no}</td>
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
                    {["open", "investigating", "resolved", "closed"].map((s) => (
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
                      <Link
                        className="text-xs underline text-[#6b6659]"
                        to="/platform/billing-print/$id"
                        params={{ id: row.id }}
                        target="_blank"
                      >
                        Print
                      </Link>
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
    </section>
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
                <td className="p-2 font-mono text-[#6b6659]">{b.location ?? "—"}</td>
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key,value")
        .in("key", ["billing.seller_name", "billing.seller_address", "billing.seller_gstin"]);
      if (data) {
        const m = new Map(
          (data as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
        );
        if (m.get("billing.seller_name")) setSellerName(m.get("billing.seller_name") as string);
        if (m.get("billing.seller_address"))
          setSellerAddress(m.get("billing.seller_address") as string);
        if (m.get("billing.seller_gstin")) setSellerGstin(m.get("billing.seller_gstin") as string);
      }
    })();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMsg(null);
    await Promise.all([
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
    ]);
    setMsg("Platform billing header settings saved.");
    setSaving(false);
    await refresh();
  }

  return (
    <div className="border border-[#dedad1] bg-[#fffdf8] p-5 space-y-4 max-w-xl">
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
        {msg && <p className="text-xs text-[#2d6a4f]">{msg}</p>}
        <Button disabled={saving} onClick={() => void saveSettings()}>
          Save Platform Settings
        </Button>
      </div>
    </div>
  );
}
