# 01. Ornexa Codebase Status Audit
**Date:** 2026-08-12  
**Target Codebase:** `c:\avs-test-install\emergent-mtj-V1`  

This document audits the current implementation status of the Ornexa codebase to identify exactly what has been completed, what is in progress, and what remains outstanding.

---

## 1. Directory & File Mapping

The current codebase is a React Single Page Application (SPA) powered by **Vite**, **TypeScript**, **TailwindCSS**, and **TanStack Router**, with a hybrid backend powered by **Supabase (PostgreSQL)** and a local data sync layer.

### 1.1. Core Logic Stores (`src/lib/`)
*   **Dual-Currency Ledger**: [`ledger-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/ledger-store.ts) is fully implemented. It supports concurrent tracking of gold-weight (in milligrams) and cash balances.
*   **Freeze Date Lock**: [`financial-lock-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/financial-lock-store.ts) is implemented. It asserts freeze date gates to prevent post-close edits.
*   **Daily Metal Rates**: [`settings-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/settings-store.ts) contains logic for live metal rates and local settings.
*   **AI Local Assistant**: [`avs-assistant-brain.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/avs-assistant-brain.ts) contains the semantic query responder and anomaly detection rules.
*   **Daily Close / Day Book**: [`dailyclose-store.ts`](file:///c:/avs-test-install/emergent-mtj-V1/src/lib/dailyclose-store.ts) tracks vault balances and close statuses.

### 1.2. Key Route Components (`src/routes/`)
*   **Karigar Self-Service Portal**:
    - Route: [`karigar-portal.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/karigar-portal.tsx)
    - Login: [`karigar-login.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/karigar-login.tsx)
    - Status: UI and core fields exist; requires integration with live SMS/OTP routing.
*   **Customer Retail Portal**:
    - Route: [`customer-portal.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/customer-portal.tsx)
    - Login: [`customer-login.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/customer-login.tsx)
    - Status: Basic dashboard and ledger statements are present; needs scheme-payments webhook integration.
*   **Wholesale Portal**:
    - Route: Mapped inside the main platform shell [`platform.tsx`](file:///c:/avs-test-install/emergent-mtj-V1/src/routes/platform.tsx).
    - Status: Features purchase order drafting and bullion inventory tracking; needs external API sync.

---

## 2. Feature Implementation Status Matrix

| Module / Feature | Current Code State | Supabase Table Mapping | Gap / Work Remaining |
|---|---|---|---|
| **POS Billing Checkout** | **90% Complete** (`src/modules/billing/`) | `billing_invoices`, `invoice_items` | Needs old-gold appraisal calculator. |
| **Gold / Cash Ledgers** | **95% Complete** (`src/lib/ledger-store.ts`) | `ledger_entries` | Fully complete. |
| **Karigar OTP Login** | **70% Complete** (`src/routes/karigar-portal.tsx`) | `worker_profiles`, `worker_otp` | Wire SMS/WhatsApp API triggers. |
| **Wholesale Bullion** | **60% Complete** (`src/routes/platform.tsx`) | `bullion_inventory` | Wire multi-branch rate matrices. |
| **ITC-04 GST Compliance**| **85% Complete** (`src/lib/itc04-store.ts`) | `itc04_records` | Verification of 300-day return alerts. |
| **Tally XML Integration**| **100% Complete** (`src/lib/tally-export-engine.ts`) | N/A (Client-side export) | Fully complete. |
| **AI Assistant Brain** | **80% Complete** (`src/lib/avs-assistant-brain.ts`) | `ai_queries_log` | Needs custom dashboard panel widget. |

---

## 3. Database Schema Status (Supabase)

Supabase schema migrations are declared in the `supabase/migrations/` and `src/integrations/supabase/types.ts` files:
1.  **Profiles and RBAC**: `profiles` table maps roles to system permissions. Fully compatible with APPIT's role requirements.
2.  **Metal Vaults**: Tables `raw_material_inventory` and `finished_stock_tags` track physical gold balances.
3.  **Audit Logs**: `audit_logs` record every update and rate change, satisfying compliance needs.
