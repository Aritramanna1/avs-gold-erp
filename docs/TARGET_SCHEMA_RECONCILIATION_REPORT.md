# MTJ ERP Target Schema Reconciliation

Date: 2026-07-30

## Scope

Read-only comparison of the old Supabase project `kjfjsfhftytezsjyegmb`, the
repository migrations, and the intended target project `dqgrrafuoxaorvyrcuuh`.
The old project was not modified. No target migration was successfully applied.

## Evidence summary

| Area | Old project | Target project | Classification |
|---|---:|---:|---|
| Public base tables | 77 | 60 | conflicting partial baseline |
| Public routines | 25 | 3 | target missing 22 routines |
| Public RLS policies | 210 | 90 | target policy set is incompatible/unsafe |
| Policies with `true` predicate | 1 | 85 | target requires corrective RLS work |
| Storage buckets | 8 private buckets | 0 buckets | target storage missing |
| Migration history | populated | empty | schema baseline is undocumented |
| Organizations | present in schema, no rows observed | missing | missing |
| User profiles | present in schema, no rows observed | missing | missing |
| Onboarding function | present | missing | missing |
| SaaS control-plane tables | present | missing | missing |

Queries were executed through the Supabase CLI against each linked project. The
target query confirmed that `public.organizations` does not exist. The target
also contains an existing `public.people` table.

## Table classification

### Old-only objects requiring creation or explicit review

`customer_gold_deposits`, `document_shares`, `feature_flags`,
`gold_issue_register`, `gold_receive_register`, `invitations`,
`jeweller_transactions`, `kyc_documents`, `licenses`, `login_history`,
`metal_conversions`, `organization_features`, `organization_subscriptions`,
`organization_usage_snapshots`, `organizations`, `platform_audit_events`,
`platform_plans`, `platform_settings`, `subscription_history`,
`support_sessions`, `user_profiles`, `user_roles`, `whatsapp_templates`, and
`workshop_process_transactions`.

These are classified as `missing`, but creation is not automatically safe until
foreign keys, enum types, and target-compatible columns are compared in detail.

### Target-only objects

`comm_provider_settings`, `erp_schema_meta`, `erp_setup_guard`,
`hallmark_batches`, `physical_stock_counts`, `print_templates`, `stock_lots`,
and `stock_stones`.

These are classified as `target-specific / requires review`. They must not be
dropped or replaced automatically.

### Shared tables

The shared table names are not classified as identical merely because the name
matches. The failed migration proves at least one target table (`people`) has
an undocumented definition that conflicts with the repository's initial
`CREATE TABLE` statement. Shared tables require column, constraint, index,
trigger, and policy diffing before any `ALTER` is written.

## Function and policy classification

The old project exposes 25 public routines, including `my_firm_id`, `has_role`,
`is_admin`, `is_saas_admin`, `onboard_tenant`, `execute_gold_transaction`,
`organization_feature_enabled`, and numbering/audit routines. The target exposes
only `generate_sequential_number`, `rls_auto_enable`, and `set_updated_at`.

The target has 85 policies whose `qual` or `with_check` is literally `true`.
This is not an acceptable production baseline. No target RLS verification was
performed with authenticated sessions because the target has no tenant identity
objects yet.

## Storage classification

The old project has eight private buckets:

`catalog-designs`, `customer-documents`, `expense-receipts`, `firm-assets`,
`order-attachments`, `repair-attachments`, `supplier-documents`, and
`worker-kyc`.

The target has zero storage buckets. Existing legacy objects remain in the old
project and were not imported. Their ownership is therefore not being guessed
or silently transferred.

## Migration attempt and blocker

The repository migration chain was dry-run against the target and then stopped
at the first migration. The exact failure was:

```text
ERROR: relation "people" already exists
```

The target has no migration history, so `migration repair` cannot safely be used
to mark the repository migrations applied. Doing so would falsely state that
the target has the repository schema and could hide missing routines, tables,
constraints, storage buckets, and security policies.

## Corrective migration status

No baseline reconciliation migration has been applied. This is intentional.
Creating one before the complete shared-table column/constraint/function diff
would be unsafe and would violate the no-guessing requirement.

The repository contains a corrected storage migration and target project guard,
but the storage migration has not been pushed because its prerequisite schema
baseline is unresolved.

## Required next steps

1. Export authoritative old and target definitions for every shared table,
   constraint, index, trigger, enum, routine, view, extension, and policy.
2. Produce a column-level diff for all shared tables, starting with `people`,
   `branches`, `orders`, `gold_ledger`, `inventory`, and `attachments`.
3. Create one reviewed additive reconciliation migration.
4. Add missing organization/profile/SaaS/onboarding objects.
5. Replace target permissive policies only after firm/profile identity objects
   exist and policy predicates compile against target columns.
6. Create private target storage buckets and apply tenant-scoped policies.
7. Verify the resulting target schema, then repair migration history only for
   migrations proven equivalent to the target state.
8. Create controlled tenants and run authenticated RLS, storage, onboarding,
   and gold concurrency tests.

## Production status

**Not production-ready.** The target is a partial, undocumented schema with
missing MTJ identity, SaaS, onboarding, storage, and security objects. No
deployment or production cutover should occur until the reconciliation migration
and authenticated verification are complete.
