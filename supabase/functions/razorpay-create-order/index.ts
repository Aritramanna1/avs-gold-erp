import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const invoiceId = String(body?.platformInvoiceId ?? "");
  const amountPaise = Number(body?.amountPaise ?? 0);
  const productId = String(body?.productId ?? "ORNEXA");

  if (!invoiceId || amountPaise <= 0) {
    return json({ error: "platformInvoiceId and amountPaise required" }, 400);
  }

  const { data: invoice, error: invErr } = await admin
    .from("platform_invoices")
    .select("id, firm_id, total_paise, invoice_no, balance_paise, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !invoice) return json({ error: "Invoice not found" }, 404);

  const { data: profile } = await admin
    .from("user_profiles")
    .select("firm_id")
    .eq("auth_id", authData.user.id)
    .maybeSingle();
  const callerFirmId = profile?.firm_id as string | undefined;
  if (!callerFirmId || callerFirmId !== invoice.firm_id) {
    return json({ error: "Invoice not found" }, 404);
  }

  const amountDue = Number(invoice.balance_paise ?? invoice.total_paise ?? 0);
  if (amountPaise !== amountDue) {
    return json({ error: "Amount does not match invoice balance" }, 400);
  }
  if (invoice.status === "paid" || amountDue <= 0) {
    return json({ error: "Invoice already paid" }, 400);
  }

  const { data: keyRow } = await admin
    .from("platform_credentials")
    .select("secret_encrypted")
    .eq("key", "razorpay_key_id")
    .maybeSingle();
  const { data: secretRow } = await admin
    .from("platform_credentials")
    .select("secret_encrypted")
    .eq("key", "razorpay_key_secret")
    .maybeSingle();

  const keyId = keyRow?.secret_encrypted ?? Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = secretRow?.secret_encrypted ?? Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json({ error: "Razorpay not configured" }, 503);

  const receipt = `INV-${invoice.invoice_no}`;
  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        firm_id: invoice.firm_id,
        platform_invoice_id: invoice.id,
        product_id: productId,
      },
    }),
  });

  const orderBody = await orderRes.json();
  if (!orderRes.ok)
    return json({ error: orderBody.error?.description ?? "Razorpay order failed" }, 400);

  await admin.from("razorpay_orders").insert({
    firm_id: invoice.firm_id,
    platform_invoice_id: invoice.id,
    razorpay_order_id: orderBody.id,
    amount_paise: amountPaise,
    receipt,
    notes: { product_id: productId },
  });

  return json({
    ok: true,
    orderId: orderBody.id,
    amountPaise,
    keyId,
    invoiceId: invoice.id,
  });
});
