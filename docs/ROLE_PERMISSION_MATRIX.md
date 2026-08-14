# ORNEXA — ROLE & PERMISSION MASTER MATRIX
**Authoritative RBAC, User Administration & Access Boundary Model**
*Version: 3.1.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Global Personas & Role Hierarchy

Ornexa enforces strict action-level, data-level, and branch-scoped security across 13 distinct roles:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PLATFORM OPERATOR LAYER                               │
│  • saas_admin (Platform Owner - SaaS Control Centre operations)             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         TENANT EXECUTIVE LAYER                              │
│  • super_owner (Multi-branch unrestricted tenant administrator)             │
│  • owner / ceo (Executive command portal & high-level operations)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                        TENANT OPERATIONAL LAYER                             │
│  • manager (Branch supervisor with approval & user management authority)    │
│  • accounts / accountant (Financial ledgers, expenses, tax filings)         │
│  • production (Workshop scheduling, job cards, stage tracking)              │
│  • inventory / vault (Bullion, raw gold, ready stock safe, lot management)  │
│  • billing (Counter billing, invoicing, payments, customer ledger)          │
│  • workshop (Bench supervisor, metal custody, QC, hallmark)                 │
│  • sales (Orders, quotations, design catalogue, CRM)                        │
│  • viewer (Read-only auditor / compliance inspector)                        │
│  • custom_role (Configurable permission sets within safe boundaries)        │
├─────────────────────────────────────────────────────────────────────────────┤
│                          EXTERNAL PORTAL LAYER                              │
│  • customer (Customer portal: orders, CAD approvals, catalogue, invoices)   │
│  • karigar (Artisan portal: assigned jobs, gold balance, return form)       │
│  • supplier (Vendor portal: purchase orders, deliveries, vendor bills)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Action-Level RBAC Matrix

| Functional Area / Action | SaaS Admin | Super Owner | Owner / CEO | Branch Manager | Billing | Vault | Workshop | Accountant | Sales | Viewer | Customer | Karigar | Supplier |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Platform SaaS Control Centre** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CEO Executive Portal (/ceo/*)**| ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Invite Internal ERP Users** | ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Invite External Portal Users**| ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Roles & Branch Scope** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Generate Tenant Data Backup** | ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Execute Tenant Data Restore** | ⚠️ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Party 360: Create / Edit** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Orders: Create / Edit** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manufacturing: Job Cards** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Gold Issue to Karigars** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Work Receive & Scrap Reconcile** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Outside Work (Mina/Polish/Hallmark)**| ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **QC Approval & Rejection** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Vault Inward / Outward** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Ready Stock: Add / Edit / Tag**| ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Billing: Create Tax Invoice** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Billing: Cancel / Reverse Bill**| ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Expenses: Record Expense** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Expenses: Approve > Threshold**| ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Financial Freeze Date Lock** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **GST Reports & Tax Exports** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Customer Portal: Approve CAD**| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Karigar Portal: Return Work** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Supplier Portal: Confirm PO** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*Legend: ✅ Allowed | ❌ Forbidden | ⚠️ Allowed with approval / limited scope*

---

## 3. Strict Portal-Role Isolation

> **CRITICAL SECURITY BOUNDARY:**
> External portal accounts must **NEVER** automatically become internal ERP operators.

1. **Customer Portal user ≠ ERP employee.**
2. **Karigar Portal user ≠ ERP manager.**
3. **Supplier Portal user ≠ ERP operator.**
4. Customer portal users have **zero exposure** to internal costs, supplier bullion rates, artisan wages, or internal QC rework notes.

---

## 4. RBAC Permissions vs Commercial Entitlements

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                   RBAC VS COMMERCIAL ENTITLEMENTS BOUNDARY                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ 1. RBAC controls WHO inside a tenant can perform an authorized action.      ║
║ 2. COMMERCIAL ENTITLEMENTS control WHAT capabilities the tenant owns.        ║
║                                                                              ║
║ EVEN A SUPER_OWNER OR CEO CANNOT ACCESS:                                     ║
║  - Wholesale B2B Dispatch without the 'business.wholesale' entitlement       ║
║  - Retail Showroom POS Counter without the 'business.retail' entitlement     ║
║  - Manufacturing Job Cards without the 'business.manufacturing' entitlement  ║
║                                                                              ║
║ Access requires BOTH an active Tenant Entitlement AND User Role Permission.  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```
