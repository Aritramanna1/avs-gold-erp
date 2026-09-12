# P1-3: Payment Gateway Return Callback & Verification (PAY-GW / AVS-34)

## Goal
Establish a robust, tamper-resistant payment verification flow for Razorpay checkout returns. Ensure return redirects landing on `/settings/license?payment=callback` reliably trigger server-side HMAC SHA256 signature verification via the Hostinger PHP backend (`/api/payments/callback.php`). Automatically activate tenant licenses or credit bundles upon verified signature, generate tax-compliant invoice PDFs, and keep **LIVE mode strictly gated** (`confirm_switch`) so that TEST mode remains the default until explicit owner authorization.

## Current tip evidence (paths)
- **Client Return Handler**: [`src/lib/platform-payments/payment-return.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/platform-payments/payment-return.ts)
  - Detects `?payment=callback` search params, extracts `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`, and calls `verifyPaymentCallback`.
- **Payment Client Service**: [`src/lib/platform-payments/platform-payment-service.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/platform-payments/platform-payment-service.ts#L188)
  - Posts credentials to `/api/payments/callback.php` with fallback to Supabase edge function when operating in hybrid mode.
- **Hostinger Authoritative Callback**: [`public/api/payments/callback.php`](file:///c:/final%20erp%2029.08/new%20and%20final/public/api/payments/callback.php)
  - Implements server-side HMAC SHA256 calculation (`verifyRazorpayReturnSignature`), invoice generation, and audit logging.
- **Admin Configuration Surface**: [`src/components/platform/PlatformRazorpayConfig.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/platform/PlatformRazorpayConfig.tsx)
  - Controls TEST vs LIVE mode selection with safety gating.

## Changes (files / migrations / Hostinger)
1. **Source Code**:
   - `src/lib/platform-payments/payment-return.ts`: Ensure error states (e.g. signature mismatch or user cancellation) trigger user-friendly recovery banners without throwing uncaught exceptions.
   - `public/api/payments/callback.php`: Maintain Hostinger PHP as the single source of truth for payment reconciliation on `erp.arivahly.in`.
   - `src/components/platform/PlatformRazorpayConfig.tsx`: Guard LIVE mode toggle with mandatory `confirm_switch` modal requiring explicit administrative acknowledgment.
2. **Hostinger / Production**:
   - Configure Hostinger web server to route `/api/payments/callback.php` without URL rewriting interference or header stripping.

## Acceptance
- Simulating or executing a TEST checkout directs to `https://erp.arivahly.in/settings/license?payment=callback`.
- Hostinger backend computes valid HMAC SHA256 against stored secret, returning `{ "ok": true, "invoice_id": ... }`.
- Credits or license validity immediately reflect in the tenant UI.
- Any attempt to toggle to LIVE mode without owner confirmation is prevented.

## Out of scope
- Switching production gateway mode from TEST to LIVE without written owner approval.
- Storing unencrypted Razorpay Key Secrets in git repositories or client-side storage.

## Status: Done
