# APPIT Jewel ERP — Screen Inventory

This document provides a detailed screen-by-screen inventory of the Appitsoft Jewel ERP platform.

---

## Screen Directory

| Screen ID     | Screen Name                  | Navigation Path                        | Primary Role(s)                             |
| ------------- | ---------------------------- | -------------------------------------- | ------------------------------------------- |
| **APPIT-001** | Executive Dashboard          | `/dashboard`                           | Owner, Super Admin, Manager                 |
| **APPIT-002** | New Sale (POS Billing)       | `/sales-billing/new-sale`              | Super Admin, Owner, Manager                 |
| **APPIT-003** | Quotations Register          | `/sales-billing/quotations`            | Super Admin, Manager, Accountant            |
| **APPIT-004** | Sales Orders                 | `/sales-billing/sales-orders`          | Super Admin, Manager                        |
| **APPIT-005** | Finished Jewellery Inventory | `/inventory/finished-jewellery`        | Super Admin, Inventory Manager              |
| **APPIT-006** | Metal Inventory Ledger       | `/inventory/metal-inventory`           | Super Admin, Inventory Manager              |
| **APPIT-007** | Diamonds & Stones Vault      | `/inventory/diamonds-stones`           | Super Admin, Inventory Manager              |
| **APPIT-008** | Stock Movement Register      | `/inventory/stock-movement`            | Super Admin, Inventory Manager              |
| **APPIT-009** | Suppliers Master             | `/purchases/suppliers`                 | Super Admin, Purchase Manager               |
| **APPIT-010** | Purchase Orders              | `/purchases/purchase-orders`           | Super Admin, Purchase Manager               |
| **APPIT-011** | Goods Receipt (GRN)          | `/purchases/goods-receipt`             | Super Admin, Purchase Manager, QC           |
| **APPIT-012** | Production Orders            | `/manufacturing/production-orders`     | Super Admin, Production Manager             |
| **APPIT-013** | Job Cards Board              | `/manufacturing/job-cards`             | Super Admin, Production Manager, Karigar    |
| **APPIT-014** | Karigar Management           | `/manufacturing/karigar-management`    | Super Admin, Production Manager             |
| **APPIT-015** | Job Work Settlement          | `/manufacturing/job-work-settlement`   | Super Admin, Production Manager, Accountant |
| **APPIT-016** | Product Catalogue            | `/products-designs/product-catalogue`  | Super Admin, Manager                        |
| **APPIT-017** | Daily Metal Rates            | `/metal-rates/daily-metal-rates`       | Super Admin, Owner                          |
| **APPIT-018** | Purity Master                | `/metal-rates/purity-master`           | Super Admin, Owner                          |
| **APPIT-019** | Customer List & CRM          | `/customer-crm/customer-list`          | Super Admin, Sales Manager                  |
| **APPIT-020** | Gold Saving Schemes          | `/customer-crm/gold-saving-schemes`    | Super Admin, Accountant, Sales Manager      |
| **APPIT-021** | New Custom Order             | `/custom-orders/new-custom-order`      | Super Admin, Sales Manager                  |
| **APPIT-022** | Repair Orders                | `/repairs-services/repair-orders`      | Super Admin, Sales Executive                |
| **APPIT-023** | Receipts & Payments          | `/finance/receipts-payments`           | Super Admin, Accountant                     |
| **APPIT-024** | Expenses Book                | `/finance/expenses`                    | Super Admin, Accountant                     |
| **APPIT-025** | Customer Ledger              | `/finance/customer-ledger`             | Super Admin, Accountant                     |
| **APPIT-026** | Old Gold Purchase            | `/old-gold-exchange/old-gold-purchase` | Super Admin, Accountant, Sales Manager      |
| **APPIT-027** | Hallmark Requests            | `/hallmark-qc/hallmark-requests`       | Super Admin, QC Manager                     |
| **APPIT-028** | HUID Records                 | `/hallmark-qc/huid-records`            | Super Admin, QC Manager                     |
| **APPIT-029** | Users & Roles Management     | `/administration/users-roles`          | Super Admin, Owner                          |
| **APPIT-030** | System Settings              | `/administration/system-settings`      | Super Admin, Owner                          |

