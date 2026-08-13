# ORNEXA MASTER WORKFLOW MAP

## Authoritative Architectural & Workflow Specification

**Date:** 2026-08-13  
**Branding/Product Name:** AVS Gold ERP (Ornexa)  
**System Architecture:** Online-only, Supabase-backed SaaS Architecture

---

## SECTION 1 — CORE PRODUCT PRINCIPLES

Ornexa is designed around seven immutable operational principles:

1. **Every gram traceable:** Metal movements are recorded down to the milligram (mg) with zero silent round-offs.
2. **Every transaction recorded:** The gold ledger is append-only and immutable; correction requires explicit, authorized compensating entries (reversals).
3. **Every party continuously accounted for:** Live balances for customers, suppliers, and karigars are derived from the central ledger.
4. **Every job connected:** Job Cards link backward to parent Manufacturing Orders and forward to specific karigar issued metals.
5. **Every document connected:** Vouchers, invoices, receipts, and delivery notes contain trace tokens to their origin events.
6. **Every communication connected:** Logs of automated messages (SMS, WhatsApp, Email) are tied directly to the ERP events that triggered them.
7. **Every role controlled:** Granular Row-Level Security (RLS) restricts access by Firm, Branch, and Role.

- **Supabase online-only is the authoritative live data architecture.** Do not reintroduce SQLite/offline/hybrid business-state architecture.
- **Preserve approved AVS business workflows and historical data.**
- **APPIT/Jwelly are research references, not the product architecture.**

---

## SECTION 2 — SYSTEM / TENANT HIERARCHY

Ornexa isolates data and inherits settings through a strict multi-tenant scope hierarchy:

```
Platform / SaaS Owner
  └── Tenant / Organisation (Isolated Supabase schemas, subscription plans)
        └── Firm (Statutory entity, GSTIN, PAN, tax billing defaults)
              └── Branch (Physical inventory locations, separate vaults)
                    └── Workshop (Manufacturing facilities, karigar groups)
                          └── Vault (Departmental gold buckets: Raw, Finished, Scrap)
                                └── Counter / Location (Physical Trays, Boxes, HUID tags)
                                      └── Users (Staff members with assigned Roles)
                                            └── Roles & Permissions (RBAC scopes)
```

- **Scope Isolation:** A user assigned to Branch A cannot see vault inventory, sales orders, or karigar balances of Branch B unless assigned a Global Role (Super Owner, Administrator, CEO).
- **Scope Inheritance:** System settings, default purities, and messaging templates flow down from Tenant -> Firm -> Branch, with local branch overrides allowed where authorized.

---

## SECTION 3 — MASTER DATA

Master registers populate downstream transactions and enforce structural consistency.

| Master Register        | Upstream Source | Downstream Workflows Consuming It                          |
| :--------------------- | :-------------- | :--------------------------------------------------------- |
| **Firm Master**        | SaaS Setup      | GST Invoicing, Tax Filings, Tally Exports                  |
| **Branch Master**      | Tenant Config   | Vault setup, User allocations, Stock Transfers             |
| **User/Role Master**   | Auth setup      | RLS validation, Approval overrides, Security audits        |
| **Customer/Jeweller**  | Party setup     | Manufacturing Orders, Gold Wallet, POS Settlement          |
| **Karigar Master**     | Party setup     | Job Card Assignment, Worker Gold Ledger, Labor Settlements |
| **Metal Master**       | Settings        | Material issues, Purity touch conversions, Live rates      |
| **Design Library**     | Cataloging      | Enquiry/CAD capture, Manufacturing Orders, Job cards       |
| **Stone & Diamond**    | Inventory       | Consumables issuing, Billing weight exclusions             |
| **Document Numbering** | Settings        | Voucher generation, GST invoicing, Print output            |

---

## SECTION 4 — PARTY 360

The Party 360 module consolidates all financial, material, operational, and conversational histories of any external entity into a single unified workspace.

```
                  ┌────────────────────────────────────────┐
                  │               Party 360                │
                  └───────────────────┬────────────────────┘
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│  Core Profile    │        │  Material Ledger │        │ Financial Ledger │
│ - KYC / Contact  │        │ - Raw Gold (mg)  │        │ - Cash Bal (Rs)  │
│ - Opening Bal.   │        │ - Fine Gold (mg) │        │ - Credit Limits  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
          │                           │                           │
          ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   Activity Log   │        │   Active Items   │        │  Communications  │
│ - Catalogue view │        │ - Job cards (WIP)│        │ - WhatsApp / SMS │
│ - Audit Timeline │        │ - Open Invoices  │        │ - Support Tickets│
└──────────────────┘        └──────────────────┘        └──────────────────┘
```

