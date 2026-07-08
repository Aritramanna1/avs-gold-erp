# MTJ ERP — Workshop Trial Guide

**Version: 0.4.0 | Date: 2026-06-28 | Build: Production Freeze**

This document is for setting up and running the real workshop trial.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment file
cp .env.example .env
# Edit .env with your Supabase URL and keys

# 3. Start development server
npm run dev

# 4. Or build for production
npm run build
# Then serve the dist/ folder with any static host
```

---

## System Requirements

| Requirement | Value                                |
| ----------- | ------------------------------------ |
| Node.js     | 18+ (20 recommended)                 |
| npm         | 9+                                   |
| Browser     | Chrome 110+, Firefox 115+, Edge 110+ |
| Internet    | Required (Supabase cloud)            |
| Screen      | 1280×800 minimum                     |

---

## Modules — Production Ready ✅

These modules are safe for real workshop use:

| Module             | Route                  | Notes                            |
| ------------------ | ---------------------- | -------------------------------- |
| Login / Auth       | `/login`               | Supabase Auth                    |
| Settings           | `/settings`            | Firm profile, users, invitations |
| Branch Management  | `/branches`            | Create/edit/set default          |
| People / KYC       | `/people`              | Customers and karigars           |
| Orders             | `/orders`              | Customer order tracking          |
| Job Cards          | `/workshop`            | Workshop assignments             |
| Gold Ledger        | `/ledger`              | Fine gold tracking               |
| Billing            | `/billing`             | GST invoicing                    |
| Repairs            | `/repair`              | Repair/polishing jobs            |
| Inventory          | `/stock`               | Item registry + barcodes         |
| Attendance         | `/attendance`          | Worker attendance                |
| Workers            | `/workshop/gold-book`  | Karigar payroll                  |
| Rate Cut           | `/workshop`            | Overloss penalties               |
| Daily Close        | `/reports/daily-close` | EOD reconciliation               |
| Manufacturing Bill | `/manufacturing`       | Karigar account bill             |
| Catalog            | `/catalog`             | Design catalog                   |
| Reports            | `/reports`             | Analytics and statements         |
| CEO Dashboard      | `/dashboard/ceo`       | Branch KPI analytics             |

---

## Modules — Partially Working ⚠️

Leave these to supervisors only during trial:

| Module          | Issue                                                       |
| --------------- | ----------------------------------------------------------- |
| Communications  | WhatsApp deep-link works; API delivery not configured       |
| Email           | Template editor works; SMTP delivery needs real credentials |
| Branch Settings | Form works; some fields may not reload on refresh           |

---

## Modules — Not Available ❌

These are NOT in this build:

- GST Returns (GSTR-1, GSTR-3B)
- Bullion Trading
- CRM / Follow-ups
- Offline Mode
- SaaS Admin Panel

---

## Setup Checklist (Before First Real Use)

1. **Enter firm profile** → Settings → Firm Profile
   - Shop name, address, phone, email, GSTIN, PAN
   - Upload shop logo

2. **Configure branches** → `/branches`
   - Confirm branch names and codes are correct
   - Set the correct default branch

3. **Configure branch GSTIN** → Settings → Branch Settings
   - Enter per-branch GSTIN and invoice series

4. **Set gold rates** → Settings → Gold & Rates
   - Enter current 22K gold rate per gram

5. **Create users** → Settings → Users
   - Create accounts for all staff with correct roles

6. **Test data persistence**
   - Create a test order → refresh browser → verify order still exists
   - This confirms database connectivity is working

---

## Printing Setup

The system prints to:

- **A4** — Standard invoices, reports, job cards
- **Thermal 80mm** — Counter receipts, job slips
- **Thermal 58mm** — Tags, mini receipts

For thermal printing: use Chrome browser, go to File → Print, select your thermal printer, set paper size to match.

---

## Database

**Supabase Project**: kjfjsfhftytezsjyegmb  
**URL**: https://kjfjsfhftytezsjyegmb.supabase.co  
**Region**: South Asia (Mumbai)

All data is stored in Supabase PostgreSQL. Data is:

- Automatically backed up by Supabase daily
- Replicated in real-time across all connected browsers
- Protected by Row-Level Security (RLS)

---

## Known Issues in This Build

1. **Manufacturing Bill store** — 17 TypeScript errors (non-blocking, module works at runtime)
2. **Branch filtering in memory** — Orders/invoices filter by branch_id in database but not in local store yet. CEO dashboard queries DB directly — correct.
3. **First load** — If branches/workshops don't appear, refresh once. Data loads on mount.

---

## Data Backup

For the trial period, take a manual backup weekly:

1. Go to Supabase Dashboard → Database → Backups
2. Download the latest backup ZIP

---

## Support / Next Development Phase

After the workshop trial, development will resume with:

1. Fix manufacturing-bill-store.ts type errors
2. GST module (GSTR-1/3B)
3. Add branch_id to in-memory store objects
4. Offline mode
5. WhatsApp Cloud API integration

Record all feedback from the workshop trial. After usage limit resets, share the feedback and development will continue.
