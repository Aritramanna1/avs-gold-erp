# JEWELLERY ERP REFERENCE AUDIT & LEGACY CAPABILITY BENCHMARK
**Authoritative Domain Analysis, Capability Extraction & Architectural Transformation Matrix**
*Version: 3.1.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Executive Summary & Audit Mission

This audit thoroughly investigates the reference legacy jewellery ERP systems (**Jwelly / Ace Lite** and **JewelAcc / JewellerWpf**) to extract deep jewellery manufacturing domain capabilities, transaction mechanics, multi-dimensional balance rules, and reporting requirements.

### 1.1 Architectural Transformation Principle
> **"STUDY THE DOMAIN DEPTH. EXTRACT THE JEWELLERY CAPABILITIES. DO NOT COPY THE LEGACY UI, SOURCE CODE, BRANDING, NAVIGATION, OR OBSOLETE LOCAL DATABASE ARCHITECTURE."**
>
> Ornexa is a **Manufacturing-First Cloud-Native Jewellery ERP** built on online-authoritative Supabase (PostgreSQL 15+, RLS, Stored Procedures) with clean 5-7 workspace progressive disclosure. We discard Windows-2000 multi-tier nested menus (300+ items) in favor of contextual search, command palette (`Ctrl/Cmd+K`), power-user keyboard flow, and role-scoped portals.

---

## 2. Reference ERP Menu & Subsystem Audit

We systematically audited all core subsystems across the legacy reference implementations:
1. `MAINTAIN` (Masters & Catalogs)
2. `VOUCHER` (Transactions & Entries)
3. `FEEDING` (Daily Registers & Bhav)
4. `REPORTS` (Ledgers, Registers, Stock & Balance Sheets)
5. `TAGGING` (Barcodes, HUID, RFID & Inventories)
6. `UTILITIES` (Data Portability, Period Closures, Tally Export)

---

## 3. Comprehensive Capability Analysis & Transformation Matrix