---

## SECTION 5 — OPENING BALANCES / MIGRATION

Opening balances are transaction-based and cannot be edited as simple text fields in profiles. Migration from legacy systems requires a posted ledger document:

```
Create Party (Customer/Karigar/Supplier)
  └── Enter Opening Gold Balance (Gross, Purity, Fine Mg)
        └── Enter Opening Cash Balance (Paise, positive/negative)
              └── Define Migration Effective Date & Document Reference
                    └── Manager/Owner Approval Required
                          └── Post Ledger Entry (Compensating Ledger Document)
```

Balances can represent either direction:

- **Debit Gold/Cash:** Party owes us gold or cash.
- **Credit Gold/Cash:** We owe the party gold or cash.

---

## SECTION 6 — CUSTOMER GOLD WALLET

The Customer Gold Wallet tracks fine gold assets owned by the customer but held by the manufacturer. It operates as a continuous, multi-order ledger:

$$\text{Closing Gold Balance} = \text{Opening Gold} + \text{Gold Received} + \text{Approved Gold Credits} - \text{Gold Consumed Against Jewellery} - \text{Gold Returned} - \text{Gold Settled} \pm \text{Approved Adjustments} = \text{Closing Gold Balance}$$

- **Continuous Nature:** The wallet balance survives invoices and orders. It does not reset to zero when an order completes.

---

## SECTION 7 — CUSTOMER CASH ACCOUNT

Keep separate:

$$\text{Closing Cash Balance} = \text{Opening Cash} + \text{Charges / Invoices} - \text{Payments / Credits} \pm \text{Adjustments}$$

- **Isolation Rule:** Gold balances (mg) and cash balances (paise) are tracked independently in Party 360. They must never be merged into a single valuation index unless a formal rate-cut settlement voucher is posted.

---

## SECTION 8 — ENQUIRY / REQUIREMENT CAPWURE

The workflow begins at the customer enquiry stage:

```
Enquiry (WhatsApp/Call/Portal)
  └── Capture Design Requirements (Reference Image, Size, Purity, Target Weight)
        └── Design Lookup
              ├── YES: Design Library Match -> Select Design
              └── NO: CAD Design Request
                       └── CAD Draft -> Review Revision -> Customer Approval
                             └── Selected Design -> Create Manufacturing Order
```

- **Rule:** Quotations or invoices cannot be generated until the manufacturing requirement is approved and target weights are determined.

---

## SECTION 9 — DESIGN LIBRARY

Each entry in the Design Master contains manufacturing guidelines:

- **Design Code:** Unique alphanumeric ID.
- **Assets:** CAD files, rendering images, blueprints.
- **Composition Specifications:** Category, compatible metals, default touch parameters.
- **Stone Map:** Number of stones, type, carat/sieve sizes, component exclusions.
- **Performance Metrics:** Production stages sequence, historical scrap/wastage variance, average karigar completion times.

---

## SECTION 10 — CATALOGUE SHARING

Manufacturers share selected design collections via secure, ephemeral links:

```
Design Library -> Filter Category/Weight -> Select Collection -> Generate Secure Token Link
  └── Shared via WhatsApp/Portal
        └── Customer views (Add to Favorites / Enquire / Request Modification)
              └── Feed Activity Log -> Timeline -> Customer 360 Profile
```

- **Security Rule:** Internal making costs, supplier charges, margins, and karigar identities are strictly hidden from catalog views.

---

## SECTION 11 — MANUFACTURING ORDER

On design approval, a Manufacturing Order is created:

- **Links:** Customer ID, Gold Wallet, Design reference, Target specs, Delivery date.
- **Lifecycle Statuses:** `Draft` -> `Approved` -> `Planning` -> `In WIP` -> `Completed` -> `Closed`.
- **Traceability:** Automatically updates the Customer 360 timeline.

---

## SECTION 12 — PRODUCTION PLANNING

The planning engine divides the Manufacturing Order into operational Job Cards:

```
Manufacturing Order (e.g., 5 Rings, 25g Total)
  ├── Job Card 1 (Ring 1, Target 5g, Karigar A) -> WIP -> QC -> Finish
  ├── Job Card 2 (Ring 2, Target 5g, Karigar B) -> WIP -> QC -> Finish
  └── Job Card 3-5 (Rings 3-5, Target 15g, Karigar C) -> WIP -> QC -> Finish
```

- **Details:** Each Job Card tracks the assigned Karigar, required fine weight, raw metal issued, wastage limits, and current department location.

---

## SECTION 13 — GOLD SOURCE DECISION

Before metal can be issued, the system verifies the gold's origin:

