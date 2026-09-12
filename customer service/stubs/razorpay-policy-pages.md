# P0-7: Razorpay Policy Pages & Merchant Website Compliance (PAY-GW / AVS-34)

## Goal
Meet all mandatory Razorpay Merchant Website verification requirements to enable production LIVE mode activation for AVS ERP SaaS licensing and credit pack purchases on `https://erp.arivahly.in`. Provide fully compliant, publicly accessible, HTTPS-secured policy pages branded under **Arivahly Venture Sphere / AVS ERP**, with working contact information, clear refund timelines, and digital service delivery disclosures:
1. **About Us** (Company overview, jewellery manufacturing mission, parent attribution)
2. **Contact Us** (Registered address, support phone, and active Hostinger mailbox `support@arivahly.in`)
3. **Pricing Details** (Clear subscription tiers and credit packs in INR with GST notes)
4. **Terms and Conditions** (`/terms` route)
5. **Privacy Policy** (`/privacy` route)
6. **Cancellation & Refund Policy** (Clear cancellation terms and 5–7 business days refund turnaround)
7. **Shipping & Delivery Policy** (Instant digital SaaS provisioning / no physical shipping)

## Current tip evidence (paths)
- **Policy Engine**: [`src/lib/compliance/legal-policies.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/compliance/legal-policies.ts)
  - Defines authoritative `TERMS_OF_SERVICE` and `PRIVACY_POLICY` with versioning and effective dates.
- **Branding Constants**: [`src/lib/app-info.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/app-info.ts)
  - `APP_NAME = "AVS ERP"`, `COMPANY_NAME = "Arivahly Venture Sphere"`, `SUPPORT_EMAIL = "privacy@arivahly.in"`.
- **Public Policy Routes**:
  - Terms: [`src/routes/terms.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/terms.tsx)
  - Privacy: [`src/routes/privacy.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/privacy.tsx)
- **SaaS Pricing & Plans Route**: [`src/routes/platform.plans.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/platform.plans.tsx)
- **Specification Guide**: [`customer service/razorpay-partner-website.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/razorpay-partner-website.md)

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/lib/compliance/legal-policies.ts`: Author and export `REFUND_POLICY` and `SHIPPING_POLICY` definitions adhering to Indian e-commerce / SaaS guidelines.
   - Public routing: Support `/refunds` and `/shipping` (or public policy tabs) rendering canonical markdown copy.
   - Public footers: Ensure all login, marketing, and checkout views provide prominent clickable links to all 7 policy surfaces.
2. **Hostinger / Production**:
   - Verify URL endpoints return clean 200 HTTP status under `https://erp.arivahly.in`.
   - Prepare sample tax invoice PDF generated from AVS ERP for Razorpay onboarding upload.

## Acceptance
- All 7 mandatory policy links resolve publicly without authentication:
  - About Us (`/about` or public profile)
  - Contact Us (`/contact` or footer with `support@arivahly.in`)
  - Pricing (`/pricing` or `/platform/plans`)
  - Terms of Service (`/terms`)
  - Privacy Policy (`/privacy`)
  - Cancellation & Refund Policy (`/refunds`)
  - Shipping & Delivery Policy (`/shipping`)
- Policy text contains explicit timelines (5–7 business days for refund processing to original payment source).
- Zero legacy placeholder branding or mojibake characters.
- Live URL passes Razorpay Dashboard "Business Website Details" automated verification.

## Out of scope
- Switching Razorpay account to LIVE mode prior to explicit owner authorization.
- Applying for Technology Partner sub-merchant OAuth (Mode B; deferred to `razorpay-tech-partner.md`).

## Status: In progress (Terms and Privacy deployed; Refunds, Shipping, and Contact links mapped)
