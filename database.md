# MTJ ERP — Database Blueprint

This document represents the single source of truth for the **MTJ ERP** database schema, design philosophy, security protocols, and operational constraints.

---

## 1. Database Design Philosophy

- **Database-First Integrity**: The database is the ultimate gatekeeper of data correctness. We do not rely solely on the client application to validate relationships or financial rules.
- **Precise Integer Storage**: To avoid floating-point inaccuracies, all financial fields are stored in **Paise** (cents/INR fraction) and all precious metal weights are stored in **Milligrams (mg)** (e.g., `1.000` gram = `1000` mg).
- **Immutable Financial Ledgers**: Invoices, transactions, and payment receipts must never be silently edited or deleted. Changes must be recorded as adjusting/reversing journal entries to preserve audit logs.
- **Granular Ownership**: Every row is strictly assigned to a `branch_id` and/or `user_id` to enforce enterprise-grade data isolation.

## 2. Naming Conventions

- **Tables and Columns**: Lowercase snake_case (e.g., `invoice_items`, `net_weight_mg`).
- **Primary Keys**: Always named `id`, utilizing UUIDv4 or structured sequential codes.
- **Foreign Keys**: Named as `singular_table_name_id` (e.g., `customer_id` referencing `people.id`).
- **Booleans**: Prefixed with `is_`, `has_`, or `should_` (e.g., `is_taxable`).
- **Timestamps**: Suffixed with `_at` (e.g., `created_at`, `updated_at`), stored with time zone (TIMESTAMPTZ).

---

## 3. Table Documentation

_(Note: Initial table structures are documented below for implementation reference.)_

### `people` (Customers & Karigars)

Tracks all external contact entities.

- `id` (UUID): Primary key.
- `full_name` (VARCHAR): Contact full name.
- `phone` (VARCHAR): Unique identifier for quick search.
- `email` (VARCHAR, Nullable)
- `role` (VARCHAR): Enum (`customer`, `karigar`, `both`).
- `gstin` (VARCHAR, Nullable): Tax registration code.
- `address` (TEXT, Nullable)
- `created_at` (TIMESTAMPTZ)

### `designs` (Catalog Items)

- `id` (UUID): Primary key.
- `design_number` (VARCHAR): Unique SKU code.
- `design_name` (VARCHAR)
- `category` (VARCHAR): e.g., `Ring`, `Necklace`.
- `subcategory` (VARCHAR, Nullable)
- `purity` (VARCHAR): Gold purity label, e.g., `22K (916)`.
- `approx_gross_mg` (INTEGER): Estimated weight.
- `image_url` (TEXT, Nullable)

### `stock_items` (Inventory)

- `id` (UUID): Primary key.
- `barcode` (VARCHAR): Unique tracking barcode.
- `design_id` (UUID): References `designs.id`.
- `gross_weight_mg` (INTEGER)
- `net_weight_mg` (INTEGER)
- `purity` (VARCHAR)
- `status` (VARCHAR): Enum (`available`, `assigned`, `sold`, `melted`).
- `location` (VARCHAR): Vault, display counter, etc.

### `invoices`

- `id` (UUID): Primary key.
- `invoice_no` (VARCHAR): Unique serial.
- `customer_id` (UUID): References `people.id`.
- `billing_type` (VARCHAR): Enum (`sale`, `repair`, `polishing`, `advance_receipt`, `payment_receipt`).
- `subtotal_paise` (INTEGER)
- `making_charges_paise` (INTEGER)
- `discount_paise` (INTEGER)
- `gst_paise` (INTEGER)
- `grand_total_paise` (INTEGER)
- `paid_paise` (INTEGER)
- `balance_paise` (INTEGER)
- `created_at` (TIMESTAMPTZ)

---

## 4. Relationships

- **Invoice to Customer**: `invoices.customer_id` belongs to `people.id` (1:Many).
- **Invoice Items to Invoice**: `invoice_items.invoice_id` belongs to `invoices.id` (Cascade on Delete).
- **Stock to Design**: `stock_items.design_id` references `designs.id` (Restrict on Delete).
- **Karigar Jobs**: `workshop_jobs.karigar_id` references `people.id` (Restrict on Delete).

## 5. Indexes

- **People Phone**: `idx_people_phone` on `people(phone)` for rapid lookup at the cash counter.
- **Stock Barcode**: `idx_stock_barcode` on `stock_items(barcode)` for scanner parsing.
- **Invoice Numbers**: `idx_invoice_no` on `invoices(invoice_no)`.

## 6. Constraints

- **Purity Values**: Check constraint ensuring karat rates are within a valid set (e.g., `18K`, `22K`, `24K`).
- **Non-Negative Wealth**: Ensure that `gross_weight_mg` and `grand_total_paise` values are always `>= 0`.

## 7. Triggers

- **Auto-Serial Invoice Generation**: Generates incremental sequence codes (e.g., `INV-2026-0001`) automatically on database insert.
- **Auto-Update Timestamp**: Updates `updated_at` on every row modification.

## 8. Views

- **`view_stock_summary`**: Aggregates total stock counts, average weights, and book value grouped by design category.
- **`view_karigar_balance`**: Computes live net outstanding gold weight liabilities for each registered Karigar.

## 9. RPCs (Stored Procedures)

- **`adjust_vault_gold(mg_delta, notes)`**: Transactionally credits or debits gold holdings to ensure lock-step synchronization.
- **`process_mixed_payment(invoice_id, payment_json)`**: Safely records diverse payments and computes customer ledger updates atomically.

## 10. Storage

- **Bucket: `product-images`**: Secure file system bucket for high-definition photograph uploads of physical stock items and custom order design drawings.

## 11. Security & Row-Level Security (RLS)

- **Global Isolation**: Every table is secured by RLS.
- **Tenant Security Policy**:
  ```sql
  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_invoice_isolation ON invoices
    FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');
  ```

---

## 12. Migration History

_(Will be populated with timestamped migrations as the schema is deployed.)_

- **[Empty]** — System initialized, waiting for baseline migration deploy.
