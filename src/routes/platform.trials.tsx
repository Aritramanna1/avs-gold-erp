import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-info";
import { useEffect, useState } from "react";
import { DEFAULT_PLATFORM_SEARCH } from "@/lib/platform-search";
import { guardRoute } from "@/lib/permissions";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Panel } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type TrialRow = {
  id: string;
  organization_id: string;
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_lifecycle_status: string | null;
  product_id: string | null;
  organizations: { name: string; slug: string } | null;
};

type LeadRow = {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  lead_stage: string;
  trial_ends_at: string | null;
  follow_up_due_at: string | null;
  organization_id: string | null;
};

export const Route = createFileRoute("/platform/trials")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "trials",
    filter: typeof search.filter === "string" ? search.filter : "active",
  }),
  head: () => ({ meta: [{ title: "Commercial Trials · Platform Owner" }] }),
  component: PlatformTrialsPage,
});

function PlatformTrialsPage() {
  const search = useRouterState({
    select: (s) => s.location.search as { tab?: string; filter?: string },
  });
  const activeTab = search.tab ?? "trials";
  const trialFilter = search.filter ?? "active";
  const [trials, setTrials] = useState<TrialRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [extendDays, setExtendDays] = useState("7");

  async function load() {
    setLoading(true);
    const [subRes, leadRes] = await Promise.all([
      supabase
        .from("organization_subscriptions" as never)
        .select(
          "id, organization_id, status, trial_started_at, trial_ends_at, trial_lifecycle_status, product_id, organizations(name, slug)",
        )
        .eq("status", "trial")
        .order("trial_ends_at", { ascending: true }),
      supabase
        .from("platform_commercial_leads" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setTrials((subRes.data ?? []) as TrialRow[]);
    setLeads((leadRes.data ?? []) as LeadRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const expiringSoon = trials.filter((t) => {
    if (!t.trial_ends_at) return false;
    const days = (new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  });

  const visibleTrials = trialFilter === "expiring" ? expiringSoon : trials;

  async function extendTrial(orgId: string) {
    const days = Number(extendDays) || 7;
    const { error } = await supabase.rpc("extend_platform_trial", {
      p_organization_id: orgId,
      p_days: days,
      p_reason: "Platform owner extension",
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Trial extended by ${days} days`);
      void load();
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/platform" search={DEFAULT_PLATFORM_SEARCH}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Platform Console
        </Link>
      </Button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gold">
            {activeTab === "onboarding"
              ? "Onboarding"
              : trialFilter === "expiring"
                ? "Expiring Trials"
                : "Active Trials"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {activeTab === "onboarding"
              ? "Sales leads and onboarding pipeline."
              : "Active trials, extensions, and conversion tracking."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} className="gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Panel title="Active Trials" padding="sm">
          <p className="text-2xl font-bold">{trials.length}</p>
        </Panel>
        <Panel title="Expiring ≤3 days" padding="sm">
          <p className="text-2xl font-bold text-amber-600">{expiringSoon.length}</p>
        </Panel>
        <Panel title="Sales Leads" padding="sm">
          <p className="text-2xl font-bold">{leads.length}</p>
        </Panel>
        <Panel title="Extend by (days)" padding="sm">
          <Input
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            className="h-8 mt-1"
          />
        </Panel>
      </div>

      {activeTab === "onboarding" ? (
        <Panel title="Trial Sales Leads">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Company</th>
                <th className="py-2">Contact</th>
                <th className="py-2">Stage</th>
                <th className="py-2">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="py-2">{l.company_name}</td>
                  <td className="py-2">
                    {l.contact_name}
                    <br />
                    <span className="text-muted-foreground">{l.contact_email}</span>
                  </td>
                  <td className="py-2 capitalize">{l.lead_stage.replace(/_/g, " ")}</td>
                  <td className="py-2">
                    {l.follow_up_due_at ? new Date(l.follow_up_due_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No onboarding leads recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      ) : (
        <Panel title={trialFilter === "expiring" ? "Expiring Trials (≤7 days)" : "Active Trials"}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Company</th>
                <th className="py-2">Product</th>
                <th className="py-2">Ends</th>
                <th className="py-2">Lifecycle</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visibleTrials.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2">{t.organizations?.name ?? t.organization_id.slice(0, 8)}</td>
                  <td className="py-2 font-mono">{!t.product_id || t.product_id === "ORNEXA" ? APP_NAME : t.product_id}</td>
                  <td className="py-2">
                    {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {t.trial_lifecycle_status ?? "TRIAL_ACTIVE"}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void extendTrial(t.organization_id)}
                    >
                      Extend
                    </Button>
                  </td>
                </tr>
              ))}
              {visibleTrials.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No trials in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
