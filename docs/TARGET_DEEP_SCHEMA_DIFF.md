# Target Deep Schema Diff

Status: analysis only; no corrective migration executed.

Live comparison:

- Old `kjfjsfhftytezsjyegmb`: 77 public tables, 25 public routines, 210 public policies, 8 private buckets.
- Target `dqgrrafuoxaorvyrcuuh`: 60 public tables, 3 public routines, 90 public policies, 0 buckets, no migration history.
- Target has 85 policies with literal `true` predicates.
- Target contains an undocumented `people` table; the first repository migration failed on `CREATE TABLE public.people` with `relation "people" already exists`.

Shared objects are not identical by name. A complete column/constraint diff is required before any ALTER. The target is classified as a partial undocumented baseline, not an empty deployment.

Priority differences: target is missing organizations, user_profiles, user_roles, SaaS control-plane tables, onboarding, document_shares, KYC tables, manufacturing phase tables, and 22 routines present in the old project. `attachments` exists in both environments and therefore requires a column-level and ownership diff; it is not classified as missing.

Priority-table target evidence (read-only): `people` has 9 rows and tenant/branch columns nullable; `branches` has 1 row and nullable `firm_id`; `orders` has 0 rows; `gold_ledger` has 0 rows and nullable `firm_id`; `inventory` has 0 rows and nullable `firm_id`; `attachments` has 1 row and nullable `firm_id`, with `linked_table`, `linked_id`, `kind`, and nullable `storage_path`. These shapes are not safe to constrain until tenant mapping is designed and profiled.
