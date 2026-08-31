/**
 * Platform Owner — Razorpay credential configuration (test/live keys via RPC vault).
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";

const KEYS = [
  {
    key: "razorpay_key_id",
    label: "Key ID (publishable)",
    placeholder: "rzp_test_… or rzp_live_…",
  },
  { key: "razorpay_key_secret", label: "Key Secret", placeholder: "••••••••", secret: true },
  { key: "razorpay_webhook_secret", label: "Webhook Secret", placeholder: "whsec_…", secret: true },
] as const;

export function PlatformRazorpayConfig() {
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("platform_credentials" as never)
        .select("key, secret_encrypted, rotated_at, metadata")
        .in(
          "key",
          KEYS.map((k) => k.key),
        );
      const map: Record<string, boolean> = {};
      for (const row of (data ?? []) as { key: string; secret_encrypted?: string | null }[]) {
        map[row.key] = Boolean(row.secret_encrypted);
      }
      setConfigured(map);
      setLoading(false);
    })();
  }, []);

  async function saveAll() {
    setSaving(true);
    try {
      for (const item of KEYS) {
        const val = values[item.key]?.trim();
        if (!val) continue;
        const { error } = await supabase.rpc("upsert_platform_credential", {
          p_key: item.key,
          p_provider: "razorpay",
          p_secret: val,
          p_metadata: { environment: val.includes("live") ? "live" : "test" },
          p_reason: "Platform Owner Razorpay configuration",
        } as never);
        if (error) throw error;
      }
      toast.success("Razorpay credentials saved securely");
      setValues({});
      const { data } = await supabase
        .from("platform_credentials" as never)
        .select("key, secret_encrypted")
        .in(
          "key",
          KEYS.map((k) => k.key),
        );
      const map: Record<string, boolean> = {};
      for (const row of (data ?? []) as { key: string; secret_encrypted?: string | null }[]) {
        map[row.key] = Boolean(row.secret_encrypted);
      }
      setConfigured(map);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save credentials");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 border-gold/20">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4 text-gold" />
        <h3 className="font-semibold text-sm">Razorpay Payments</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Configure test or live Razorpay keys for tenant subscription checkout. Webhook URL:{" "}
        <code className="text-[10px] bg-muted px-1 rounded">
          {import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-webhook
        </code>
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-3">
          {KEYS.map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs">{item.label}</Label>
                <Badge variant="outline" className="text-[9px]">
                  {configured[item.key] ? "Configured" : "Not set"}
                </Badge>
              </div>
              <Input
                type={"secret" in item && item.secret ? "password" : "text"}
                placeholder={item.placeholder}
                value={values[item.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [item.key]: e.target.value }))}
                className="font-mono text-xs"
                autoComplete="off"
              />
            </div>
          ))}
          <Button size="sm" onClick={() => void saveAll()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Razorpay Credentials"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Leave a field blank to keep the existing secret. Paste demo keys from Razorpay Dashboard
            → Settings → API Keys.
          </p>
        </div>
      )}
    </Card>
  );
}
