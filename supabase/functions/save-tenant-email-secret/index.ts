/**
 * Save tenant email provider secrets (SMTP password, API keys) server-side only.
 * Links to tenant_email_accounts + comm_provider_secrets by branch.
 */
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

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  try {
    const body = await req.json();
    const accountId = String(body.accountId ?? "").trim();
    const branchId = String(body.branchId ?? "").trim();
    const providerType = String(body.providerType ?? "email_smtp").trim();
    const secretData = body.secretData;

    if (!branchId || !secretData || typeof secretData !== "object") {
      return json({ error: "branchId and secretData required" }, 400);
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
      .select("firm_id, branch_id, role, active, status")
      .eq("auth_id", userData.user.id)
      .maybeSingle();
    const isAdmin = [
      "owner_ceo",
      "saas_admin",
      "admin",
      "owner",
      "super_owner",
      "manager",
    ].includes(String(profile?.role ?? ""));
    if (
      !profile?.active ||
      profile.status !== "active" ||
      (!isAdmin && profile.branch_id !== branchId)
    ) {
      return json({ error: "Not authorized for this branch" }, 403);
    }

    const allowedKeys = new Set(["password", "api_key", "access_token", "username"]);
    const incoming = Object.fromEntries(
      Object.entries(secretData as Record<string, unknown>)
        .filter(([k, v]) => allowedKeys.has(k) && typeof v === "string" && String(v).trim())
        .map(([k, v]) => [k, String(v).trim()]),
    );
    if (Object.keys(incoming).length === 0) {
      return json({ error: "No valid secrets provided" }, 400);
    }

    const { data: existing } = await admin
      .from("comm_provider_secrets")
      .select("secret_data")
      .eq("branch_id", branchId)
      .eq("provider_type", providerType)
      .maybeSingle();

    const merged = { ...(existing?.secret_data ?? {}), ...incoming };
    await admin
      .from("comm_provider_secrets")
      .upsert(
        { branch_id: branchId, provider_type: providerType, secret_data: merged },
        { onConflict: "branch_id,provider_type" },
      );

    if (accountId) {
      await admin
        .from("tenant_email_accounts")
        .update({
          last_test_at: null,
          last_test_status: "secret_updated",
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);
    }

    return json({ ok: true, configured: true });
  } catch (e) {
    console.error("[save-tenant-email-secret]", e);
    return json({ error: "Request failed" }, 500);
  }
});
