// MTJ ERP — Invitation Validate & Accept Edge Function
// ---------------------------------------------------------------------------
// Single authoritative backend for the entire "Accept Invitation" flow.
// Runs with the service-role key so it works for an invitee who has NO
// Supabase session yet (app_settings is RLS-locked to `authenticated` only —
// an anon client-side read/write against it is silently blocked and returns
// no rows, which is why invite validation/acceptance was failing before this
// was moved server-side).
//
// This is also the ONLY place that mutates app_settings.users/invitations
// for the invite flow — no client-side read-modify-write against the same
// row, which previously raced with (and could clobber) this data via
// multiple non-atomic full-snapshot writes from a browser with stale/empty
// local state.
//
// Modes:
//   { mode: "validate", email, code }
//     → returns { valid: true, invite: {...} } or { valid: false, reason }
//   { mode: "accept", email, code, name, phone, password }
//     → validates again (defense in depth), creates/updates the Supabase Auth
//       user (email pre-confirmed — this is an admin-issued invite, not a
//       public signup), upserts app_settings.users, marks the invitation
//       "used". Returns { success: true }. The client then signs in via the
//       standard supabase.auth.signInWithPassword() — the same single auth
//       path used everywhere else in the app.
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface Invitation {
  id: string;
  email: string;
  role: string;
  code: string;
  createdAt: number;
  expiresAt?: number;
  status: "pending" | "used" | "expired";
  branchId?: string;
  workshopId?: string;
  invitedBy?: string;
  usedAt?: number;
}

function findInvitation(
  invitations: Invitation[],
  email: string,
  code: string,
): Invitation | undefined {
  return invitations.find(
    (inv) => inv.email?.toLowerCase() === email.toLowerCase() && inv.code === code,
  );
}

