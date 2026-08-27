# Platform Access parity audit — Slice 4

Date: 2026-08-27  
Foundation: locked production `main` + live entitlement migrations.

## Checklist

| Check | Evidence | Status |
|-------|----------|--------|
| Assign plan + apply_plan_entitlements | Platform subscriptions UI + RPC | PASS (wired) |
| AVS_* assignable only | `platform.tsx` filter `code.startsWith("AVS_")` | PASS |
| Price data-driven | `AvsCatalogPricingPanel` edits `price_minor` | PASS |
| Suspend fails closed | `organization_feature_enabled_for` status check (live) | PASS |
| Activate re-applies entitlements | `setSubscriptionStatus` → `apply_plan_entitlements` | PASS |
| Manual override source | `toggleModule` sets `source=manual` | PASS |
| MODULE_KEYS = real features | manufacturing, crm_communications, portals, … | PASS |
| Tenant boot entitlements | `auth-gate` → `get_my_tenant_entitlements` | PASS |
| Route deny + MTG allowlist | `pathAllowedByEntitlements(..., { isMtg })` | PASS |
| Portal feature gate | `get_my_portal_context` raises `feature_not_entitled` | PASS (live) |
| RLS restrictive writes | repairs, job_cards, invoices, melt_jobs, orders, catalog_designs | PASS (live) |
| MTG isolation | `MtgShell` only when `isMtg`; `/mtg` denied for non-MTG | PASS |

## Residual notes

- `stock_items` / `attendance_records` tables may not exist on this deployment; entitlement restrict policies apply to tables present.
- OD matrix cells remain Owner Decision — not invented.
- Barcode deferred per plan.
