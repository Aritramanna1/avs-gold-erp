# JWELLY & JEWELLERY ERP REFERENCE MASTER
**Authoritative Reverse-Audit and Functional Capability Extraction from Reference Jewellery Systems**
*Version: 4.0.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Executive Summary & Audit Mission

This document captures the complete functional capabilities of mature reference jewellery ERP systems (including Jwelly / Ace Lite and JewelAcc / JewellerWpf) found in the local environment.

### 1.1 Core Operating Principle
> **"STUDY JWELLY AS A DOMAIN BENCHMARK. EXTRACT EVERY MATURE JEWELLERY CAPABILITY. DO NOT COPY OLD WINDOWS FORMS, BRANDING, UI, SOURCE CODE, OR OBSOLETE LOCAL DATABASE ARCHITECTURE. REBUILD CLEANLY IN ORNEXA."**
>
> Ornexa covers the essential capabilities a mature jeweller expects, while being cleaner, manufacturing-first, configurable, cloud-native, and easier to use.

---

## 2. Complete Jwelly Menu & Subsystem Catalog

```
├── 1. MAINTAIN / MASTERS
│   ├── Accounts (Ledgers, Customers, Dealers, Suppliers, Karigars, Staff)
│   ├── Account Groups (Balance Sheet & P&L Group Tree)
│   ├── Items (Metals, Ornaments, Components, Purity classifications)
│   ├── Item Groups (Gold Ornaments, Silver, Loose Diamond, Gemstones)
│   ├── Stamp / Purity Master (Karat fineness: 24K, 22K 916, 18K 750, 14K, 925 Silver)
│   ├── Diamond & Stone Setup (Clarity, Color, Shape, Sieve, Cut, Sieve-rate tables)
│   ├── Narration Master (Predefined voucher narration templates)
│   ├── Company Details (Legal name, GSTIN, State code, Multi-branch mapping)
│   ├── Series & Auto-Numbering (Voucher prefixes, financial year resets)
│   └── Sundry Lists (Expense types, payment terms, delivery modes)
├── 2. VOUCHERS / TRANSACTIONS
│   ├── Receipt & Payment Vouchers (Cash, Bank, Multi-mode, Metal weight receipts)
│   ├── Sales Invoice (B2B Wholesale Tax Invoice, Retail POS Bill, Estimations)
│   ├── Metal Purchase & Old Gold Buyback (Assaying deductions, Melting touch %, Scrap recovery)
│   ├── Karigar Issue & Receive (Raw gold issues, finished jewellery receive, bench dust recovery)
│   ├── Outside Processing Challan (Subcontracting: Mina/Enameling, Setting, Polishing, Hallmarking)
│   ├── Manufacturing Job Orders (Job cards, Design selection, BOM allocation, Promised dates)
│   ├── Journal & Contra Vouchers (Inter-account transfers, Metal-to-cash conversions)
│   ├── Credit Notes & Debit Notes (Weight adjustments, Rate-cut adjustments)
│   └── Stock Journals (Inter-tray, Inter-vault, Box transfers, Melting transformations)
├── 3. FEEDING & REGISTERS
│   ├── Daily Bhav Rate Book (Daily spot rates by karat/metal, MCX benchmark integration)
│   ├── Daily Attendance & Karigar In/Out
│   ├── Bank Reconciliation Registry
│   ├── Cheque Clearance Registry
│   ├── Physical Box / Tray In-Out Location Tracking
│   └── Daily Reminders & Task Register
├── 4. REPORTS & REGISTERS
│   ├── Ledger Family (Short Ledger, Detailed Ledger, Bill-wise, Metal-wise Dual Ledger)
│   ├── Outstanding Family (Debtors, Creditors, Ageing <30/60/90, Gold Outstanding)
│   ├── Daily Books (Cash Book, Gold Book, Silver Book, Day Book, Daily Summary Sheet)
│   ├── Stock Status (Loose Stock, Tagged Stock, WIP Stock, Outside Gold, Karigar Custody)
│   ├── Sales & Purchase Registers (Bill-wise, Item-wise, Party-wise, Tax GST HSN summaries)
│   ├── Karigar Registers (Issue/Receive register, Metal loss register, Wage settlement register)
│   └── Administrative & Audit Logs (User audit trail, Modified/Deleted voucher registers)
├── 5. TAGGING & INVENTORY
│   ├── Tag Generation & Printing (Barcode Code128, QR Code, RFID tag encoding)
│   ├── Tag Modification & Calculator (Weight recalculations, stone re-pricing)
│   ├── Weight Search & Physical Stock Verification (Serial weighing scale tare integration)
│   └── Stock Discrepancy & Audit Analyzer (In-Place, Missing, Extra, Misplaced)
└── 6. UTILITIES
    ├── Backup & Restore (Encrypted archive export and recovery)
    ├── Period & Year Close (Financial year balance rollover, Period data locks)
    ├── Day Close Checklist (Daily physical cash & gold safe verification)
    ├── Karigar Hisab Final (Automated artisan metal & labour balance checkout)
    └── Tally Prime XML Export (Structured financial accounting synchronization)
```