| # | Reference Subsystem & Feature | Business Purpose & Domain Role | Inputs / Data Tracked | Outputs / Documents | Ledger & Gold Impact | Stock / WIP Impact | Ornexa Status | Architectural Decision & Modern Ornexa Improvement | Target Module | Priority |
|---|---|---|---|---|---|---|:---:|---|---|:---:|
| **1** | **Maintain → Accounts (`accmast`)** | Maintain ledger accounts for customers, suppliers, karigars, staff | Code, Name, Address, GSTIN, PAN, Bank, Credit Limit, Karigar Loss % | Account List, Party Master record | Maps to Chart of Accounts | None directly | `PARTIAL` | **Replaced by Party 360:** Dedicated party types (Customer, Supplier, Karigar, Outside Karigar, Refinery, Hallmark, Employee). No manual chart of accounts grouping required. Automatic ledger account generation. | `Party 360` | `P0` |
| **2** | **Maintain → Account Groups (`group`)** | Define accounting balance sheet & P&L categories | Group Name, Primary Nature (Asset, Liability, Income, Expense) | Balance sheet tree | Defines ledger hierarchy | None | `PARTIAL` | **Configurable Account Groups:** Standardized double-entry classification with nested groups while shielding routine customer creation. | `Accounting` | `P1` |
| **3** | **Maintain → Items (`itemmast`)** | Define jewellery items, metals, labour basis, wastage % | Item Name, Group, Metal, Touch %, Labour on Gross/Net/Pcs, Min Making | Product Catalog, Item Master | None | Defines item tracking mode | `PARTIAL` | **Item & Material Master:** Multi-attribute support (Collection, Design, Metal, Karat, Touch, Gross/Net/Fine, Stone/Diamond, HUID, Tagging method, Production route). | `Inventory / Masters` | `P0` |
| **4** | **Maintain → Stamp / Purity Master** | Configure metal touch/karat grades and hallmark seals | Karat (24K, 22K, 18K, 14K), Touch % (99.9, 91.6, 75.0, 58.5), Metal Type | Purity selection dropdowns | Calculates fine weight conversions | Purity segregation | `PARTIAL` | **Stamp & Purity Master:** Centralized fineness registry across Gold, Silver, Platinum with HUID laser tracking linkage. | `Masters` | `P0` |
| **5** | **Maintain → Diamond / Stone Setup** | Define stone classifications for studded jewellery | Clarity, Shape, Color, Sieve/Size, Cut, Lab Certificate, Carat Rate | Diamond rate tables, Sieve lists | Financial cost & stone value | Carat & Piece inventory | `PARTIAL` | **Diamond & Gemstone Master:** Configurable multi-attribute matrices (Clarity, Cut, Color, Carat, Shape, Lab Certificate) with tenant custom fields. | `Masters` | `P1` |
| **6** | **Maintain → Opening Stock Initialization** | Ingest opening physical inventory on ERP go-live | Item Group, Tag No, Gross Wt, Net Wt, Fine Wt, Touch, Purity, Pcs | Opening Stock Ledger | Dr Opening Stock Reserve | Initializes Inventory & Vault Balances | `PARTIAL` | **Opening Balance & Migration Engine (P0):** Multi-dimensional opening balances (Raw gold, WIP, finished tags, karigar custody, refinery, customer gold) via 13-stage wizard. | `Migration / Stock` | `P0` |
| **7** | **Voucher → Sales Invoice / GST Bill** | B2B & Retail tax invoice generation | Customer, Items, Gross Wt, Less Wt, Net Wt, Touch, Rate, Making, GST | Tax Invoice PDF, E-Way Bill, Delivery Challan | Dr Customer A/c, Cr Sales, Cr GST Payable | Deducts Finished Tag / Loose Stock | `EXISTS` | **Universal Document Engine + 10 Templates:** Multi-format PDF/print, WhatsApp delivery, payment QR, automated gold deduction, dual cash/metal posting. | `Billing / Sales` | `P0` |
| **8** | **Voucher → Old Gold / Metal Purchase** | Buyback old jewellery or bullion from customer/dealer | Party, Gross Wt, Dust/Stone Deduction, Melting Touch %, Fine Wt, Rate | Metal Purchase Voucher, Cash/Bank Slip | Cr Party A/c, Dr Metal Purchase A/c | Adds to Raw / Old Gold Vault Stock | `PARTIAL` | **Metal Inward / Old Gold Engine:** Automated assaying deduction, melting loss preview, instant party credit (Cash or Metal credit balance). | `Stock / Purchases` | `P0` |
| **9** | **Voucher → Karigar Metal Issue** | Issue pure gold / alloy to goldsmith for job production | Karigar, Job Card ID, Raw Gold Gross Wt, Touch %, Calculated Fine Wt | Karigar Issue Slip, Workshop Handover Voucher | Dr Karigar Metal Ledger (Grams & Fine) | Deducts Vault Raw Stock, Adds to Karigar WIP | `EXISTS` | **Manufacturing & Custody Engine:** Direct job-linked issue, barcode scan, Bluetooth scale integration, real-time fine gold debit. | `Manufacturing` | `P0` |
| **10**| **Voucher → Karigar Receive & Return** | Receive finished ornaments, scrap, and bench dust | Karigar, Job Card, Finished Wt, Scrap Wt, Dust Wt, Touch %, Making Due | Karigar Receive Slip, Tag Generation Voucher | Cr Karigar Metal Ledger, Cr Karigar Labour Due | Adds Finished Goods / Tag Stock, Deducts Karigar WIP | `EXISTS` | **Manufacturing Book Traceability:** Reconciles gross/net/fine, allowed wastage vs actual loss, posts wage to labour ledger, auto-routes to QC. | `Manufacturing` | `P0` |
| **11**| **Voucher → Outside Work Challan** | Subcontract specialized processes (Enameling/Mina, Setting, Polish) | Vendor, Job Cards, Gross Wt, Process Type, Expected Return Date | Outside Work Voucher (Mina / Polish Book) | Dr Outside Vendor Custody Ledger | Moves Job WIP to Subcontractor Location | `PARTIAL` | **Outside Processing Subsystem:** Mina Book, Polish Book, Casting House dispatch tracking with stage-by-stage weight loss validation. | `Manufacturing` | `P0` |
| **12**| **Feeding → Daily Bhav / Spot Rates** | Daily gold, silver, and platinum buying/selling rate card | Date/Time, Karat/Purity, Buy Rate/g, Sell Rate/g, MCX Benchmark | Daily Rate Card, Billing Auto-fill | Historical rate lookup for billing | Dynamic valuation | `PARTIAL` | **Versioned Rate Book:** Multi-branch rate management, automatic timestamping, rate approval workflow, immutable historical rate snapshotting. | `Control / Pricing` | `P0` |
| **13**| **Reports → Metal-wise & Short Ledger** | Track cash debits/credits alongside metal gram balances | Party ID, Date Range, Metal Type (Gold, Silver, Platinum) | Dual-Unit Statement (Cash ₹ + Fine Grams) | Inspects `tran1` / `gold_ledger` | Traceable to source vouchers | `PARTIAL` | **Universal Ledger Family:** Dual cash/fine metal accounting, drill-down to source vouchers, WhatsApp statement export, instant PDF share. | `Reporting` | `P0` |
| **14**| **Reports → Outstanding & Ageing** | Track receivables, payables, and overdue metal custody | As-of Date, Party Type, Ageing Brackets (<30, 30-60, 60-90, >90) | Ageing Schedule, Reminder Letters | Analyzes unpaid bills & unsettled metal | Risk monitoring | `PARTIAL` | **Outstanding & Credit Engine:** Multi-dimensional ageing (Money receivables + Gold outstanding with karigars + Customer gold deposits). | `Reporting` | `P0` |
| **15**| **Reports → Karigar Hisab Final / Loss** | Reconcile artisan accounts: metal issued vs returned vs wastage | Karigar ID, Settlement Date Range, Allowed Wastage %, Making Tariff | Karigar Settlement Statement | Posts final fine gold variance / wage settlement | Clears Karigar WIP balance | `PARTIAL` | **Deterministic Hisab Engine:** Automated tolerance check, scrap recovery calculation, wage credit voucher, audit freeze. | `Manufacturing / Reports`| `P0` |
| **16**| **Tagging → Tag Stock & Weight Search** | Inventory lookup by barcode tag, box, purity, weight range | Tag No, Box/Tray ID, Weight Range, Item Group | Tag Inventory Grid, Physical Stock Audit | Live Stock Balance | Reconciles counter stock | `PARTIAL` | **Modern Tag & Inventory Subsystem:** Code128 / QR barcodes, RFID batch scanner compatibility, Box/Tray location transfers, discrepancy reports. | `Stock / Tagging` | `P0` |
| **17**| **Utilities → Tally Prime Export** | Export financial and inventory vouchers to Tally XML | Date Range, Voucher Types (Sales, Purchase, Receipt, Payment, Journal) | `tally.xml` formatted export file | Reconciles external CA books | Cross-system audit | `PARTIAL` | **Structured Tally XML Export Pipeline:** Schema-validated XML generation, account mapping validator, dual-ledger audit verification report. | `Integrations` | `P1` |
| **18**| **Utilities → Year / Day Closure** | Lock historical entries and carry forward closing balances | As-of Date, User Authorization, Closure Checklist | Financial Year Opening Balances | Locks posted transactions | Carries forward closing stock | `PARTIAL` | **Period & Day Control Engine:** Period locks, day-close verification gates, CEO authorization to reopen, tamper-proof historical immutability. | `Accounting / Control` | `P0` |
| **19**| **Maintain → Kitty / Chit Scheme** | Retail monthly jewellery savings installment scheme | Customer ID, Monthly Installment ₹, Tenure (11+1 months) | Kitty Passbook, Maturity Voucher | Dr Bank, Cr Customer Deposit | None | `OBSOLETE/RETAIL`| **Not Core for Manufacturing:** Kitty/Chit schemes are pure retail POS features. Excluded from core manufacturing ERP; can be added as an optional future app plugin. | `Retail Plugin` | `P3` |
| **20**| **Maintain → Girvi / Pawn Broking** | Retail pawn shop gold loan lending & interest calculation | Customer, Gold Ornaments Pledged, Loan Amount, Interest Rate % | Pawn Ticket, Redemption Voucher | Dr Loan Asset, Cr Cash | Pledged Vault Custody | `OBSOLETE/RETAIL`| **Not Core for Manufacturing:** Girvi pawn broking is excluded from Ornexa's B2B manufacturing core. | `Retail Plugin` | `P3` |

---

## 4. Key Architectural Takeaways for Ornexa

1. **Dual Metal & Currency Accounting is Mandatory:** Every party transaction involving gold must record both monetary value (₹) and physical metal weight (Gross, Touch %, Fine Gold).
2. **Manufacturing Traceability is the True Core:** The Manufacturing Book connects Order → Design → Job Card → Karigar Issue → Processes (Melting, Casting, Setting, Mina, Polish) → QC → Hallmark (HUID) → Finished Tag → Invoice.
3. **Opening Balances Must Be Multi-Dimensional:** Onboarding a legacy jewellery firm requires migrating Money, Fine Gold, Scrap, Tags, Job WIP, and Karigar balances simultaneously.
4. **Declarative Customization Eliminates Menu Sprawl:** Rather than hardcoding 150 legacy forms, Ornexa uses the Universal Transaction Engine, Custom Formula Engine, and Configurable Report Engine.
