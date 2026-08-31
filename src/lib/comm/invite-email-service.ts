/**
 * Unified invite email rendering and dispatch for staff + portal invitations.
 */
import { getPublicInviteOrigin } from "@/lib/website/public-site-url";
import {
  ensurePortalInviteEmailContent,
  renderEmailTemplate,
  type EmailTemplateType,
  type EmailTemplateVariables,
} from "@/lib/comm/email-templates";
import { resolvePublishedEmailTemplate } from "@/lib/comm/platform/email-template-library-store";
import { resolveEmailActionUrl } from "@/lib/notifications/href-policy";
import { sendGenericEmail } from "@/lib/email-service";
import { sanitizeEmailHtml } from "@/lib/sanitize-html";
import {
  resolveEmailBrandVars,
  wrapBrandedEmailHtml,
} from "@/lib/comm/branded-email-shell";

export const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PORTAL_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export function buildShareableInviteUrl(opts: {
  code: string;
  email?: string;
  phone?: string;
}): string;
export function buildShareableInviteUrl(code: string, contact: string): string;
export function buildShareableInviteUrl(
  codeOrOpts: string | { code: string; email?: string; phone?: string },
  contact?: string,
): string {
  if (typeof codeOrOpts === "object") {
    const q = new URLSearchParams({ code: codeOrOpts.code });
    const email = codeOrOpts.email?.trim().toLowerCase();
    const phone = codeOrOpts.phone?.replace(/\D/g, "");
    if (email?.includes("@")) q.set("email", email);
    if (phone && phone.length >= 10) q.set("phone", phone);
    return `${getPublicInviteOrigin()}/invite/accept?${q.toString()}`;
  }
  const c = contact ?? "";
  if (c.includes("@")) {
    return buildShareableInviteUrl({ code: codeOrOpts, email: c });
  }
  return buildShareableInviteUrl({ code: codeOrOpts, phone: c });
}

function interpolateTemplate(
  template: string,
  vars: EmailTemplateVariables,
): string {
  const map: Record<string, string> = {
    recipient_name: vars.recipientName ?? "",
    tenant_name: vars.firmName ?? "",
    firm_name: vars.firmName ?? "",
    product_name: vars.productName ?? "AVS ERP",
    action_url: vars.actionUrl ?? "",
    invite_code: vars.inviteCode ?? "",
    role: vars.roleOrPortal ?? "",
    branch_name: vars.branchName ?? "",
    expiry_hours: vars.expiryHours ?? "24",
    expiry_days: vars.expiryDays ?? "7",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? `{{${key}}}`);
}

export async function renderInviteEmail(opts: {
  templateType: EmailTemplateType;
  vars: EmailTemplateVariables;
  firmId?: string;
  inviteCode?: string;
  actionUrl: string;
  isPortalInvite?: boolean;
}): Promise<{ subject: string; html: string; text: string }> {
  const actionUrl = resolveEmailActionUrl(opts.actionUrl) ?? opts.actionUrl;
  const vars: EmailTemplateVariables = { ...opts.vars, actionUrl };

  const published = await resolvePublishedEmailTemplate(opts.templateType, opts.firmId);
  let rendered: { subject: string; html: string; text: string };

  if (published) {
    const brand = resolveEmailBrandVars();
    const subject = interpolateTemplate(published.subjectTemplate, vars);
    const innerHtml = sanitizeEmailHtml(interpolateTemplate(published.htmlTemplate, vars));
    rendered = {
      subject,
      html: wrapBrandedEmailHtml({
        title: subject,
        innerHtml,
        firmName: vars.firmName ?? brand.firmName,
        logoUrl: vars.logoUrl ?? brand.logoUrl,
        phone: brand.phone,
        email: brand.email,
        address: brand.address,
        tagline: brand.tagline,
        website: brand.website,
      }),
      text: interpolateTemplate(published.textTemplate ?? published.subjectTemplate, vars),
    };
  } else {
    rendered = renderEmailTemplate(opts.templateType, vars);
  }

  if (opts.isPortalInvite) {
    const ensured = ensurePortalInviteEmailContent(
      rendered.html,
      rendered.text,
      actionUrl,
      opts.inviteCode ?? vars.inviteCode,
    );
    return { subject: rendered.subject, ...ensured };
  }

  return rendered;
}

export async function sendStaffInviteEmail(opts: {
  recipientEmail: string;
  recipientName?: string;
  firmName: string;
  role: string;
  branchName: string;
  inviteCode: string;
  actionUrl: string;
  firmId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const actionUrl = resolveEmailActionUrl(opts.actionUrl) ?? opts.actionUrl;
  if (!actionUrl) {
    return { success: false, error: "Invite link could not be generated." };
  }

  const rendered = await renderInviteEmail({
    templateType: "internal_user_invitation",
    vars: {
      recipientName: opts.recipientName || opts.recipientEmail.split("@")[0],
      recipientEmail: opts.recipientEmail,
      firmName: opts.firmName,
      productName: "AVS ERP",
      actionUrl,
      inviteCode: opts.inviteCode,
      roleOrPortal: opts.role,
      branchName: opts.branchName,
      expiryDays: "7",
    },
    firmId: opts.firmId,
    actionUrl,
    inviteCode: opts.inviteCode,
  });

  return sendGenericEmail({
    to: opts.recipientEmail,
    subject: rendered.subject,
    htmlBody: rendered.html,
    textBody: rendered.text,
    metadata: {
      forcePlatform: true,
      inviteActionUrl: actionUrl,
      emailKind: "staff_invitation",
    },
  });
}

export async function sendPortalInviteEmail(opts: {
  portal: "customer" | "karigar" | "supplier";
  recipientName: string;
  recipientEmail: string;
  actionUrl: string;
  inviteCode: string;
  firmName: string;
  firmId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const templateType: EmailTemplateType =
    opts.portal === "karigar"
      ? "karigar_portal_invitation"
      : opts.portal === "supplier"
        ? "supplier_portal_invitation"
        : "customer_portal_invitation";

  const actionUrl = resolveEmailActionUrl(opts.actionUrl) ?? opts.actionUrl;
  if (!actionUrl) {
    return { success: false, error: "Invite link could not be generated for this email." };
  }

  const rendered = await renderInviteEmail({
    templateType,
    vars: {
      recipientName: opts.recipientName,
      recipientEmail: opts.recipientEmail,
      firmName: opts.firmName,
      productName: "AVS ERP",
      actionUrl,
      inviteCode: opts.inviteCode,
      roleOrPortal: opts.portal,
      expiryHours: "24",
    },
    firmId: opts.firmId,
    actionUrl,
    inviteCode: opts.inviteCode,
    isPortalInvite: true,
  });

  return sendGenericEmail({
    to: opts.recipientEmail,
    subject: rendered.subject,
    htmlBody: rendered.html,
    textBody: rendered.text,
    metadata: {
      forcePlatform: true,
      inviteActionUrl: actionUrl,
      emailKind: "portal_invitation",
    },
  });
}

export function buildPortalWhatsAppMessage(opts: {
  partyName: string;
  firmName: string;
  portalLabel: string;
  inviteCode: string;
  inviteUrl: string;
}): string {
  return (
    `Hello ${opts.partyName}, you have been invited to the ${opts.portalLabel} on AVS ERP (${opts.firmName}). ` +
    `Code: ${opts.inviteCode}. Accept here: ${opts.inviteUrl} (valid 24 hours)`
  );
}
