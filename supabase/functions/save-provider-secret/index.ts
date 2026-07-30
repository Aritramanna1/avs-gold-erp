const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  try {
    const body = await req.json();
    const branchId = String(body.branchId || "").trim();
    const providerType = String(body.providerType || "").trim();
    const secretData = body.secretData;
    if (!branchId || !providerType || !secretData || typeof secretData !== "object") {
      return json({ error: "branchId, providerType and secretData are required" }, 400);
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const token = auth.slice("Bearer ".length);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

    const { data: profile } = await admin
      .from("user_profiles")
      .select("firm_id,branch_id,role,active,status")
      .eq("auth_id", userData.user.id)
      .maybeSingle();
    const isAdmin = ["owner_ceo", "saas_admin", "admin"].includes(String(profile?.role));
    if (
      !profile?.active ||
      profile.status !== "active" ||
      (!isAdmin && profile.branch_id !== branchId)
    ) {
      return json({ error: "You are not allowed to manage this branch" }, 403);
    }

    const allowedKeys = new Set([
      "access_token",
      "api_key",
      "password",
      "webhook_verify_token",
      "webhook_secret",
      "username",
      "account_sid",
      "auth_token",
    ]);
    const incoming = Object.fromEntries(
      Object.entries(secretData as Record<string, unknown>)
        .filter(
          ([key, value]) =>
            allowedKeys.has(key) && typeof value === "string" && value.length <= 4096,
        )
        .filter(([, value]) => String(value).trim().length > 0),
    );
    if (Object.keys(incoming).length === 0) {
      return json({ error: "At least one non-empty supported secret is required" }, 400);
    }
    const { data: existing } = await admin
      .from("comm_provider_secrets")
      .select("secret_data")
      .eq("branch_id", branchId)
      .eq("provider_type", providerType)
      .maybeSingle();
    const mergedSecretData = { ...(existing?.secret_data ?? {}), ...incoming };

    const { error } = await admin.from("comm_provider_secrets").upsert(
      {
        branch_id: branchId,
        provider_type: providerType,
        secret_data: mergedSecretData,
      },
      { onConflict: "branch_id,provider_type" },
    );
    if (error) return json({ error: "Secret storage failed" }, 500);
    return json({ ok: true, providerType, configured: true });
  } catch (error) {
    console.error("[save-provider-secret] request failed", error);
    return json({ error: "Invalid request" }, 400);
  }
});