```
                  ┌────────────────────────────────────────┐
                  │        Gold Source Verification        │
                  └───────────────────┬────────────────────┘
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│  Customer Gold   │        │  New Metal Rcpt  │        │ Manufacturer gold│
│ - Deduct balance │        │ - Weigh, touch   │        │ - Vault Stock    │
│   from Wallet    │        │ - Post to Ledger │        │ - Internal post  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
```

- **Accountability:** All issued raw gold is mapped to a specific customer contract or manufacturer inventory source.

---

## SECTION 14 — CENTRAL METAL TRANSACTION CORE

Every single metal movement must write a record to the central `gold_ledger` schema:

| Column          | Type         | Purpose                                       |
| :-------------- | :----------- | :-------------------------------------------- |
| `id`            | UUID         | Primary key                                   |
| `ts`            | BIGINT       | Millisecond epoch timestamp                   |
| `type`          | MovementType | Ledger transaction classification code        |
| `branch_id`     | VARCHAR      | Scope isolation key                           |
| `party_id`      | UUID         | Relational party ID (Karigar, Customer, etc.) |
| `job_id`        | UUID         | Optional related Job Card reference           |
| `gross_mg`      | INT          | Physical weight before exclusions             |
| `less_mg`       | INT          | Weight exclusions (stones, chains)            |
| `net_mg`        | INT          | Net metal weight (`gross - less`)             |
| `touch`         | NUMERIC      | Measured gold purity fraction                 |
| `fine_mg`       | INT          | Equivalent 99.9 gold weight (`net * touch`)   |
| `delta_vault`   | INT          | Signed vault balance change in mg             |
| `delta_karigar` | INT          | Signed karigar custody balance change in mg   |
| `delta_scrap`   | INT          | Signed scrap vault change in mg               |

---

## SECTION 15 — VAULT / GOLD ISSUE

Metal issues reduce vault holdings and increase karigar liability:

```
Vault Stock (Branch A)
  └── Issue Request (Job Card link, Gross Wt, Purity, Fine Gold Wt)
        └── RLS & Manager Over-Loss Limit Validations
              └── Post Issue Ledger Entry:
                    ├── Vault balance decreases (delta_vault = -Fine Mg)
                    └── Karigar balance increases (delta_karigar = +Fine Mg)
```

---

## SECTION 16 — KARIGAR / WORKER ACCOUNTABILITY

The Karigar 360 profile functions as an audit trail for the artisan's custody:

$$\text{Worker Metal Liability} = \text{Gold Issued} + \text{Materials Issued} - \text{Finished Returns} - \text{Scrap/Dust Returned} - \text{Approved Losses}$$

- **Key Controls:** Enforces maximum outstanding metal credit limits. Prevents new issues if a worker's liability exceeds their configured threshold.

---

## SECTION 17 — MANUFACTURING / WIP

Karigars advance jobs through configurable workshop departments:

$$\text{Melting} \longrightarrow \text{Rolling} \longrightarrow \text{Wire/Cutting} \longrightarrow \text{Assembly} \longrightarrow \text{Setting} \longrightarrow \text{Polishing} \longrightarrow \text{Finished}$$

- **Control Point:** The system logs the custodian, department, date, and weight at each transition point.

---

## SECTION 18 — PARTIAL ISSUE / PARTIAL RECEIVE

Ornexa allows jobs to receive additional raw metals or return partial works:

```
Day 1: Issue 10g Raw Gold to Karigar A (JC-101) -> Karigar Balance: +10g
Day 3: Karigar returns 4g finished components -> Karigar Balance: +6g
Day 4: Issue additional 2g gold wire to Karigar A -> Karigar Balance: +8g
Day 6: Final return of remaining job work -> Karigar Balance: 0g (Reconciliation)
```

- **Rule:** Every intermediate movement requires an individual, timestamped ledger voucher.

---

## SECTION 19 — RETURN WEIGHT MODEL

Upon return from a karigar, weight is calculated using this formula:

$$\text{Net Gold Weight} = \text{Gross Weight Received} - \text{Less Weight (Stone, Chain, Components)}$$
$$\text{Fine Gold Equivalent} = \text{Net Gold Weight} \times \text{Purity/Touch Percentage}$$

- **Separation:** Gross, less, net, and fine weights must be recorded as separate fields. They cannot be merged or averaged.

---

## SECTION 20 — JOB GOLD RECONCILIATION

Reconciles raw metals issued against returned items, scrap, and dust:

$$\text{Variance} = \text{Fine Gold Issued} - \left( \text{Fine Gold in Finished Return} + \text{Scrap Fine} + \text{Dust Fine} + \text{Allowed Wastage} \right)$$

