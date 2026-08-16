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
  createdAt?: number;
  expiresAt?: number;
  status: "pending" | "used" | "expired";
  branchId?: string;
  workshopId?: string;
  invitedBy?: string;
  usedAt?: number;
  partyId?: string;
  customerPersonId?: string;
  isPortalInvitation?: boolean;
  firmId?: string;
  portalType?: string;
}

function mapDisplayRoleToAppRoles(displayRole: string): string[] {
  const r = String(displayRole ?? "").toLowerCase();
  if (r.includes("super owner") || r.includes("administrator")) return ["owner", "manager"];
  if (r.includes("ceo")) return ["viewer"];
  if (r.includes("branch manager")) return ["manager"];
  if (r.includes("workshop")) return ["workshop", "vault"];
  if (r.includes("accountant")) return ["accountant", "billing"];
  if (r.includes("retail") || r.includes("sales") || r.includes("counter")) return ["billing"];
  if (r.includes("crm")) return ["billing", "manager"];
  if (r.includes("manufacturing")) return ["workshop"];
  if (r.includes("karigar") || r.includes("worker")) return ["workshop"];
  if (r.includes("supplier") || r.includes("vendor")) return ["billing"];
  if (r.includes("customer")) return ["viewer"];
  return ["viewer"];
}

async function upsertUserRoles(
  admin: ReturnType<typeof createClient>,
  userId: string,
  displayRole: string,
  isPortalInvitation: boolean,
): Promise<void> {
  if (isPortalInvitation) return;
  const roles = mapDisplayRoleToAppRoles(displayRole);
  for (const role of roles) {
    const { error } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (error) {
      console.error(`[invite-accept] user_roles upsert failed for ${role}:`, error);
    }
  }
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

interface FirmInviteContext {
  appSettingsId: string;
  payload: Record<string, unknown>;
  invitations: Invitation[];
  invite: Invitation;
}

/** Resolve staff invitations stored in app_settings (firm UUID id or legacy "firm"). */
async function resolveFirmInvitationContext(
  admin: ReturnType<typeof createClient>,
  email: string,
  code: string,
): Promise<FirmInviteContext | null> {
  const { data: rows, error } = await admin
    .from("app_settings")
    .select("id, data")
    .eq("scope", "firm");

  if (error) {
    console.error("[invite-accept] Failed to list app_settings:", error);
    return null;
  }

  const candidates = rows ?? [];
  // Legacy row id="firm" last so firm-scoped UUID rows win when both exist.
  candidates.sort((a, b) => {
    if (a.id === "firm") return 1;
    if (b.id === "firm") return -1;
    return 0;
  });

  for (const row of candidates) {
    const payload = { ...((row.data as Record<string, unknown>) ?? {}) };
    const invitations: Invitation[] = Array.isArray(payload.invitations)
      ? (payload.invitations as Invitation[])
      : [];
    const invite = findInvitation(invitations, email, code);
    if (invite) {
      return { appSettingsId: String(row.id), payload, invitations, invite };
    }
  }
  return null;
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
    let appSettingsId = "firm";
    let payload: Record<string, unknown> = {};
    let invitations: Invitation[] = [];
    let invite: Invitation | undefined;
    let statusIssue: string | null = "not_found";

    const firmCtx = await resolveFirmInvitationContext(admin, email, code);
    if (firmCtx) {
      appSettingsId = firmCtx.appSettingsId;
      payload = firmCtx.payload;
      invitations = firmCtx.invitations;
      invite = firmCtx.invite;
      statusIssue = checkInviteStatus(invite);
    }

    // External portal invitations (portal_invitations table)
    if (!invite) {
      const { data: portalInvite } = await admin
        .from("portal_invitations")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (portalInvite) {
        const pi = portalInvite as Record<string, unknown>;
        const piEmail = String(pi.recipient_email ?? "").toLowerCase();
        const piPhone = String(pi.recipient_phone ?? "").replace(/\D/g, "");
        const emailNorm = email.toLowerCase();
        const emailDigits = emailNorm.replace(/\D/g, "");
        const emailMatches = !piEmail || piEmail === emailNorm;
        const phoneMatches =
          !piPhone || (emailDigits.length >= 10 && emailDigits.endsWith(piPhone.slice(-10)));
        if (!emailMatches && !phoneMatches) {
          statusIssue = "not_found";
        } else if (pi.status !== "SENT") {
          statusIssue = String(pi.status).toLowerCase();
        } else if (pi.expires_at && Date.now() > new Date(String(pi.expires_at)).getTime()) {
          statusIssue = "expired";
        } else {
          const portalRole =
            String(pi.portal_type) === "karigar_portal"
              ? "karigar"
              : String(pi.portal_type) === "supplier_portal"
                ? "supplier"
                : "customer";
          invite = {
            id: String(pi.id),
            email: piEmail || email,
            role: portalRole,
            code,
            status: "pending",
            branchId: "MAIN",
            partyId: String(pi.party_id),
            customerPersonId: String(pi.party_id),
            isPortalInvitation: true,
            firmId: String(pi.firm_id ?? ""),
            portalType: String(pi.portal_type ?? ""),
          };
          statusIssue = null;
        }
      }
    }

    const statusIssueFinal = statusIssue ?? checkInviteStatus(invite);

    // ── Mode 1: validate only ─────────────────────────────────────────────────
    if (body.mode === "validate") {
      if (statusIssueFinal) {
        return json({ valid: false, reason: statusIssueFinal, invite: invite ?? null });
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
          portalType: invite!.portalType ?? null,
          isPortalInvitation: !!invite!.isPortalInvitation,
        },
      });
    }

    // ── Mode 2: accept ────────────────────────────────────────────────────────
    if (body.mode === "accept") {
      if (statusIssueFinal) {
        return json(
          {
            error: `Invitation is ${statusIssueFinal.replace("_", " ")}.`,
            reason: statusIssueFinal,
          },
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

      if (!invite!.isPortalInvitation) {
        const { error: upsertErr } = await admin.from("app_settings").upsert(
          {
            id: appSettingsId,
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
      } else {
        await admin
          .from("portal_invitations")
          .update({
            status: "ACCEPTED",
            accepted_at: new Date().toISOString(),
            accepted_by_auth_id: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invite!.id);
      }

      // ── Portal identity provisioning (server-side tenant + party scope) ─────
      try {
        const roleLower = String(invite!.role ?? "").toLowerCase();
        const portalType =
          roleLower.includes("supplier") || roleLower.includes("vendor")
            ? "supplier"
            : roleLower.includes("karigar") || roleLower.includes("worker")
              ? "karigar"
              : roleLower.includes("customer") || roleLower.includes("portal")
                ? "customer"
                : null;

        const partyId = String(invite!.partyId ?? invite!.customerPersonId ?? "").trim() || null;

        const firmId =
          invite!.firmId && invite!.firmId.length > 10
            ? invite!.firmId
            : ((
                await admin
                  .from("organizations")
                  .select("id")
                  .eq("is_active", true)
                  .order("created_at", { ascending: true })
                  .limit(1)
                  .maybeSingle()
              ).data?.id ?? null);

        if (firmId) {
          const { data: profileRow, error: profileErr } = await admin
            .from("user_profiles")
            .upsert(
              {
                auth_id: userId,
                firm_id: firmId,
                branch_id: newUser.branchId ?? "MAIN",
                full_name: name,
                phone: phone || null,
                role: invite!.role,
                status: "active",
                active: true,
                customer_person_id: partyId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "auth_id" },
            )
            .select("id")
            .single();

          if (profileErr) {
            console.error("[invite-accept] user_profiles upsert failed:", profileErr);
          } else if (portalType && profileRow?.id) {
            const { data: identityRow, error: identityErr } = await admin
              .from("portal_identities")
              .upsert(
                {
                  auth_user_id: userId,
                  firm_id: firmId,
                  portal_type: portalType,
                  status: "active",
                  branch_id: newUser.branchId ?? "MAIN",
                  user_profile_id: profileRow.id,
                  metadata: { source: "invite-accept", invite_id: invite!.id },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "auth_user_id,firm_id,portal_type" },
              )
              .select("id")
              .single();

            if (identityErr) {
              console.error("[invite-accept] portal_identities upsert failed:", identityErr);
            } else if (partyId && identityRow?.id) {
              const { error: linkErr } = await admin.from("portal_party_links").upsert(
                {
                  portal_identity_id: identityRow.id,
                  firm_id: firmId,
                  party_id: partyId,
                  link_role: "primary",
                  is_active: true,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "portal_identity_id,party_id" },
              );
              if (linkErr) {
                console.error("[invite-accept] portal_party_links upsert failed:", linkErr);
              }
            }
          }
        }
      } catch (portalErr) {
        console.error("[invite-accept] Portal identity provisioning failed:", portalErr);
      }

      await upsertUserRoles(admin, userId, invite!.role, !!invite!.isPortalInvitation);

      console.log(`[invite-accept] Invitation accepted for ${email}, role=${invite!.role}.`);
      return json({
        success: true,
        portalType: invite!.portalType ?? null,
        role: invite!.role,
        isPortalInvitation: !!invite!.isPortalInvitation,
      });
    }

    // ── Mode 3: accept via Google OAuth (session already established) ───────
    if (body.mode === "accept_oauth") {
      if (statusIssueFinal) {
        return json(
          {
            error: `Invitation is ${statusIssueFinal.replace("_", " ")}.`,
            reason: statusIssueFinal,
          },
          409,
        );
      }

      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token) {
        return json({ error: "Google sign-in session is required." }, 401);
      }

      const { data: authData, error: authErr } = await admin.auth.getUser(token);
      if (authErr || !authData?.user) {
        return json({ error: "Invalid or expired Google session." }, 401);
      }

      const sessionEmail = String(authData.user.email ?? "").toLowerCase();
      if (sessionEmail !== email) {
        return json(
          {
            error: `Google account (${sessionEmail}) must match the invited email (${email}).`,
          },
          403,
        );
      }

      const userId = authData.user.id;
      const name =
        String(body.name || "").trim() ||
        String(authData.user.user_metadata?.full_name ?? "").trim() ||
        email.split("@")[0];
      const phone = String(body.phone || "").trim();

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
        details: `Accepted invitation via Google — ${email} assigned role: ${invite!.role}`,
        userEmail: email,
      });

      if (!invite!.isPortalInvitation) {
        const { error: upsertErr } = await admin.from("app_settings").upsert(
          {
            id: appSettingsId,
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
          return json({ error: `Could not save profile: ${upsertErr.message}` }, 500);
        }
      } else {
        await admin
          .from("portal_invitations")
          .update({
            status: "ACCEPTED",
            accepted_at: new Date().toISOString(),
            accepted_by_auth_id: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invite!.id);
      }

      await upsertUserRoles(admin, userId, invite!.role, !!invite!.isPortalInvitation);

      // Reuse portal identity block via same logic as password accept
      try {
        const roleLower = String(invite!.role ?? "").toLowerCase();
        const portalType =
          roleLower.includes("supplier") || roleLower.includes("vendor")
            ? "supplier"
            : roleLower.includes("karigar") || roleLower.includes("worker")
              ? "karigar"
              : roleLower.includes("customer") || roleLower.includes("portal")
                ? "customer"
                : null;
        const partyId = String(invite!.partyId ?? invite!.customerPersonId ?? "").trim() || null;
        const firmId =
          invite!.firmId && invite!.firmId.length > 10
            ? invite!.firmId
            : ((
                await admin
                  .from("organizations")
                  .select("id")
                  .eq("is_active", true)
                  .order("created_at", { ascending: true })
                  .limit(1)
                  .maybeSingle()
              ).data?.id ?? null);
        if (firmId) {
          await admin.from("user_profiles").upsert(
            {
              auth_id: userId,
              firm_id: firmId,
              branch_id: newUser.branchId ?? "MAIN",
              full_name: name,
              phone: phone || null,
              role: invite!.role,
              status: "active",
              active: true,
              customer_person_id: partyId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "auth_id" },
          );
          if (portalType && partyId) {
            const { data: profileRow } = await admin
              .from("user_profiles")
              .select("id")
              .eq("auth_id", userId)
              .maybeSingle();
            if (profileRow?.id) {
              const { data: identityRow } = await admin
                .from("portal_identities")
                .upsert(
                  {
                    auth_user_id: userId,
                    firm_id: firmId,
                    portal_type: portalType,
                    status: "active",
                    branch_id: newUser.branchId ?? "MAIN",
                    user_profile_id: profileRow.id,
                    metadata: { source: "invite-accept-oauth", invite_id: invite!.id },
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "auth_user_id,firm_id,portal_type" },
                )
                .select("id")
                .single();
              if (identityRow?.id) {
                await admin.from("portal_party_links").upsert(
                  {
                    portal_identity_id: identityRow.id,
                    firm_id: firmId,
                    party_id: partyId,
                    link_role: "primary",
                    is_active: true,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "portal_identity_id,party_id" },
                );
              }
            }
          }
        }
      } catch (portalErr) {
        console.error("[invite-accept] OAuth portal provisioning failed:", portalErr);
      }

      return json({
        success: true,
        portalType: invite!.portalType ?? null,
        role: invite!.role,
        isPortalInvitation: !!invite!.isPortalInvitation,
      });
    }

    return json({ error: "Unknown mode. Expected 'validate', 'accept', or 'accept_oauth'." }, 400);
  } catch (err) {
    console.error("[invite-accept] Unhandled exception:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
