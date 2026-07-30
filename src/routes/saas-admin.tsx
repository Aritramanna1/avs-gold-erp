import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Building2, CircleAlert, Database, ShieldCheck, Users, LifeBuoy } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/saas-admin")({
  component: () => <Navigate to="/platform" replace />,
});

type Organization = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};
type Plan = { id: string; name: string; code: string; is_active: boolean; billing_cycle: string };
type Subscription = {
  organization_id: string;
  status: string;
  trial_ends_at: string | null;
  renews_at: string | null;
};
type PlatformAudit = {
  id: string;
  action: string;
  target_type: string | null;
  reason: string | null;
  created_at: string;
};
type PlatformUser = {
  id: string;
  firm_id: string | null;
  branch_id: string | null;
  role: string;
  full_name: string | null;
  status: string;
  active: boolean;
};
type Branch = { id: string; name: string; firm_id: string | null; active: boolean };

function SaaSAdminPage() {
  const role = useSettings((s) => s.currentUserRole);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [auditEvents, setAuditEvents] = useState<PlatformAudit[]>([]);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [firmName, setFirmName] = useState("");
  const [firmSlug, setFirmSlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [planName, setPlanName] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [supportOrg, setSupportOrg] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [orgs, planRows, subRows, auditRows, userRows, branchRows] = await Promise.all([
      supabase
        .from("organizations" as never)
        .select("id,name,slug,is_active,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("platform_plans" as never)
        .select("id,name,code,is_active,billing_cycle")
        .order("name"),
      supabase
        .from("organization_subscriptions" as never)
        .select("organization_id,status,trial_ends_at,renews_at"),
      supabase
        .from("platform_audit_events" as never)
        .select("id,action,target_type,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("user_profiles" as never)
        .select("id,firm_id,branch_id,role,full_name,status,active"),
      supabase.from("branches" as never).select("id,name,firm_id,active"),
    ]);
    const firstError =
      orgs.error ||
      planRows.error ||
      subRows.error ||
      auditRows.error ||
      userRows.error ||
      branchRows.error;
    if (firstError)
      setError(
        "Platform data could not be loaded. Verify your SaaS Admin role and database migration.",
      );
    setOrganizations((orgs.data ?? []) as Organization[]);
    setPlans((planRows.data ?? []) as Plan[]);
    setSubscriptions((subRows.data ?? []) as Subscription[]);
    setAuditEvents((auditRows.data ?? []) as PlatformAudit[]);
    setPlatformUsers((userRows.data ?? []) as PlatformUser[]);
    setBranches((branchRows.data ?? []) as Branch[]);
    setLoading(false);
  }

  async function createFirm() {
    if (!firmName.trim() || !firmSlug.trim() || !ownerName.trim() || !ownerEmail.trim())
      return setError("Firm name, slug, owner name, and owner email are required.");
    const { error: onboardingError } = await supabase.functions.invoke("onboard-tenant", {
      body: { firmName, firmSlug, ownerName, ownerEmail },
    });
    if (onboardingError) return setError(onboardingError.message);
    setFirmName("");
    setFirmSlug("");
    setOwnerName("");
    setOwnerEmail("");
    await load();
  }

  async function toggleFirm(org: Organization) {
    const { error: updateError } = await supabase
      .from("organizations" as never)
      .update({ is_active: !org.is_active } as never)
      .eq("id", org.id);
    if (updateError) return setError(updateError.message);
    await supabase.rpc(
      "record_platform_audit" as never,
      {
        p_action: org.is_active ? "organization.suspended" : "organization.restored",
        p_organization_id: org.id,
        p_target_type: "organization",
        p_target_id: org.id,
        p_reason: "Status changed from SaaS Admin",
      } as never,
    );
    await load();
  }

  async function createPlan() {
    if (!planName.trim() || !planCode.trim()) return setError("Plan name and code are required.");
    const { error: insertError } = await supabase
      .from("platform_plans" as never)
      .insert([{ name: planName.trim(), code: planCode.trim().toLowerCase() }] as never);
    if (insertError) return setError(insertError.message);
    setPlanName("");
    setPlanCode("");
    await load();
  }

  async function startSupportSession() {
    if (!supportOrg || supportReason.trim().length < 10)
      return setError("Select a firm and provide a support reason of at least 10 characters.");
    const { data: user } = await supabase.auth.getUser();
    const { error: sessionError } = await supabase.from("support_sessions" as never).insert([
      {
        organization_id: supportOrg,
        actor_id: user.user?.id,
        reason: supportReason.trim(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    ] as never);
    if (sessionError) return setError(sessionError.message);
    setSupportReason("");
    await load();
  }

  useEffect(() => {
    let cancelled = false;
    async function verifyPlatformRole() {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) {
        if (!cancelled) {
          setAuthorized(false);
          setLoading(false);
        }
        return;
      }
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", userId);
      const isSaaSAdmin =
        !roleError &&
        ((roleRows ?? []) as Array<{ role?: string }>).some(
          (row) => row.role === "saas_admin" || row.role === "SaaS Admin",
        );
      if (cancelled) return;
      setAuthorized(isSaaSAdmin);
      if (isSaaSAdmin) {
        await load();
      } else {
        setLoading(false);
      }
    }
    void verifyPlatformRole();
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (!authorized) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <CircleAlert className="mb-3 text-destructive" />
          <h1 className="text-xl font-semibold">Platform access denied</h1>
          <p className="mt-2 text-muted-foreground">
            This control plane is restricted to SaaS Admin users.
          </p>
        </div>
      </main>
    );
  }

  const active = organizations.filter((o) => o.is_active).length;
  const trials = subscriptions.filter((s) => s.status === "trial").length;
  const suspended = organizations.length - active;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Platform control plane</p>
          <h1 className="text-2xl font-semibold tracking-tight">SaaS Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant metadata, plans, subscriptions, and platform security.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </header>
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Building2} label="Total firms" value={organizations.length} />
        <Metric icon={ShieldCheck} label="Active firms" value={active} />
        <Metric icon={Users} label="Trial subscriptions" value={trials} />
        <Metric icon={CircleAlert} label="Suspended firms" value={suspended} />
        <Metric
          icon={Database}
          label="Active plans"
          value={plans.filter((p) => p.is_active).length}
        />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Platform users"
          subtitle="User metadata only; credentials and secrets remain in Supabase Auth."
        >
          {platformUsers.length === 0 ? (
            <Empty text="No platform profiles found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Name</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {platformUsers.slice(0, 50).map((user) => (
                    <tr className="border-b" key={user.id}>
                      <td className="p-2">{user.full_name || user.id.slice(0, 8)}</td>
                      <td className="p-2">{user.role}</td>
                      <td className="p-2">
                        {user.active && user.status === "active" ? "Active" : "Suspended"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel
          title="Branches and operational scope"
          subtitle="Branch metadata is platform-visible; company data remains protected by firm RLS."
        >
          {branches.length === 0 ? (
            <Empty text="No branches found." />
          ) : (
            <div className="space-y-2">
              {branches.map((branch) => (
                <div className="flex justify-between rounded-md border p-3 text-sm" key={branch.id}>
                  <span>{branch.name}</span>
                  <span className="text-muted-foreground">
                    {branch.active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Tenant management"
          subtitle="Only metadata is shown here; business data requires an explicit support session."
        >
          {loading ? (
            <Empty text="Loading tenants…" />
          ) : organizations.length === 0 ? (
            <Empty text="No firms found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">Firm</th>
                    <th className="p-3">Slug</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => (
                    <tr className="border-b last:border-0" key={org.id}>
                      <td className="p-3 font-medium">{org.name}</td>
                      <td className="p-3 font-mono text-xs">{org.slug}</td>
                      <td className="p-3">{org.is_active ? "Active" : "Suspended"}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" onClick={() => void toggleFirm(org)}>
                          {org.is_active ? "Suspend" : "Restore"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Plans" subtitle="Plans are database records, not frontend constants.">
          {loading ? (
            <Empty text="Loading plans…" />
          ) : plans.length === 0 ? (
            <Empty text="No plans configured." />
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => (
                <div
                  className="flex items-center justify-between rounded-md border p-3"
                  key={plan.id}
                >
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.code} · {plan.billing_cycle}
                    </p>
                  </div>
                  <span className="text-xs">{plan.is_active ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
      <section className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Create firm"
          subtitle="Creates the tenant, branch, owner profile, owner role, and trial subscription atomically."
        >
          <div className="space-y-3">
            <Input
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Firm name"
            />
            <Input
              value={firmSlug}
              onChange={(e) => setFirmSlug(e.target.value)}
              placeholder="Unique slug"
            />
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Owner full name"
            />
            <Input
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="Owner email"
              type="email"
            />
            <Button onClick={() => void createFirm()}>
              <Building2 className="mr-2 h-4 w-4" />
              Create firm
            </Button>
          </div>
        </Panel>
        <Panel
          title="Create plan"
          subtitle="Limits and features are stored in the platform database."
        >
          <div className="space-y-3">
            <Input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Plan name"
            />
            <Input
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
              placeholder="Plan code"
            />
            <Button onClick={() => void createPlan()}>
              <Database className="mr-2 h-4 w-4" />
              Create plan
            </Button>
          </div>
        </Panel>
        <Panel
          title="Support access"
          subtitle="Time-limited and reason-bound; no silent impersonation."
        >
          <div className="space-y-3">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={supportOrg}
              onChange={(e) => setSupportOrg(e.target.value)}
            >
              <option value="">Select firm</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <Input
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
              placeholder="Reason (10+ characters)"
            />
            <Button onClick={() => void startSupportSession()}>
              <LifeBuoy className="mr-2 h-4 w-4" />
              Start 30-minute session
            </Button>
          </div>
        </Panel>
      </section>
      <Panel
        title="Platform audit"
        subtitle="Recent platform actions; business gold and financial records are not editable from this panel."
      >
        {auditEvents.length === 0 ? (
          <Empty text="No platform actions recorded." />
        ) : (
          <div className="space-y-2 text-sm">
            {auditEvents.map((event) => (
              <div
                className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0"
                key={event.id}
              >
                <span className="font-medium">{event.action}</span>
                <span className="text-muted-foreground">
                  {event.reason || "—"} · {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
