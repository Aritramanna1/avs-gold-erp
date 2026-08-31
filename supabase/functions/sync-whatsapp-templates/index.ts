/**
 * Sync WhatsApp message templates from Meta Graph API into whatsapp_message_templates.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

type MetaTemplate = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  components?: Array<{ type?: string; text?: string }>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !url || !serviceKey) return json({ error: "Authentication required" }, 401);

  let body: { connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.connectionId) return json({ error: "connectionId is required" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Invalid session" }, 401);

  const { data: profile } = await admin
    .from("user_profiles")
    .select("firm_id,active,status")
    .eq("auth_id", auth.user.id)
    .maybeSingle();
  if (!profile?.firm_id || !profile.active || profile.status !== "active") {
    return json({ error: "Active tenant membership required" }, 403);
  }

  const { data: conn, error: connError } = await admin
    .from("whatsapp_connections")
    .select("id,firm_id,branch_id,waba_id,provider_secret_ref")
    .eq("id", body.connectionId)
    .eq("firm_id", profile.firm_id)
    .maybeSingle();
  if (connError || !conn?.waba_id) {
    return json({ error: "WhatsApp connection or WABA ID not found" }, 404);
  }

  let accessToken = "";
  if (conn.provider_secret_ref) {
    const { data: secretRow } = await admin
      .from("comm_provider_secrets")
      .select("secret_data")
      .eq("id", conn.provider_secret_ref)
      .maybeSingle();
    const secret = (secretRow?.secret_data ?? {}) as Record<string, unknown>;
    accessToken = String(secret.access_token ?? secret.api_key ?? "");
  }
  if (!accessToken && conn.branch_id) {
    const { data: secretRow } = await admin
      .from("comm_provider_secrets")
      .select("secret_data")
      .eq("branch_id", conn.branch_id)
      .eq("provider_type", "whatsapp_cloud_api")
      .maybeSingle();
    const secret = (secretRow?.secret_data ?? {}) as Record<string, unknown>;
    accessToken = String(secret.access_token ?? secret.api_key ?? "");
  }
  if (!accessToken) {
    return json({ error: "WhatsApp access token not configured for this connection" }, 400);
  }

  const apiVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? "v19.0";
  const graphUrl = `https://graph.facebook.com/${apiVersion}/${conn.waba_id}/message_templates?limit=100`;
  const metaRes = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    const errText = await metaRes.text();
    await admin
      .from("whatsapp_connections")
      .update({ template_sync_status: "failed", last_error: errText.slice(0, 500) })
      .eq("id", conn.id);
    return json({ error: "Meta API request failed", details: errText.slice(0, 500) }, 502);
  }

  const metaJson = (await metaRes.json()) as { data?: MetaTemplate[] };
  const templates = metaJson.data ?? [];
  let synced = 0;

  for (const tpl of templates) {
    if (!tpl.name) continue;
    const bodyComponent = tpl.components?.find((c) => c.type === "BODY");
    const status = String(tpl.status ?? "pending").toLowerCase();
    const normalizedStatus =
      status === "approved" || status === "rejected" || status === "paused" ? status : "pending";
    const category = String(tpl.category ?? "utility").toLowerCase();
    const normalizedCategory =
      category === "marketing" || category === "authentication" ? category : "utility";

    const { error: upsertError } = await admin.from("whatsapp_message_templates").upsert(
      {
        connection_id: conn.id,
        template_name: tpl.name,
        language: tpl.language ?? "en",
        category: normalizedCategory,
        status: normalizedStatus,
        meta_template_id: tpl.id ?? null,
        body_preview: bodyComponent?.text?.slice(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,template_name,language" },
    );
    if (!upsertError) synced += 1;
  }

  await admin
    .from("whatsapp_connections")
    .update({
      template_sync_status: "synced",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return json({ ok: true, synced, total: templates.length });
});
