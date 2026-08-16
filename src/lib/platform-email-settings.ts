/**
 * Platform email settings — persisted in platform_settings and consumed by send-email.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface PlatformEmailSettings {
  fromEmail: string;
  replyTo: string;
  displayName: string;
  provider: string;
}

const KEYS = {
  from: "integrations.email_from",
  replyTo: "integrations.email_reply_to",
  displayName: "integrations.email_display_name",
  provider: "integrations.email_provider",
} as const;

export async function loadPlatformEmailSettings(): Promise<PlatformEmailSettings> {
  const { data } = await supabase
    .from("platform_settings")
    .select("key,value")
    .in("key", Object.values(KEYS));
  const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return {
    fromEmail: String(map.get(KEYS.from) ?? "noreply@ornexa.in"),
    replyTo: String(map.get(KEYS.replyTo) ?? ""),
    displayName: String(map.get(KEYS.displayName) ?? "Ornexa Platform"),
    provider: String(map.get(KEYS.provider) ?? "email_smtp"),
  };
}

export async function savePlatformEmailSettings(input: PlatformEmailSettings): Promise<void> {
  const rows = [
    { key: KEYS.from, value: input.fromEmail },
    { key: KEYS.replyTo, value: input.replyTo },
    { key: KEYS.displayName, value: input.displayName },
    { key: KEYS.provider, value: input.provider },
  ];
  const { error } = await supabase.from("platform_settings").upsert(rows);
  if (error) throw new Error(error.message);
}

export async function testPlatformEmailConnection(toEmail: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const settings = await loadPlatformEmailSettings();
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      to: toEmail,
      subject: `Ornexa platform email test — ${settings.displayName}`,
      htmlBody: `<p>Platform email configuration test from ${settings.fromEmail}.</p>`,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === "object" && "ok" in data && data.ok === false) {
    return { ok: false, error: String((data as { error?: string }).error ?? "Send failed") };
  }
  return { ok: true };
}
