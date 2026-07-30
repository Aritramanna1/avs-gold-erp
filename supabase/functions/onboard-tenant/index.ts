import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !serviceKey || !authorization) return json({ error: "Unauthorized" }, 401);

  const caller = createClient(url, anonKey ?? serviceKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData } = await caller.auth.getUser();
  if (!authData.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("role", "saas_admin")
    .maybeSingle();
  if (!role) return json({ error: "SaaS administrator access required" }, 403);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const firmName = String(body?.firmName ?? "").trim();
  const firmSlug = String(body?.firmSlug ?? "")
    .trim()
    .toLowerCase();
  const ownerName = String(body?.ownerName ?? "").trim();
  const ownerEmail = String(body?.ownerEmail ?? "")
    .trim()
    .toLowerCase();
  if (!firmName || !firmSlug || !ownerName || !ownerEmail)
    return json({ error: "Firm name, slug, owner name, and owner email are required" }, 400);

  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    ownerEmail,
    { data: { full_name: ownerName } },
  );
  if (inviteError || !invitation.user)
    return json({ error: inviteError?.message ?? "Owner invitation failed" }, 400);

  const { data, error } = await admin.rpc("onboard_tenant", {
    p_auth_id: invitation.user.id,
    p_firm_name: firmName,
    p_firm_slug: firmSlug,
    p_owner_full_name: ownerName,
  });
  if (error) {
    await admin.auth.admin.deleteUser(invitation.user.id);
    return json({ error: error.message }, 400);
  }
  return json({ success: true, onboarding: data });
});