- **Variance Resolution:**
  - `Within Limits`: Auto-posts to wastage account.
  - `Outside Limits`: Suspends job card, alerts manager, and records excess loss to the karigar's account.

---

## SECTION 21 — WORKER LABOUR / PAYROLL

Calculates karigar compensation using the net eligible weight:

$$\text{Eligible Weight} = \text{Total Work Weight} - \text{Chain/Excluded Weight}$$
$$\text{Labour Payable} = \text{Eligible Weight} \times \text{Karigar Labor Rate Percentage (or flat per-gram rate)}$$

- **Rule:** Chain weights or pre-manufactured components are excluded from wastage and labor entitlement configurations.

---

## SECTION 22 — OUTSIDE WORK / CUSTODY

Tracks materials sent outside the internal workshop (e.g., to polishers, setters, or laser vendors):

```
Internal Workshop
  └── Outward Gatepass (Gross Wt, Purity, Carrier, External Vendor)
        └── Vendor Balance updates (Outside Custody = +Fine Mg)
              └── Expected Return Date Follow-up active
                    └── Inward Gatepass (Verification, weight checks)
                          └── Settle labor charges (Accounts payable)
```

---

## SECTION 23 — QC

Finished works are routed to the Quality Control queue:

```
Production Receive -> QC Inspection -> checklist checks (Finish, stones setting, weight)
                                       ├── PASS: Route to Hallmark/Vault
                                       └── FAIL: Flag Rework -> Send back to Karigar
                                                 (Track rework count & audit delays)
```

---

## SECTION 24 — HALLMARK

Tracks HUID assignments and hallmark certification details:

```
QC Pass -> Outward to Hallmark Vendor -> Hallmark custody active -> HUID laser marked
                                                                    └── Inward Receive (Weight check, record HUID, post Hallmark charges)
```

---

## SECTION 25 — OLD GOLD

Customer old gold is valued and added to the refining pipeline:

```
Old Gold Receipt -> Gross Wt -> Touch/Acid Test -> Melt Test -> Net Wt -> Fine Mg calculated
                                                                            └── Settled to Gold Wallet or Cash Account at current buying rate
```

---

## SECTION 26 — REFINERY

Tracks raw scrap, old gold, and workshop recovery dust sent to refineries:

```
Refinery Batch Outward -> Vault Metal Scrap -> Carrier -> Refinery custody
                                                            └── Return (Actual fine gold received, refine charges, record loss/gain)
```

---

## SECTION 27 — INVENTORY

Tracks inventory across various material states and physical locations:

```
Inventory States:
 [Raw Metal] -> [Semi-Finished/WIP] -> [Finished Jewellery] -> [Diamonds/Stones] -> [Scrap/Dust]

Physical Locations:
 Branch -> Vault -> Departmental Counter -> Tray -> Individual Tag (HUID / Barcode)
```

---

## SECTION 28 — DIAMOND / STONE FLOW

Tracks stones separately from gold weights to ensure calculations remain accurate:

```
Purchase Stone Bag -> Inventory (Carats/Pieces) -> Issue to Job -> Set on Jewellery (Deduct from raw stone inventory)
                                                                       └── Net jewellery weight adjustment (Gross - Stone Weight = Net Gold Weight)
```

---

## SECTION 29 — BRANCH TRANSFER

Inter-branch stock movements are verified at both ends to prevent dual-counting:

```
Branch A Vault
  └── Transfer Outward Request (Status: In-Transit, Carrier: Aangadiya)
        └── Branch A Vault decreases
              └── Branch B receives & weighs items
                    ├── Match: Confirm and add to Branch B Vault
                    └── Mismatch: Flag discrepancy, alert manager
```

---

## SECTION 30 — FINISHED JEWELLERY

Finished stock registration:

- **Generation:** Unique barcode tag, HUID tracking, final weights.
- **Lineage:** Retains relationships back to the original Customer, Order ID, Job Card, and Karigar.

---

## SECTION 31 — BILLING / CUSTOMER SETTLEMENT

POS invoice calculations:

$$\text{Subtotal Paise} = (\text{Net Weight} \times \text{Rate}) + \text{Labour Charges} + \text{Stone/Diamond Charges} + \text{Hallmark Fees}$$
$$\text{Taxable Value} = \text{Subtotal} - \text{Discounts}$$
$$\text{Final Invoice Total} = \text{Taxable Value} + \text{GST (e.g. 3\%)}$$

- **Settlement:** Settled via Gold Wallet deduction (Fine Gold) and Cash/Bank payments.

---

## SECTION 32 — ACCOUNTING

Ornexa maintains a double-entry accounting ledger for cash and a parallel ledger for metal:

