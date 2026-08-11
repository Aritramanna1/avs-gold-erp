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
      errorEvents,
      backupRuns,
    ] = await Promise.all([
      supabase
        .from("organizations" as never)
        .select("id,name,slug,is_active,created_at,gstin,address")
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
          "id,firm_id,document_no,document_type,status,amount_minor,paid_minor,due_at,issued_at,taxable_minor,cgst_minor,sgst_minor,igst_minor,gst_minor,buyer_state_code,seller_state_code,data",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("platform_support_tickets" as never)
        .select("id,ticket_no,firm_id,category,subject,severity,priority,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("platform_error_events" as never)
        .select("id,firm_id,reference_id,category,severity,context,message,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("platform_backup_runs" as never)
        .select(
          "id,backup_type,environment,status,location,error_message,started_at,finished_at,verified_at",
        )
        .order("started_at", { ascending: false })
        .limit(100),
    ]);
    const labeledErrors = (
      [
        ["organizations", orgs.error],
        ["organization_subscriptions", subs.error],
        ["platform_plans", planRows.error],
        ["platform_audit_events", audit.error],
        ["user_profiles count", userRows.error],
        ["branches count", branchRows.error],
        ["platform_service_requests count", requests.error],
        ["platform_support_tickets count", tickets.error],
        ["platform_alerts count", alerts.error],
        ["platform_backup_runs count", backups.error],
        ["organization_features", featureRows.error],
        ["platform_service_requests list", requestList.error],
        ["platform_support_tickets list", ticketList.error],
        ["platform_billing_documents list", billingList.error],
        ["platform_error_events list", errorEvents.error],
        ["platform_backup_runs list", backupRuns.error],
      ] as Array<[string, { message: string } | null]>
    ).filter(([, err]) => err);
    if (labeledErrors.length > 0) {
      // Every failed query's actual message and source table, not a blanket
      // "something failed" — a permission-denied query used to fall back to
      // an empty array and render as a real "0", indistinguishable from a
      // genuinely empty table. Now the failure is visible instead of
      // masquerading as data.
      setError(
        labeledErrors
          .map(([table, err]) => `${table}: ${err?.message ?? "unknown error"}`)
          .join(" · "),
      );
    }
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
    setErrorRows((errorEvents.data ?? []) as ErrorEventRow[]);
    setBackupRows((backupRuns.data ?? []) as BackupRunRow[]);
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
        {view === "health" && (
          <HealthView
            rows={errorRows}
            firms={firms}
            criticalAlerts={criticalAlerts}
            failedBackups={failedBackups}
          />
        )}
        {view === "backups" && <BackupsView rows={backupRows} />}
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

const SEVERITY_STYLE: Record<string, string> = {
  critical: "text-[#b42318]",
  error: "text-[#b42318]",
  warning: "text-[#a15c00]",
  info: "text-[#5c5750]",
};

function HealthView({
  rows,
  firms,
  criticalAlerts,
  failedBackups,
}: {
  rows: ErrorEventRow[];
  firms: Firm[];
  criticalAlerts: number;
  failedBackups: number;
}) {
  const [filter, setFilter] = useState("");
  const visible = rows.filter((row) =>
    `${row.message} ${row.category} ${row.context ?? ""}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const byCategory = new Map<string, number>();
  for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Errors (last 200)", rows.length],
          ["Critical alerts open", criticalAlerts],
          ["Failed backups", failedBackups],
          ["Distinct error categories", byCategory.size],
        ].map(([label, value]) => (
          <div key={label as string} className="border border-[#dedad1] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-wide text-[#8c8c88]">{label}</p>
            <p className="mt-1 text-2xl font-serif">{value}</p>
          </div>
        ))}
      </div>
      <div className="border border-[#dedad1] bg-[#fffdf8]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dedad1] p-4">
          <div>
            <h2 className="font-serif text-2xl">Live error feed</h2>
            <p className="text-sm text-[#8c8c88]">
              Every tenant-side error reported across all firms, newest first.
            </p>
          </div>
          <Input
            className="w-64"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search errors"
          />
        </div>
        <div className="max-h-[36rem] overflow-y-auto divide-y divide-[#dedad1]">
          {visible.length === 0 ? (
            <p className="p-6 text-sm text-[#8c8c88]">No errors reported. That's a good sign.</p>
          ) : (
            visible.map((row) => (
              <div className="p-4" key={row.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-sm font-medium ${SEVERITY_STYLE[row.severity] ?? ""}`}>
                    {row.message}
                  </p>
                  <time className="text-xs text-[#8c8c88]">
                    {new Date(row.created_at).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-xs text-[#8c8c88]">
                  {row.category} · {row.context ?? "no context"} ·{" "}
                  {row.firm_id
                    ? (firms.find((f) => f.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8))
                    : "unknown firm"}{" "}
                  · Ref {row.reference_id}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function BackupsView({ rows }: { rows: BackupRunRow[] }) {
  return (
    <section className="border border-[#dedad1] bg-[#fffdf8]">
      <div className="border-b border-[#dedad1] p-4">
        <h2 className="font-serif text-2xl">Backups</h2>
        <p className="text-sm text-[#8c8c88]">Most recent backup runs, newest first.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[#dedad1] text-left">
            <tr>
              <th className="p-3">Type</th>
              <th className="p-3">Environment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Started</th>
              <th className="p-3">Finished</th>
              <th className="p-3">Verified</th>
              <th className="p-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-[#dedad1]" key={row.id}>
                <td className="p-3">{row.backup_type}</td>
                <td className="p-3">{row.environment}</td>
                <td
                  className={`p-3 font-medium ${row.status === "failed" ? "text-[#b42318]" : row.status === "success" ? "text-[#147d52]" : ""}`}
                >
                  {row.status}
                </td>
                <td className="p-3 text-xs">{new Date(row.started_at).toLocaleString()}</td>
                <td className="p-3 text-xs">
                  {row.finished_at ? new Date(row.finished_at).toLocaleString() : "—"}
                </td>
                <td className="p-3 text-xs">
                  {row.verified_at ? new Date(row.verified_at).toLocaleString() : "—"}
                </td>
                <td className="p-3 text-xs text-[#8c8c88]">
                  {row.error_message ?? row.location ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-[#8c8c88]">No backup runs recorded.</p>
        )}
      </div>
    </section>
  );
}

function SettingsView() {
  const [rows, setRows] = useState<Array<{ key: string; value: unknown; is_secret: boolean }>>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [reason, setReason] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function load() {
    const { data } = await supabase
      .from("platform_settings" as never)
      .select("key,value,is_secret")
      .order("key");
    setRows((data ?? []) as Array<{ key: string; value: unknown; is_secret: boolean }>);
  }
  useEffect(() => {
    void load();
  }, []);
  function selectRow(row: { key: string; value: unknown; is_secret: boolean }) {
    setKey(row.key);
    // Secrets are write-only: never populate the editor with the stored
    // value, only let the admin paste a replacement.
    setValue(row.is_secret ? "" : JSON.stringify(row.value, null, 2));
    setIsSecret(row.is_secret);
    setMessage(null);
  }
  async function save() {
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = isSecret ? value : JSON.parse(value);
    } catch {
      setMessage("Value must be valid JSON (secrets are stored as a plain string).");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc(
      "set_platform_setting" as never,
      { p_key: key, p_value: parsed, p_reason: reason, p_is_secret: isSecret } as never,
    );
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Setting saved and audited.");
    setReason("");
    setValue("");
    await load();
  }
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <div className="border border-[#dedad1] bg-[#fffdf8]">
        <div className="border-b border-[#dedad1] p-4">
          <h2 className="font-serif text-2xl">Platform settings</h2>
          <p className="text-sm text-[#8c8c88]">
            Global configuration and API keys. Changes require a reason and are audited — secret
            values are never shown again after saving.
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
                <span className="flex items-center gap-2 font-medium">
                  {row.key}
                  {row.is_secret && (
                    <span className="rounded-full border border-[#c9c4ba] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#8c8c88]">
                      Secret
                    </span>
                  )}
                </span>
                <code className="max-w-[60%] truncate text-xs text-[#8c8c88]">
                  {row.is_secret ? "•••••••• (set)" : JSON.stringify(row.value)}
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
              placeholder="integrations.wasender_api_key"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
            />
            Secret (API key / webhook secret — write-only, masked everywhere after saving)
          </label>
          <label className="block text-sm">
            {isSecret ? "New secret value" : "JSON value"}
            {isSecret ? (
              <input
                type="password"
                autoComplete="off"
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2 font-mono text-xs"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Paste the key/secret — it will not be shown again"
              />
            ) : (
              <textarea
                className="mt-1 min-h-32 w-full border border-[#c9c4ba] bg-white p-2 font-mono text-xs"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
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
  const [firmFilter, setFirmFilter] = useState("");
  const keys = Array.from(new Set(features.map((f) => f.feature_key))).sort();
  const byFirm = new Map<string, Feature[]>();
  for (const f of features) {
    const list = byFirm.get(f.organization_id) ?? [];
    list.push(f);
    byFirm.set(f.organization_id, list);
  }
  const visibleFirms = firms.filter((firm) =>
    firm.name.toLowerCase().includes(firmFilter.toLowerCase()),
  );
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
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Current entitlements, by firm</h3>
            <Input
              className="w-48 h-8 text-xs"
              value={firmFilter}
              onChange={(e) => setFirmFilter(e.target.value)}
              placeholder="Filter firms"
            />
          </div>
          {firms.length === 0 ? (
            <p className="mt-3 text-sm text-[#8c8c88]">No firms onboarded yet.</p>
          ) : (
            <div className="mt-3 max-h-[32rem] space-y-4 overflow-y-auto">
              {visibleFirms.map((firm) => {
                const firmFeatures = (byFirm.get(firm.id) ?? []).sort((a, b) =>
                  a.feature_key.localeCompare(b.feature_key),
                );
                return (
                  <div key={firm.id} className="border border-[#dedad1] bg-white">
                    <div className="border-b border-[#dedad1] bg-[#f6f2e9] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#6b6659]">
                      {firm.name}
                    </div>
                    {firmFeatures.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-[#8c8c88]">
                        No modules explicitly set — using plan defaults.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#f0ede5]">
                        {firmFeatures.map((f) => (
                          <div
                            className="flex items-center justify-between px-3 py-2 text-sm"
                            key={`${f.organization_id}-${f.feature_key}`}
                          >
                            <span>{f.feature_key}</span>
                            <span
                              className={
                                f.enabled
                                  ? "text-[10px] font-semibold uppercase text-[#147d52]"
                                  : "text-[10px] font-semibold uppercase text-[#b42318]"
                              }
                            >
                              {f.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {visibleFirms.length === 0 && (
                <p className="text-sm text-[#8c8c88]">No firms match "{firmFilter}".</p>
              )}
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

type AdminThreadMessage = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

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
  const [openTicket, setOpenTicket] = useState<TicketRow | null>(null);
  const [thread, setThread] = useState<AdminThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
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
  async function openTicketThread(row: TicketRow) {
    setOpenTicket(row);
    setThreadLoading(true);
    setThread([]);
    const { data: conversation } = await supabase
      .from("platform_conversations" as never)
      .select("id")
      .eq("ticket_id", row.id)
      .maybeSingle();
    const conversationId = (conversation as { id?: string } | null)?.id;
    if (conversationId) {
      const { data: messages } = await supabase
        .from("platform_conversation_messages" as never)
        .select("id,body,sender_id,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setThread((messages ?? []) as AdminThreadMessage[]);
    }
    setThreadLoading(false);
  }
  async function sendReply() {
    if (!openTicket || !reply.trim()) return;
    setSending(true);
    const { data: session } = await supabase.auth.getSession();
    const { data: conversation } = await supabase
      .from("platform_conversations" as never)
      .select("id")
      .eq("ticket_id", openTicket.id)
      .maybeSingle();
    const conversationId = (conversation as { id?: string } | null)?.id;
    if (conversationId && session.session?.user.id) {
      await supabase.from("platform_conversation_messages" as never).insert({
        conversation_id: conversationId,
        sender_id: session.session.user.id,
        body: reply.trim(),
        visibility: "customer",
      } as never);
      await supabase
        .from("platform_conversations" as never)
        .update({ status: "waiting", updated_at: new Date().toISOString() } as never)
        .eq("id", conversationId);
      setReply("");
      await openTicketThread(openTicket);
    }
    setSending(false);
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
                  <button
                    className="text-left hover:underline"
                    onClick={() => void openTicketThread(row)}
                  >
                    <b>{row.ticket_no}</b>
                    <div className="text-xs text-[#8c8c88]">
                      {row.subject} · {row.category}
                    </div>
                  </button>
                </td>
                <td className="p-3">
                  {firms.find((firm) => firm.id === row.firm_id)?.name ?? row.firm_id.slice(0, 8)}
                </td>
                <td className="p-3">
                  {row.severity} / {row.priority}
                </td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => void openTicketThread(row)}
                    >
                      Open
                    </Button>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="p-8 text-center text-sm text-[#8c8c88]">No support tickets found.</p>
        )}
      </div>

      {openTicket && (
        <div className="border-t border-[#dedad1] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">
                {openTicket.ticket_no} · {openTicket.subject}
              </h3>
              <p className="text-xs text-[#8c8c88]">
                {firms.find((f) => f.id === openTicket.firm_id)?.name ?? openTicket.firm_id} ·{" "}
                {openTicket.status}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenTicket(null)}>
              Close
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2 border border-[#dedad1] bg-white p-3">
            {threadLoading ? (
              <p className="text-xs text-[#8c8c88] text-center py-6">Loading…</p>
            ) : thread.length === 0 ? (
              <p className="text-xs text-[#8c8c88] text-center py-6">No messages yet.</p>
            ) : (
              thread.map((m) => (
                <div key={m.id} className="text-sm border-b border-[#f0ede5] pb-2">
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] text-[#8c8c88]">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply to the firm…"
              disabled={sending}
            />
            <Button disabled={sending || !reply.trim()} onClick={() => void sendReply()}>
              Send
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

const GST_RATES = [0, 3, 5, 12, 18, 28];
const DOC_TYPES = [
  "quotation",
  "proforma",
  "tax_invoice",
  "renewal_invoice",
  "credit_note",
  "payment_receipt",
] as const;
const DOC_TYPE_LABEL: Record<string, string> = {
  quotation: "Quotation",
  proforma: "Proforma invoice",
  tax_invoice: "Tax invoice",
  renewal_invoice: "Renewal invoice",
  credit_note: "Credit note",
  payment_receipt: "Payment receipt",
};

function rupees(minor: number | null | undefined): string {
  return `₹${((minor ?? 0) / 100).toFixed(2)}`;
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
  const [type, setType] = useState<(typeof DOC_TYPES)[number]>("quotation");
  const [description, setDescription] = useState("");
  const [taxableAmount, setTaxableAmount] = useState("");
  const [gstRate, setGstRate] = useState(18);
  const [sellerStateCode, setSellerStateCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firmId && firms[0]) setFirmId(firms[0].id);
  }, [firmId, firms]);

  useEffect(() => {
    void supabase
      .from("platform_settings" as never)
      .select("value")
      .eq("key", "billing.seller_state_code")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: unknown } | null)?.value;
        if (typeof v === "string" && v) setSellerStateCode(v);
      });
  }, []);

  const buyerFirm = firms.find((f) => f.id === firmId);
  const buyerStateCode = buyerFirm?.gstin?.slice(0, 2) ?? "";
  const taxableMinor = Math.round((Number.parseFloat(taxableAmount || "0") || 0) * 100);
  const gstMinor = Math.round((taxableMinor * gstRate) / 100);
  const isInterState = !!buyerStateCode && !!sellerStateCode && buyerStateCode !== sellerStateCode;
  const cgstMinor = isInterState ? 0 : Math.round(gstMinor / 2);
  const sgstMinor = isInterState ? 0 : gstMinor - cgstMinor;
  const igstMinor = isInterState ? gstMinor : 0;
  const totalMinor = taxableMinor + gstMinor;

  async function createDocument() {
    if (!firmId || taxableMinor < 0) {
      setMessage("Choose a firm and enter a valid taxable amount.");
      return;
    }
    if (!buyerStateCode) {
      setMessage(
        `${buyerFirm?.name ?? "This firm"} has no GSTIN on file — add it under Firms before billing with GST, or the document will show 0% split.`,
      );
    }
    setSaving(true);
    const documentNo = `AVS-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("platform_billing_documents" as never).insert({
      firm_id: firmId,
      document_no: documentNo,
      document_type: type,
      status: "draft",
      amount_minor: totalMinor,
      paid_minor: 0,
      taxable_minor: taxableMinor,
      gst_minor: gstMinor,
      cgst_minor: cgstMinor,
      sgst_minor: sgstMinor,
      igst_minor: igstMinor,
      buyer_state_code: buyerStateCode || null,
      seller_state_code: sellerStateCode || null,
      issued_at: new Date().toISOString(),
      data: { currency: "INR", description, gst_rate_percent: gstRate },
    } as never);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Created ${documentNo}.`);
    setTaxableAmount("");
    setDescription("");
    onSaved();
  }

  async function markPaid(row: BillingRow) {
    const { error } = await supabase
      .from("platform_billing_documents" as never)
      .update({ status: "paid", paid_minor: row.amount_minor } as never)
      .eq("id", row.id);
    if (!error) onSaved();
  }

  async function updateStatus(row: BillingRow, status: string) {
    const { error } = await supabase
      .from("platform_billing_documents" as never)
      .update({ status } as never)
      .eq("id", row.id);
    if (!error) onSaved();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
      <div className="border border-[#dedad1] bg-[#fffdf8] p-4">
        <h2 className="font-serif text-2xl">Software billing</h2>
        <p className="mt-1 text-sm text-[#8c8c88]">
          Quotations, GST invoices, and receipts for Arivahly's platform subscription — separate
          from jewellery billing.
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
                  {firm.gstin ? ` · GSTIN ${firm.gstin}` : " · no GSTIN on file"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Document type
            <select
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={type}
              onChange={(e) => setType(e.target.value as (typeof DOC_TYPES)[number])}
            >
              {DOC_TYPES.map((item) => (
                <option key={item} value={item}>
                  {DOC_TYPE_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Description / line item
            <input
              className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. AVS Gold ERP — annual subscription, Full edition"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Taxable amount (₹)
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
                inputMode="decimal"
                value={taxableAmount}
                onChange={(e) => setTaxableAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="block text-sm">
              GST rate
              <select
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
              >
                {GST_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Seller GST state code
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-white p-2"
                value={sellerStateCode}
                onChange={(e) => setSellerStateCode(e.target.value.slice(0, 2))}
                placeholder="e.g. 27"
                maxLength={2}
              />
            </label>
            <label className="block text-sm">
              Buyer GST state code
              <input
                className="mt-1 w-full border border-[#c9c4ba] bg-[#f4f0e8] p-2 text-[#8c8c88]"
                value={buyerStateCode}
                readOnly
                placeholder="from firm GSTIN"
              />
            </label>
          </div>
          <div className="border border-[#dedad1] bg-white p-3 text-sm">
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
          {message && <p className="text-sm text-[#8c8c88]">{message}</p>}
          <Button disabled={saving} onClick={() => void createDocument()}>
            Create draft
          </Button>
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
                      <a
                        className="text-xs underline text-[#6b6659]"
                        href={`/platform/billing-print/${row.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Print
                      </a>
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
