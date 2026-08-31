/**
 * WhatsApp message templates — platform table + Meta sync via edge function.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface WhatsAppMessageTemplate {
  id: string;
  connectionId: string;
  eventKey?: string;
  templateName: string;
  language: string;
  category: string;
  status: string;
  metaTemplateId?: string;
  bodyPreview?: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): WhatsAppMessageTemplate {
  return {
    id: String(row.id),
    connectionId: String(row.connection_id),
    eventKey: row.event_key ? String(row.event_key) : undefined,
    templateName: String(row.template_name),
    language: String(row.language ?? "en"),
    category: String(row.category ?? "utility"),
    status: String(row.status ?? "pending"),
    metaTemplateId: row.meta_template_id ? String(row.meta_template_id) : undefined,
    bodyPreview: row.body_preview ? String(row.body_preview) : undefined,
    updatedAt: String(row.updated_at),
  };
}

export async function fetchWhatsAppTemplates(
  connectionId: string,
): Promise<WhatsAppMessageTemplate[]> {
  const { data, error } = await supabase
    .from("whatsapp_message_templates" as never)
    .select("*")
    .eq("connection_id", connectionId)
    .order("template_name");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function syncWhatsAppTemplatesFromMeta(
  connectionId: string,
): Promise<{ ok: boolean; synced?: number; total?: number; error?: string }> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!url || !token) return { ok: false, error: "Sign in required." };

  const res = await fetch(`${url}/functions/v1/sync-whatsapp-templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ connectionId }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    synced?: number;
    total?: number;
    error?: string;
    details?: string;
  };
  if (!res.ok) {
    return { ok: false, error: body.error ?? body.details ?? `Sync failed (${res.status})` };
  }
  return { ok: true, synced: body.synced, total: body.total };
}