```
              ┌────────────────────────────────────────┐
              │           Financial Ledger             │
              │         (Rupees / Paise)               │
              └────────────────────────────────────────┘
                 ├── Day Book & Journal Vouchers
                 ├── GST Outputs (Sales/Purchase)
                 └── Bank / Cash Accounts
              ┌────────────────────────────────────────┐
              │             Metal Ledger               │
              │         (Fine Gold mg)                 │
              └────────────────────────────────────────┘
                 ├── Vault Balances
                 ├── Karigar Outstanding Gold
                 └── Customer Gold Wallets
```

---

## SECTION 33 — TALLY EXPORT

Converts accounting vouchers into `TALLYMESSAGE` XML files:

```
Voucher Posted -> Eligible for Export -> Map Ledgers (Ornexa -> Tally) -> Generate XML
                                                                           └── Export Batch update -> Status: Exported (Disables editing)
```

---

## SECTION 34 — DOCUMENT ENGINE

Generates print layouts for vouchers and invoices:

- **Templates:** HTML/CSS documents using system schemas.
- **Layouts:** Support for A4, A5, and thermal roll layouts.
- **Print Engine:** Injected via a hidden iframe to prevent modal backdrop clipping.

---

## SECTION 35 — DIGITAL DOCUMENT DELIVERY

Delivery workflow:

```
Invoice Posted -> PDF Generated -> Saved to Supabase Bucket -> Secure URL Token created
                                                                └── Sent to Customer via WhatsApp/SMS
```

- **Verification:** Link allows online viewing and PDF downloads without requiring a user login.

---

## SECTION 36 — CUSTOMER PORTAL

Provides customers with a self-service view of their orders and balances:

- **Dashboard:** Open orders status, gold wallet balance, and cash balances.
- **Approvals:** View and approve CAD designs and quotations.
- **Catalogues:** Browse collections shared by the branch.
- **Security:** RLS filters prevent customers from seeing internal manufacturing costs or other customers' data.

---

## SECTION 37 — KARIGAR PORTAL

Mobile-friendly portal for artisans to manage their daily work:

- **Job List:** Active job cards, specifications, and CAD models.
- **Custody:** View outstanding gold balances and confirm issues/returns.
- **Rework:** View QA rejections and review notes.
- **Security:** RLS restricts users to their own assignments.

---

## SECTION 38 — SUPPLIER PORTAL

A dedicated workspace for raw material suppliers:

- **Purchase Orders:** View and accept orders.
- **Settlements:** Check invoice statuses and cash/metal payment schedules.

---

## SECTION 39 — COMMUNICATION

Tracks and dispatches automated system notifications:

```
System Event (e.g. Invoice Posted) -> Match Template -> Choose Channel (WhatsApp/SMS) -> Queue Message
                                                                                           └── Provider Send -> Log Status (Sent/Delivered/Failed)
```

---

## SECTION 40 — FOLLOW-UP

Tracks pending tasks across departments:

- **Actions:** Payment collections, pending CAD approvals, karigar returns, and hallmark delays.
- **Rules:** Escalates overdue items to manager dashboards.

---

## SECTION 41 — SUPPORT

In-app support system for customers and karigars:

- **Tickets:** Create, attach files, assign, track SLAs, and record conversations.
- **Visibility:** Internal notes are hidden from customer views.

---

## SECTION 42 — ATTENDANCE

Staff attendance system:

- **Features:** Shift definitions, check-in/out logs, working hours, and monthly registers.
- **Isolation:** Separate from karigar job settlement accounts.

---

## SECTION 43 — REPORTS

Standard reports generated by the system:

```
                  ┌────────────────────────────────────────┐
                  │            Ornexa Reports              │
                  └───────────────────┬────────────────────┘
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   Gold / Metal   │        │  Manufacturing   │        │    Accounting    │
│ - Live Exposure  │        │ - Job Ageing     │        │ - GST registers  │
│ - Karigar Ledger │        │ - QC Pass rates  │        │ - Day Book       │
│ - Vault Stocks   │        │ - Worker Perf.   │        │ - Cash registers │
└──────────────────┘        └──────────────────┘        └──────────────────┘
```

---

## SECTION 44 — WHERE IS MY GOLD?

The master inventory reconciliation interface:

$$\text{Total Controlled Fine Gold} = \text{Vault Stock} + \text{Karigar WIP} + \text{Outside Custody} + \text{Hallmark Pending} + \text{Refinery WIP} + \text{Finished Stock} + \text{In Transit}$$

- **Drill-down:** Clicking any category displays individual item codes, HUID tags, and job cards.

---

