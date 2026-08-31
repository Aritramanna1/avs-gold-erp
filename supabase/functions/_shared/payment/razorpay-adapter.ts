import { createHmac } from "node:crypto";
import type {
  CreateOrderInput,
  CreateOrderResult,
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
  PaymentCredentials,
  PaymentProviderAdapter,
} from "./types.ts";

export class RazorpayAdapter implements PaymentProviderAdapter {
  readonly providerId = "razorpay";

  constructor(private readonly creds: PaymentCredentials) {}

  private authHeader(): string {
    return `Basic ${btoa(`${this.creds.keyId}:${this.creds.keySecret}`)}`;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency ?? "INR",
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.description ?? "Razorpay order creation failed");
    }
    return {
      orderId: body.id,
      amountPaise: input.amountPaise,
      currency: input.currency ?? "INR",
      receipt: input.receipt,
    };
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency ?? "INR",
        description: input.description,
        reference_id: input.referenceId,
        customer: {
          name: input.customerName,
          email: input.customerEmail,
          contact: input.customerContact,
        },
        expire_by: input.expireBy,
        notes: input.notes ?? {},
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.description ?? "Razorpay payment link failed");
    }
    return {
      paymentLinkId: body.id,
      shortUrl: body.short_url,
      amountPaise: input.amountPaise,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    if (!secret || !signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return expected === signature;
  }
}

export async function loadRazorpayCredentials(admin: any): Promise<PaymentCredentials | null> {
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
  const { data: webhookRow } = await admin
    .from("platform_credentials")
    .select("secret_encrypted")
    .eq("key", "razorpay_webhook_secret")
    .maybeSingle();

  const keyId = keyRow?.secret_encrypted ?? Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  const keySecret = secretRow?.secret_encrypted ?? Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
  const webhookSecret =
    webhookRow?.secret_encrypted ?? Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

  if (!keyId || !keySecret) return null;

  const env = keyId.includes("_live_") ? "live" : "test";
  return { keyId, keySecret, webhookSecret, environment: env };
}
