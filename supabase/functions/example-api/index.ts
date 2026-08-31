import { withSupabase } from "npm:@supabase/server";

// CORS headers for client response
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Supabase Edge Function using @supabase/server SDK
 */
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    // Handle CORS Preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      // ctx.supabase is automatically RLS-scoped to the user making the request!
      const { data, error } = await ctx.supabase.from("login_attempts").select("*").limit(5);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Securely retrieved user's login attempts",
          data,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || "An unexpected error occurred" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }),
};
