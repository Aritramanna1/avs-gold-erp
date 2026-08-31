import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RazorpayAdapter, loadRazorpayCredentials } from "./razorpay-adapter.ts";
import type { PaymentProviderAdapter } from "./types.ts";

/** PlatformPaymentService — single entry for provider operations (edge only). */
export class PlatformPaymentService {
  private adapter: PaymentProviderAdapter | null = null;

  constructor(private readonly admin: SupabaseClient) {}

  async getAdapter(): Promise<PaymentProviderAdapter> {
    if (this.adapter) return this.adapter;
    const creds = await loadRazorpayCredentials(this.admin);
    if (!creds) throw new Error("Razorpay not configured");
    this.adapter = new RazorpayAdapter(creds);
    return this.adapter;
  }

  async getPublishableKeyId(): Promise<string> {
    const creds = await loadRazorpayCredentials(this.admin);
    if (!creds) throw new Error("Razorpay not configured");
    return creds.keyId;
  }

  async logPaymentAttempt(input: {
    firmId: string;
    platformInvoiceId?: string;
    attemptType: string;
    razorpayOrderId?: string;
    status: string;
    requestPayload?: unknown;
    responsePayload?: unknown;
    errorCode?: string;
    errorDescription?: string;
  }): Promise<void> {
    await this.admin.from("payment_attempts").insert({
      firm_id: input.firmId,
      platform_invoice_id: input.platformInvoiceId ?? null,
      attempt_type: input.attemptType,
      razorpay_order_id: input.razorpayOrderId ?? null,
      status: input.status,
      request_payload: input.requestPayload ?? null,
      response_payload: input.responsePayload ?? null,
      error_code: input.errorCode ?? null,
      error_description: input.errorDescription ?? null,
    });
  }
}
