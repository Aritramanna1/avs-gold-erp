# Ornexa Supabase RPC Security Matrix

Date: 2026-08-13

Purpose: track every remaining signed-in callable `SECURITY DEFINER` function reported by the Supabase advisor. This file prevents accidental blanket revokes that would break login, licensing, support, portals, RLS, or document numbering.

Current verified state:

- Public tables without RLS: `0 / 129`
- RLS-enabled public tables without policies: `0`
- Signed-in callable `SECURITY DEFINER` functions: `31`
- Safe helper revokes already applied: `apply_plan_entitlements(uuid, uuid, text)`, `require_organization_feature(text)`
- Remaining Supabase security advisor categories: signed-in callable `SECURITY DEFINER` functions, leaked-password protection disabled

Status values:

- `INTENTIONAL_ENDPOINT`: frontend/product RPC, must stay callable until a replacement is built.
- `RLS_HELPER`: used by policies/defaults/helper predicates; do not revoke directly without a private-schema redesign.
- `NEEDS_REDESIGN`: should move to private schema, Edge Function, service-role workflow, or invoker/RLS-safe design.
- `REVIEW`: needs authenticated workflow test before changing grants.

| Function                                                                          | Category             | Current Reason                                                                                 | Next Action                                                                               |
| --------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `create_customer_support_ticket(text,text,text,text)`                             | INTENTIONAL_ENDPOINT | Customer portal support creation. Requires customer profile guard.                             | Keep; add browser test for customer ticket creation and rate limiting.                    |
| `create_firm_support_ticket(text,text,text,text,text,text,boolean)`               | INTENTIONAL_ENDPOINT | Tenant firm support ticket creation from app/error surfaces.                                   | Keep; verify diagnostics consent, role scope, and ticket visibility.                      |
| `create_staff_support_ticket(text,text,text,text)`                                | INTENTIONAL_ENDPOINT | Staff/user support ticket creation from error/support UI.                                      | Keep; verify requester-only visibility and live chat thread creation.                     |
| `get_firm_customer_support_thread(uuid)`                                          | INTENTIONAL_ENDPOINT | Firm staff reads customer support thread for their tenant.                                     | Keep; verify firm isolation and ticket ownership.                                         |
| `get_karigar_portal()`                                                            | INTENTIONAL_ENDPOINT | Karigar portal aggregates worker-owned data across protected tables.                           | Keep; verify karigar identity matching and no cross-worker leakage.                       |
| `get_login_destination()`                                                         | INTENTIONAL_ENDPOINT | Auth gate routes platform/customer/tenant users after login.                                   | Keep; consider security-invoker rewrite only after role query policies are proven.        |
| `get_my_tenant_entitlements()`                                                    | INTENTIONAL_ENDPOINT | Tenant license/module UX reads own entitlement bundle.                                         | Keep; verify tenant isolation and expired/suspended status behavior.                      |
| `get_my_tenant_license_key()`                                                     | INTENTIONAL_ENDPOINT | Client license gate resolves tenant license without exposing all licenses.                     | Keep; verify it returns only current tenant key.                                          |
| `get_my_tenant_subscription_entitlement()`                                        | INTENTIONAL_ENDPOINT | Client license/subscription gate reads own subscription state.                                 | Keep; verify tenant isolation and trial/expired cases.                                    |
| `get_platform_support_thread(uuid)`                                               | INTENTIONAL_ENDPOINT | Platform owner reads support thread. Guarded by `is_saas_admin()`.                             | Keep; verify non-admin denial.                                                            |
| `has_role(uuid, app_role)`                                                        | RLS_HELPER           | Used heavily in policies and helper functions. Direct RPC can reveal role membership.          | Redesign into private schema or restrict direct RPC without breaking policies.            |
| `is_admin(uuid)`                                                                  | RLS_HELPER           | Used in policies/write gates.                                                                  | Redesign with private helper schema or generated claims later.                            |
| `is_customer_role()`                                                              | RLS_HELPER           | Used for customer portal isolation.                                                            | Keep pending policy redesign.                                                             |
| `is_firm_ticket_staff()`                                                          | RLS_HELPER           | Used by support thread/list/reply/transition RPCs.                                             | Keep pending support workflow tests.                                                      |
| `is_saas_admin()`                                                                 | RLS_HELPER           | Used in platform-owner policies and admin RPC guards.                                          | Keep pending private-helper redesign.                                                     |
| `issue_platform_license(text,text,text,text,integer,timestamptz,jsonb,text,uuid)` | INTENTIONAL_ENDPOINT | Platform owner issues tenant licenses from owner panel.                                        | Keep; verify non-admin denial and audit row.                                              |
| `list_customer_portal_support_tickets(text,text)`                                 | INTENTIONAL_ENDPOINT | Firm staff lists customer tickets for tenant.                                                  | Keep; verify firm isolation.                                                              |
| `list_firm_support_tickets()`                                                     | INTENTIONAL_ENDPOINT | Tenant users list their support tickets / tenant admin view.                                   | Keep; verify requester/admin scoping.                                                     |
| `list_my_support_tickets()`                                                       | INTENTIONAL_ENDPOINT | Current user support ticket list.                                                              | Keep; verify requester-only rows.                                                         |
| `my_customer_person_id()`                                                         | RLS_HELPER           | Customer portal identity helper.                                                               | Keep pending private-helper redesign.                                                     |
| `my_firm_id()`                                                                    | RLS_HELPER           | Core tenant isolation helper used across RLS.                                                  | Keep; do not revoke without replacing policy architecture.                                |
| `my_role()`                                                                       | RLS_HELPER           | Attachment/module write rules use current role.                                                | Keep; consider app_metadata/claims strategy later.                                        |
| `next_document_number(text,text,integer)`                                         | INTENTIONAL_ENDPOINT | Legal/business document numbering requires atomic definer RPC.                                 | Keep; add concurrency and role/tenant tests.                                              |
| `organization_feature_enabled(text)`                                              | RLS_HELPER           | Entitlement checks for module gating and write guards.                                         | Keep; consider private helper or signed entitlement cache later.                          |
| `renew_platform_license(text,timestamptz,text)`                                   | INTENTIONAL_ENDPOINT | Platform owner renews license from owner panel.                                                | Keep; verify non-admin denial and audit row.                                              |
| `reply_firm_customer_support_ticket(uuid,text)`                                   | INTENTIONAL_ENDPOINT | Firm staff replies to customer support thread.                                                 | Keep; verify firm isolation, visibility, and closed-ticket behavior.                      |
| `reply_platform_support_ticket(uuid,text)`                                        | INTENTIONAL_ENDPOINT | Platform owner replies to platform support ticket.                                             | Keep; verify non-admin denial and message visibility.                                     |
| `resolve_document_share(text)`                                                    | INTENTIONAL_ENDPOINT | Token-based public document sharing. Authenticated execution remains for logged-in recipients. | Keep; verify token expiry, revoked tokens, max views, and no raw document table exposure. |
| `suspend_platform_license(text,text)`                                             | INTENTIONAL_ENDPOINT | Platform owner suspends license from owner panel.                                              | Keep; verify non-admin denial and audit row.                                              |
| `tenant_module_write_allowed(text)`                                               | RLS_HELPER           | Used by transaction/posting RPCs to enforce licensed modules.                                  | Keep pending private-helper redesign.                                                     |
| `transition_firm_customer_support_ticket(uuid,text)`                              | INTENTIONAL_ENDPOINT | Firm staff transitions customer ticket status.                                                 | Keep; verify firm isolation and allowed status transitions.                               |

Next security passes:

1. Convert pure helper functions to a private, non-exposed schema or another architecture that still works inside RLS.
2. Add authenticated Playwright/Supabase tests for support ticket, license, document numbering, document share, and karigar portal denial/allow cases.
3. Enable leaked-password protection in Supabase Auth settings from the dashboard/control plane.
4. Reduce performance advisor noise separately: unindexed foreign keys and multiple permissive policies.
