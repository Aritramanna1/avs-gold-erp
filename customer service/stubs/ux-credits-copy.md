# P1-1: Credits Copy Cleanup & SaaS Support Exemption (AVS-62)

## Goal
Replace confusing fintech jargon (**Wallet**, **Top-Up**, **Recharge**) across the application with simple, plain operator terms: **Credits left**, **Buy credits**, **Get credits**, and **Pay now**. Explicitly communicate that credits apply strictly to product-level metered features (**Cloud AI**, **WhatsApp Business messaging**, and **Receipt OCR**), while all SaaS platform support and help desk interactions are **100% free with zero credit deduction** (`deduct_tenant_credits = 0`).

## Current tip evidence (paths)
- **Credits Tab Component**: [`src/components/settings/CreditsTab.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/components/settings/CreditsTab.tsx)
  - Manages credit balance viewing, transaction history, and credit pack purchasing.
- **Credit Store & Service**:
  - Store: [`src/stores/credits-store.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/stores/credits-store.ts)
  - Service: [`src/lib/credit-service.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/credit-service.ts)
- **Platform Payment Hook**: [`src/lib/platform-payments/platform-payment-service.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/lib/platform-payments/platform-payment-service.ts)
- **Research Specification**: [`customer service/customer service.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/customer%20service.md#L35)
  - Hard rule (AVS-49 / AVS-62): SaaS support is never metered against tenant credits.

## Changes (files / migrations / Hostinger)
1. **User Interface Copy**:
   - `src/components/settings/CreditsTab.tsx`:
     - Update headings: "Credit Wallet" &rarr; "Credits Left".
     - Update CTA buttons: "Top Up Credits" &rarr; "Buy Credits".
     - Add prominent clarity banner: *"Credits are only used for optional Cloud AI suggestions, automated WhatsApp customer messages, and bill scanning. Customer support and help tickets are always free."*
   - Global Navigation / Badges: Replace "Wallet Balance" with "Credits: {count}".
2. **Backend / Deduct Logic Invariant**:
   - Verify `deduct_tenant_credits` RPC is only invoked by:
     1. AI Center generative completions (`/ai-center`)
     2. Automated WhatsApp marketing/reminders (`/communications`)
     3. Document scan OCR
   - Ensure support ticketing (`STF-*`), training desk (`/help`), and chatwoot support never invoke credit deduction.

## Acceptance
- The word "Top-Up" is removed from user-facing screens in favour of "Buy credits" or "Get credits".
- Operators see "Credits left" instead of "Wallet balance".
- Creating a support ticket, talking to Help Agent, or asking for support in Chatwoot deducts 0 credits.
- Low credit warning prompts clearly read: "Low credits for WhatsApp & AI — Buy credits to continue automatic messaging".

## Out of scope
- Changing the underlying database column names (e.g. `wallet_balance_paise` remains intact in DB schema to prevent breaking migrations).
- Modifying per-message carrier pricing for WhatsApp Meta.

## Status: In progress (UI copy review mapped; store enforcement verified)
