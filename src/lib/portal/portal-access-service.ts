/**
 * Party 360 + firm Portal Access — invitation lifecycle, delivery, and identity status.
 * Invitation tokens are tenant + party + purpose scoped; never trust client-only scoping.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { isNativeApp } from "@/lib/native/platform";
import { sendWhatsAppText } from "@/lib/comm/send-whatsapp-text";
import { shareContent } from "@/lib/native/share";
import {
  buildPortalWhatsAppMessage,
  buildShareableInviteUrl,
  PORTAL_INVITE_TTL_MS,
  sendPortalInviteEmail,
} from "@/lib/comm/invite-email-service";

export type PortalTypeKey = "customer_portal" | "supplier_portal" | "karigar_portal";

export type PortalAccessStatus =
  | "not_invited"
  | "invitation_pending"
  | "active"
  | "suspended"
  | "revoked";

export type InvitationDeliveryStatus =
  | "not_attempted"
  | "queued"
  | "delivered"
  | "failed"
  | "link_copied"
  | "shared_native"
  | "deep_link_only";

export interface PortalInvitationRow {
  id: string;
  party_id: string;
  portal_type: PortalTypeKey | string;
  recipient_email: string | null;
  recipient_phone: string | null;
  code: string;
  status: string;
  delivery_status: InvitationDeliveryStatus | string;
  delivery_channel: string | null;
  delivery_error: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  last_resent_at: string | null;
  invited_by: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PortalIdentityLink {
  identity_id: string;
  portal_type: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  party_id: string;
  link_active: boolean;
}

export interface PartyPortalAccessSnapshot {
  partyId: string;
  accessStatus: PortalAccessStatus;
  identities: PortalIdentityLink[];
  invitations: PortalInvitationRow[];
  primaryIdentity: PortalIdentityLink | null;
  pendingInvitation: PortalInvitationRow | null;
  lastLoginAt: string | null;
}

const INVITE_SELECT =
  "id,party_id,portal_type,recipient_email,recipient_phone,code,status,delivery_status,delivery_channel,delivery_error,expires_at,accepted_at,created_at,last_resent_at,invited_by,metadata";

export function normalizePortalType(portalType: string): "customer" | "karigar" | "supplier" {
  const t = portalType.toLowerCase();
  if (t.includes("karigar") || t.includes("worker")) return "karigar";
  if (t.includes("supplier") || t.includes("vendor")) return "supplier";
  return "customer";
}

export function portalTypeLabel(portalType: string): string {
  const n = normalizePortalType(portalType);
  if (n === "karigar") return "Karigar Portal";
  if (n === "supplier") return "Supplier Portal";
  return "Customer Portal";
}

async function sendPortalInvitationEmail(opts: {
  portal: "customer" | "karigar" | "supplier";
  recipientName: string;
  recipientEmail: string;
  actionUrl: string;
  inviteCode: string;
  firmName: string;
  firmId?: string;
}): Promise<{ success: boolean; error?: string }> {
  return sendPortalInviteEmail(opts);
}

export { buildShareableInviteUrl };

/** Build a shareable invite URL including both email and phone when stored on the row. */
export function buildPortalInviteShareUrl(row: {
  code: string;
  recipient_email?: string | null;
  recipient_phone?: string | null;
}): string {
  return buildShareableInviteUrl({
    code: row.code,
    email: row.recipient_email ?? undefined,
    phone: row.recipient_phone ?? undefined,
  });
}

export function accessStatusLabel(status: PortalAccessStatus): string {
  switch (status) {
    case "not_invited":
      return "Not Invited";
    case "invitation_pending":
      return "Invitation Pending";
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "revoked":
      return "Revoked";
  }
}

function deriveAccessStatus(
  identities: PortalIdentityLink[],
  invitations: PortalInvitationRow[],
): PortalAccessStatus {
  if (identities.find((i) => i.status === "active" && i.link_active)) return "active";
  if (identities.find((i) => i.status === "suspended")) return "suspended";
  const revoked = identities.find((i) => i.status === "revoked");
  const pending = invitations.find(
    (i) =>
      (i.status === "PENDING" || i.status === "SENT") &&
      new Date(i.expires_at).getTime() > Date.now(),
  );
  if (pending) return "invitation_pending";
  if (revoked || invitations.some((i) => i.status === "REVOKED")) return "revoked";
  return "not_invited";
}

