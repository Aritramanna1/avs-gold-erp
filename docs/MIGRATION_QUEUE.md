# Migration Queue

Use this file to reserve database migration ownership before adding or editing `supabase/migrations/**`.

| Status  | Migration ID                                       | Branch                       | PR  | Owner         | Depends on | Affected objects | RLS/grants impact | Rollback/recovery                          |
| ------- | -------------------------------------------------- | ---------------------------- | --- | ------------- | ---------- | ---------------- | ----------------- | ------------------------------------------ |
| Example | `20260808103000_example_non_production_policy.sql` | `feature/example-foundation` | TBD | Example Owner | `develop`  | `example_table`  | None              | Drop example policy before merge if unused |

## Status Values

- `Reserved`: ID claimed, migration not merged.
- `In review`: PR open and migration included.
- `Merged`: migration merged to `develop`.
- `Superseded`: replaced by another migration.
- `Example`: documentation-only example; not an active reservation.

## Rules

- One row per migration file.
- Reserve before creating the migration.
- Do not reuse IDs.
- Do not edit another owner escalation-free.
- Child-stack migrations depend on parent-stack migrations.
- Update this file when a migration is merged, superseded, or removed.
