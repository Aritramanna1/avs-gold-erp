/**
 * Builds send-email edge function payloads with firm → platform sender resolution.
 * When no active firm mailbox is configured, AVS ERP platform SMTP is used by default.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fetchTenantEmailAccounts } from "@/lib/comm/platform/tenant-email-store";

export interface SendEmailAttachmentPayload {
  filename: string;
  content: string;
  contentType?: string;
}

export interface SendEmailInvokeBody {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  branchId?: string;
  firmId?: string;
  preferPlatformEmail?: boolean;
  inviteActionUrl?: string;
  attachments?: SendEmailAttachmentPayload[];
  metadata?: Record<string, unknown>;
  verifyOnly?: boolean;
}

export async function buildSendEmailInvokeBody(input: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  branchId?: string;
  attachments?: SendEmailAttachmentPayload[];
  metadata?: Record<string, unknown>;
  verifyOnly?: boolean;
  /** Force AVS ERP platform sender (SaaS system mail). */
  forcePlatform?: boolean;
}): Promise<SendEmailInvokeBody> {
  let firmId: string | undefined;
  try {
    const { data } = await supabase.rpc("my_firm_id");
    if (data) firmId = String(data);
  } catch {
    // Some platform-only sends may not have firm context.
  }

  const meta = input.metadata ?? {};
  let preferPlatformEmail =
    input.forcePlatform === true || meta.forcePlatform === true;
  if (!preferPlatformEmail && firmId) {
    const accounts = await fetchTenantEmailAccounts({ firmId });
    const hasActiveFirmMailbox = accounts.some(
      (account) => account.isActive && Boolean(account.fromEmail.trim()),
    );
    preferPlatformEmail = !hasActiveFirmMailbox;
  } else if (!preferPlatformEmail && !firmId) {
    preferPlatformEmail = true;
  }

  const inviteActionUrl =
    typeof meta.inviteActionUrl === "string"
      ? meta.inviteActionUrl
      : typeof meta.action_url === "string"
        ? meta.action_url
        : undefined;

  return {
    to: input.to,
    subject: input.subject,
    htmlBody: input.htmlBody,
    textBody: input.textBody,
    branchId: input.branchId,
    firmId,
    preferPlatformEmail,
    inviteActionUrl,
    verifyOnly: input.verifyOnly,
    metadata: input.metadata,
    attachments: input.attachments,
  };
}
