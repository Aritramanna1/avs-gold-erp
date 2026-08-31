/** Shared payment types — provider-agnostic platform billing. */

export type PaymentEnvironment = "test" | "live";

export interface PaymentCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  environment: PaymentEnvironment;
}

export interface CreateOrderInput {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  receipt: string;
}

export interface CreatePaymentLinkInput {
  amountPaise: number;
  currency?: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  customerContact?: string;
  referenceId: string;
  expireBy?: number;
  notes?: Record<string, string>;
}

export interface CreatePaymentLinkResult {
  paymentLinkId: string;
  shortUrl: string;
  amountPaise: number;
}

export interface PaymentProviderAdapter {
  readonly providerId: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult>;
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean;
}
