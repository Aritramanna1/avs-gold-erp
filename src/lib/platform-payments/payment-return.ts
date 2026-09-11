/**
 * Payment return / callback helpers (no secrets).
 * Wires configured return_url (?payment=callback) to verifyPaymentCallback.
 * LIVE final integration stays gated in SaaS admin (Phase C hold).
 */
import { verifyPaymentCallback } from "@/lib/platform-payments/platform-payment-service";

export const DEFAULT_PAYMENT_RETURN_PATH = "/settings/license?payment=callback";

export type RazorpayReturnParams = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  internal_payment_id?: string;
};

export function isPaymentCallbackSearch(search: string): boolean {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return q.get("payment") === "callback";
}

/** Parse Razorpay checkout / redirect query fields from a location search string. */
export function parseRazorpayReturnParams(search: string): RazorpayReturnParams | null {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const paymentId = (q.get("razorpay_payment_id") || q.get("payment_id") || "").trim();
  const orderId = (q.get("razorpay_order_id") || q.get("order_id") || "").trim();
  const signature = (q.get("razorpay_signature") || q.get("signature") || "").trim();
  const internalId = (q.get("internal_payment_id") || "").trim();
  if (!paymentId || !orderId || !signature) return null;
  return {
    razorpay_payment_id: paymentId,
    razorpay_order_id: orderId,
    razorpay_signature: signature,
    ...(internalId ? { internal_payment_id: internalId } : {}),
  };
}

export function resolvePaymentReturnUrl(configured?: string | null): string {
  const trimmed = (configured ?? "").trim();
  if (trimmed) return trimmed;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${DEFAULT_PAYMENT_RETURN_PATH}`;
  }
  return DEFAULT_PAYMENT_RETURN_PATH;
}

/** Append Razorpay verify fields onto the configured return URL (path+search for SPA navigate). */
export function withRazorpayReturnParams(
  returnUrl: string,
  params: RazorpayReturnParams,
): string {
  try {
    const url = new URL(
      returnUrl.startsWith("http") || returnUrl.startsWith("/") ? returnUrl : `/${returnUrl}`,
      typeof window !== "undefined" ? window.location.origin : "https://erp.arivahly.in",
    );
    if (!url.searchParams.get("payment")) url.searchParams.set("payment", "callback");
    url.searchParams.set("razorpay_payment_id", params.razorpay_payment_id);
    url.searchParams.set("razorpay_order_id", params.razorpay_order_id);
    url.searchParams.set("razorpay_signature", params.razorpay_signature);
    if (params.internal_payment_id) {
      url.searchParams.set("internal_payment_id", params.internal_payment_id);
    }
    // Same-origin SPA: return path+search; cross-origin: full href
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return url.pathname + url.search + url.hash;
    }
    return url.toString();
  } catch {
    return DEFAULT_PAYMENT_RETURN_PATH;
  }
}

export type PaymentReturnHandleResult =
  | { status: "skipped"; reason: string }
  | { status: "verified"; payload: unknown }
  | { status: "failed"; error: string };

/**
 * If the current URL is a payment callback with Razorpay fields, verify server-side.
 * Safe when fields are missing (modal-only / stub success path).
 */
export async function handlePaymentReturnFromSearch(
  search: string,
): Promise<PaymentReturnHandleResult> {
  if (!isPaymentCallbackSearch(search)) {
    return { status: "skipped", reason: "not_callback" };
  }
  const params = parseRazorpayReturnParams(search);
  if (!params) {
    return { status: "skipped", reason: "missing_razorpay_fields" };
  }
  try {
    const payload = (await verifyPaymentCallback(params)) as {
      success?: boolean;
      error?: string;
    };
    if (payload?.error || payload?.success === false) {
      return { status: "failed", error: String(payload.error ?? "Verification failed") };
    }
    return { status: "verified", payload };
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "Verification request failed",
    };
  }
}
