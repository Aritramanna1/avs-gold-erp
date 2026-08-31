# Item Groups migration — BLOCKED on QA

**Status:** BLOCKED (not applied)  
**Approved migration:** `supabase/migrations/20260830280000_item_groups_and_inventory_master_link.sql`  
**Verdict:** Do not claim applied until live verification passes.

---

## Blocker

| Item | Detail |
|------|--------|
| **Cause** | Supabase CLI cannot authenticate as `cli_login_postgres` |
| **Missing** | `SUPABASE_DB_PASSWORD` (or equivalent owner-approved apply channel) |
| **CLI error** | `password authentication failed for user "cli_login_postgres"` |
| **Attempt** | `npx supabase db query --linked -f supabase/migrations/20260830280000_item_groups_and_inventory_master_link.sql` → **FAILED** |

This is an **environment/credential blocker**, not a code defect. Do **not** invent schema, mock tables, or fake group data.

---

## Live QA verification (2026-08-30)

| Object | QA status |
|--------|-----------|
| `public.item_groups` | ❌ Missing (REST 404) |
| `item_masters.item_group_id` column | ❌ Not verified (depends on migration) |
| `inventory.item_master_id` column | ❌ Not verified (depends on migration) |

**Probe command:** `node scripts/verify-migrations-applied.mjs` → `item_groups_table` FAIL until table returns HTTP 200.

---

## Workflows BLOCKED until migration applied

- Item Groups CRUD (`item-groups-store`, `/catalog/masters` group picker)
- Item master ↔ group assignment (`item_group_id`)
- Inventory ↔ item master authority link (`inventory.item_master_id`)

**Not blocked:** Item masters without groups, stock, billing, dashboard, portals, KYC (non-group), print/PDF, etc.

---

## Editable implementation behaviour (no fake data)

- `item-groups-store.ts` sets `schemaAvailable: false` when table missing
- `/catalog/masters` shows explicit **blocked** banner; group select disabled
- No local mock groups, no parallel table

---

## Owner action required

1. Apply `20260830280000_item_groups_and_inventory_master_link.sql` on QA via approved channel
2. Re-run `node scripts/verify-migrations-applied.mjs`
3. Confirm `SELECT to_regclass('public.item_groups')` is not null
4. Side-by-side verify `/catalog/masters` group picker loads real groups

**Do not** manually patch schema outside the approved migration file.
