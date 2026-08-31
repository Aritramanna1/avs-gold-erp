/**
 * Platform Owner — Meta / WhatsApp Control Centre
 */
import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type WabaRow = {
  id: string;
  firm_id: string;
  product_id: string;
  connection_mode: string;
  display_phone: string | null;
  waba_id: string | null;
  onboarding_status: string;
  embedded_signup_status: string | null;
  webhook_status: string | null;
  template_sync_status: string | null;
  is_enabled: boolean;
  messages_sent_count: number;
  messages_delivered_count: number;
  messages_failed_count: number;
};

type FirmRow = { id: string; name: string };

export function MetaControlCentre() {
  const [connections, setConnections] = useState<WabaRow[]>([]);
  const [firms, setFirms] = useState<FirmRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [connRes, firmRes] = await Promise.all([
      supabase
        .from("whatsapp_connections" as never)
        .select(
          "id,firm_id,product_id,connection_mode,display_phone,waba_id,onboarding_status,embedded_signup_status,webhook_status,template_sync_status,is_enabled,messages_sent_count,messages_delivered_count,messages_failed_count",
        )
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("organizations" as never)
        .select("id,name")
        .limit(500),
    ]);
    setConnections((connRes.data ?? []) as WabaRow[]);
    setFirms((firmRes.data ?? []) as FirmRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const firmName = (id: string) => firms.find((f) => f.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gold">Meta / WhatsApp Control Centre</h2>
          <p className="text-xs text-muted-foreground">
            WABAs, embedded signup state, webhooks, templates, and tenant connections across AVS
            products.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} className="gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Panel title="Connections" padding="sm">
          <p className="text-2xl font-bold">{connections.length}</p>
        </Panel>
        <Panel title="Managed (AVS)" padding="sm">
          <p className="text-2xl font-bold">
            {connections.filter((c) => c.connection_mode === "managed_partner").length}
          </p>
        </Panel>
        <Panel title="External BSP" padding="sm">
          <p className="text-2xl font-bold">
            {
              connections.filter(
                (c) =>
                  c.connection_mode === "client_owned" || c.connection_mode === "custom_connector",
              ).length
            }
          </p>
        </Panel>
        <Panel title="Messages Sent (all)" padding="sm">
          <p className="text-2xl font-bold">
            {connections.reduce((s, c) => s + (c.messages_sent_count ?? 0), 0)}
          </p>
        </Panel>
      </div>

      <Panel
        title="WABAs & Phone Numbers"
        description="Per-tenant connection health and onboarding state."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Tenant</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Mode</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Signup</th>
                <th className="py-2 pr-3">Webhook</th>
                <th className="py-2 pr-3">Templates</th>
                <th className="py-2 pr-3">Sent/Deliv/Fail</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{firmName(c.firm_id)}</td>
                  <td className="py-2 pr-3 font-mono">{c.product_id}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {c.connection_mode.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">{c.display_phone ?? "—"}</td>
                  <td className="py-2 pr-3">{c.embedded_signup_status ?? c.onboarding_status}</td>
                  <td className="py-2 pr-3">{c.webhook_status ?? "—"}</td>
                  <td className="py-2 pr-3">{c.template_sync_status ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono">
                    {c.messages_sent_count}/{c.messages_delivered_count}/{c.messages_failed_count}
                  </td>
                </tr>
              ))}
              {connections.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No WhatsApp connections registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
