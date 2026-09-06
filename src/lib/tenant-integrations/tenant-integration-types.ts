/**
 * Arivahly Venture Sphere (AVS) — Multi-Tenant Integration Types
 * 
 * Strict schema definitions for per-tenant external integrations:
 * AI, WhatsApp (chargeable), Email (IMAP/SMTP/OAuth), SMS, and Payments.
 */

export type IntegrationType = 'ai' | 'whatsapp' | 'email' | 'sms' | 'payment';

export type IntegrationStatus = 
  | 'NOT_CONFIGURED' 
  | 'ACTIVE' 
  | 'VALIDATING' 
  | 'VALIDATION_FAILED' 
  | 'SUSPENDED' 
  | 'EXPIRED';

export interface BaseIntegrationConfig {
  enabled: boolean;
  lastValidatedAt?: string;
  validationError?: string;
}

// 1. AI Integration Config (Tenant-Owned)
export interface TenantAIConfig extends BaseIntegrationConfig {
  provider: 'google_gemini' | 'openai' | 'anthropic' | 'none';
  model: string;
  apiKey?: string; // Encrypted in storage
  temperature: number;
  monthlyTokenQuota: number;
  tokensUsedThisMonth: number;
}

// 2. WhatsApp Integration Config (Chargeable External Integration)
export interface TenantWhatsAppConfig extends BaseIntegrationConfig {
  provider: 'wasender' | 'meta_cloud_api' | 'twilio';
  phoneNumberId?: string;
  accessToken?: string; // Encrypted
  webhookSecret?: string;
  businessAccountId?: string;
  // Commercial Entitlements
  isChargeableActive: boolean;
  planTier: 'free_trial' | 'starter' | 'growth' | 'enterprise';
  monthlyMessageLimit: number;
  messagesSentThisMonth: number;
  billingStatus: 'paid' | 'overdue' | 'trial' | 'unsubscribed';
}

// 3. Email Integration Config (Tenant-Specific Mailbox)
export interface TenantEmailConfig extends BaseIntegrationConfig {
  provider: 'smtp_imap' | 'google_workspace_oauth' | 'microsoft_365_oauth';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string; // Encrypted
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPassword?: string; // Encrypted
  fromAddress?: string;
  fromName?: string;
  allowedMailboxScopes: string[];
}

// 4. SMS Integration Config
export interface TenantSMSConfig extends BaseIntegrationConfig {
  provider: 'fast2sms' | 'twilio' | 'gupshup';
  apiKey?: string; // Encrypted
  senderId?: string;
  dltTemplateRegistered: boolean;
}

// 5. Payment Gateway Config (Razorpay / Stripe)
export interface TenantPaymentConfig extends BaseIntegrationConfig {
  provider: 'razorpay' | 'stripe';
  keyId?: string;
  keySecret?: string; // Encrypted
  webhookSecret?: string;
  merchantName?: string;
}

export interface TenantIntegrationRecord<T = unknown> {
  id: string;
  tenantId: string;
  integrationType: IntegrationType;
  status: IntegrationStatus;
  config: T;
  isFlagshipManaged?: boolean;
  createdAt: string;
  updatedAt: string;
}