export async function loadPartyPortalAccess(partyId: string): Promise<PartyPortalAccessSnapshot> {
  const [{ data: inviteData, error: inviteErr }, { data: linkData, error: linkErr }] =
    await Promise.all([
      supabase
        .from("portal_invitations" as never)
        .select(INVITE_SELECT)
        .eq("party_id", partyId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("portal_party_links" as never)
        .select(
          "party_id,is_active,portal_identity_id,portal_identities(id,portal_type,status,last_login_at,created_at)",
        )
        .eq("party_id", partyId)
        .limit(20),
    ]);

  if (inviteErr) throw inviteErr;
  if (linkErr) throw linkErr;

  const invitations = (inviteData ?? []) as unknown as PortalInvitationRow[];
  const identities: PortalIdentityLink[] = (linkData ?? []).flatMap((row: Record<string, unknown>) => {
    const pi = row.portal_identities;
    const rows = pi ? (Array.isArray(pi) ? pi : [pi]) : [];
    return rows.map((t: Record<string, unknown>) => ({
      identity_id: String(t.id),
      portal_type: String(t.portal_type ?? ""),
      status: String(t.status ?? ""),
      last_login_at: t.last_login_at ? String(t.last_login_at) : null,
      created_at: String(t.created_at ?? ""),
      party_id: String(row.party_id),
      link_active: !!row.is_active,
    }));
  });

  const accessStatus = deriveAccessStatus(identities, invitations);
  const pendingInvitation =
    invitations.find(
      (i) =>
        (i.status === "PENDING" || i.status === "SENT") &&
        new Date(i.expires_at).getTime() > Date.now(),
    ) ?? null;
  const primaryIdentity =
    identities.find((i) => i.status === "active" && i.link_active) ?? identities[0] ?? null;

  return {
    partyId,
    accessStatus,
    identities,
    invitations,
    primaryIdentity,
    pendingInvitation,
    lastLoginAt: primaryIdentity?.last_login_at ?? null,
  };
}

export async function loadFirmPortalUsers(opts?: {
  limit?: number;
  portalFilter?: "all" | "customer" | "supplier" | "karigar";
}): Promise<{ invitations: PortalInvitationRow[]; identities: PortalIdentityLink[] }> {
  const limit = opts?.limit ?? 100;
  let inviteQuery = supabase
    .from("portal_invitations" as never)
    .select(INVITE_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.portalFilter && opts.portalFilter !== "all") {
    inviteQuery = inviteQuery.eq("portal_type", `${opts.portalFilter}_portal` as never);
  }
  const { data: inviteData, error: inviteErr } = await inviteQuery;
  if (inviteErr) throw inviteErr;

  const { data: linkData, error: linkErr } = await supabase
    .from("portal_party_links" as never)
    .select(
      "party_id,is_active,portal_identity_id,portal_identities(id,portal_type,status,last_login_at,created_at)",
    )
    .limit(limit);
  if (linkErr) throw linkErr;

  let identities: PortalIdentityLink[] = (linkData ?? []).flatMap((row: Record<string, unknown>) => {
    const pi = row.portal_identities;
    const rows = pi ? (Array.isArray(pi) ? pi : [pi]) : [];
    return rows.map((t: Record<string, unknown>) => ({
      identity_id: String(t.id),
      portal_type: String(t.portal_type ?? ""),
      status: String(t.status ?? ""),
      last_login_at: t.last_login_at ? String(t.last_login_at) : null,
      created_at: String(t.created_at ?? ""),
      party_id: String(row.party_id),
      link_active: !!row.is_active,
    }));
  });

  if (opts?.portalFilter && opts.portalFilter !== "all") {
    identities = identities.filter((i) => normalizePortalType(i.portal_type) === opts.portalFilter);
  }

  return {
    invitations: (inviteData ?? []) as unknown as PortalInvitationRow[],
    identities,
  };
}

function makeInviteCode(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
      : Math.random().toString(36).substring(2, 14).toUpperCase();
  return `INV-${suffix}`;
}

export interface CreatePortalInviteInput {
  partyId: string;
  partyName: string;
  portalType: PortalTypeKey;
  email?: string;
  phone?: string;
  channel: "email" | "whatsapp" | "link" | "native_share";
  firmName?: string;
}

export interface CreatePortalInviteResult {
  invitation: PortalInvitationRow;
  inviteUrl: string;
  deliveryOk: boolean;
  deliveryMessage: string;
}

async function updateDelivery(
  id: string,
  patch: {
    status?: string;
    delivery_status: InvitationDeliveryStatus;
    delivery_channel?: string;
    delivery_error?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase
    .from("portal_invitations" as never)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

/** Revoke other active invites for the same party+portal so only one link is valid. */
async function revokeStaleActiveInvites(partyId: string, portalType: PortalTypeKey): Promise<void> {
  await supabase
    .from("portal_invitations" as never)
    .update({
      status: "REVOKED",
      updated_at: new Date().toISOString(),
      metadata: { revoked_reason: "superseded_by_new_invite" },
    } as never)
    .eq("party_id", partyId)
    .eq("portal_type", portalType)
    .in("status", ["PENDING", "SENT"] as never);
}

export async function createAndDispatchPortalInvite(
  input: CreatePortalInviteInput,
): Promise<CreatePortalInviteResult> {
  const email = input.email?.trim() || "";
  const phone = input.phone?.trim() || "";
  if (!email && !phone) {
    throw new Error("Email or phone is required to invite this party.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  const inviteCode = makeInviteCode();
  const expiresAt = new Date(Date.now() + PORTAL_INVITE_TTL_MS).toISOString();
  const inviteUrl = buildShareableInviteUrl({
    code: inviteCode,
    email: email || undefined,
    phone: phone || undefined,
  });

  await revokeStaleActiveInvites(input.partyId, input.portalType);

  const { data, error } = await supabase
    .from("portal_invitations" as never)
    .insert([
      {
        party_id: input.partyId,
        portal_type: input.portalType,
        recipient_email: email || null,
        recipient_phone: phone || null,
        code: inviteCode,
        status: "PENDING",
        delivery_status: "not_attempted",
        delivery_channel: input.channel,
        expires_at: expiresAt,
        invited_by: user?.id ?? null,
        metadata: {
          person_name: input.partyName,
          channel: input.channel,
          invite_url: inviteUrl,
          email_action_url: inviteUrl,
        },
      } as never,
    ])
    .select(INVITE_SELECT)
    .single();

  if (error) throw error;
  const invitation = data as unknown as PortalInvitationRow;

  let deliveryOk = false;
  let deliveryMessage = "Invitation created.";
  const portal = normalizePortalType(input.portalType);
  const waMessage = buildPortalWhatsAppMessage({
    partyName: input.partyName,
    firmName: input.firmName || "AVS ERP",
    portalLabel: portalTypeLabel(input.portalType),
    inviteCode,
    inviteUrl,
  });

  try {
    if (input.channel === "email") {
      if (!email) throw new Error("Email is required for email invitation.");
      const result = await sendPortalInvitationEmail({
        portal,
        recipientName: input.partyName,
        recipientEmail: email,
        actionUrl: inviteUrl,
        inviteCode,
        firmName: input.firmName || "AVS ERP",
      });
      if (result.success) {
        deliveryOk = true;
        deliveryMessage = `Invitation email sent to ${email}`;
        await supabase
          .from("portal_invitations" as never)
          .update({
            status: "SENT",
            delivery_status: "delivered",
            delivery_channel: "email",
            delivery_error: null,
            metadata: {
              ...(invitation.metadata ?? {}),
              invite_url: inviteUrl,
              email_action_url: inviteUrl,
            },
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", invitation.id);
        invitation.status = "SENT";
        invitation.delivery_status = "delivered";
      } else {
        const err = result.error ?? "Email delivery failed";
        await updateDelivery(invitation.id, {
          status: "PENDING",
          delivery_status: "failed",
          delivery_channel: "email",
          delivery_error: err,
          metadata: {
            ...(invitation.metadata ?? {}),
            invite_url: inviteUrl,
            email_action_url: inviteUrl,
          },
        });
        invitation.delivery_status = "failed";
        invitation.delivery_error = err;
        deliveryMessage = `Invitation saved but email failed: ${err}. Copy the link to share manually.`;
      }
    } else if (input.channel === "whatsapp") {
      const { loadCommunicationPolicy, canSendOfficialWhatsAppApi } = await import(
        "@/lib/comm/communication-policy"
      );
      const policy = await loadCommunicationPolicy();
      if (!canSendOfficialWhatsAppApi(policy)) {
        const shared = await shareContent({
          title: `AVS ERP ${portalTypeLabel(input.portalType)} invitation`,
          text: waMessage,
          url: inviteUrl,
        });
        deliveryOk = shared.initiated;
        await updateDelivery(invitation.id, {
          status: "SENT",
          delivery_status: shared.initiated ? "shared_native" : "link_copied",
          delivery_channel: "native_share",
          delivery_error: null,
          metadata: {
            ...(invitation.metadata ?? {}),
            invite_url: inviteUrl,
            email_action_url: inviteUrl,
          },
        });
        invitation.status = "SENT";
        invitation.delivery_status = shared.initiated ? "shared_native" : "link_copied";
        deliveryMessage = shared.initiated
          ? "Share sheet opened. The invitation is sent only if you complete it in WhatsApp or another app."
          : "Invitation link ready — copy and share manually.";
      } else {
        if (!phone) throw new Error("Phone is required for WhatsApp invitation.");
        const wa = await sendWhatsAppText({
          phone,
          message: waMessage,
          recipientName: input.partyName,
          linkedType: "portal_invitation",
          linkedId: input.partyId,
        });
        if (wa.ok && wa.via !== "whatsapp_deep_link") {
          deliveryOk = true;
          deliveryMessage = "WhatsApp invitation dispatched.";
          await updateDelivery(invitation.id, {
            status: "SENT",
            delivery_status: "delivered",
            delivery_channel: "whatsapp",
            delivery_error: null,
            metadata: {
              ...(invitation.metadata ?? {}),
              invite_url: inviteUrl,
              email_action_url: inviteUrl,
            },
          });
          invitation.status = "SENT";
          invitation.delivery_status = "delivered";
        } else if (wa.ok && wa.via === "whatsapp_deep_link") {
          deliveryOk = wa.ok;
          deliveryMessage =
            "Share sheet opened. The invitation is sent only if you complete it in WhatsApp or another app.";
          await updateDelivery(invitation.id, {
            status: "SENT",
            delivery_status: "deep_link_only",
            delivery_channel: "whatsapp",
            delivery_error: null,
            metadata: {
              ...(invitation.metadata ?? {}),
              invite_url: inviteUrl,
              email_action_url: inviteUrl,
            },
          });
          invitation.status = "SENT";
          invitation.delivery_status = "deep_link_only";
        } else {
          const err = wa.error ?? "WhatsApp send failed";
          await updateDelivery(invitation.id, {
            status: "PENDING",
            delivery_status: "failed",
            delivery_channel: "whatsapp",
            delivery_error: err,
            metadata: {
              ...(invitation.metadata ?? {}),
              invite_url: inviteUrl,
              email_action_url: inviteUrl,
            },
          });
          invitation.delivery_status = "failed";
          invitation.delivery_error = err;
          deliveryMessage = `Invitation saved but WhatsApp failed: ${err}`;
        }
      }
    } else if (input.channel === "native_share") {
      const shared = await shareContent({
        title: `AVS ERP ${portalTypeLabel(input.portalType)} invitation`,
        text: waMessage,
        url: inviteUrl,
      });
      deliveryOk = shared.initiated;
      await updateDelivery(invitation.id, {
        status: "SENT",
        delivery_status: shared.initiated ? "shared_native" : "link_copied",
        delivery_channel: "native_share",
        delivery_error: null,
        metadata: {
          ...(invitation.metadata ?? {}),
          invite_url: inviteUrl,
          email_action_url: inviteUrl,
        },
      });
      invitation.status = "SENT";
      invitation.delivery_status = shared.initiated ? "shared_native" : "link_copied";
      deliveryMessage = shared.initiated
        ? "Share sheet opened. The invitation is sent only if you complete it in WhatsApp, Email, or another app."
        : "Invitation link ready — copy and share manually.";
    } else {
      await updateDelivery(invitation.id, {
        status: "SENT",
        delivery_status: "link_copied",
        delivery_channel: "link",
        delivery_error: null,
        metadata: {
          ...(invitation.metadata ?? {}),
          invite_url: inviteUrl,
          email_action_url: inviteUrl,
        },
      });
      invitation.status = "SENT";
      invitation.delivery_status = "link_copied";
      deliveryOk = true;
      deliveryMessage = "Invitation link ready to copy.";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateDelivery(invitation.id, {
      status: "PENDING",
      delivery_status: "failed",
      delivery_channel: input.channel,
      delivery_error: msg,
      metadata: {
        ...(invitation.metadata ?? {}),
        invite_url: inviteUrl,
        email_action_url: inviteUrl,
      },
    });
    invitation.delivery_status = "failed";
    invitation.delivery_error = msg;
    deliveryMessage = `Invitation saved but delivery failed: ${msg}`;
  }

  void notifyInviteSent({
    invitationId: invitation.id,
    partyName: input.partyName,
    portalType: input.portalType,
  });

  return { invitation, inviteUrl, deliveryOk, deliveryMessage };
}

async function notifyInviteSent(input: {
  invitationId: string;
  partyName: string;
  portalType: string;
}): Promise<void> {
  try {
    const { notifyStaffPortalInvited } = await import("@/lib/notifications/erp-events");
    await notifyStaffPortalInvited(input);
  } catch {
    /* non-blocking */
  }
}

export async function markInviteLinkCopied(invitationId: string): Promise<void> {
  await updateDelivery(invitationId, {
    status: "SENT",
    delivery_status: "link_copied",
    delivery_channel: "link",
    delivery_error: null,
  });
}

export async function resendPortalInvitation(
  invitation: PortalInvitationRow,
  opts: { firmName: string; partyName: string; channel?: "email" | "whatsapp" },
): Promise<CreatePortalInviteResult> {
  await supabase
    .from("portal_invitations" as never)
    .update({
      status: "REVOKED",
      updated_at: new Date().toISOString(),
      metadata: {
        ...(invitation.metadata ?? {}),
        revoked_reason: "superseded_by_resend",
      },
    } as never)
    .eq("id", invitation.id)
    .in("status", ["PENDING", "SENT"] as never);

  const channel =
    opts.channel ??
    (invitation.recipient_email ? "email" : invitation.recipient_phone ? "whatsapp" : "link");

  return createAndDispatchPortalInvite({
    partyId: invitation.party_id,
    partyName: opts.partyName,
    portalType: invitation.portal_type as PortalTypeKey,
    email: invitation.recipient_email ?? undefined,
    phone: invitation.recipient_phone ?? undefined,
    channel: channel === "whatsapp" ? "whatsapp" : channel === "email" ? "email" : "link",
    firmName: opts.firmName,
  }).then(async (result) => {
    await supabase
      .from("portal_invitations" as never)
      .update({ last_resent_at: new Date().toISOString() } as never)
      .eq("id", result.invitation.id);
    return result;
  });
}

export async function revokePortalInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from("portal_invitations" as never)
    .update({ status: "REVOKED", updated_at: new Date().toISOString() } as never)
    .eq("id", invitationId);
  if (error) throw error;
}

export async function setPortalIdentityStatus(
  identityId: string,
  status: "active" | "suspended" | "revoked",
): Promise<void> {
  const { error } = await supabase
    .from("portal_identities" as never)
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("id", identityId);
  if (error) throw error;

  if (status === "revoked" || status === "suspended") {
    await supabase
      .from("portal_party_links" as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq("portal_identity_id", identityId);
  }
  if (status === "active") {
    await supabase
      .from("portal_party_links" as never)
      .update({ is_active: true, updated_at: new Date().toISOString() } as never)
      .eq("portal_identity_id", identityId);
  }
}

export function defaultPortalTypeForPerson(type?: string): PortalTypeKey {
  const t = String(type ?? "").toLowerCase();
  if (t === "karigar" || t === "worker") return "karigar_portal";
  if (t === "vendor" || t === "outside_worker" || t === "supplier") return "supplier_portal";
  return "customer_portal";
}

export function isNativeShareAvailable(): boolean {
  return isNativeApp() || (typeof navigator !== "undefined" && typeof navigator.share === "function");
}