## SECTION 45 — REPORT SAVE / VERIFY

- **Rule:** Generated financial reports can be locked/signed as verified.
- **Integrity:** Verified report snapshots are stored as read-only and cannot be mutated by subsequent ledger changes.

---

## SECTION 46 — ORNEXA ASSISTANT

Natural language AI assistant:

- **Capabilities:** Check stock levels, query customer balances, create follow-ups, and draft vouchers.
- **Security:** Authorizes commands against user permissions before execution.

---

## SECTION 47 — AI PROVIDER ARCHITECTURE

- **Adapter Pattern:** The AI service uses an adapter pattern (supporting OpenAI, Anthropic, or Cloudflare AI Gateways).
- **Rule:** Core business calculations and validations are executed by the deterministic backend, never by the AI model.

---

## SECTION 48 — PLATFORM OWNER / SAAS ADMIN

A control panel for the SaaS Platform Owner:

- **Metrics:** Active tenants, database usages, subscription updates, plan builders, feature flags, and deployment health checks.

---

## SECTION 49 — LICENSE / SUBSCRIPTION

- **SaaS Limits:** Restricts users, branches, storage limits, and AI tokens.
- **Enforcement:** Evaluates limits server-side on login; features are deactivated if subscriptions expire.

---

## SECTION 50 — SECURITY

- **Tenant Isolation:** Row-Level Security (RLS) isolates database schemas by `tenant_id` and `branch_id`.
- **Document Security:** Digital invoices and shared catalogs require cryptographic URL tokens.

---

## SECTION 51 — HARDWARE

Direct integrations with hardware tools:

- **Weighing Scales:** Reads weight from USB/Serial inputs.
- **Barcode/RFID Scanners:** Fast search and counter verifications.
- **Rule:** Weighing scale feeds populate draft forms but require manual confirmation before posting.

---

## SECTION 52 — ERROR / MAINTENANCE STATES

- **Rules:** Display user-friendly error views with clean recovery options during outages.
- **Security:** Hide database query stack traces from public view.

---

## SECTION 53 — MOBILE

- **Design:** Core workflows (Owner Dashboard, Approvals, Karigar View) use mobile-responsive tailwind classes.
- **Targets:** Standard breakpoint tests for 375px, 390px, and 430px widths.

---

## SECTION 54 — PERFORMANCE

- **Strategies:** Code splitting, lazy loading list views, database query indexing, and pre-fetching branch configurations during startup.

---

## SECTION 55 — BACKUP / RECOVERY

- **Procedures:** Scheduled database backups, replica sync checks, and automated disaster recovery tests.

---

## SECTION 56 — DEPLOYMENT

```
[Development Branch] ──> [PR / ESLint & Typecheck] ──> [Staging Test] ──> [Manager Approval] ──> [Production Release]
```

---

## SECTION 57 — APPROVAL ENGINE

Sensitive transactions are held as drafts pending manager approval:

```
Karigar Issue > Over-Loss Limit -> Suspend Posting -> Notify Approver
                                                       ├── APPROVE -> Execute transaction & post to ledger
                                                       └── REJECT -> Cancel transaction & log reason
```

---

## SECTION 58 — REVERSAL / CORRECTION

- **Rule:** Posted transactions cannot be deleted.
- **Compensating Entries:** Adjustments write a reversal entry referencing the original transaction ID, returning balances to their previous states.

---

## SECTION 59 — AUDIT / TIMELINE

Tracks system activities in a central log:

| Actor ID  | Role  | Action            | Target Entity      | Timestamp      | Correlation ID |
| :-------- | :---- | :---------------- | :----------------- | :------------- | :------------- |
| `usr_981` | Admin | `ledger.reversal` | `ledger_entry_771` | `178945621430` | `corr_812739`  |

---

## SECTION 60 — SOURCE-OF-TRUTH MATRIX

### A. Business Event Ledger Matrix

| Business Event       | Authoritative Source | Physical Metal Effect   | Fine Gold Effect        | Money Ledger Effect  | Party Balance Effect    | Reversal Method   |
| :------------------- | :------------------- | :---------------------- | :---------------------- | :------------------- | :---------------------- | :---------------- |
| **Opening Balance**  | Ledger Entry         | None                    | None                    | Post opening balance | Update customer balance | Adjusting journal |
| **Customer Receipt** | Gold Ledger          | Vault Gross Gold +      | Vault Fine Gold +       | None                 | Customer Gold Wallet +  | Reversal voucher  |
| **Gold Issue**       | Gold Ledger          | Vault - / Karigar WIP + | Vault - / Karigar WIP + | None                 | Karigar Gold Account +  | Reversal voucher  |
| **Job Receive**      | Gold Ledger          | Karigar WIP - / Vault + | Karigar WIP - / Vault + | None                 | Karigar Gold Account -  | Reversal voucher  |
| **Invoice Settle**   | Sales Invoice        | Finished Vault -        | Finished Vault -        | Cash/Bank Account +  | Customer Cash Account - | Credit Note       |

