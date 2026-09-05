# MTJ / AVS ERP — REPOSITORY, DEPLOYMENT & MULTI-BRANCH ARCHITECTURE

## 1. Product Architecture Overview

```
                         AVS / MTJ ERP
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       ONLINE PRODUCTION              PRIVATE / SELF-HOSTED
        (Hostinger Cloud)              (Shop Host PC & LAN)
               │                               │
       Supabase Cloud / RLS            Self-Hosted Supabase / Docker
               │                               │
               └───────────────┬───────────────┘
                               │
                        ONE COMPANY
              (MTJ / AVS Gold & Diamond Jewellers)
                               │
                       MULTIPLE BRANCHES
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   Main Showroom          Branch 2 / Counter     Karigar / Workshop Unit
   (e.g., Gorakhpur)      (Retail Terminal)      (Manufacturing Hub)
```

---

## 2. GitHub Repository Matrix & Release Strategy

| Repository | Remote Name | Purpose | Target Environment | Tagged Baseline |
| :--- | :--- | :--- | :--- | :--- |
| **[avs-erp-baseline-backup](https://github.com/Aritramanna1/avs-erp-baseline-backup)** | `backup-remote` | **Immutable Baseline Recovery Point** (Protected Archive) | Immutable Archive | `BASELINE-BACKUP`<br/>`v1.1.2-baseline-backup` |
| **[avs-erp-hostinger-live](https://github.com/Aritramanna1/avs-erp-hostinger-live)** | `hostinger-remote` | **Hostinger Online Production** | Hostinger Cloud + Supabase RLS | `v1.1.2-hostinger-live` |
| **[avs-erp-self-hosted](https://github.com/Aritramanna1/avs-erp-self-hosted)** | `selfhosted-remote` | **Private Self-Hosted Desktop & LAN** | Shop Host PC + Docker Supabase | `v1.1.2-self-hosted-live` |
| **[avs-gold-erp](https://github.com/Aritramanna1/avs-gold-erp)** | `origin` | **Main Active Upstream** | Continuous Integration | `feature/production-v1.1.2` |

### Local Physical Recovery Archive
- **Location**: `c:\final erp 29.08\AVS_ERP_BASELINE_BACKUP_20260905.zip`
- **Size**: ~3.18 MB (Complete standalone source snapshot)

---

## 3. One Company — Multi-Branch Architecture

### Core Principle
**MTJ / AVS ERP is a Single-Company, Multi-Branch Enterprise ERP.**
It is **NOT** a public SaaS platform with arbitrary tenant signups or tenant creation.

### Multi-Branch Hierarchy
1. **Company Level (Authoritative Firm)**:
   - Legal Name, GSTIN, PAN, Registered Address, Consolidated Books, Master Settings.
2. **Branch Level (Operational Units)**:
   - **Main Showroom** (Primary sales, counter billing, stock custody).
   - **Secondary Showrooms / Outlets** (Counter sales, local retail inventory).
   - **Workshop / Karigar Unit** (Melting, casting, filings, Dhadi job cards, manufacturing).

### Multi-Branch Capabilities
- **Explicit Branch Selection**: Users operate within their assigned branch context via `useBranch().currentBranchId`.
- **Role & Access Governance**:
  - `owner_ceo`: Global visibility, consolidated executive analytics, audit logs.
  - `branch_manager`: Full operational control over the assigned branch.
  - `billing_staff`: Restricted to counter billing, invoices, and customer orders for their branch.
  - `workshop_staff`: Restricted to workshop job cards, gold filings, and manufacturing books for their unit.
  - `accountant`: Branch vouchers, ledger reconciliations, and daily close.
- **Branch-Scoped Data Isolation**:
  - Branch-level inventory & lot management.
  - Branch-level gold stock & physical vault balances.
  - Branch-level cash/bank books & daily close reports.
  - Inter-branch inventory & gold transfers.
  - Consolidated multi-branch financial reports.

---

## 4. Deployment Environments

### A. Hostinger Online Cloud Deployment
- **Frontend / Backend**: Hosted on Hostinger environment.
- **Database / Auth**: Supabase PostgreSQL with Row Level Security (RLS).
- **Public URL**: Direct domain (e.g. `https://maatarajewellers.shop` / `https://mtj-erp.aritramanna222.workers.dev`).
- **Security**: Public signup disabled (`PUBLIC_SELF_SIGNUP_DISABLED = true`), `/setup` completely blocked. Authentication requires pre-provisioned credentials or staff invitation.

### B. Private Self-Hosted Desktop & LAN Deployment
- **Main Host PC**: Runs Electron Desktop Shell + Docker Supabase Stack (PostgreSQL :5432, Supabase Gateway :8000).
- **Client Workstations**: Connect to Main PC over local Wi-Fi / LAN (`http://192.168.0.101:3000`) using 1-click desktop shortcut (`SETUP_CLIENT_DESKTOP.bat`).
- **First-Run Host Setup**: Executed once inside Electron on initial boot; writes `installation-lock.json`.
- **Protected Local Recovery**: Reset/re-run setup requires local Master Admin password verification.
