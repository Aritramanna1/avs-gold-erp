const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  try {
    const body = await req.json();
    const branchId = String(body.branchId || "").trim();
    const phone = String(body.phone || "").trim();
    const message = String(body.message || "").trim();
    if (!branchId || !phone || !message || message.length > 10000)
      return json({ error: "branchId, phone and message are required" }, 400);
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false } },
    );
    const { data: userData, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !userData.user) return json({ error: "Invalid session" }, 401);
    const { data: profile } = await admin
      .from("user_profiles")
      .select("firm_id,branch_id,role,active,status")
      .eq("auth_id", userData.user.id)
      .maybeSingle();
    if (
      !profile?.active ||
      profile.status !== "active" ||
      (profile.branch_id !== branchId &&
        !["owner_ceo", "admin", "saas_admin"].includes(String(profile.role)))
    )
      return json({ error: "Branch access denied" }, 403);
    const { data: config } = await admin
      .from("comm_provider_settings")
      .select("provider_type,settings")
      .eq("branch_id", branchId)
      .eq("channel", "sms")
      .eq("is_active", true)
      .order("priority")
      .limit(1)
      .maybeSingle();
    if (!config || !String(config.provider_type).startsWith("sms_"))
      return json({ error: "No active SMS provider configured" }, 409);
    const { data: vault } = await admin
      .from("comm_provider_secrets")
      .select("secret_data")
      .eq("branch_id", branchId)
      .eq("provider_type", config.provider_type)
      .maybeSingle();
    const secrets = (vault?.secret_data || {}) as Record<string, string>;
    const settings = (config.settings || {}) as Record<string, string>;
    const sender = settings.sender_id || settings.sender_phone || "MTJERP";
    let response: Response;
    if (config.provider_type === "sms_twilio") {
      if (!secrets.account_sid || !secrets.auth_token)
        return json({ error: "Twilio credentials are not configured" }, 409);
      const auth = btoa(`${secrets.account_sid}:${secrets.auth_token}`);
      const form = new URLSearchParams({ To: phone, From: sender, Body: message });
      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(secrets.account_sid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        },
      );
    } else if (config.provider_type === "sms_fast2sms") {
      if (!secrets.api_key) return json({ error: "Fast2SMS API key is not configured" }, 409);
      response = await fetch(settings.api_url || "https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: { authorization: secrets.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({
          route: "q",
          message,
          language: "english",
          flash: 0,
          numbers: phone.replace(/\D/g, ""),
        }),
      });
    } else {
      if (!secrets.api_key) return json({ error: "MSG91 API key is not configured" }, 409);
      response = await fetch(settings.api_url || "https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: { authkey: secrets.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ sender, mobiles: phone, message }),
      });
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      return json(
        { error: "SMS provider rejected the message", providerStatus: response.status },
        502,
      );
    return json({
      ok: true,
      status: "queued",
      messageId: payload.sid || payload.request_id || payload.message_id || null,
    });
  } catch (error) {
    console.error("[send-sms] request failed", error);
    return json({ error: "SMS delivery failed" }, 500);
  }
});
