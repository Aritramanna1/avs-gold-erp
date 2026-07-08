# MTJ ERP — Master Roadmap & TODO

_Last updated: 2026-06-28 · v0.4.0 Workshop Trial Export_

---

## ✅ Completed — Phase 1–5 (Stable)

### Foundation

- [x] Project setup: React 19 + Vite + TanStack Router + Zustand + Supabase
- [x] Authentication: Supabase Auth with role-based access control
- [x] Multi-branch architecture: branches table, per-branch RLS
- [x] Multi-workshop architecture: workshops table, linked to branches
- [x] Settings store: firm profile, users, invitations, GST, branding
- [x] Data loader: `pullAll()` on startup, realtime sync on change
- [x] Supabase persistence: every store mutation calls `saveDirect()`
- [x] Integer arithmetic: paise, milligrams, per-mille throughout

### Core Modules

- [x] People / KYC — customers, karigars, Aadhaar/PAN
- [x] Orders — customer order creation and status tracking
- [x] Job Cards — workshop assignments with process step templates
- [x] Gold Ledger — double-entry fine gold with vault/karigar buckets
- [x] Billing — GST invoice, multi-payment modes, old-gold, advance
- [x] Repairs — intake, status workflow, delivery, billing
- [x] Inventory / Stock — item registry, barcode, HUID, image upload
- [x] Attendance — stay-based model (Not Arrived / Working / Gone Home)
- [x] Workers / Payroll — salary rules, withdrawals, loans, settlements
- [x] Gold Book — karigar issue/receive register
- [x] Rate Cut — overloss penalty calculation and settlement
- [x] Daily Close — end-of-day reconciliation
- [x] Manufacturing Bill — karigar account ledger (P/MP entries, fine calc)
- [x] Catalog — product design catalog with photos
- [x] Print System — A4, thermal 80mm/58mm for all document types
- [x] Barcode — barcode + QR code generation and print
- [x] Reports — daily close, gold statements, customer ledger
- [x] CEO Dashboard — per-branch analytics (read-only)
- [x] Branch Settings UI — GSTIN, SMTP, printer, invoice series per branch

### Infrastructure

- [x] TypeScript errors: reduced from 313 → 18 (18 are pre-existing in mfg-bill-store)
- [x] Build: `npm run build` → ✓ success, 3.8s
- [x] Supabase types: auto-generated and up to date
- [x] Migration: `branch_id` added to orders, invoices, repairs, job_cards, people
- [x] Invitation system: 6-digit code, 7-day expiry, accept link with params
- [x] User management: role assignment, workshop/branch assignment, Super Owner
- [x] `.env.example` created

---

## 🔴 Critical Before Next Development Phase

### Database

- [x] Add `branchId` to store objects — orders, invoices, repairs, job_cards all stamped with selectedBranchId on creation
- [x] Fix manufacturing-bill-store.ts type errors — resolved in v0.4.1 stabilization
- [ ] Add Row-Level Security policies for branch-level data isolation (currently policies are permissive)

### UI/UX

- [ ] Branch Settings: wire read-back from Supabase `branch_settings` table on load
- [ ] Dashboard: add date range picker for CEO analytics
- [x] BillingModule.tsx: TS errors resolved

---

## 🟡 Phase 6 — Enterprise Modules (Post Workshop Trial)

### GST Module

- [ ] GSTR-1 return computation (B2B, B2C, exports)
- [ ] GSTR-3B computation and filing summary
- [ ] HSN/SAC master and invoice-level HSN coding
- [ ] E-invoice (IRN generation via NIC API)
- [ ] E-way bill generation
- [ ] GST payment challan

### Bullion Trading

- [ ] Gold/silver purchase from market (bullion receipt)
- [ ] Silver ledger (mirror of gold ledger)
- [ ] Bullion vendor management
- [ ] Market rate integration (live MCX/spot prices)

### CRM

- [ ] Customer visit history
- [ ] Birthday / anniversary reminders
- [ ] Follow-up task management
- [ ] Customer lifetime value analytics

### Communications

- [ ] WhatsApp Cloud API: send invoices, order ready alerts, payment reminders
- [ ] SMTP email: invoice PDF delivery
- [ ] Bulk messaging campaigns
- [ ] Template approval workflow

### Offline Mode

- [ ] Service worker with background sync
- [ ] IndexedDB fallback store
- [ ] Conflict resolution on reconnect
- [ ] Offline indicator in UI

### SaaS / Multi-Tenant

- [ ] Admin panel for onboarding new firms
- [ ] Subscription / license management
- [ ] Tenant isolation verification
- [ ] White-label domain configuration

### Hardware

- [ ] Weighing scale: USB serial integration (RS-232)
- [ ] Barcode scanner: USB HID (keyboard wedge already works)
- [ ] Cash drawer: ESC/POS trigger
- [ ] RFID tag reading

---

## 🟢 Post-Workshop Trial Improvements (Based on User Feedback)

_To be populated after real workshop testing_

---

## Workshop Trial Checklist (v0.4.0)

### Before Going Live

- [x] Build passes (v0.4.1: 0 errors, 0 TS errors)
- [x] Database connected (kjfjsfhftytezsjyegmb.supabase.co)
- [x] Branches seeded (Retail ICH, Mfg ICH, Mfg GKP)
- [x] Workshops seeded (5 workshops)
- [x] Auth working
- [ ] Real firm profile entered in Settings
- [ ] Real branch GSTIN entered in Branch Settings
- [ ] At least one real user created beyond owner
- [ ] Test order → job card → billing flow end-to-end
- [ ] Verify print on actual printer
- [ ] Verify data persists after browser refresh
