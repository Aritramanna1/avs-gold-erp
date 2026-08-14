# ORNEXA — DATABASE & SUPABASE ARCHITECTURE MASTER
**Authoritative Schema, Migration & Storage Model**
*Version: 3.1.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Supabase-Only Authoritative Architecture

Ornexa runs entirely on **Supabase (PostgreSQL 15+)** with strict Row-Level Security (RLS), atomic database transactions, secure RPC functions, and Cloudflare R2 / Supabase Storage. All legacy SQLite, offline sync queues, and local file storage are completely deprecated and removed.

---

## 2. Table Classification & Schema Alignment

Every table in the Ornexa schema is classified below to guide clean, non-destructive migrations:

| Classification | Meaning | Action Rule |
|---|---|---|
| **KEEP** | Core table matching current approved architecture. | Preserve as-is. |
| **EXTEND** | Valid table needing additional columns for new features. | Add nullable / default columns safely. |
| **MIGRATE** | Table requiring data transformation or foreign key updates. | Run forward-safe SQL script without data loss. |
| **CONSOLIDATE**| Multiple fragmented tables merging into unified structure. | Merge into primary table with backward view. |
| **REMOVE LEGACY**| Obsolete offline-sync or legacy demo tables. | Drop after verifying zero code dependencies. |
| **MISSING** | Required for approved workflows but not yet created. | Create with standard RLS and tenant scoping. |

---

## 3. Core Database Table Schema Inventory

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TENANCY & IDENTITY                                │
│  • organizations / firms (KEEP)                                             │
│  • branches (KEEP)                                                          │
│  • user_profiles (EXTEND - add branch_ids array, state, custom_fields)      │
│  • user_roles (KEEP - maps user_id to app_roles)                             │
│  • portal_invitations (NEW - tracks invitation token, states & expiry)      │
├─────────────────────────────────────────────────────────────────────────────┤
│                          PARTY 360 & DIRECTORY                              │
│  • people / parties (EXTEND - state_code, place_of_supply, custom_fields)   │
│  • party_credit_limits (KEEP)                                               │
│  • party_kyc_documents (EXTEND - storage_path, verified_by)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                       MANUFACTURING & CUSTODY BOOKS                         │
│  • job_cards (EXTEND - mina_status, polish_status, custom_fields)           │
│  • manufacturing_book_entries (EXTEND - connects all stage events)          │
│  • worker_returns (EXTEND - filings_mg, scrap_mg, recovery_mg)              │
│  • outside_work_orders (KEEP - Section 143 job work tracking)               │
│  • mina_process_records (NEW / EXTEND - enameling stage tracking)           │
│  • polish_process_records (NEW / EXTEND - buffing & dust recovery)          │
│  • bis_hallmark_registry (EXTEND - 6-character HUID, cert_url)              │
│  • qc_inspection_logs (NEW / EXTEND - checklists, pass/fail, rework_notes)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                          INVENTORY & VAULT GOLD                             │
│  • stock_items / ready_stock (EXTEND - multiple images array, tray_no)      │
│  • stock_categories (EXTEND - custom fields schema)                         │
│  • vault_gold_ledger (KEEP - double-entry physical gold movements)          │
│  • bullion_rates (KEEP - live and manual daily rates)                       │
│  • physical_stock_verifications (KEEP - scan audits & variances)            │
├─────────────────────────────────────────────────────────────────────────────┤
│                       BILLING, VOUCHERS & EXPENSES                          │
│  • invoices (EXTEND - buyer_state_code, seller_state_code, due_date, terms) │
│  • invoice_items (EXTEND - making_formula_snapshot, stone_details)          │
│  • cash_ledger / money_movements (KEEP - integer paise double-entry)        │
│  • gold_ledger / metal_movements (KEEP - integer mg fine metal)             │
│  • expenses (EXTEND - approval_status, approved_by, receipts_storage_path)  │
│  • expense_categories (KEEP - customizable master)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                     DOCUMENTS & PRINT CONFIGURATION                         │
│  • document_templates (NEW / EXTEND - 7 professional layout definitions)    │
│  • print_profiles (NEW / EXTEND - A4, A5, Thermal, Labels, margins, scales) │
│  • print_terms_conditions (NEW / EXTEND - hierarchy: firm > branch > doc)   │
│  • generated_documents (EXTEND - secure token, audit context, pdf_path)     │
├─────────────────────────────────────────────────────────────────────────────┤
│                      BACKUP & DISASTER RECOVERY                             │
│  • tenant_backups (NEW - metadata, size, checksum_sha256, download_url)     │
│  • tenant_restore_audit (NEW - pre-restore snapshot ID, diff report)        │
├─────────────────────────────────────────────────────────────────────────────┤
│                      COMMUNICATION & WHATSAPP META                          │
│  • whatsapp_tenants / waba_configurations (EXTEND - Meta embedded signup)   │
│  • whatsapp_templates (KEEP - Meta synced templates)                        │
│  • message_logs (EXTEND - provider_cost, delivery_status, retry_count)      │
│  • email_outbox (NEW / EXTEND - transactional email queue)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                     PORTALS, SUPPORT & AI ASSISTANT                         │
│  • support_tickets (EXTEND - SLA, priority, conversation threads)           │
│  • support_ticket_messages (KEEP)                                           │
│  • ai_assistant_sessions (NEW / EXTEND - tool call logs, quota usage)       │
│  • customer_design_approvals (NEW / EXTEND - CAD approval / rework notes)   │
│  • supplier_purchase_orders (EXTEND - vendor delivery confirmations)        │
├─────────────────────────────────────────────────────────────────────────────┤
│                       PLATFORM OWNER & SAAS ADMIN                           │
│  • platform_plans (KEEP - plan tiers, module limits, pricing)                │
│  • organization_subscriptions (KEEP - billing cycle, status, grace_period)  │
│  • license_entitlements (KEEP - activation keys & device seats)             │
│  • platform_audit_logs (KEEP - security & administrative events)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Controlled Backend RPC & Edge Functions Inventory