---

## 3. Comprehensive Jwelly Capability Audit & Mapping Matrix

| # | Reference Menu & Feature | Business Purpose | Key Fields / Inputs | Transaction Effect | Gold / Metal Effect | Stock / WIP Effect | Accounting Effect | Reports Produced | Status in Ornexa | Implementation Decision |
|---|---|---|---|---|---|---|---|---|:---:|---|
| **1** | **Maintain → Accounts (`accmast`)** | Customer, Supplier, Karigar, Dealer directories | Name, Alias, Type, Contact, Address, PAN, GSTIN, State Code, Bank, Credit Limit (₹ & Gold g), Karigar Loss % | Creates Master Record | Configures metal tracking mode (`WTBAL`) | None directly | Auto-generates sub-ledger | Party Directory, Balance Summary | `EXISTS` | Handled via **Party 360** with dedicated types and dual cash/metal balances. |
| **2** | **Maintain → Stamp / Purity** | Metal karat and touch fineness definitions | Karat Name, Metal (Gold/Silver/Pt), Touch % (99.9, 91.6, 75.0, 58.5), Standard Hallmark Seal | Configures conversion factor | Authoritative for Fine Weight calculations | Governs stock karat segregation | None | Purity Master List | `EXISTS` | Centralized in `purity_grades` master table. |
| **3** | **Maintain → Diamond / Stone Setup** | Gemstone classification & sieve pricing tables | Sieve Size, Shape, Clarity, Color, Cut, Carat Rate ₹, Weight Deduction Rule | Configures stone pricing | Stone weight deducted from Gross Wt | Tracks piece & carat inventory | Stone value added to bill | Diamond Rate Book, Stone Stock | `EXISTS` | Managed via `diamond_matrices` and `stone_classifications`. |
| **4** | **Maintain → Opening Stock / Balances** | Ingest legacy business state on ERP go-live | Party Balances (Cash ₹, Fine Gold g), Raw Gold Vaults, Tagged Stock, WIP Job Cards, Karigar Metal | Ingests opening positions | Initializes Gold Vaults & Karigar balances | Initializes stock registers & active WIP | Dr/Cr Opening Balance Equity | Opening Trial Balance, Migration Audit | `PARTIAL` | Rebuilt into **13-Stage Migration Wizard** with completion states. |
| **5** | **Vouchers → Metal Purchase / Old Gold** | Buy old jewellery or raw bullion from party | Party, Gross Wt, Dust/Stone Less Wt, Melting Touch %, Fine Wt, Spot Bhav, Cash/Metal Payment | Creates Purchase Voucher | Adds Fine Gold to Raw Vault Stock | Adds Old Gold Lot / Scrap Stock | Cr Party (Cash ₹ or Metal g), Dr Metal Purchase | Metal Purchase Register, Old Gold Book | `EXISTS` | Handled via Universal Transaction `OLD_GOLD_PURCHASE` / `BULLION_INWARD`. |
| **6** | **Vouchers → Karigar Issue** | Issue raw gold or alloy to goldsmith for job bag | Karigar ID, Job Card ID, Raw Gold Wt, Touch %, Calculated Fine Gold Wt | Creates Karigar Issue Slip | Debits Karigar Fine Gold Custody | Decreases Vault Stock, Increases Karigar WIP | Dr Karigar Metal Ledger | Karigar Issue Register, Bench Gold Report | `EXISTS` | Handled via Manufacturing Book `karigar_metal_issues`. |
| **7** | **Vouchers → Karigar Receive** | Receive finished jewellery, scrap, and bench dust | Karigar ID, Job Card, Finished Gross Wt, Scrap Wt, Touch %, Wastage % | Creates Karigar Receive Slip | Credits Karigar Fine Gold Custody | Adds Finished Goods Tag, Clears Karigar WIP | Cr Karigar Labour Due, Reconciles Loss | Karigar Receive Register, Scrap Report | `EXISTS` | Handled via Manufacturing Book `karigar_metal_receives`. |
| **8** | **Vouchers → Outside Work (Mina/Polish)**| Subcontract specialized enameling/polishing | Vendor ID, Job Bags, Gross Wt, Process Type (Mina, Polish, Setting) | Creates Outside Challan | Transfter custody to Subcontractor | Moves Job WIP to Vendor Location | Accrues Outside Service Expense | Mina Book, Polish Book, Outside WIP | `EXISTS` | Handled via Outside Processing Subsystem in Manufacturing Book. |
| **9** | **Vouchers → Sales Tax Invoice (B2B/POS)**| Wholesale and retail tax invoice generation | Customer, Tag Barcodes, Gross/Net Wt, Touch, Bhav, Making Charges, GST | Creates GST Tax Bill | Deducts Finished Gold from Stock | Deducts Tagged Stock from Showroom/Vault | Dr Customer, Cr Sales, Cr GST Payable | Sales Register, Tax Invoice, GSTR-1 | `EXISTS` | Handled via Universal Document Engine with 10 templates. |
| **10**| **Feeding → Daily Bhav Rate Book** | Daily spot bullion rate updates by purity | Date/Time, Metal, Karat, Buy Rate/g, Sell Rate/g, MCX Benchmark | Updates active pricing | Dynamic valuation of inventory & rate-cuts | Re-prices non-fixed stock | Historical rate snapshot | Daily Rate Card, Historical Bhav Sheet | `EXISTS` | Centralized in `rate_book_history` with multi-branch cards. |
| **11**| **Reports → Metal-wise Dual Ledger** | View cash and fine metal balances side-by-side | Party ID, Date Range, Metal Type (Gold, Silver) | Generates Statement | Tracks dual running balance (Cash ₹ + Metal g) | None | Full audit reconciliation | Dual-Unit Statement (Cash ₹ + Fine g) | `EXISTS` | Standardized across all party views in Party 360 and Reports. |
| **12**| **Reports → Karigar Hisab Final** | Complete settlement of karigar metal and wages | Karigar ID, Date Range, Allowed Wastage vs Actual Loss, Wage Rate | Creates Settlement Voucher | Zeros out Karigar metal custody balance | Clears WIP job bag tracking | Settles labour ledger via Cash/Bank | Karigar Hisab Voucher, Loss Statement | `EXISTS` | Handled via `hisab_final_settlements` in Manufacturing Book. |
| **13**| **Tagging → Stock & Discrepancy Audit** | Barcode / RFID scanning and inventory audit | Tag ID, Tray/Box ID, Physical Scan List | Reconciles physical stock | Live tagged inventory verification | Identifies Missing, Extra, Misplaced tags | None | Stock Discrepancy Report, Tray Audit | `EXISTS` | Standardized in Tagging and Traceability Master. |
| **14**| **Utilities → Tally Prime XML Export** | Export vouchers to external CA accounting package | Date Range, Voucher Types (Sales, Purchase, Receipt, Journal) | Generates `tally.xml` | None directly | Reconciles external books | Formats XML ledger vouchers | Tally Audit Verification Report | `EXISTS` | Handled via `/control/tally-export` XML pipeline. |
| **15**| **Maintain → Kitty / Chit Fund Scheme** | Retail monthly jewellery deposit scheme | Customer ID, Monthly Deposit ₹, Duration (11+1) | Creates Scheme Account | Accumulates customer gold deposit | None | Dr Bank, Cr Customer Deposit | Chit Passbook, Maturity Schedule | `DEFERRED` | **Frozen for Future Extensibility:** Documented in `FUTURE_ROADMAP.md`. |
| **16**| **Maintain → Girvi / Pawn Broking** | Pledging gold jewellery against cash loans | Customer, Ornaments Pledged, Loan ₹, Interest % | Creates Pawn Ticket | Pledged gold held in custody vault | Holds collateral in pledge safe | Dr Loan Asset, Cr Cash | Girvi Register, Interest Outstanding | `DEFERRED` | **Frozen for Future Extensibility:** Documented in `FUTURE_ROADMAP.md`. |

---

## 4. Key Architectural Invariants Derived from Jwelly

1. **Dual Metal & Currency Accounting is Mandatory:** Every party transaction involving gold must record both monetary value (₹) and physical metal weight (Gross, Touch %, Fine Gold).
2. **Manufacturing Traceability is the True Core:** The Manufacturing Book connects Order → Design → Job Card → Karigar Issue → Processes (Melting, Casting, Setting, Mina, Polish) → QC → Hallmark (HUID) → Finished Tag → Invoice.
3. **Opening Balances Must Be Multi-Dimensional:** Onboarding a legacy jewellery firm requires migrating Money, Fine Gold, Scrap, Tags, Job WIP, and Karigar balances simultaneously.
4. **Declarative Customization Eliminates Menu Sprawl:** Rather than hardcoding 200 Windows forms, Ornexa uses the Universal Transaction Engine, Custom Formula Engine, Configurable Report Engine, and dedicated Customization Workspace.
