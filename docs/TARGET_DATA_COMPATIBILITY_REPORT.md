# Target Data Compatibility Report

Status: blocked before mutation.

The target already contains 60 public tables but has no tenant identity tables. Therefore existing rows cannot currently be assigned safely to a firm or branch. No NOT NULL, foreign key, uniqueness, enum, or check constraint was added.

Known blockers:

- `people` exists in target with an undocumented definition; the repository create migration conflicts.
- `organizations` and `user_profiles` are absent, so tenant ownership cannot be derived.
- Priority-table live profile: `people` 9 rows, `branches` 1 row, `orders` 0 rows, `gold_ledger` 0 rows, `inventory` 0 rows, `attachments` 1 row. These counts are direct read-only target queries, not estimates.
- `attachments` exists in target and has data, so its ownership and storage reference must be mapped before constraints or storage migration.
- Target purpose-specific tables (`erp_schema_meta`, `erp_setup_guard`, `comm_provider_settings`, `hallmark_batches`, `physical_stock_counts`, `print_templates`, `stock_lots`, `stock_stones`) require business/schema review before alteration.
- Target data backup via native `supabase db dump` was blocked because Docker Desktop is unavailable. Direct metadata queries remain read-only; no backup claim is made.
