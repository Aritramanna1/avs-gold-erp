/**
 * Meta WhatsApp Embedded Signup — OAuth code exchange + WABA persistence.
 * POST { code, redirectUri, connectionId, branchId }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appId = Deno.env.get("META_APP_ID") ?? Deno.env.get("VITE_META_APP_ID") ?? "";
  const appSecret = Deno.env.get("META_APP_SECRET") ?? "";
  if (!token || !url || !serviceKey) return json({ error: "Authentication required" }, 401);
  if (!appId || !appSecret)
    return json({ error: "Meta App ID/Secret not configured on server" }, 503);

  let body: { code?: string; redirectUri?: string; connectionId?: string; branchId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.code || !body.redirectUri || !body.connectionId) {
    return json({ error: "code, redirectUri, and connectionId are required" }, 400);
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

  const branchId = body.branchId ?? profile.branch_id;
  if (!branchId) return json({ error: "Branch context required" }, 400);

  const { data: conn } = await admin
    .from("whatsapp_connections")
    .select("id,firm_id")
    .eq("id", body.connectionId)
    .eq("firm_id", profile.firm_id)
    .maybeSingle();
  if (!conn) return json({ error: "WhatsApp connection not found" }, 404);

  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", body.redirectUri);
  tokenUrl.searchParams.set("code", body.code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    return json({ error: tokenJson.error?.message ?? "Meta token exchange failed" }, 502);
  }

  const accessToken = tokenJson.access_token;

  // Resolve WABA + phone from debug token or shared WABA list
  let wabaId: string | null = null;
  let phoneNumberId: string | null = null;
  let displayPhone: string | null = null;

  const debugRes = await fetch(
    `https://graph.facebook.com/v19.0/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`,
  );
  const debugJson = (await debugRes.json()) as {
    data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> };
  };
  const wabaScope = debugJson.data?.granular_scopes?.find(
    (s) => s.scope === "whatsapp_business_management",
  );
  if (wabaScope?.target_ids?.[0]) wabaId = wabaScope.target_ids[0];

  if (wabaId) {
    const phonesRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
    );
    const phonesJson = (await phonesRes.json()) as {
      data?: Array<{ id?: string; display_phone_number?: string }>;
    };
    const phone = phonesJson.data?.[0];
    if (phone?.id) {
      phoneNumberId = phone.id;
      displayPhone = phone.display_phone_number ?? null;
    }
  }

  const { data: secretRow, error: secretError } = await admin
    .from("comm_provider_secrets")
    .upsert(
      {
        branch_id: branchId,
        provider_type: "whatsapp_cloud_api",
        secret_data: { access_token: accessToken, app_id: appId },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "branch_id,provider_type" },
    )
    .select("id")
    .single();
  if (secretError) return json({ error: "Failed to store provider secret" }, 500);

  const { error: connUpdateError } = await admin
    .from("whatsapp_connections")
    .update({
      connection_mode: "client_owned",
      billing_responsibility: "CLIENT",
      provider_secret_ref: secretRow?.id ?? null,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone: displayPhone,
      embedded_signup_status: "completed",
      onboarding_status: "connected",
      is_enabled: true,
      webhook_status: "pending_verification",
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.connectionId);

  if (connUpdateError) return json({ error: connUpdateError.message }, 500);

  // Auto-sync templates after successful signup
  try {
    await fetch(`${url}/functions/v1/sync-whatsapp-templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ connectionId: body.connectionId }),
    });
  } catch {
    // non-blocking
  }

  return json({
    ok: true,
    wabaId,
    phoneNumberId,
    displayPhone,
    embeddedSignupStatus: "completed",
  });
});