### B. Core Data Subsystem Ownership Matrix

| Value Metric | Authoritative Subsystem | Database Table(s) | Primary Mutation Source | Calculation / Derivation Principle |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Gold Balance** | Gold Ledger | `gold_ledger` | Metal Vouchers (Receipts, Issues) | Sum of `fine_gold_deltas` where party is customer. |
| **Karigar Custody Balance** | Gold Ledger | `gold_ledger` | Job Card Issue/Receive Vouchers | Sum of `fine_gold_deltas` where party is karigar. |
| **Vault / Location Balances** | Vault Stock Subsystem | `gold_ledger`, `stock_verification` | Branch Transfers, Job Receipts | Sum of gross/fine deltas scoped by branch/vault/location. |
| **Fine Weight (Transaction)** | Purity Conversion Engine | `calculation_engine` schema | Form Inputs, Scale API | $\text{Gross} \times \text{Touch/Purity}$. Deterministic utility, never stored as independent input. |
| **Party Cash Balance** | Financial Ledger | `cash_ledger`, `payments` | Invoices, Cash Receipts, Payments | Sum of cash deltas (in paise) per party. |
| **Stock Quantity / Tag Weight** | Tag Registry | `stock_tags` | Tagging / Barcoding Actions | Single tag registry row representing exact active physical weight. |
| **Job WIP Status** | Production Workflow Tracker | `job_cards` | Karigar portal stage updates | Configurable workflow state enumeration. |
| **Invoice Amount (Totals)** | Billing Engine | `sales_invoices`, `mfg_bills` | Checkout settlement wizard | Persisted aggregate values (Making + Labour + Gold Value + Taxes) locked at save time. |
| **Worker Entitlement (Wages)** | Rule Calculation Engine | `karigar_wage_ledger` | Job completion approvals | Snapshotted compensation rule applied to eligible net/gross weight. |
| **Document Delivery Status** | Notification Dispatcher | `message_deliveries` | Webhook hooks, SMS/WA gateways | ephemerally checked status (`sent`, `delivered`, `read`) with timestamp. |

---

## SECTION 61 — COMPLETE END-TO-END EXAMPLE

```
1. Customer A (Jeweller) opens an account -> Posts Opening Balance of 50,000 mg fine gold and ₹0 cash.
2. Customer A submits a design enquiry via Portal (Uploads ring image, target weight 5g, 22K/91.6%).
3. Design approved -> System generates Manufacturing Order MO-101 and Job Card JC-201.
4. Gold Source: Deduct 5g Net Weight from Customer A's Gold Wallet balance.
5. Vault Issue: Issue 5.50g raw gold (accounting for wastage) to Karigar X.
6. Karigar X accepts metal -> Status changes to WIP (Melting stage).
7. Karigar X returns finished ring (Gross: 4.95g, Stones: 0.15g, Net Gold: 4.80g).
8. Job Gold Reconciliation: Fine gold returned + scrap + dust matches issued gold within allowed limits.
9. Labour calculated: 4.80g Net Gold * Rs 100/g = Rs 480 labour payable to Karigar X.
10. QC passes ring -> Ring sent to Hallmark Center -> HUID marked -> Added to Finished Stock.
11. Invoice generated: Charges for labour, hallmark, and GST. Customer settles invoice using their cash account.
12. Ring is shipped -> Customer Gold Wallet and Cash Account balances are updated.
```

---

## SECTION 62 — FINAL MANUFACTURING-FIRST RULE

> [!IMPORTANT]
> **ORNEXA IS NOT A RETAIL JEWELLERY POS.**
> It is a B2B Jewellery Manufacturing ERP whose primary architecture is built around:
> Customer/Jeweller Relationship -> Design -> Manufacturing Requirement -> Job -> Gold/Material Accountability -> Worker/Karigar -> Production -> Reconciliation -> Finished Jewellery -> Gold + Cash Settlement -> Continuous Customer Balance.
>
> Any future module or workflow must integrate into this B2B architecture instead of forcing retail POS logic into the center of the product.

---

## SECTION 63 — CUSTOM FORMULA & BUSINESS RULE ENGINE

Ornexa supports a configurable business rule engine to resolve calculations Dynamically across branches and items.

### A. Formula Precedence Precedence

When resolving calculations, rules are evaluated from specific to general:

