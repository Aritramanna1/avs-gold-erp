# MTJ ERP — Master Project Brain

_Last updated: 2026-06-28 · Build v0.5.0 · Production Readiness Sprint_

---

## 1. Project Vision

MTJ ERP is a **white-label, multi-branch, multi-workshop jewellery ERP** built for modern retail and manufacturing operations. It is designed to run as a cloud-first SaaS with Supabase as the backend, supporting multiple independent jewellery businesses (companies), each with multiple branches and workshops.

Nothing is hardcoded for MTJ — all firm details, branch names, user roles, and features are configured at runtime.

---

## 2. Business Goals

- **Flawless Inventory Tracking**: Real-time stock by weight, purity, design, barcode.
- **Double-Entry Gold Ledger**: Every gold movement (issue, receive, convert, sell) balances exactly in milligrams.
- **Karigar Collaboration**: Track gold liabilities and job statuses with artisan workshops.
- **Frictionless Retail Billing**: GST invoicing, advance/gold/cash/UPI modes, old-gold buyback.
- **Manufacturing Bill**: Karigar account ledger — P-entries (gold given), MP-entries (gold received back), fine calculations.
- **Audit-Ready Compliance**: Chronological log of all operations, print-ready vouchers.

---

## 3. Architecture

### Tech Stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | React 19 + Vite + TypeScript                            |
| Routing  | TanStack Router (file-based)                            |
| State    | Zustand (no persist middleware — Supabase is the store) |
| Database | Supabase (PostgreSQL + RLS + Realtime)                  |
| Auth     | Supabase Auth                                           |
| Styling  | Tailwind CSS v4 + shadcn/ui                             |
| Print    | React + CSS print media queries                         |
| Barcode  | `react-barcode` + `qrcode`                              |

### Persistence Pattern

Every store mutation follows this flow:

```
User Action → Zustand set() → saveDirect("table", id, payload) → Supabase upsert
App Load   → pullAll() → reads all Supabase tables → hydrates all stores
Realtime   → startRealtimeSync() → postgres_changes → pullXxx() re-hydrates
```

### Key Files

| File                                  | Purpose                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `src/lib/settings-store.ts`           | Firm profile, branches, workshops, users, invitations      |
| `src/lib/data-loader.ts`              | `pullAll()` — loads everything from Supabase on startup    |
| `src/lib/realtime-sync.ts`            | `startRealtimeSync()` — live Postgres change subscriptions |
| `src/lib/supabase-write.ts`           | `saveDirect(table, id, payload)` — generic upsert helper   |
| `src/integrations/supabase/client.ts` | Supabase client singleton                                  |
| `src/integrations/supabase/types.ts`  | Auto-generated DB types                                    |
| `src/routes/__root.tsx`               | App root, auth gate, `pullAll()` trigger                   |

### Integer Arithmetic Rule

- **Money**: stored as integer **paise** (1 ₹ = 100 paise)
- **Gold**: stored as integer **milligrams** (1 g = 1000 mg)
- **Purity**: stored as integer **per-mille** (916 = 91.6% = 22K)
- **No floating point** for financial calculations anywhere

---

## 4. Multi-Company Architecture

- **Organization** → Company (e.g., "Maa Tara Jewellers")
- **Branch** → Physical location (e.g., "Retail — ICH", "Mfg — GKP")
- **Workshop** → Functional unit within a branch
- **User** → Has a role + branch assignment + workshop assignment
- **Branch isolation**: `branch_id` on all core tables, RLS auto-filters

### Supabase Tables (as of v0.4.0)

| Table                 | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `app_settings`        | Firm JSON blob (firm profile, print, GST config)     |
| `branches`            | Branch registry with FK to organizations             |
| `workshops`           | Workshop registry with FK to branches                |
| `branch_settings`     | Per-branch GSTIN, SMTP, printer, series config       |
| `invitations`         | Invitation codes for user onboarding                 |
| `user_profiles`       | Users with branch_id, workshop_id, role, permissions |
| `people`              | Customers, karigars, suppliers (with branch_id)      |
| `orders`              | Customer orders (with branch_id)                     |
| `job_cards`           | Workshop job cards (with branch_id)                  |
| `job_process_steps`   | Steps within each job card                           |
| `invoices`            | Billing invoices (with branch_id)                    |
| `payments`            | Invoice payment records                              |
| `repairs`             | Repair/polishing jobs (with branch_id)               |
| `inventory`           | Stock items                                          |
| `stock_movements`     | Stock movement log                                   |
| `gold_ledger`         | Fine gold movement ledger                            |
| `attendance`          | Worker attendance records                            |
| `salary_rules`        | Worker salary configuration                          |
| `worker_transactions` | Withdrawals, loans, advances                         |
| `worker_settlements`  | Periodic salary settlements                          |
| `rate_cut_records`    | Karigar overloss penalty records                     |
| `daily_close`         | End-of-day closing snapshots                         |
| `print_logs`          | Print event audit trail                              |
| `catalog_designs`     | Product design catalog                               |
| `communication_logs`  | WhatsApp/email send log                              |
| `whatsapp_inbox`      | Incoming WhatsApp messages                           |
| `dropdown_masters`    | User-configurable dropdown values                    |
| `attachments`         | File/image attachments                               |
| `audit_logs`          | Tamper-evident audit trail                           |

