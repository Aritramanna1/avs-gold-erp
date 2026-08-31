import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Queue platform receipt email + optional WhatsApp after successful payment capture. */
export async function queuePlatformPaymentNotifications(
  admin: SupabaseClient,
  input: {
    firmId: string;
    invoiceId: string | null;
    paymentId: string;
    amountPaise: number;
  },
): Promise<{ emailQueued: boolean; receiptId: string | null }> {
  const { firmId, invoiceId, paymentId, amountPaise } = input;

  const { data: receipt } = await admin
    .from("platform_receipts")
    .select("id, receipt_no, issued_at")
    .eq("platform_payment_id", paymentId)
    .maybeSingle();

  const [{ data: org }, { data: invoice }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", firmId).maybeSingle(),
    invoiceId
      ? admin
          .from("platform_invoices")
          .select("invoice_no, billing_name, billing_email, total_paise, status")
          .eq("id", invoiceId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: ownerProfiles } = await admin
    .from("user_profiles")
    .select("email, full_name, phone")
    .eq("firm_id", firmId)
    .eq("role", "owner")
    .eq("active", true)
    .limit(3);

  const billingEmail =
    (invoice?.billing_email as string | undefined) ||
    (ownerProfiles?.[0]?.email as string | undefined) ||
    null;

  const amountRs = (amountPaise / 100).toFixed(2);
  const invoiceNo = (invoice?.invoice_no as string) ?? "—";
  const receiptNo = (receipt?.receipt_no as string) ?? "—";
  const firmName = (org?.name as string) ?? "Tenant";

  let emailQueued = false;

  if (billingEmail) {
    const subject = `Payment received — ${invoiceNo} (Rs. ${amountRs})`;
    const htmlBody = `<p>Dear ${firmName},</p>
<p>We have received your payment of <strong>Rs. ${amountRs}</strong> for invoice <strong>${invoiceNo}</strong>.</p>
<p>Receipt: <strong>${receiptNo}</strong></p>
<p>Thank you for choosing Ornexa.</p>`;

    await admin.from("email_outbox").insert({
      firm_id: firmId,
      recipient_email: billingEmail,
      subject,
      template_key: "platform_payment_receipt",
      event_key: "payment.received",
      entity_type: "platform_payment",
      entity_id: paymentId,
      status: "queued",
    });

    await admin.from("communication_jobs").insert({
      firm_id: firmId,
      product_id: "ORNEXA",
      event_key: "payment.received",
      channels_requested: ["email"],
      status: "pending",
      recipient: { email: billingEmail, name: firmName },
      payload: {
        subject,
        htmlBody,
        invoice_no: invoiceNo,
        receipt_no: receiptNo,
        amount_display: `Rs. ${amountRs}`,
      },
      reference_type: "platform_payment",
      reference_id: paymentId,
    });

    emailQueued = true;
  }

  const ownerPhone = ownerProfiles?.find((p) => p.phone)?.phone as string | undefined;
  if (ownerPhone) {
    const { data: waAccount } = await admin
      .from("tenant_whatsapp_accounts")
      .select("id")
      .eq("firm_id", firmId)
      .eq("is_active", true)
      .maybeSingle();

    if (waAccount?.id) {
      await admin.from("communication_jobs").insert({
        firm_id: firmId,
        product_id: "ORNEXA",
        event_key: "payment.received",
        channels_requested: ["whatsapp"],
        status: "pending",
        recipient: { phone: ownerPhone, name: firmName },
        payload: {
          message: `Payment received: Rs. ${amountRs} for invoice ${invoiceNo}. Receipt ${receiptNo}. — Ornexa`,
        },
        reference_type: "platform_payment",
        reference_id: paymentId,
      });
    }
  }

  return { emailQueued, receiptId: (receipt?.id as string) ?? null };
}