$$\text{Specific Party Contract} \longrightarrow \text{Design Master} \longrightarrow \text{Item Category} \longrightarrow \text{Branch Config} \longrightarrow \text{Firm Default}$$

### B. Core Formulas

#### 1. Fine Gold Weight Calculation

$$\text{Net Weight} = \text{Gross Weight} - \text{Stones/Diamond/Chain Exclusions}$$
$$\text{Fine Weight} = \text{Net Weight} \times \frac{\text{Touch Percentage} + \text{Wastage Percentage}}{100}$$

#### 2. Karigar Labor Entitlement

$$\text{Eligible Weight} = \text{Total Weight} - \text{Chain Weight}$$
$$\text{Labor Payable} = \text{Eligible Weight} \times \text{Labor Percentage Rate (or Flat Rate per gram)}$$

#### 3. Invoice Making Charge

$$\text{Making Charges} = \text{Net Weight} \times \text{Making Rate} + \text{Fixed Setup Fees}$$

### C. Rule Versioning Rules

Formula changes are versioned and date-effective. Updating a rule does not change historical calculations.

---

## SECTION 64 — UNIVERSAL NO-CODE TRANSACTION ENGINE + SIMPLIFIED WORKSPACE NAVIGATION

Allows administrators to configure new transaction types and posting routes without writing code.

### A. Transaction Type Definiton Template

Admins configure templates specifying:

- Input fields (weights, dates, drop-downs)
- Authorization requirements (manager approvals above thresholds)
- Post routes (defining gold and cash adjustments)

```
                       ┌──────────────────────────────┐
                       │     Transaction Template     │
                       └──────────────┬───────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌───────────────────────────┐                   ┌───────────────────────────┐
│       Metadata            │                   │       Posting Rules       │
│ - Transaction Code        │                   │ - Credit/Debit Buckets    │
│ - User Permission Roles   │                   │ - Gold Ledger Adjustments │
│ - Custom Fields           │                   │ - Account Balances        │
└───────────────────────────┘                   └───────────────────────────┘
```

---

## SECTION 65 — SIMPLIFIED ERP NAVIGATION

Ornexa consolidates its features into seven workspaces to keep the user interface clean:

1.  **WORK:** Handles orders, designs, job cards, karigar assignments, WIP, QC, and Hallmark records.
2.  **STOCK & GOLD:** Coordinates vaults, metal holdings, finished stocks, physical audits, and branch transfers.
3.  **PARTIES:** Workspace for Customer 360, Karigar accounts, Supplier metrics, and vendor directories.
4.  **VOUCHERS & ACCOUNTS:** Handles accounting transactions (sales invoices, receipts, payments, and scrap values).
5.  **INSIGHTS:** The reporting dashboard for business KPI charts, tax filings, and ledger reports.
6.  **COMMUNICATION & PORTALS:** Controls message logs, catalog configurations, and external portal settings.
7.  **CONTROL:** Access settings, user permissions, formula engine rules, and SaaS subscription details.

---

## SECTION 66 — PROGRESSIVE DISCLOSURE

Avoids visual clutter by structuring navigation into clear hierarchies:

$$\text{Workspace (Work)} \longrightarrow \text{Subdomain (Jobs)} \longrightarrow \text{Task Group (Active Jobs)} \longrightarrow \text{Action (Issue Gold)}$$

---

## SECTION 67 — ROLE-BASED HOME SCREEN

Menus and views adjust automatically based on user roles:

- **Owner:** Views all workspaces (Control, Insights, Accounts, Work).
- **Workshop Manager:** Views WIP, Job Cards, and Vault stock levels.
- **Sales Executive:** Views Order entries and Catalog collections.

---

## SECTION 68 — COMMAND / INTENT-BASED ENTRY

Provides a quick search launcher ("Command Palette") at the top of the interface:

- Users type commands (e.g. _"Issue gold to Karigar X"_ or _"View Customer A balance"_) to bypass menus and jump directly to actions.

---

## SECTION 69 — CUSTOMISATION WITHOUT DEVELOPMENT

Allows businesses to adjust parameters through settings instead of requesting code updates:

- Managers can add new inventory categories, edit wastage rules, change document styles, adjust approval workflows, and add custom fields.

---

### FINAL SIMPLIFICATION PRINCIPLE

**COMPLEX ENGINE — SIMPLE INTERFACE.**
Ornexa provides powerful B2B tracking capabilities while keeping daily screens clean, simple, and action-oriented.

---

### FINAL MASTER PRINCIPLE

**ORNEXA IS NOT A RETAIL JEWELLERY POS.**
Every business flow, master data schema, and custom transaction template must support the manufacturing-first lifecycle.