---

## 5. Module Status

### Production-Ready ✅

- **Auth / Login** — Supabase Auth, role-based access
- **Settings** — Firm profile, GST, branding, gold rates, users, invitations
- **Branch Management** — Create/edit/default branches, persisted to Supabase
- **Workshop Management** — Create/edit workshops, linked to branches
- **People / KYC** — Customer & karigar registry, Aadhaar/PAN, notes
- **Orders** — Customer order creation, status tracking, karigar assignment
- **Job Cards** — Workshop job cards with configurable process steps
- **Gold Ledger** — Double-entry fine gold ledger with bucket tracking
- **Repairs** — Repair & polishing intake, status workflow, billing
- **Billing** — GST invoice with multiple payment modes including gold
- **Inventory / Stock** — Item registry with image upload, barcode, HUID
- **Attendance** — Stay-based attendance for West Bengal labour model
- **Workers / Payroll** — Salary rules, withdrawals, loans, advances, settlements
- **Gold Book** — Workshop karigar gold issue/receive register
- **Rate Cut** — Karigar overloss penalty calculation and settlement
- **Daily Close** — End-of-day reconciliation snapshot
- **Print System** — A4, thermal 80mm, thermal 58mm layouts for all documents
- **Barcode** — Barcode + QR code generation and printing
- **Reports** — Daily close report, karigar gold statements, customer ledger
- **CEO Dashboard** — Per-branch KPI analytics (read-only, no operational work)

### Partially Complete ⚠️

- **Manufacturing Bill** — Bill creation works, TS type issues in store (non-blocking)
- **Communications** — WhatsApp deep-link works; Cloud API/BSP delivery not wired to real keys
- **Email** — Template designer done; SMTP delivery needs real credentials
- **Catalog** — Design catalog CRUD done; photo management partial
- **Branch Settings UI** — Form exists; read-back from Supabase not wired

### Not Yet Started ❌

- **GST Module** — GSTR-1, GSTR-3B filing, HSN summary
- **Bullion Trading** — Gold/silver purchase from market
- **CRM** — Customer relationship tracking, follow-ups
- **Offline Mode** — Service worker, IndexedDB fallback
- **SaaS Admin Panel** — Multi-tenant onboarding
- **Barcode Scanner Hardware** — USB HID integration (typing simulation works)
- **Weighing Scale Hardware** — Serial port / USB serial

---

## 6. Known Issues (v0.4.0)

1. **manufacturing-bill-store.ts** — 17 TS type errors (store API mismatch). Build passes but tsc strict fails. Module functions correctly at runtime.
2. **BillingModule.tsx** — 2 TS errors (`BillingType` assignment, `grandTotal` name). Non-blocking.
3. **Branch filtering on invoices** — `branch_id` column added to DB. Store objects don't yet carry `branchId` for invoices/orders — filtering in CEO dashboard is DB-level only.
4. **SMTP email** — Provider code written but no real credentials in `.env`.
5. **WhatsApp Cloud API** — Deep-link delivery works; API delivery requires WhatsApp Business API keys.
6. **Chunk size warning** — `index.js` bundle is 644 KB (gzip: 178 KB). Acceptable for SPA, will improve with code splitting later.

---

## 7. Environment Variables Required

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
```

---

## 8. Development Rules (Non-Negotiable)

1. **Integer arithmetic only** — never use floats for money or gold
2. **Supabase is the source of truth** — every mutation calls `saveDirect()`
3. **No hardcoded firm data** — firm name, GSTIN, branches all come from settings-store
4. **Branch isolation** — every write must include `branch_id` where applicable
5. **Print CSS** — sidebar and header must be hidden for all print routes
6. **White-label** — this ERP must work for any jeweller, not just MTJ
