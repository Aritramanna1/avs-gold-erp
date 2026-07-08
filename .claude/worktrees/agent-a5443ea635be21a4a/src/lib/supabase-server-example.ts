import { withSupabase } from "@supabase/server";

/**
 * Example handler requiring "user" auth mode.
 * This validates that the request contains a valid user JWT in the Authorization header.
 * It provides:
 *  - ctx.supabase: RLS-scoped client initialized with the user's JWT.
 *  - ctx.supabaseAdmin: Admin client that bypasses RLS (initialized with service_role key).
 */
export const userAuthenticatedHandler = {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      // Query a table (e.g., "todos") using the user's RLS-scoped client
      const { data, error } = await ctx.supabase.from("todos").select("*");

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: "Successfully fetched authenticated user data",
        data,
      });
    } catch (err: any) {
      return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
  }),
};

/**
 * Example handler using "publishable" auth mode.
 * Useful for public endpoints that require a valid Supabase publishable key but not a specific user login.
 */
export const publishableKeyHandler = {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { data, error } = await ctx.supabase.from("products").select("*").limit(10);

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: "Successfully fetched public products",
        data,
      });
    } catch (err: any) {
      return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
  }),
};

/**
 * Example handler using "secret" auth mode.
 * Requires the service role / secret key to access. Great for background jobs, webhooks, or admin tools.
 */
export const secretAdminHandler = {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    try {
      // Perform an admin operation bypassing RLS
      const { data, error } = await ctx.supabaseAdmin.from("app_settings").select("*");

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: "Successfully fetched admin app settings",
        data,
      });
    } catch (err: any) {
      return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
  }),
};

/**
 * Example handler with "none" auth mode.
 * Anyone can access this endpoint without any keys.
 */
export const publicEndpointHandler = {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    return Response.json({
      success: true,
      message: "This is a completely public, unauthenticated endpoint",
      timestamp: new Date().toISOString(),
    });
  }),
};
