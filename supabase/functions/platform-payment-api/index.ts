import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PlatformPaymentService } from "../_shared/payment/platform-payment-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !serviceKey || !authorization) return json({ error: "Unauthorized" }, 401);

  const caller = createClient(url, anonKey ?? serviceKey, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(url, serviceKey);
  const { data: authData } = await caller.auth.getUser();
  if (!authData.user) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");

  const { data: profile } = await admin
    .from("user_profiles")
    .select("firm_id, full_name")
    .eq("auth_id", authData.user.id)
    .maybeSingle();
  const firmId = profile?.firm_id as string | undefined;
  if (!firmId) return json({ error: "No tenant profile" }, 400);

  const paymentService = new PlatformPaymentService(admin);

  try {
    if (action === "create_order") {
      const invoiceId = String(body?.platformInvoiceId ?? "");
      const amountPaise = Number(body?.amountPaise ?? 0);
      if (!invoiceId || amountPaise <= 0)
        return json({ error: "platformInvoiceId and amountPaise required" }, 400);

      const { data: invoice } = await admin
        .from("platform_invoices")
        .select("id, firm_id, invoice_no, balance_paise, status")
        .eq("id", invoiceId)
        .maybeSingle();
      if (!invoice || invoice.firm_id !== firmId) return json({ error: "Invoice not found" }, 404);
      if (invoice.status === "paid" || Number(invoice.balance_paise) <= 0) {
        return json({ error: "Invoice not payable" }, 400);
      }
      if (amountPaise !== Number(invoice.balance_paise)) {
        return json({ error: "Amount must match invoice balance" }, 400);
      }

      const adapter = await paymentService.getAdapter();
      const receipt = `INV-${invoice.invoice_no}`;
      const order = await adapter.createOrder({
        amountPaise,
        receipt,
        notes: {
          firm_id: firmId,
          platform_invoice_id: invoiceId,
          product_id: String(body?.productId ?? "ORNEXA"),
        },
      });

      await admin.from("razorpay_orders").insert({
        firm_id: firmId,
        platform_invoice_id: invoiceId,
        razorpay_order_id: order.orderId,
        amount_paise: amountPaise,
        receipt,
        notes: { product_id: String(body?.productId ?? "ORNEXA") },
      });

      await paymentService.logPaymentAttempt({
        firmId,
        platformInvoiceId: invoiceId,
        attemptType: "create_order",
        razorpayOrderId: order.orderId,
        status: "created",
        responsePayload: order,
      });

      const keyId = await paymentService.getPublishableKeyId();
      return json({ ok: true, orderId: order.orderId, amountPaise, keyId, invoiceId });
    }

    if (action === "create_payment_link") {
      const invoiceId = String(body?.platformInvoiceId ?? "");
      const { data: invoice } = await admin
        .from("platform_invoices")
        .select("id, firm_id, invoice_no, balance_paise, billing_name")
        .eq("id", invoiceId)
        .maybeSingle();
      if (!invoice || invoice.firm_id !== firmId) return json({ error: "Invoice not found" }, 404);

      const adapter = await paymentService.getAdapter();
      const link = await adapter.createPaymentLink({
        amountPaise: Number(invoice.balance_paise),
        description: `Ornexa Invoice ${invoice.invoice_no}`,
        customerName: String(invoice.billing_name),
        referenceId: invoiceId,
        notes: { firm_id: firmId, platform_invoice_id: invoiceId },
      });

      await admin.from("payment_links").insert({
        razorpay_payment_link_id: link.paymentLinkId,
        platform_invoice_id: invoiceId,
        firm_id: firmId,
        amount_paise: link.amountPaise,
        short_url: link.shortUrl,
        status: "created",
        created_by: authData.user.id,
      });

      return json({ ok: true, shortUrl: link.shortUrl, paymentLinkId: link.paymentLinkId });
    }

    if (action === "purchase_plan") {
      const planCode = String(body?.planCode ?? "").trim();
      const productId = String(body?.productId ?? "ORNEXA").trim();
      if (!planCode) return json({ error: "planCode required" }, 400);

      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", firmId)
        .maybeSingle();
      const { data: plan } = await admin
        .from("platform_plans")
        .select("id, name, price_minor")
        .eq("code", planCode)
        .maybeSingle();

      const amountPaise = Number(plan?.price_minor ?? 0);
      if (amountPaise <= 0)
        return json({ error: "Plan has no configured price — contact Platform Owner" }, 400);

      const { data: invResult, error: invErr } = await admin.rpc(
        "create_platform_commercial_invoice",
        {
          p_firm_id: firmId,
          p_billing_name: String(org?.name ?? "Tenant"),
          p_lines: [
            {
              item_type: "licence",
              description: `${plan?.name ?? planCode} — ${productId}`,
              quantity: 1,
              unit_price_paise: amountPaise,
              tax_rate_pct: 0,
              metadata: { plan_id: plan?.id, plan_code: planCode, product_id: productId },
            },
          ],
          p_primary_item_type: "licence",
        },
      );
      if (invErr) return json({ error: invErr.message }, 400);
      const invoiceId = (invResult as { invoice_id?: string })?.invoice_id;
      if (!invoiceId) return json({ error: "Invoice creation failed" }, 500);

      const adapter = await paymentService.getAdapter();
      const invoiceNo = (invResult as { invoice_no?: string })?.invoice_no ?? `AVS-${Date.now()}`;
      const order = await adapter.createOrder({
        amountPaise,
        receipt: invoiceNo,
        notes: {
          firm_id: firmId,
          platform_invoice_id: invoiceId,
          plan_code: planCode,
          product_id: productId,
        },
      });

      await admin.from("razorpay_orders").insert({
        firm_id: firmId,
        platform_invoice_id: invoiceId,
        razorpay_order_id: order.orderId,
        amount_paise: amountPaise,
        receipt: invoiceNo,
        notes: { plan_code: planCode, product_id: productId },
      });

      const keyId = await paymentService.getPublishableKeyId();
      return json({ ok: true, orderId: order.orderId, amountPaise, keyId, invoiceId });
    }

    if (action === "credit_topup") {
      const credits = Number(body?.credits ?? 0);
      const walletType = String(body?.walletType ?? "ai");
      if (credits <= 0) return json({ error: "credits must be positive" }, 400);

      const { data: invResult, error: invErr } = await admin.rpc("create_credit_topup_invoice", {
        p_firm_id: firmId,
        p_credits: credits,
        p_wallet_type: walletType,
      });
      if (invErr) return json({ error: invErr.message }, 400);
      const invoiceId = (invResult as { invoice_id?: string })?.invoice_id;
      const invoiceNo = (invResult as { invoice_no?: string })?.invoice_no;
      if (!invoiceId) return json({ error: "Invoice failed" }, 500);

      const { data: invoice } = await admin
        .from("platform_invoices")
        .select("total_paise, balance_paise")
        .eq("id", invoiceId)
        .single();
      const amountPaise = Number(invoice?.balance_paise ?? invoice?.total_paise ?? 0);

      const adapter = await paymentService.getAdapter();
      const order = await adapter.createOrder({
        amountPaise,
        receipt: invoiceNo ?? `CR-${invoiceId}`,
        notes: { firm_id: firmId, platform_invoice_id: invoiceId, credits: String(credits) },
      });

      await admin.from("razorpay_orders").insert({
        firm_id: firmId,
        platform_invoice_id: invoiceId,
        razorpay_order_id: order.orderId,
        amount_paise: amountPaise,
        receipt: invoiceNo,
        notes: { credits, wallet_type: walletType },
      });

      const keyId = await paymentService.getPublishableKeyId();
      return json({ ok: true, orderId: order.orderId, amountPaise, keyId, invoiceId, credits });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Payment error";
    await paymentService.logPaymentAttempt({
      firmId,
      attemptType: action,
      status: "failed",
      errorDescription: message,
      requestPayload: body,
    });
    return json({ error: message }, 503);
  }
});
