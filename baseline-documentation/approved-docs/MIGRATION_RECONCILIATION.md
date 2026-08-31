# Migration Reconciliation — 2026-08-16

## Situation

Remote Supabase (`dqgrrafuoxaorvyrcuuh`) accumulated migrations via dashboard/MCP with version names that do not all exist as local files. `supabase db push` fails with `LegacyDbPushMissingLocalError`.

## Remote-only versions (not in local `supabase/migrations/`)

These exist on remote only and must **not** be reverted without PO approval:

- `20260730182914` … `20260815185836` (see `supabase migration list --linked` for full list)
- Payment engine applied as chunks: `platform_payment_engine_v1`, `_functions_a/b`, `_allocate`, `_cash`, `_webhook`

## Applied this session (via MCP `apply_migration`)

| Migration name | Purpose |
|---|---|
| `platform_completion_core` | AMC sweep, refund RPC, email template, settings |
| `public_trial_and_training_v1` | Trial settings, `platform_commercial_leads`, `user_tutorial_progress` |
| `public_trial_provision_fn` | `provision_public_trial`, `platform_lead_tasks` |

## Local files pending formal push

- `20260816010000_platform_payment_engine_v1.sql` — content already on remote (chunked)
- `20260816020000_platform_completion_v1.sql` — applied as `platform_completion_core`
- `20260815260000_public_trial_training_razorpay.sql` — partially applied (provision + leads; older `process_razorpay` in file superseded by v1 engine)

## Repair strategy (non-destructive)

1. **Do not** `db reset` or revert remote-only migrations.
2. Keep applying forward-only deltas via `apply_migration` or append new local files with timestamps **after** `20260816020000`.
3. When aligning CLI: run `npx supabase migration repair --status applied <version>` for each local file whose SQL is already on remote, **after PO reviews the list**.
4. Document any new remote apply with matching local file in the same PR.

## Verification

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20;
```

Edge functions deployed this session: `platform-payment-api`, `razorpay-webhook`, `public-trial-provision`, `trial-lifecycle-sweep`, `run-whatsapp-campaign`, `send-whatsapp-inbox-reply`, `communication-scheduler` (updated).
