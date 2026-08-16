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

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const firmName = String(body?.firmName ?? "").trim();
  const firmSlug = String(body?.firmSlug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const ownerName = String(body?.ownerName ?? "").trim();
  const ownerPhone = String(body?.ownerPhone ?? "").trim();
  const productId = String(body?.productId ?? "ORNEXA").trim();

  if (!firmName || !firmSlug || !ownerName) {
    return json({ error: "Company name, slug, and your name are required" }, 400);
  }

  const { data, error } = await caller.rpc("provision_public_trial", {
    p_firm_name: firmName,
    p_firm_slug: firmSlug,
    p_owner_full_name: ownerName,
    p_owner_phone: ownerPhone,
    p_owner_email: authData.user.email ?? "",
    p_product_id: productId,
  });

  if (error) return json({ error: error.message }, 400);

  const row = Array.isArray(data) ? data[0] : data;
  return json({ ok: true, provisioning: row });
});
