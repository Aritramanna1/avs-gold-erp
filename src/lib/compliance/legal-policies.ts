/**
 * Canonical AVS ERP Terms / Privacy — single source for public pages,
 * OAuth consent URLs, and in-app Legal Acceptance gate.
 *
 * Google Auth Platform / OAuth consent screen MUST use the same public URLs:
 *   {VITE_PUBLIC_APP_URL}/privacy
 *   {VITE_PUBLIC_APP_URL}/terms
 * Homepage footer must link these exact paths (not a divergent CMS copy).
 *
 * Scopes AVS ERP requests for Sign in with Google: openid, email, profile only.
 */

import { publicSiteUrl } from "@/lib/website/public-site-url";
import { APP_NAME, APP_PARENT_ATTRIBUTION, COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/app-info";

export type LegalDocumentType = "terms" | "privacy";

/** Bump when content materially changes — triggers re-acceptance for all users. */
export const CURRENT_TERMS_VERSION = "2026-08-17";
export const CURRENT_PRIVACY_VERSION = "2026-08-17";

/** Cookie banner / local prefs stay aligned with privacy revision. */
export const CURRENT_POLICY_VERSION = CURRENT_PRIVACY_VERSION;

export const CANONICAL_PRIVACY_PATH = "/privacy";
export const CANONICAL_TERMS_PATH = "/terms";

export function canonicalPrivacyUrl(): string {
  return publicSiteUrl(CANONICAL_PRIVACY_PATH);
}

export function canonicalTermsUrl(): string {
  return publicSiteUrl(CANONICAL_TERMS_PATH);
}

export type LegalDocumentDefinition = {
  documentType: LegalDocumentType;
  version: string;
  title: string;
  effectiveDate: string;
  /** Plain text / markdown-ish body shown in public pages and acceptance scroll. */
  body: string;
};

export const TERMS_OF_SERVICE: LegalDocumentDefinition = {
  documentType: "terms",
  version: CURRENT_TERMS_VERSION,
  title: "Terms of Service",
  effectiveDate: "2026-08-17",
  body: `${APP_NAME} (${APP_PARENT_ATTRIBUTION})

By creating an account or using ${APP_NAME}, you agree to these terms on behalf of your organisation.

1. Service
Cloud ERP for jewellery manufacturing — gold vault, workshop, billing, stock, portals, and communications. Features depend on your subscription plan and licensed modules. ${APP_NAME} is a jewellery manufacturing ERP, not a retail POS.

2. Account responsibility
You are responsible for accurate business data, user access control, and compliance with GST, hallmark, and messaging-provider policies (including WhatsApp / Meta) when using integrated channels. Account holders must be authorised to bind their business.

3. Acceptable use
No unlawful activity, credential sharing outside your organisation, or attempts to bypass security, licensing, or tenant-isolation controls.

4. Mobile & desktop apps
Native apps (including Android package in.arivahly.ornexa) and desktop clients are subject to Apple App Store / Google Play / platform policies in addition to these terms. In-app purchases and subscriptions follow platform billing rules where applicable.

5. Data & availability
Production data is Supabase-authoritative. Limited offline UI caching may be offered; gold balances and accounting-sensitive transactions require online server validation through the vault / ledger engine. Do not treat offline queues as posted gold accounting.

6. Sign-in providers
You may sign in with email or Google (where enabled). Using Google Sign-In does not create a Google Account on our behalf; it authenticates you to ${APP_NAME} with your existing Google credentials.

7. Limitation of liability
The service is provided within the scope of your agreement. You remain responsible for statutory filings and physical gold custody.

8. Changes
Material changes to these Terms may require renewed in-app acceptance before continued use.

Contact: support channels published on the ${APP_NAME} website, or your firm administrator.
Operated by ${COMPANY_NAME}.`,
};

export const PRIVACY_POLICY: LegalDocumentDefinition = {
  documentType: "privacy",
  version: CURRENT_PRIVACY_VERSION,
  title: "Privacy Policy",
  effectiveDate: "2026-08-17",
  body: `${APP_NAME} ("we", "us") — ${APP_PARENT_ATTRIBUTION} — provides cloud jewellery manufacturing ERP software. This policy explains how we collect, use, and protect personal and business data. We do not invent or hide Google user-data usage.

1. Data we process
• Account credentials (email; passwords hashed via Supabase Auth) and profile fields you provide
• Business profile, firm settings, and operational ERP records you enter
• Device/browser metadata limited to what is needed for security, session integrity, and fraud prevention
• Communication logs when you use WhatsApp/SMS/email features (with separate channel consent where required)
• Legal acceptance audit records: user id, document type, policy version, accepted_at, app version/platform, and acceptance method (no unnecessary device fingerprinting)

2. Google Sign-In (Sign in with Google)
When you choose Continue with Google / Sign in with Google, we request only the standard sign-in scopes: openid, email, and profile.
From Google we may receive your Google account identifier, email address, name, and profile picture (if available) for the sole purposes of authenticating you, creating or linking your ${APP_NAME} account, and displaying your identity inside the product.
We do not request access to Gmail, Google Drive, Contacts, Calendar, or other Google user content.
We do not use Google user data for advertising, selling, or unrelated profiling.
Authentication is completed via Supabase Auth (including ID-token exchange on Android). Session tokens are stored securely for keeping you signed in.

3. Legal bases (GDPR where applicable)
Contract performance (providing the ERP), legitimate interests (security, product reliability), and consent (marketing, optional analytics, WhatsApp messaging, and explicit Terms/Privacy acceptance).

4. Cookies & local storage
Essential cookies and local storage are required for authentication and session security. Functional preferences (theme, language) may be stored locally. Analytics cookies load only after you opt in via the cookie banner.

5. Data retention & deletion
Operational data is retained per your subscription and applicable tax law (e.g. GST records). You may request export or deletion subject to legal holds — contact your firm administrator or ${SUPPORT_EMAIL}.

6. International transfers
Data may be processed on Supabase and approved sub-processors. Standard contractual safeguards apply where required.

7. Your rights
Access, rectification, erasure, restriction, portability, and objection — contact ${SUPPORT_EMAIL}.

8. Children
The service is for businesses. Users must be 18+ or have guardian consent for workforce accounts.

9. Changes
Material changes to this Privacy Policy may require renewed in-app acceptance. The version shown on this page and in Google Auth Platform branding must match.

Operated by ${COMPANY_NAME}.`,
};

export function getLegalDocument(type: LegalDocumentType): LegalDocumentDefinition {
  return type === "terms" ? TERMS_OF_SERVICE : PRIVACY_POLICY;
}

export function getCurrentLegalDocuments(): LegalDocumentDefinition[] {
  return [TERMS_OF_SERVICE, PRIVACY_POLICY];
}
