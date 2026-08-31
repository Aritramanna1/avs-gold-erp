import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadRazorpayCredentials, RazorpayAdapter } from "../_shared/payment/razorpay-adapter.ts";
import { queuePlatformPaymentNotifications } from "../_shared/payment/post-payment-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server misconfigured" }, 500);

  const admin = createClient(url, serviceKey);
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const creds = await loadRazorpayCredentials(admin);
  if (!creds) return json({ error: "Razorpay not configured" }, 503);

  const adapter = new RazorpayAdapter(creds);
  if (creds.webhookSecret) {
    if (!signature || !adapter.verifyWebhookSignature(rawBody, signature, creds.webhookSecret)) {
      return json({ error: "Invalid signature" }, 401);
    }
  }

  const payload = JSON.parse(rawBody) as {
    event?: string;
    id?: string;
    payload?: {
      payment?: { entity?: Record<string, unknown> };
      settlement?: { entity?: Record<string, unknown> };
    };
  };

  const eventId = payload.id ?? `evt_${Date.now()}`;
  const eventType = payload.event ?? "unknown";

  if (eventType === "payment.captured") {
    const payment = payload.payload?.payment?.entity;
    const notes = (payment?.notes ?? {}) as Record<string, string>;
    const firmId = notes.firm_id;
    const invoiceId = notes.platform_invoice_id ?? null;
    if (!firmId || !payment?.id) {
      await admin.from("webhook_events").upsert({
        razorpay_event_id: eventId,
        event_type: eventType,
        payload: JSON.parse(rawBody),
        processed: false,
        error: "missing firm_id or payment id",
      });
      return json({ ok: false, error: "missing firm_id" }, 422);
    }

    const { data: result, error } = await admin.rpc("process_razorpay_payment_captured", {
      p_razorpay_event_id: eventId,
      p_event_type: eventType,
      p_payload: JSON.parse(rawBody),
      p_razorpay_payment_id: String(payment.id),
      p_razorpay_order_id: String(payment.order_id ?? ""),
      p_amount_paise: Number(payment.amount ?? 0),
      p_firm_id: firmId,
      p_platform_invoice_id: invoiceId,
    });
    if (error) return json({ error: error.message }, 500);

    const paymentId = (result as { payment_id?: string })?.payment_id;
    if (paymentId && !(result as { duplicate?: boolean })?.duplicate) {
      try {
        await queuePlatformPaymentNotifications(admin, {
          firmId,
          invoiceId,
          paymentId,
          amountPaise: Number(payment?.amount ?? 0),
        });
      } catch (notifyErr) {
        console.error("[razorpay-webhook] post-payment notify failed:", notifyErr);
      }
    }

    return json({ ok: true, result });
  }

  if (eventType === "settlement.processed") {
    const settlement = payload.payload?.settlement?.entity;
    if (settlement?.id) {
      await admin.from("settlements").upsert(
        {
          razorpay_settlement_id: String(settlement.id),
          amount_paise: Number(settlement.amount ?? 0),
          fees_paise: Number(settlement.fees ?? 0),
          tax_paise: Number(settlement.tax ?? 0),
          status: String(settlement.status ?? "processed"),
          settled_at: settlement.settled_at
            ? new Date(Number(settlement.settled_at) * 1000).toISOString()
            : new Date().toISOString(),
          utr: settlement.utr ? String(settlement.utr) : null,
        },
        { onConflict: "razorpay_settlement_id" },
      );
    }
  }

  await admin.from("webhook_events").upsert(
    {
      razorpay_event_id: eventId,
      event_type: eventType,
      payload: JSON.parse(rawBody),
      processed: true,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "razorpay_event_id" },
  );

  return json({ ok: true, ignored: eventType });
});
