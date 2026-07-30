import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !url || !serviceKey) return json({ error: "Authentication required" }, 401);

  let body: { branchId?: string; phone?: string; message?: string; verifyOnly?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.verifyOnly && (!body.phone || !body.message || body.message.length > 4096)) {
    return json({ error: "A valid phone and message are required" }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Invalid session" }, 401);

  const { data: profile } = await admin
    .from("user_profiles")
    .select("firm_id,branch_id,active,status")
    .eq("auth_id", auth.user.id)
    .maybeSingle();
  if (!profile?.firm_id || !profile.active || profile.status !== "active") {
    return json({ error: "Active tenant membership required" }, 403);
  }
  const branchId = body.branchId || profile.branch_id;
  if (!branchId) return json({ error: "Branch context is required" }, 400);
  if (profile.branch_id && profile.branch_id !== branchId) {
    return json({ error: "Branch access denied" }, 403);
  }

  const { data: settings, error: settingsError } = await admin
    .from("branch_settings")
    .select("wa_config")
    .eq("branch_id", branchId)
    .maybeSingle();
  if (settingsError) return json({ error: "Could not read WhatsApp configuration" }, 500);
  const config = (settings?.wa_config ?? {}) as Record<string, unknown>;
  const providerType = String(config.providerType ?? "");
  if (config.enabled !== true || providerType === "whatsapp_deep_link") {
    return json({ error: "An active server WhatsApp API provider is required" }, 400);
  }

  const { data: secretRow, error: secretError } = await admin
    .from("comm_provider_secrets")
    .select("secret_data")
    .eq("branch_id", branchId)
    .eq("provider_type", providerType)
    .maybeSingle();
  if (secretError || !secretRow?.secret_data)
    return json({ error: "WhatsApp secret is not configured" }, 400);
  const secret = secretRow.secret_data as Record<string, unknown>;
  const accessToken = String(secret.access_token ?? secret.api_key ?? "");
  const apiVersion = String(config.apiVersion ?? "v19.0");
  const apiBaseUrl = String(config.apiBaseUrl ?? "").replace(/\/+$/, "");
  if (!accessToken) return json({ error: "WhatsApp provider secret is not configured" }, 400);

  if (body.verifyOnly) {
    if (providerType !== "whatsapp_cloud_api") {
      return json(
        { error: "Connection verification is not supported for this provider adapter" },
        400,
      );
    }
    const phoneNumberId = String(config.phoneNumberId ?? "");
    if (!phoneNumberId || !apiBaseUrl)
      return json({ error: "WhatsApp Cloud API is incompletely configured" }, 400);
    const probe = await fetch(
      `${apiBaseUrl}/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name,status`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const result = await probe.json().catch(() => ({}));
    if (!probe.ok) return json({ error: result?.error?.message ?? `HTTP ${probe.status}` }, 502);
    return json({
      ok: true,
      message: `Connected: ${result?.verified_name ?? "WhatsApp"} (${result?.display_phone_number ?? phoneNumberId})`,
    });
  }

  let endpoint = apiBaseUrl;
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let requestBody: Record<string, unknown>;
  if (providerType === "whatsapp_cloud_api") {
    const phoneNumberId = String(config.phoneNumberId ?? "");
    if (!phoneNumberId || !apiBaseUrl)
      return json({ error: "WhatsApp Cloud API is incompletely configured" }, 400);
    endpoint = `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`;
    requestHeaders.Authorization = `Bearer ${accessToken}`;
    requestBody = {
      messaging_product: "whatsapp",
      to: body.phone,
      type: "text",
      text: { body: body.message },
    };
  } else if (providerType === "whatsapp_openwa") {
    if (!apiBaseUrl) return json({ error: "OpenWA URL is not configured" }, 400);
    endpoint = `${apiBaseUrl}/sendText`;
    requestHeaders["x-api-key"] = accessToken;
    requestBody = { chatId: `${body.phone}@c.us`, content: body.message };
  } else if (
    ["whatsapp_interakt", "whatsapp_wati", "whatsapp_aisensy", "whatsapp_gupshup"].includes(
      providerType,
    )
  ) {
    if (!apiBaseUrl) return json({ error: "BSP API URL is not configured" }, 400);
    endpoint = apiBaseUrl;
    requestHeaders.Authorization = `Bearer ${accessToken}`;
    requestBody = { to: body.phone, type: "text", message: body.message };
  } else {
    return json({ error: "This WhatsApp provider requires a server adapter before use" }, 400);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    return json(
      { error: result?.error?.message ?? `WhatsApp API error (${response.status})` },
      502,
    );
  return json({ ok: true, messageId: result?.messages?.[0]?.id ?? null });
});
