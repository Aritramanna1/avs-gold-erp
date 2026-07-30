// Hallmark · macrostructure: operations console · tone: authoritative · anchor hue: legacy gold
import { createFileRoute } from "@tanstack/react-router";
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
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/platform")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  component: PlatformOwnerConsole,
});

type Firm = { id: string; name: string; slug: string; is_active: boolean; created_at: string };
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
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", session.session.user.id);
    const isSaasAdmin =
      !roles.error &&
      ((roles.data ?? []) as Array<{ role?: string }>).some(
        (r) => r.role === "saas_admin" || r.role === "SaaS Admin",
      );
    setAuthorized(isSaasAdmin);
    if (!isSaasAdmin) {
      setLoading(false);
      return;
    }
    const [
      orgs,
      subs,
      planRows,
      audit,
      userRows,
      branchRows,
      requests,
      tickets,
      alerts,
      backups,
      featureRows,
      requestList,
      ticketList,
      billingList,
    ] = await Promise.all([
      supabase
        .from("organizations" as never)
        .select("id,name,slug,is_active,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_subscriptions" as never)
        .select("organization_id,status,trial_ends_at,renews_at,plan_id"),
      supabase
        .from("platform_plans" as never)
        .select("id,name,code,price_minor")
        .eq("is_active", true),
      supabase
        .from("platform_audit_events" as never)
        .select("id,action,target_type,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("user_profiles" as never).select("id", { count: "exact", head: true }),
      supabase.from("branches" as never).select("id", { count: "exact", head: true }),
      supabase
        .from("platform_service_requests" as never)
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(closed,rejected)"),
      supabase
        .from("platform_support_tickets" as never)
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(closed,resolved)"),
      supabase
        .from("platform_alerts" as never)
        .select("id", { count: "exact", head: true })
        .eq("severity", "critical")
        .is("acknowledged_at", null),
      supabase
        .from("platform_backup_runs" as never)
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("organization_features" as never)
        .select("organization_id,feature_key,enabled,source"),
      supabase
        .from("platform_service_requests" as never)
        .select("id,request_no,firm_id,category,subject,priority,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("platform_billing_documents" as never)
        .select(
          "id,firm_id,document_no,document_type,status,amount_minor,paid_minor,due_at,issued_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("platform_support_tickets" as never)
        .select("id,ticket_no,firm_id,category,subject,severity,priority,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const firstError =
      orgs.error ||
      subs.error ||
      planRows.error ||
      audit.error ||
      userRows.error ||
      branchRows.error ||
      requests.error ||
      tickets.error ||
      alerts.error ||
      backups.error ||
      featureRows.error;
    if (firstError || requestList.error || ticketList.error || billingList.error)
      setError("One or more control-plane queries failed. Retry or inspect platform RLS.");
    setFirms((orgs.data ?? []) as Firm[]);
    setSubscriptions((subs.data ?? []) as Subscription[]);
    setPlans((planRows.data ?? []) as Plan[]);
    setEvents((audit.data ?? []) as Event[]);
    setUsers(userRows.count ?? 0);
    setBranches(branchRows.count ?? 0);
    setServiceRequests(requests.count ?? 0);
    setSupportTickets(tickets.count ?? 0);
    setCriticalAlerts(alerts.count ?? 0);
    setFailedBackups(backups.count ?? 0);
    setFeatures((featureRows.data ?? []) as Feature[]);
    setRequestRows((requestList.data ?? []) as RequestRow[]);
    setTicketRows((ticketList.data ?? []) as TicketRow[]);
    setBillingRows((billingList.data ?? []) as BillingRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);
  const trialSubs = subscriptions.filter((s) => s.status === "trial");
  const expiringTrials = trialSubs.filter(
    (s) => s.trial_ends_at && new Date(s.trial_ends_at).getTime() - Date.now() < 30 * 86400000,
  );
  const overdue = subscriptions.filter((s) => s.status === "past_due" || s.status === "suspended");
  const filteredFirms = useMemo(
    () => firms.filter((f) => `${f.name} ${f.slug}`.toLowerCase().includes(search.toLowerCase())),
    [firms, search],
  );

  if (authorized === false)
    return (
      <div className="p-8">
        <div className="max-w-lg border border-red-200 bg-white p-6">
          <h1 className="font-serif text-2xl">Platform access denied</h1>
          <p className="mt-2 text-sm text-[#8c8c88]">
            This application is restricted to SaaS Admin users.
          </p>
        </div>
      </div>
    );
  if (authorized === null || loading)
    return (
      <div className="min-h-screen bg-[#f4f0e8] p-8">
        <div className="mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-8 w-80 bg-[#dedad1]" />
          <div className="h-16 bg-[#dedad1]" />
          <div className="h-72 bg-[#dedad1]" />
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f4f0e8] text-[#09090b]">
      <header className="border-b border-[#dedad1] bg-[#fffdf8] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8c8c88]">
              AVS / platform operations
            </p>
            <h1 className="font-serif text-2xl md:text-3xl">Owner Control Center</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="border border-[#b99b5a] px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
              SaaS Admin
            </span>
            <Button variant="outline" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </div>
        <nav className="mx-auto mt-5 flex max-w-[1600px] gap-1 overflow-x-auto">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm ${view === key ? "border-[#b99b5a] text-[#09090b]" : "border-transparent text-[#8c8c88]"}`}
              onClick={() => setView(key)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-8">
        {error && (
          <div className="flex items-center gap-2 border border-red-200 bg-white p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
        {view === "overview" && (
          <Overview
            firms={firms}
            subscriptions={subscriptions}
            plans={plans}
            events={events}
            users={users}
            branches={branches}
            expiringTrials={expiringTrials.length}
            overdue={overdue.length}
            serviceRequests={serviceRequests}
            supportTickets={supportTickets}
            criticalAlerts={criticalAlerts}
            failedBackups={failedBackups}
            onView={setView}
          />
        )}
        {view === "firms" && (
          <FirmsView
            firms={filteredFirms}
            subscriptions={subscriptions}
            plans={plans}
            search={search}
            setSearch={setSearch}
            onSaved={() => void refresh()}
          />
        )}
        {view === "subscriptions" && (
          <SubscriptionsView subscriptions={subscriptions} firms={firms} plans={plans} />
        )}
        {view === "licensing" && (
          <LicensingView firms={firms} features={features} onSaved={() => void refresh()} />
        )}
        {view === "requests" && (
          <RequestsView rows={requestRows} firms={firms} onSaved={() => void refresh()} />
        )}
        {view === "tickets" && (
          <TicketsView rows={ticketRows} firms={firms} onSaved={() => void refresh()} />
        )}
        {view === "billing" && (
          <BillingView rows={billingRows} firms={firms} onSaved={() => void refresh()} />
        )}
        {view === "activity" && <ActivityView events={events} />}
        {view === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

function Overview({
  firms,
  subscriptions,
  plans,
  events,
  users,
  branches,
  expiringTrials,
  overdue,
  serviceRequests,
  supportTickets,
  criticalAlerts,
  failedBackups,
  onView,
}: {
  firms: Firm[];
  subscriptions: Subscription[];
  plans: Plan[];
  events: Event[];
  users: number;
  branches: number;
  expiringTrials: number;
  overdue: number;
  serviceRequests: number;
  supportTickets: number;
  criticalAlerts: number;
  failedBackups: number;
  onView: (v: View) => void;
}) {
  const active = firms.filter((f) => f.is_active).length;
  const queues = [
    {
      label: "Trials expiring within 30 days",
      value: expiringTrials,
      icon: Clock3,
      action: () => onView("subscriptions"),
    },
    {
      label: "Past-due or suspended subscriptions",
      value: overdue,
      icon: CircleDollarSign,
      action: () => onView("subscriptions"),
    },
    {
      label: "Open service requests",
      value: serviceRequests,
      icon: LifeBuoy,
      action: () => onView("activity"),
    },
    {
      label: "Open support tickets",
      value: supportTickets,
      icon: ShieldAlert,
      action: () => onView("activity"),
    },
    {
      label: "Critical security alerts",
      value: criticalAlerts,
      icon: AlertTriangle,
      action: () => onView("activity"),
    },
    {
      label: "Failed backup runs",
      value: failedBackups,
      icon: Database,
      action: () => onView("activity"),
    },
    {
      label: "Firms needing review",
      value: firms.filter((f) => !f.is_active).length,
      icon: FileWarning,
      action: () => onView("firms"),
    },
  ];
  return (
    <>
      <section className="border-b border-[#dedad1] pb-5">
        <p className="text-sm text-[#8c8c88]">Today’s control-plane brief</p>
        <h2 className="mt-1 font-serif text-3xl">What needs your attention?</h2>
      </section>
      <section className="grid grid-cols-2 border border-[#dedad1] bg-[#fffdf8] md:grid-cols-4">
        <Summary label="Active firms" value={active} detail={`of ${firms.length} total`} />
        <Summary
          label="Trial firms"
          value={subscriptions.filter((s) => s.status === "trial").length}
          detail="current trials"
        />
        <Summary label="Branches" value={branches} detail="across all firms" />
        <Summary label="Active users" value={users} detail={`${plans.length} active plans`} />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="border border-[#dedad1] bg-[#fffdf8]">
          <div className="border-b border-[#dedad1] p-4">
            <h3 className="font-semibold">Attention queue</h3>
            <p className="text-sm text-[#8c8c88]">
              Click an item to move directly to the management view.
            </p>
          </div>
          <div className="divide-y divide-[#dedad1]">
            {queues.map(({ label, value, icon: Icon, action }) => (
              <button
                key={label}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-[#f4f0e8]"
                onClick={action}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-[#b99b5a]" />
                  <span className="text-sm">{label}</span>
                </span>
                <span className="flex items-center gap-2 font-semibold">
                  {value}
                  <ChevronRight className="h-4 w-4 text-[#8c8c88]" />
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="border border-[#dedad1] bg-[#fffdf8]">
          <div className="border-b border-[#dedad1] p-4">
            <h3 className="font-semibold">Live platform signal</h3>
            <p className="text-sm text-[#8c8c88]">Recorded facts from the control plane.</p>
          </div>
          <div className="space-y-4 p-4 text-sm">
            <Signal label="Audit events loaded" value={events.length} />
            <Signal label="Plans available" value={plans.length} />
            <Signal label="Subscriptions" value={subscriptions.length} />
            <Signal label="Platform status" value="Operational" good />
          </div>
        </div>
      </section>
      <ActivityView events={events.slice(0, 8)} />
    </>
  );
}
function Summary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="border-r border-b border-[#dedad1] p-4 last:border-r-0">
      <p className="text-xs text-[#8c8c88]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#8c8c88]">{detail}</p>
    </div>
  );
}
function Signal({ label, value, good }: { label: string; value: string | number; good?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#dedad1] pb-3">
      <span className="text-[#8c8c88]">{label}</span>
      <span className={good ? "text-[#147d52]" : "font-medium"}>{value}</span>
    </div>
  );
}
function FirmsView({
  firms,
  subscriptions,
  plans,
  search,
  setSearch,
  onSaved,
}: {
  firms: Firm[];
  subscriptions: Subscription[];
  plans: Plan[];
  search: string;
  setSearch: (s: string) => void;
  onSaved: () => void;
}) {
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? "Unassigned";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function createFirm() {
    if (!name.trim() || !slug.trim()) {
      setMessage("Firm name and slug are required.");
      return;
    }
    const { error } = await supabase
      .from("organizations" as never)
      .insert({ name: name.trim(), slug: slug.trim().toLowerCase(), is_active: true } as never);
    if (error) {
      setMessage(error.message);
      return;
    }
    setName("");
    setSlug("");
    setMessage("Firm created.");
    onSaved();
  }
  return (
    <section className="space-y-4">
      <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
        <h3 className="font-semibold">Create firm</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className="border border-[#c9c4ba] bg-white p-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Firm name"
          />
          <input
            className="border border-[#c9c4ba] bg-white p-2"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="tenant-slug"
          />
          <Button onClick={() => void createFirm()}>Create</Button>
        </div>
        {message && <p className="mt-2 text-sm text-[#8c8c88]">{message}</p>}
      </div>
      <div className="border border-[#dedad1] bg-[#fffdf8]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dedad1] p-4">
          <div>
            <h2 className="font-serif text-2xl">Firms</h2>
            <p className="text-sm text-[#8c8c88]">
              Tenant health, account status and subscription position.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8c8c88]" />
            <Input
              className="w-64 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search firms"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[#dedad1] text-left">
              <tr>
                <th className="p-3">Firm</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {firms.map((firm) => {
                const sub = subscriptions.find((s) => s.organization_id === firm.id);
                return (
                  <tr className="border-b border-[#dedad1] last:border-0" key={firm.id}>
                    <td className="p-3">
                      <b>{firm.name}</b>
                      <div className="text-xs text-[#8c8c88]">{firm.slug}</div>
                    </td>
                    <td className="p-3">{sub ? planName(sub.plan_id) : "—"}</td>
                    <td className="p-3">
                      {firm.is_active ? (
                        <span className="text-[#147d52]">Active</span>
                      ) : (
                        <span className="text-[#b42318]">Suspended</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-[#8c8c88]">
                      {new Date(firm.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <ArrowUpRight className="h-4 w-4 text-[#b99b5a]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {firms.length === 0 && (
            <p className="p-8 text-center text-sm text-[#8c8c88]">No firms match this search.</p>
          )}
        </div>
      </div>
    </section>
  );
}
function SubscriptionsView({
  subscriptions,
  firms,
  plans,
}: {
  subscriptions: Subscription[];
  firms: Firm[];
  plans: Plan[];
}) {
  const firmName = (id: string) => firms.find((f) => f.id === id)?.name ?? id.slice(0, 8);
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? "Unassigned";
  return (
    <section className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="border-b border-[#dedad1] p-4">
        <h2 className="font-serif text-2xl">Subscriptions & trials</h2>
        <p className="text-sm text-[#8c8c88]">Live subscription state from the platform ledger.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[#dedad1] text-left">
            <tr>
              <th className="p-3">Firm</th>
              <th className="p-3">Plan</th>
              <th className="p-3">State</th>
              <th className="p-3">Trial ends</th>
              <th className="p-3">Renews</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr className="border-b border-[#dedad1] last:border-0" key={s.organization_id}>
                <td className="p-3">{firmName(s.organization_id)}</td>
                <td className="p-3">{planName(s.plan_id)}</td>
                <td className="p-3">{s.status}</td>
                <td className="p-3">
                  {s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3">
                  {s.renews_at ? new Date(s.renews_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ActivityView({ events }: { events: Event[] }) {
  return (
    <section className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="border-b border-[#dedad1] p-4">
        <h2 className="font-serif text-2xl">Recent platform activity</h2>
        <p className="text-sm text-[#8c8c88]">Audited events, newest first.</p>
      </div>
      <div className="divide-y divide-[#dedad1]">
        {events.length === 0 ? (
          <p className="p-6 text-sm text-[#8c8c88]">No platform events recorded.</p>
        ) : (
          events.map((e) => (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={e.id}>
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-[#b99b5a]" />
                <div>
                  <p className="text-sm font-medium">{e.action}</p>
                  <p className="text-xs text-[#8c8c88]">
                    {e.target_type ?? "platform"}
                    {e.reason ? ` · ${e.reason}` : ""}
                  </p>
                </div>
              </div>
              <time className="text-xs text-[#8c8c88]">
                {new Date(e.created_at).toLocaleString()}
              </time>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
function SettingsView() {
  const [rows, setRows] = useState<Array<{ key: string; value: unknown }>>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function load() {
    const { data } = await supabase
      .from("platform_settings" as never)
      .select("key,value")
      .order("key");
    setRows((data ?? []) as Array<{ key: string; value: unknown }>);
  }
  useEffect(() => {
    void load();
  }, []);
  function selectRow(row: { key: string; value: unknown }) {
    setKey(row.key);
    setValue(JSON.stringify(row.value, null, 2));
    setMessage(null);
  }
  async function save() {
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setMessage("Value must be valid JSON.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc(
      "set_platform_setting" as never,
      { p_key: key, p_value: parsed, p_reason: reason } as never,
    );
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Setting saved and audited.");
    setReason("");
    await load();
  }
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <div className="border border-[#dedad1] bg-[#fffdf8]">
        <div className="border-b border-[#dedad1] p-4">
          <h2 className="font-serif text-2xl">Platform settings</h2>
          <p className="text-sm text-[#8c8c88]">
            Global configuration records. Changes require a reason and are audited.
          </p>
        </div>
        <div className="divide-y divide-[#dedad1]">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-[#8c8c88]">No platform settings have been configured.</p>
          ) : (
            rows.map((row) => (
              <button
                className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-[#f4f0e8]"
                key={row.key}
                onClick={() => selectRow(row)}
              >
                <span className="font-medium">{row.key}</span>
                <code className="max-w-[60%] truncate text-xs text-[#8c8c88]">
                  {JSON.stringify(row.value)}
                </code>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
        <h3 className="font-semibold">Edit global value</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Key
            <input
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="platform.trial_days"
            />
          </label>
          <label className="block text-sm">
            JSON value
            <textarea
              className="mt-1 min-h-32 w-full border border-[#c9c4ba] bg-white p-2 font-mono text-xs"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Reason
            <textarea
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this setting changing?"
            />
          </label>
          {message && <p className="text-sm text-[#8c8c88]">{message}</p>}
          <Button disabled={saving || !key.trim() || !reason.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : "Save setting"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function LicensingView({
  firms,
  features,
  onSaved,
}: {
  firms: Firm[];
  features: Feature[];
  onSaved: () => void;
}) {
  const [firmId, setFirmId] = useState(firms[0]?.id ?? "");
  const [featureKey, setFeatureKey] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const keys = Array.from(new Set(features.map((f) => f.feature_key))).sort();
  useEffect(() => {
    if (!firmId && firms[0]) setFirmId(firms[0].id);
  }, [firms, firmId]);
  async function save(enabled: boolean) {
    setMessage(null);
    setSaving(true);
    const { error } = await supabase.rpc(
      "set_organization_feature" as never,
      {
        p_organization_id: firmId,
        p_feature_key: featureKey,
        p_enabled: enabled,
        p_reason: reason,
      } as never,
    );
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Feature ${enabled ? "enabled" : "disabled"} and audited.`);
    setReason("");
    onSaved();
  }
  return (
    <section className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="border-b border-[#dedad1] p-4">
        <h2 className="font-serif text-2xl">Module licensing</h2>
        <p className="text-sm text-[#8c8c88]">
          Firm entitlements are changed through an audited platform RPC.
        </p>
      </div>
      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <h3 className="font-semibold">Current entitlements</h3>
          {features.length === 0 ? (
            <p className="mt-3 text-sm text-[#8c8c88]">No feature entitlements are configured.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#dedad1]">
              {features.map((f) => (
                <div
                  className="flex items-center justify-between py-3 text-sm"
                  key={`${f.organization_id}-${f.feature_key}`}
                >
                  <span>
                    {firms.find((firm) => firm.id === f.organization_id)?.name ??
                      f.organization_id.slice(0, 8)}{" "}
                    · {f.feature_key}
                  </span>
                  <span className={f.enabled ? "text-[#147d52]" : "text-[#b42318]"}>
                    {f.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            Firm
            <select
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={firmId}
              onChange={(e) => setFirmId(e.target.value)}
            >
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Feature
            <select
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
            >
              <option value="">Select an existing feature</option>
              {keys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Reason
            <textarea
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {message && <p className="text-sm text-[#8c8c88]">{message}</p>}
          <div className="flex gap-2">
            <Button
              disabled={saving || !firmId || !featureKey || !reason.trim()}
              onClick={() => void save(true)}
            >
              Enable
            </Button>
            <Button
              variant="outline"
              disabled={saving || !firmId || !featureKey || !reason.trim()}
              onClick={() => void save(false)}
            >
              Disable
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RequestsView({
  rows,
  firms,
  onSaved,
}: {
  rows: RequestRow[];
  firms: Firm[];
  onSaved: () => void;
}) {
  const [filter, setFilter] = useState("");
  const visible = rows.filter((row) =>
    `${row.request_no} ${row.subject} ${row.category}`.toLowerCase().includes(filter.toLowerCase()),
  );
  async function update(id: string, status: string) {
    const { error } = await supabase
      .from("platform_service_requests" as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (!error) onSaved();
  }
  return (
    <section className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dedad1] p-4">
        <div>
          <h2 className="font-serif text-2xl">Service requests</h2>
          <p className="text-sm text-[#8c8c88]">Live tenant requests with status control.</p>
        </div>
        <Input
          className="w-64"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search requests"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[#dedad1] text-left">
            <tr>
              <th className="p-3">Request</th>
              <th className="p-3">Firm</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr className="border-b border-[#dedad1]" key={row.id}>
                <td className="p-3">
                  <b>{row.request_no}</b>
                  <div className="text-xs text-[#8c8c88]">
                    {row.subject} · {row.category}
                  </div>
                </td>
                <td className="p-3">
                  {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                </td>
                <td className="p-3">{row.priority}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">
                  <select
                    className="border border-[#c9c4ba] bg-white p-1"
                    value={row.status}
                    onChange={(e) => void update(row.id, e.target.value)}
                  >
                    <option value="new">New</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="in_review">In review</option>
                    <option value="assigned">Assigned</option>
                    <option value="waiting_customer">Waiting customer</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="p-8 text-center text-sm text-[#8c8c88]">No service requests found.</p>
        )}
      </div>
    </section>
  );
}

function TicketsView({
  rows,
  firms,
  onSaved,
}: {
  rows: TicketRow[];
  firms: Firm[];
  onSaved: () => void;
}) {
  const [filter, setFilter] = useState("");
  const visible = rows.filter((row) =>
    `${row.ticket_no} ${row.subject} ${row.category}`.toLowerCase().includes(filter.toLowerCase()),
  );
  async function update(id: string, status: string) {
    const { error } = await supabase.rpc(
      "transition_platform_support_ticket" as never,
      {
        p_ticket_id: id,
        p_status: status,
      } as never,
    );
    if (!error) onSaved();
  }
  return (
    <section className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dedad1] p-4">
        <div>
          <h2 className="font-serif text-2xl">Support tickets</h2>
          <p className="text-sm text-[#8c8c88]">
            Live support queue with severity and resolution workflow.
          </p>
        </div>
        <Input
          className="w-64"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search tickets"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[#dedad1] text-left">
            <tr>
              <th className="p-3">Ticket</th>
              <th className="p-3">Firm</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr className="border-b border-[#dedad1]" key={row.id}>
                <td className="p-3">
                  <b>{row.ticket_no}</b>
                  <div className="text-xs text-[#8c8c88]">
                    {row.subject} · {row.category}
                  </div>
                </td>
                <td className="p-3">
                  {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                </td>
                <td className="p-3">
                  {row.severity} / {row.priority}
                </td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">
                  <select
                    className="border border-[#c9c4ba] bg-white p-1"
                    value={row.status}
                    onChange={(e) => void update(row.id, e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="in_progress">In progress</option>
                    <option value="waiting_customer">Waiting customer</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="reopened">Reopened</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="p-8 text-center text-sm text-[#8c8c88]">No support tickets found.</p>
        )}
      </div>
    </section>
  );
}

function BillingView({
  rows,
  firms,
  onSaved,
}: {
  rows: BillingRow[];
  firms: Firm[];
  onSaved: () => void;
}) {
  const [firmId, setFirmId] = useState(firms[0]?.id ?? "");
  const [type, setType] = useState("tax_invoice");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!firmId && firms[0]) setFirmId(firms[0].id);
  }, [firmId, firms]);
  async function createDocument() {
    const minor = Number.parseInt(amount, 10);
    if (!firmId || !Number.isInteger(minor) || minor < 0) {
      setMessage("Choose a firm and enter a valid amount in minor currency units.");
      return;
    }
    const documentNo = `AVS-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("platform_billing_documents" as never).insert({
      firm_id: firmId,
      document_no: documentNo,
      document_type: type,
      amount_minor: minor,
      paid_minor: 0,
      status: "draft",
      data: { currency: "INR" },
    } as never);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Created ${documentNo}.`);
    setAmount("");
    onSaved();
  }
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
      <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
        <h2 className="font-serif text-2xl">Software billing</h2>
        <p className="mt-1 text-sm text-[#8c8c88]">
          Platform invoices and receipts are separate from jewellery billing.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block text-sm">
            Firm
            <select
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={firmId}
              onChange={(e) => setFirmId(e.target.value)}
            >
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Document type
            <select
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {[
                "quotation",
                "proforma",
                "tax_invoice",
                "renewal_invoice",
                "credit_note",
                "payment_receipt",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Amount in minor units
            <input
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </label>
          {message && <p className="text-sm text-[#8c8c88]">{message}</p>}
          <Button onClick={() => void createDocument()}>Create draft</Button>
        </div>
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
                <th className="p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-[#dedad1]" key={row.id}>
                  <td className="p-3">{row.document_no}</td>
                  <td className="p-3">
                    {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                  </td>
                  <td className="p-3">{row.document_type}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">
                    ₹{(row.amount_minor / 100).toFixed(2)} / ₹{(row.paid_minor / 100).toFixed(2)}
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
