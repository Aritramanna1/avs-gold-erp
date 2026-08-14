/**
 * Ornexa Central Email Template Engine
 * Standardized, responsive HTML email templates for Invitations, Auth, Documents, and Notifications.
 */

export type EmailTemplateType =
  | "internal_user_invitation"
  | "customer_portal_invitation"
  | "karigar_portal_invitation"
  | "supplier_portal_invitation"
  | "password_reset"
  | "document_ready"
  | "support_update"
  | "security_alert";

export interface EmailTemplateVariables {
  firmName?: string;
  recipientName: string;
  recipientEmail: string;
  roleOrPortal?: string;
  actionUrl?: string;
  otpCode?: string;
  documentType?: string;
  documentNumber?: string;
  amountFormatted?: string;
  ticketNumber?: string;
  ticketSubject?: string;
  ticketStatus?: string;
  alertDetails?: string;
  logoUrl?: string;
}

export function renderEmailTemplate(
  templateType: EmailTemplateType,
  vars: EmailTemplateVariables,
): { subject: string; html: string; text: string } {
  const firm = vars.firmName || "Ornexa Jewellery ERP";
  const primaryColor = "#d97706"; // Ornexa Gold

  const headerHtml = `
    <div style="background-color: #111827; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="color: ${primaryColor}; font-family: serif; margin: 0; font-size: 24px; letter-spacing: 0.5px;">${firm}</h2>
      <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Professional Jewellery ERP</p>
    </div>
  `;

  const footerHtml = `
    <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 11px; margin: 0;">This is an automated notification from ${firm}. Please do not reply directly to this email.</p>
    </div>
  `;

  switch (templateType) {
    case "internal_user_invitation":
      return {
        subject: `Invitation to join ${firm} as ${vars.roleOrPortal || "Team Member"}`,
        html: `
          <div style="max-width: 560px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${headerHtml}
            <div style="padding: 32px 24px; background: #ffffff;">
              <h3 style="color: #1f2937; margin-top: 0;">Hello ${vars.recipientName},</h3>
              <p style="color: #4b5563; line-height: 1.6;">You have been invited to access <strong>${firm}</strong> with the role of <strong>${vars.roleOrPortal}</strong>.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${vars.actionUrl}" style="background-color: ${primaryColor}; color: #000000; font-weight: 600; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation & Set Password</a>
              </div>
              <p style="color: #6b7280; font-size: 12px;">This invitation link will expire in 48 hours.</p>
            </div>
            ${footerHtml}
          </div>
        `,
        text: `Hello ${vars.recipientName},\n\nYou have been invited to join ${firm} as ${vars.roleOrPortal}.\n\nAccept your invitation here: ${vars.actionUrl}`,
      };

    case "customer_portal_invitation":
      return {
        subject: `Your Digital Jewellery Portal Access — ${firm}`,
        html: `
          <div style="max-width: 560px; margin: 0 auto; font-family: sans-serif; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${headerHtml}
            <div style="padding: 32px 24px; background: #ffffff;">
              <h3 style="color: #1f2937; margin-top: 0;">Welcome ${vars.recipientName},</h3>
              <p style="color: #4b5563; line-height: 1.6;">Access your digital invoices, certificate downloads, order live tracking, and gold passbook anytime on our Customer Portal.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${vars.actionUrl}" style="background-color: ${primaryColor}; color: #000000; font-weight: 600; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Access Customer Portal</a>
              </div>
            </div>
            ${footerHtml}
          </div>
        `,
        text: `Welcome ${vars.recipientName},\n\nAccess your customer portal for ${firm}: ${vars.actionUrl}`,
      };

    case "password_reset":
      return {
        subject: `Password Reset Request — ${firm}`,
        html: `
          <div style="max-width: 560px; margin: 0 auto; font-family: sans-serif; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${headerHtml}
            <div style="padding: 32px 24px; background: #ffffff;">
              <h3 style="color: #1f2937; margin-top: 0;">Password Reset</h3>
              <p style="color: #4b5563; line-height: 1.6;">We received a request to reset your password for ${firm}. Use the OTP code below or click the link:</p>
              ${
                vars.otpCode
                  ? `<div style="text-align: center; margin: 24px 0; background: #fef3c7; padding: 16px; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #92400e;">${vars.otpCode}</div>`
                  : ""
              }
              ${
                vars.actionUrl
                  ? `<div style="text-align: center; margin: 24px 0;"><a href="${vars.actionUrl}" style="background-color: ${primaryColor}; color: #000000; font-weight: 600; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></div>`
                  : ""
              }
              <p style="color: #6b7280; font-size: 12px;">If you did not make this request, please contact your administrator immediately.</p>
            </div>
            ${footerHtml}
          </div>
        `,
        text: `Password reset request for ${firm}. OTP: ${vars.otpCode || ""} Link: ${vars.actionUrl || ""}`,
      };

    case "document_ready":
      return {
        subject: `${vars.documentType || "Invoice"} #${vars.documentNumber || ""} from ${firm}`,
        html: `
          <div style="max-width: 560px; margin: 0 auto; font-family: sans-serif; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${headerHtml}
            <div style="padding: 32px 24px; background: #ffffff;">
              <h3 style="color: #1f2937; margin-top: 0;">Dear ${vars.recipientName},</h3>
              <p style="color: #4b5563; line-height: 1.6;">Your <strong>${vars.documentType || "Invoice"} #${vars.documentNumber}</strong> for <strong>${vars.amountFormatted}</strong> is ready for viewing and download.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${vars.actionUrl}" style="background-color: ${primaryColor}; color: #000000; font-weight: 600; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Download PDF</a>
              </div>
            </div>
            ${footerHtml}
          </div>
        `,
        text: `${vars.documentType} #${vars.documentNumber} from ${firm}: ${vars.actionUrl}`,
      };

    default:
      return {
        subject: `Notification from ${firm}`,
        html: `
          <div style="max-width: 560px; margin: 0 auto; font-family: sans-serif; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${headerHtml}
            <div style="padding: 32px 24px; background: #ffffff;">
              <h3 style="color: #1f2937;">Hello ${vars.recipientName},</h3>
              <p style="color: #4b5563;">${vars.alertDetails || "You have a new notification from your ERP system."}</p>
            </div>
            ${footerHtml}
          </div>
        `,
        text: `Notification from ${firm}: ${vars.alertDetails || ""}`,
      };
  }
}
