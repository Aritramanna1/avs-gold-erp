# P2-3: Razorpay Technology Partner & Sub-Merchant Architecture (Parked Plan)

## Goal
Document the future architectural roadmap for Razorpay **Technology Partner (Mode B)** integration, enabling tenant jewellers to onboard as sub-merchants through Razorpay OAuth or Embedded Payments. This allows tenants to accept digital payments from their retail or wholesale customers directly into their own bank accounts while AVS ERP programmatically tracks settlements and reconciliation. Reaffirm that **Phase 1 strictly focuses on Mode A (SaaS platform billing for licenses/credits)**, while Mode B is parked for a later phase.

## Current tip evidence (paths)
- **Partner Specification**: [`customer service/razorpay-partner-website.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/razorpay-partner-website.md#L104)
  - Section 4: Details Technology Partner requirements, OAuth onboarding flow, sub-merchant authorization, and KYC prerequisites.
- **Tenant Payment Settings**: [`src/routes/settings.index.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/settings.index.tsx)
  - Existing stub for tenant bank details and UPI QR configuration.
- **Platform Razorpay Config**: [`src/components/platform/PlatformRazorpayConfig.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/platform/PlatformRazorpayConfig.tsx)
  - Currently handles platform Mode A credentials only.

## Changes (files / migrations / Hostinger)
1. **Future Phase Scope (Mode B Roadmap)**:
   - Upgrade Razorpay account to certified **Technology Partner** status in Razorpay Dashboard.
   - Implement OAuth 2.0 connection workflow (`/api/payments/partner-oauth.php` on Hostinger):
     - `client_id`, `redirect_uri` (`https://erp.arivahly.in/settings/integrations/razorpay`), `scope=read_write`.
     - Secure token exchange storing tenant sub-merchant account IDs in `tenant_payment_gateways` table.
   - Dynamic checkout initiation routing customer retail sales to the tenant's sub-merchant account ID.
2. **Current Phase Isolation**:
   - Keep firm POS retail payments based on existing manual rails (Cash, NEFT/RTGS, direct UPI QR, Gold barter).
   - Zero Mode B sub-merchant code introduced into the critical Mode A SaaS billing path.

## Acceptance
- Mode A SaaS billing functions autonomously without dependency on Mode B partner capabilities.
- Technology partner prerequisites (Partner KYC, OAuth app registration, website verification) are clearly documented for future rollout.
- Zero premature sub-merchant onboarding complexity introduced to active jewellery operators.

## Out of scope
- Processing end-customer jewellery purchases through the platform's primary SaaS Razorpay merchant account (violates merchant terms).
- Implementing instant sub-merchant payout escrow in the current release.

## Status: Parked (Planned for Phase 2 tenant eCommerce/POS expansion)