Critical business, security, and accounting actions execute via server-side RPC functions:

1. `post_tax_invoice(p_invoice_id, p_payload)` → Validates stock, calculates GST, atomically posts to cash and gold ledgers, and generates document token.
2. `issue_gold_to_karigar(p_karigar_id, p_gross_mg, p_purity, p_job_id)` → Decrements vault gold, increments worker custody, and logs movement.
3. `receive_worker_return(p_return_id, p_job_id, p_weights)` → Reconciles finished piece, scrap, filings, calculates allowable Ghat, and updates balances.
4. `create_portal_invitation(p_party_id, p_portal_type, p_email, p_role_id)` → Generates secure single-use invitation token with expiration.
5. `accept_portal_invitation(p_token, p_password)` → Atomically provisions user, verifies party binding, and activates access.
6. `get_customer_portal(p_customer_id)` → Scoped read-only RPC returning orders, invoices, and wallet without exposing internal costs.
7. `get_karigar_portal(p_karigar_id)` → Scoped RPC returning active job cards, personal gold custody, and wage history.
8. `create_customer_support_ticket(p_subject, p_desc, p_category)` → Inserts support ticket with audit metadata.
9. `generate_tenant_backup(p_tenant_id)` → Packages encrypted business data archive and writes checksum record.
10. `validate_license_entitlement(p_license_key, p_device_id)` → Verifies active subscription, seats, and module feature flags.
11. `generate_secure_document_token(p_doc_id, p_doc_type)` → Issues time-limited signed URL for public PDF preview without exposing raw storage.

---

## 5. Storage Architecture & Bucket Security

Ornexa isolates binary assets into secure Cloudflare R2 / Supabase Storage buckets:

| Bucket Name | Access Policy | Allowed Formats | Usage |
|---|---|---|---|
| `firm-logos` | Public / Signed Read | PNG, JPG, SVG, WebP | Company and branch logos for documents and app header. |
| `stock-images` | Authenticated Read | WebP, JPG, PNG | High-resolution Ready Stock and Design Catalogue photos. |
| `cad-designs` | Authenticated / Portal | 3DM, STL, PNG, PDF | CAD drawings and customer design approval renders. |
| `invoices-pdf` | Private (Signed Token) | PDF | Generated invoice PDFs and tax vouchers. |
| `job-attachments`| Private (Tenant Scope)| JPG, PNG, PDF | Reference sketches, physical job cards, and Karigar receipts. |
| `qc-evidence` | Private (Tenant Scope)| JPG, PNG, MP4 | Quality inspection failure photos and video recordings. |
| `receipts-expense`| Private (Tenant Scope)| PDF, JPG, PNG | Expense bills, fuel vouchers, and maintenance receipts. |
| `support-files` | Private (Tenant Scope)| JPG, PNG, PDF, ZIP | Customer and staff support ticket attachments. |
| `tenant-backups`| Strict Admin (Encrypted)| `.ornexa.enc`, ZIP | Self-service encrypted tenant backup packages. |

*Storage Rule: Never store raw public URLs in the database. Store storage paths (`tenant_id/year/filename.ext`) and generate signed token URLs for secure rendering.*