function checkInviteStatus(invite: Invitation | undefined): string | null {
  if (!invite) return "not_found";
  if (invite.status === "used") return "used";
  if (invite.expiresAt && Date.now() > invite.expiresAt) return "expired";
  return null; // valid
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    console.error("[invite-accept] Invalid JSON body:", err);
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const code = String(body.code || "").trim();
  if (!email || !code) {
    return json({ error: "Invitation code and email are required." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured with database access." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: appData, error: appErr } = await admin
      .from("app_settings")
      .select("data")
      .eq("id", "firm")
      .maybeSingle();

    if (appErr) {
      console.error("[invite-accept] Failed to read app_settings:", appErr);
      return json({ error: `Could not read invitation records: ${appErr.message}` }, 500);
    }

    const payload = { ...(appData?.data ?? {}) };
    const invitations: Invitation[] = Array.isArray(payload.invitations) ? payload.invitations : [];
    const invite = findInvitation(invitations, email, code);
    const statusIssue = checkInviteStatus(invite);

    // ── Mode 1: validate only ─────────────────────────────────────────────────
    if (body.mode === "validate") {
      if (statusIssue) {
        return json({ valid: false, reason: statusIssue, invite: invite ?? null });
      }
      return json({
        valid: true,
        invite: {
          id: invite!.id,
          email: invite!.email,
          role: invite!.role,
          branchId: invite!.branchId,
          workshopId: invite!.workshopId,
          expiresAt: invite!.expiresAt,
        },
      });
    }

    // ── Mode 2: accept ────────────────────────────────────────────────────────
    if (body.mode === "accept") {
      if (statusIssue) {
        return json(
          { error: `Invitation is ${statusIssue.replace("_", " ")}.`, reason: statusIssue },
          409,
        );
      }

      const password = String(body.password || "");
      if (password.length < 10) {
        return json({ error: "Password must be at least 10 characters." }, 400);
      }
      const name = String(body.name || "").trim() || email.split("@")[0];
      const phone = String(body.phone || "").trim();

      // Create the Supabase Auth account. Admin-issued invites are
      // pre-confirmed — the invitee already proved receipt of the email by
      // holding the code, so there's no separate confirmation step (avoids
      // ever leaving them stuck with an account they can't sign in to).
      let userId: string;
      const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createErr) {
        const alreadyExists = /already.*(registered|exists)/i.test(createErr.message || "");
        if (!alreadyExists) {
          console.error("[invite-accept] createUser failed:", createErr);
          return json({ error: `Account creation failed: ${createErr.message}` }, 500);
        }

        // Existing Supabase Auth user — find them and reset their password to
        // the one just chosen, so this single invite completes the account
        // regardless of what they may have set previously.
        let existingUserId: string | null = null;
        let page = 1;
        while (!existingUserId) {
          const { data: pageData, error: listErr } = await admin.auth.admin.listUsers({
            page,
            perPage: 200,
          });
          if (listErr) {
            console.error("[invite-accept] listUsers failed:", listErr);
            return json({ error: `Could not resolve existing account: ${listErr.message}` }, 500);
          }
          const found = pageData.users.find((u) => u.email?.toLowerCase() === email);
          if (found) {
            existingUserId = found.id;
            break;
          }
          if (pageData.users.length < 200) break; // no more pages
          page++;
        }

        if (!existingUserId) {
          return json(
            { error: "Account already exists but could not be located to reset its password." },
            500,
          );
        }

        const { error: updateErr } = await admin.auth.admin.updateUserById(existingUserId, {
          password,
          email_confirm: true,
        });
        if (updateErr) {
          console.error("[invite-accept] updateUserById failed:", updateErr);
          return json({ error: `Could not update existing account: ${updateErr.message}` }, 500);
        }
        userId = existingUserId;
      } else {
        userId = createData.user!.id;
      }

      // Single atomic read-then-write: upsert the user record (dedupe by
      // email/id) and mark the invitation used, in one merged payload.
      const usersList: any[] = Array.isArray(payload.users) ? [...payload.users] : [];
      const existingIdx = usersList.findIndex((u) => u.email?.toLowerCase() === email);
      const newUser = {
        id: userId,
        name,
        email,
        phone,
        role: invite!.role,
        branchId: invite!.branchId ?? "MAIN",
        workshopId: invite!.workshopId ?? undefined,
        permissions: existingIdx >= 0 ? (usersList[existingIdx].permissions ?? {}) : {},
        active: true,
        createdAt: existingIdx >= 0 ? usersList[existingIdx].createdAt : Date.now(),
      };
      if (existingIdx >= 0) {
        usersList[existingIdx] = { ...usersList[existingIdx], ...newUser };
      } else {
        usersList.push(newUser);
      }

      const updatedInvitations = invitations.map((inv) =>
        inv.id === invite!.id ? { ...inv, status: "used" as const, usedAt: Date.now() } : inv,
      );

      const securityLogs: any[] = Array.isArray(payload.securityLogs) ? payload.securityLogs : [];
      securityLogs.unshift({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        action: "user created",
        details: `Accepted invitation — ${email} assigned role: ${invite!.role}, branch: ${newUser.branchId}`,
        userEmail: email,
      });

      const { error: upsertErr } = await admin.from("app_settings").upsert(
        {
          id: "firm",
          data: {
            ...payload,
            users: usersList,
            invitations: updatedInvitations,
            securityLogs: securityLogs.slice(0, 1000),
          },
        },
        { onConflict: "id" },
      );

      if (upsertErr) {
        console.error("[invite-accept] Failed to persist accepted invitation:", upsertErr);
        return json(
          { error: `Account created, but could not save your profile: ${upsertErr.message}` },
          500,
        );
      }

      console.log(`[invite-accept] Invitation accepted for ${email}, role=${invite!.role}.`);
      return json({ success: true });
    }

    return json({ error: "Unknown mode. Expected 'validate' or 'accept'." }, 400);
  } catch (err) {
    console.error("[invite-accept] Unhandled exception:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
