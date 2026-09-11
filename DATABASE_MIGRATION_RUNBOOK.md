# AVS / Aurum / MTJ ERP — Database Migration Runbook

This document details the complete, verified procedure to migrate the ERP database, schema, authentication users, storage buckets, and operational data to your new Supabase project.

---

## 1. Preserved Schemas & Migration Assets

All database structures, functions, triggers, policies, and buckets have been cataloged and consolidated:

| Asset | Path | Description |
| :--- | :--- | :--- |
| **Master Migration Bundle** | [`supabase/MASTER_MIGRATION_BUNDLE.sql`](file:///c:/final%20erp%2029.08/new%20and%20final/supabase/MASTER_MIGRATION_BUNDLE.sql) | **1.02 MB SQL script** containing all 208 migrations in strict execution sequence. |
| **Schema Inventory** | [`supabase/MASTER_SCHEMA_INVENTORY.json`](file:///c:/final%20erp%2029.08/new%20and%20final/supabase/MASTER_SCHEMA_INVENTORY.json) | Complete JSON manifest of all 208 files, 154 tables, 74 RPC functions, and 476 RLS policies. |
| **Individual Migrations** | [`supabase/migrations/`](file:///c:/final%20erp%2029.08/new%20and%20final/supabase/migrations) | 208 individual atomic SQL migration files. |
| **Auth & Config** | [`supabase/config.toml`](file:///c:/final%20erp%2029.08/new%20and%20final/supabase/config.toml) | Auth providers, redirect URLs, TOTP MFA, and Edge Function rules. |
| **TypeScript Types** | [`src/integrations/supabase/types.ts`](file:///c:/final%20erp%2029.08/new%20and%20final/src/integrations/supabase/types.ts) | Complete strongly-typed client definitions matching the schema. |

---

## 2. Automated Migration Tooling

The following scripts have been created and prepared in [`scripts/`](file:///c:/final%20erp%2029.08/new%20and%20final/scripts):

1. **Project Schema & Bucket Orchestrator**:
   ```bash
   node scripts/migrate-to-new-project.mjs --url "<NEW_SUPABASE_URL>" --anon-key "<NEW_ANON_KEY>" --service-key "<NEW_SERVICE_ROLE_KEY>"
   ```
   - Connects to the new project.
   - Creates all 8 storage buckets (`customer-documents`, `worker-kyc`, `supplier-documents`, `firm-assets`, `catalog-designs`, `order-attachments`, `repair-attachments`, `expense-receipts`).
   - Updates `.env.local` automatically.

2. **Auth & User Migration Tool**:
   ```bash
   node scripts/migrate-auth-users.mjs --url "<NEW_SUPABASE_URL>" --service-key "<NEW_SERVICE_ROLE_KEY>" [--input users_backup.json]
   ```
   - Provisions all roles (`owner`, `admin`, `accountant`, `billing`, `vault`, `workshop`, `ceo`, `manager`, `viewer`) into `auth.users` with confirmed email statuses and role metadata.

3. **Data Table Backup & Restore**:
   ```bash
   # Once old project is temporarily accessible or from exported table files:
   node scripts/migrate-data-transfer.mjs --import --url "<NEW_SUPABASE_URL>" --service-key "<NEW_SERVICE_ROLE_KEY>"
   ```

---

## 3. What We Need When You Are Ready

When you create your new Supabase project (and MCP server), provide:
1. **Target Project URL**: e.g., `https://<new-ref>.supabase.co`
2. **Publishable / Anon Key**: `sb_publishable_...` (or standard `anon` key)
3. **Service Role Key**: (Required for database schema execution, user provisioning, and RLS bypass during import)
4. **Direct Database Connection URL** *(optional but recommended for fastest 1-click execution)*:
   `postgresql://postgres:<password>@db.<new-ref>.supabase.co:5432/postgres`
5. **New MCP configuration** *(if applicable)*.

---

## 4. How to Extract Data & Users from the Old Project

Because project `dqgrrafuoxaorvyrcuuh` is restricted with `exceed_egress_quota` (returning HTTP 402 on REST), choose one of the following methods to retrieve live data:

* **Method A (Easiest — 2-minute temporary uncap)**:
  In the Supabase Dashboard for the old project, temporarily toggle off the spend cap or upgrade to Pro ($25). Once unblocked, run:
  ```bash
  node scripts/migrate-data-transfer.mjs --export --url "https://dqgrrafuoxaorvyrcuuh.supabase.co" --service-key "<OLD_SERVICE_ROLE_KEY>"
  ```
  Then migrate the data to the new project.
* **Method B (Supabase Dashboard Table Export)**:
  In the old project dashboard → **Table Editor**, select key tables (`people`, `item_masters`, `bills`, etc.) and export as CSV/JSON.
* **Method C (Clean Bootstrap / Seed Data)**:
  If the previous project was primarily used for development, QA, and pre-launch testing, you can apply the master schema and bootstrap standard company entities and users immediately on the new project.
