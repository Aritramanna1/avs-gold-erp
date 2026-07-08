/**
 * Provider Registry — maps ProviderType strings to provider instances.
 * To add a new provider: implement CommProvider, add an entry here.
 * No other file needs to change.
 */
import type { CommProvider, ProviderType } from "./types";
import { WhatsAppDeepLinkProvider } from "./providers/whatsapp-deep-link";
import { WhatsAppCloudApiProvider } from "./providers/whatsapp-cloud-api";
import { WhatsAppOpenWaProvider } from "./providers/whatsapp-openwa";
import { WhatsAppBspProvider } from "./providers/whatsapp-bsp";
import { EmailProvider } from "./providers/email-provider";

type ProviderFactory = () => CommProvider;

const REGISTRY: Record<ProviderType, ProviderFactory> = {
  // WhatsApp
  whatsapp_deep_link: () => new WhatsAppDeepLinkProvider(),
  whatsapp_cloud_api: () => new WhatsAppCloudApiProvider(),
  whatsapp_openwa: () => new WhatsAppOpenWaProvider(),
  whatsapp_interakt: () => new WhatsAppBspProvider("whatsapp_interakt"),
  whatsapp_wati: () => new WhatsAppBspProvider("whatsapp_wati"),
  whatsapp_aisensy: () => new WhatsAppBspProvider("whatsapp_aisensy"),
  whatsapp_gupshup: () => new WhatsAppBspProvider("whatsapp_gupshup"),
  // Email
  email_smtp: () => new EmailProvider("email_smtp"),
  email_resend: () => new EmailProvider("email_resend"),
  email_sendgrid: () => new EmailProvider("email_sendgrid"),
  email_ses: () => new EmailProvider("email_ses"),
  email_mailgun: () => new EmailProvider("email_mailgun"),
  // SMS — stubs ready for implementation
  sms_twilio: () => {
    throw new Error("sms_twilio not yet implemented");
  },
  sms_msg91: () => {
    throw new Error("sms_msg91 not yet implemented");
  },
  sms_fast2sms: () => {
    throw new Error("sms_fast2sms not yet implemented");
  },
};

export function createProvider(type: ProviderType): CommProvider {
  const factory = REGISTRY[type];
  if (!factory) throw new Error(`Unknown provider type: ${type}`);
  return factory();
}

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  whatsapp_deep_link: "WhatsApp Deep Link (Free — manual send)",
  whatsapp_cloud_api: "WhatsApp Cloud API (Meta — official)",
  whatsapp_openwa: "WhatsApp (Self-hosted OpenWA)",
  whatsapp_interakt: "Interakt BSP",
  whatsapp_wati: "WATI BSP",
  whatsapp_aisensy: "AiSensy BSP",
  whatsapp_gupshup: "Gupshup BSP",
  email_smtp: "SMTP (self-hosted / Hostinger)",
  email_resend: "Resend",
  email_sendgrid: "SendGrid",
  email_ses: "Amazon SES",
  email_mailgun: "Mailgun",
  sms_twilio: "Twilio SMS",
  sms_msg91: "MSG91 SMS",
  sms_fast2sms: "Fast2SMS",
};
