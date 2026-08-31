# Target Reconciliation Migration Plan

No execution in this phase.

## Stage A — identity foundation

Create missing organizations, profiles, roles, branch membership, and SaaS tables using target-compatible definitions. Preconditions: column/constraint diff complete. Stop if existing target rows cannot be mapped.

## Stage B — compatibility

Add nullable tenant/branch columns only where absent. Add quarantine tables and mapping reports. Do not enforce NOT NULL yet.

## Stage C — data mapping

Map rows deterministically; quarantine unknown ownership. Validate foreign keys, duplicate keys, document numbers, ledger postings, and attachment references.

## Stage D — functions and constraints

Install hardened helpers, numbering, audit, onboarding, and gold posting only after dependencies compile. Add constraints only after compatibility reports pass.

## Stage E — RLS

Replace permissive policies table-by-table. Validate with authenticated sessions before proceeding.

## Stage F — storage

Create private buckets, metadata, tenant-scoped paths, and policies. Do not import legacy files with unproven ownership.

## Stage G — verification

Run onboarding, two-firm RLS, storage, gold concurrency, and regression tests. Only then repair migration history and deploy.
