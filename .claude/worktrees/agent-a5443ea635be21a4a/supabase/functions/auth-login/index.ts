// NOTE: deliberately avoids deno.land/std imports — that registry has proven
// unreliable to fetch during bundling on this project's deploy infra (it caused
// this exact function to silently fail to deploy). Deno.serve is a built-in
// global in the Supabase Edge Function runtime, no import needed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, captchaToken } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // Read client IP from standard proxy headers, taking the first hop
    const xForwardedFor = req.headers.get("x-forwarded-for");
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    let ip = "unknown";
    if (xForwardedFor) {
      ip = xForwardedFor.split(",")[0].trim();
    } else if (cfConnectingIp) {
      ip = cfConnectingIp.trim();
    }

    // Initialize Supabase client with the service role key (allows writing to locked-down table and auth)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let isLocked = false;
    let retryAfterMinutes = 60;

    // Fail-safe wrapper: if querying database attempts table fails, log and bypass to prevent complete lockout
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Count failures for email in last 60 mins
      const { count: emailFails, error: emailErr } = await supabaseAdmin
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("email", sanitizedEmail)
        .eq("success", false)
        .gt("created_at", oneHourAgo);

      if (emailErr) {
        console.error("Error fetching email fails:", emailErr);
      }

      // Count failures for IP in last 60 mins
      const { count: ipFails, error: ipErr } = await supabaseAdmin
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip", ip)
        .eq("success", false)
        .gt("created_at", oneHourAgo);

      if (ipErr) {
        console.error("Error fetching IP fails:", ipErr);
      }

      const emailFailsCount = emailFails || 0;
      const ipFailsCount = ipFails || 0;

      if (emailFailsCount >= 5 || ipFailsCount >= 20) {
        isLocked = true;

        // Calculate dynamic minutes left based on the oldest failed attempt in the 1 hour window
        const { data: oldestAttempt, error: oldestErr } = await supabaseAdmin
          .from("login_attempts")
          .select("created_at")
          .eq(emailFailsCount >= 5 ? "email" : "ip", emailFailsCount >= 5 ? sanitizedEmail : ip)
          .eq("success", false)
          .gt("created_at", oneHourAgo)
          .order("created_at", { ascending: true })
          .limit(1);

        if (!oldestErr && oldestAttempt && oldestAttempt.length > 0) {
          const oldestTime = new Date(oldestAttempt[0].created_at).getTime();
          const msPassed = Date.now() - oldestTime;
          const msLeft = 60 * 60 * 1000 - msPassed;
          retryAfterMinutes = Math.max(1, Math.ceil(msLeft / (60 * 1000)));
        }
      }
    } catch (dbEx) {
      console.error(
        "Fail-safe: Failed to check login_attempts table. Proceeding to authenticate.",
        dbEx,
      );
    }

    if (isLocked) {
      return new Response(
        JSON.stringify({
          locked: true,
          retryAfterMinutes,
          error: `Too many failed attempts. Try again in about ${retryAfterMinutes} minutes.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // SECURITY NOTE: The database-backed login_attempts table is a secondary UX deterrent.
    // The actual un-bypassable security boundary is enforced at GoTrue itself via CAPTCHA
    // and native Supabase IP/user rate limits.
    const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
      email: sanitizedEmail,
      password: password,
      options: {
        captchaToken: captchaToken || undefined,
      },
    });

    if (authErr) {
      // Log failed attempt in the table
      try {
        await supabaseAdmin.from("login_attempts").insert({
          email: sanitizedEmail,
          ip: ip,
          success: false,
        });
      } catch (insertEx) {
        console.error("Failed to insert failed login attempt:", insertEx);
      }

      // Return a standard, generic 401 response without revealing if email exists
      return new Response(JSON.stringify({ error: "Invalid email or password." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success! Log the success row
    try {
      await supabaseAdmin.from("login_attempts").insert({
        email: sanitizedEmail,
        ip: ip,
        success: true,
      });

      // Optional: Clean up/delete previous failed attempts for this email to keep table tidy
      await supabaseAdmin
        .from("login_attempts")
        .delete()
        .eq("email", sanitizedEmail)
        .eq("success", false);
    } catch (successEx) {
      console.error("Failed to insert/clean successful login attempt:", successEx);
    }

    // Dynamic Server-Side Bootstrapping of Owner / Staff Role
    try {
      const { data: appData, error: appErr } = await supabaseAdmin
        .from("app_settings")
        .select("data")
        .eq("id", "firm")
        .maybeSingle();

      if (appErr) {
        console.error("[auth-login] Failed to read app_settings row 'firm':", appErr);
      } else {
        // Seed a payload even when the "firm" row doesn't exist yet — this is
        // the very first login on a fresh project, so there's nothing to read.
        const payload = { ...(appData?.data ?? {}) };
        const usersList: any[] = Array.isArray(payload.users) ? payload.users : [];

        // The designated platform Super Owner account — always provisioned
        // with the full permission set and never demoted, regardless of
        // bootstrap order. All other emails keep the existing first-user
        // Owner / subsequent Staff behavior, unchanged.
        const SUPER_OWNER_EMAIL = "aritramanna222@gmail.com";
        const isSuperOwnerAccount = sanitizedEmail === SUPER_OWNER_EMAIL;

        const fullPermissions = {
          dashboard_view: true,
          dashboard_edit: true,
          customers_view: true,
          customers_create: true,
          customers_edit: true,
          customers_delete: true,
          orders_view: true,
          orders_create: true,
          orders_edit: true,
          orders_delete: true,
          goldLedger_view: true,
          goldLedger_create: true,
          goldLedger_edit: true,
          workerSalary_view: true,
          workerSalary_create: true,
          workerSalary_edit: true,
          reports_view: true,
          reports_export: true,
          settings_view: true,
          settings_edit: true,
          userManagement_view: true,
          userManagement_edit: true,
        };

        const existingIdx = usersList.findIndex(
          (u: any) => u.email && u.email.toLowerCase() === sanitizedEmail,
        );
        let changed = false;

        if (existingIdx === -1) {
          const hasOwner = usersList.some((u: any) => u.role === "Owner" || u.isSuperOwner);
          const newRole = isSuperOwnerAccount ? "Super Owner" : hasOwner ? "Staff" : "Owner";

          const newUser = {
            id:
              authData.user?.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: authData.user?.email?.split("@")[0] || "System User",
            email: sanitizedEmail,
            phone: "+91 99999 99999",
            role: newRole,
            isSuperOwner: isSuperOwnerAccount || undefined,
            permissions: isSuperOwnerAccount
              ? fullPermissions
              : {
                  dashboard_view: true,
                  dashboard_edit: newRole === "Owner",
                  customers_view: true,
                  customers_create: true,
                  customers_edit: true,
                  customers_delete: newRole === "Owner",
                  orders_view: true,
                  orders_create: true,
                  orders_edit: true,
                  orders_delete: newRole === "Owner",
                  goldLedger_view: true,
                  goldLedger_create: true,
                  goldLedger_edit: newRole === "Owner",
                  workerSalary_view: true,
                  workerSalary_create: true,
                  workerSalary_edit: newRole === "Owner",
                  reports_view: true,
                  reports_export: newRole === "Owner",
                  settings_view: true,
                  settings_edit: newRole === "Owner",
                  userManagement_view: newRole === "Owner",
                  userManagement_edit: newRole === "Owner",
                },
            active: true,
            createdAt: Date.now(),
          };

          usersList.push(newUser);
          changed = true;
          console.log(
            `[auth-login] Bootstrapped new user ${sanitizedEmail} as ${newRole} server-side.`,
          );
        } else if (isSuperOwnerAccount) {
          // Profile already exists for the designated Super Owner — verify
          // it's correctly linked to this auth user and holds Super Owner
          // privileges; upgrade in place if it has drifted (e.g. was created
          // as Staff before this account was designated Super Owner).
          const current = usersList[existingIdx];
          const needsRoleFix = current.role !== "Super Owner" || !current.isSuperOwner;
          const needsLinkFix = authData.user?.id && current.id !== authData.user.id;
          const needsPermFix = Object.entries(fullPermissions).some(
            ([k, v]) => current.permissions?.[k] !== v,
          );
          const needsActiveFix = current.active !== true;

          if (needsRoleFix || needsLinkFix || needsPermFix || needsActiveFix) {
            usersList[existingIdx] = {
              ...current,
              id: authData.user?.id || current.id,
              role: "Super Owner",
              isSuperOwner: true,
              permissions: fullPermissions,
              active: true,
            };
            changed = true;
            console.log(
              `[auth-login] Verified/upgraded ${sanitizedEmail} to Super Owner server-side.`,
            );
          }
        }

        if (changed) {
          payload.users = usersList;
          const { error: upsertErr } = await supabaseAdmin
            .from("app_settings")
            .upsert({ id: "firm", data: payload }, { onConflict: "id" });
          if (upsertErr) {
            console.error("[auth-login] Failed to persist app_settings.users update:", upsertErr);
          }
        }
      }
    } catch (bootstrapEx) {
      console.error("[auth-login] Failed to bootstrap user role server-side:", bootstrapEx);
    }

    // Return the session to the client so they can call supabase.auth.setSession()
    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Edge Function unhandled exception:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected authentication error occurred on the server." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
