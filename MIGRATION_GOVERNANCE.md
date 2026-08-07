# Migration Governance

Parallel stacked PRs must not create conflicting database migrations. Every database-changing PR must reserve migration ownership before adding SQL files.

## Migration Queue

The source of truth is `docs/MIGRATION_QUEUE.md`.

Before adding a migration:

1. Reserve a migration ID.
2. Record the owning branch and PR.
3. Record dependency on parent migration or PR.
4. List affected database objects.
5. List RLS, grants, triggers, functions, storage, and RPC impact.
6. Describe rollback or forward-recovery.

## Migration ID Format

Use timestamped IDs:

```text
YYYYMMDDHHMMSS_short_description.sql
```

Example:

```text
20260808103000_customer_portal_rls.sql
```

When two agents need migrations on the same day, the lower stack PR reserves the earlier timestamp and child PRs reserve later timestamps.

## Stack Dependency

Migration PRs must identify:

- Parent branch.
- Parent PR.
- Migration dependency.
- Whether this migration can run independently.
- Whether it requires a data backfill.
- Whether it changes RLS or grants.

## Review Requirements

Database PRs require review from CODEOWNERS for:

- `supabase/migrations/**`
- `supabase/functions/**`
- `src/integrations/supabase/**`
- `src/lib/repositories/**`
- `src/lib/supabase-*`

## Conflict Rules

If two branches touch the same table/function/policy:

1. Stop adding parallel migrations.
2. Create or update a lower foundation PR.
3. Rebase dependent PRs onto the foundation.
4. Update `docs/MIGRATION_QUEUE.md`.

## Rollback Notes

Every migration PR must document one of:

- A safe rollback migration.
- A forward fix strategy.
- Why rollback is unsafe and what recovery steps operators should take.