---

## Detailed Screen Audits

### APPIT-001: Executive Dashboard

- **Path**: `/dashboard`
- **Purpose**: High-level real-time KPI overview of sales, inventory, and workshop metrics.
- **Fields & KPIs**:
  - Total Sales (MTD / YTD)
  - Gross Profit & Margin %
  - Metal Stock Balance (Gold in Vault vs. Issued to Karigars)
  - Pending Job Cards count
  - Daily Gold Rate (24K / 22K) ticker
- **Actions**: Export Dashboard PDF, Date range filters (Today, Yesterday, Last 7 Days, Custom).
- **Downstream Effects**: Read-only, pulls aggregate metrics dynamically from Sales, Vault, and Manufacturing databases.

### APPIT-002: New Sale (POS Billing)

- **Path**: `/sales-billing/new-sale`
- **Purpose**: Create retail jewellery tax invoices.
- **Fields**: Customer search/phone, Barcode tag scan, Discount (%), Old Gold Adjustment, Advance Adjustment, Payment Mode, Tax (3% GST).
- **Calculations**:
  - Gold Price = Net Gold Weight $\times$ Live Rate (22K)
  - Making Charges = Calculated based on flat rate, rate per gram, or item percentage.
  - Subtotal = Gold Value + Making Charges + Wastage Value + Stone Value
  - GST = Subtotal $\times$ 3%
  - Grand Total = Subtotal + GST - Adjustments (Old Gold / Advances)
- **Stock Effect**: Instantly moves finished ornament status to `Sold` (decreases finished stock count).
- **Ledger Effect**: Debits Cash/Bank account, Credits Sales Account, Debits Tax Ledger (GST Output).

### APPIT-013: Job Cards Board

- **Path**: `/manufacturing/job-cards`
- **Purpose**: Pipeline dashboard representing workshop production.
- **Fields**: Job Card Number, Karigar select, Metal / Purity, Expected Wt, Material Issued Wt, Process Stage select.
- **Drawer panel fields**: Detail info, scrap recovered wt, wastage wt, delay risk percentage.
- **Wastage Math**:
  $$\text{Wastage \%} = \frac{\text{Issued Wt} - (\text{Finished Wt} + \text{Scrap Wt})}{\text{Issued Wt}} \times 100$$
- **Metal Effect**: Transfers Gold weight from Main Vault $\rightarrow$ Karigar Metal Book.
- **Accounting Effect**: Deferment until job-work settlement.

### APPIT-017: Daily Metal Rates

- **Path**: `/metal-rates/daily-metal-rates`
- **Purpose**: Manage daily metal rates.
- **Fields**: Metal name, Purity Karat, Selling Rate, Buying Rate, effective date.
- **Actions**: Update Rate, Approve rate changes, Publish branch-wise overrides.
- **Downstream Effects**: Automatically changes selling price on retail checkout (New Sale) and buying rate on Old Gold valuation screens.

### APPIT-023: Receipts & Payments

- **Path**: `/finance/receipts-payments`
- **Purpose**: Post cash, bank, or UPI ledger transactions.
- **Fields**: Payment Date, Party Name, Type (Receipt / Payment), Payment Mode (Cash, Card, UPI, Bank), Amount, Narration.
- **Accounting Effect**: Double-entry posting: Debits target Cash/Bank, Credits selected Customer/Supplier ledger account.

### APPIT-026: Old Gold Purchase

- **Path**: `/old-gold-exchange/old-gold-purchase`
- **Purpose**: Value and buy old gold ornaments outright.
- **Fields**: Customer, Item description, Gross Wt, Appraised Touch (%), Melting Loss Wt, Live 24K Rate, Buying Rate Discount (%).
- **Calculations**:
  - Net Pure Wt = (Gross Wt - Melting Loss) $\times$ Touch %
  - Appraised Value = Net Pure Wt $\times$ (24K Gold Rate - Discount %)
- **Stock Effect**: Increases Scrap/Melt Gold inventory.
- **Ledger Effect**: Credits Customer ledger, Debits Raw Metal Vault (in milligrams and cash value).
