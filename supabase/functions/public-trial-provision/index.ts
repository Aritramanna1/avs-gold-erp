/**
 * Public self-serve trial provisioning — DISABLED.
 * Tenant creation requires authorized invitation or platform onboard_tenant.
 */
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
  return json(
    {
      error:
        "Public signup is disabled. Request access from AVS or complete signup using your authorized invitation link.",
      code: "PUBLIC_SIGNUP_DISABLED",
    },
    403,
  );
});
