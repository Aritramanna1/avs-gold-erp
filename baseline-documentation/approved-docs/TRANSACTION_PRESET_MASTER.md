# ORNEXA — TRANSACTION PRESET MASTER SPECIFICATION
**Authoritative Architectural Specification for Domain Transaction Presets: Manufacturer, Wholesaler, Retailer, and Universal Customization**
*Version: 3.1.0 (Approved Source of Truth)*
*Last Updated: August 2026*

---

## 1. Transaction Preset Philosophy

### 1.1 The Core Operating Principle
> **"EACH BUSINESS MODE EXPOSES RELEVANT DEFAULT TRANSACTION TYPES OUT OF THE BOX, ALL RUNNING ON THE UNIVERSAL TRANSACTION ENGINE."**
>
> Rather than overwhelming a retail store with 40 complex factory melting vouchers, or forcing a manufacturer through retail cash-drawer receipts, Ornexa provisions tailored transaction starter packs.

```mermaid
graph TD
    UniversalEngine["Universal Transaction Engine (Multi-Ledger Invariants, Formula Integration, Document Engine)"]
    
    UniversalEngine --> PackMfg["Manufacturer Transaction Pack (Gold Issue, Gold Receive, Job Loss, Recovery, Outside Work, Hisab)"]
    UniversalEngine --> PackWholesale["Wholesaler Transaction Pack (Bullion Purchase, Bulk Inward, Wholesale Invoice, Dispatch, Collection)"]
    UniversalEngine --> PackRetail["Retailer Transaction Pack (Counter Estimate, Retail Tax Invoice, Old Gold Buyback, Advance, Repair Slip)"]
    UniversalEngine --> PackCustom["Universal Custom Transaction Designer (Create Any New Jewellery Voucher)"]
```

---

## 2. Business Mode Transaction Presets

| Business Mode Preset | Standard Default Transaction Types | Core Target Ledger Postings | Output Documents |
|---|---|---|---|
| **Jewellery Manufacturer** | 1. `Karigar Gold Issue`<br>2. `Karigar Receive & Return`<br>3. `Melting & Assay Slip`<br>4. `Outside Work Challan (Mina/Polish)`<br>5. `Karigar Hisab Settlement`<br>6. `Tax Invoice (B2B)` | `Dr Karigar Metal Ledger`<br>`Cr Karigar Metal Ledger`<br>`Dr/Cr Melting Loss`<br>`Dr Outside Custody`<br>`Cr Karigar Labour Due`<br>`Dr Customer / Cr Sales` | Issue Voucher<br>Receive Slip<br>Assay Certificate<br>Outside Challan<br>Hisab Statement<br>Tax Invoice A4 |
| **Jewellery Wholesaler** | 1. `Bullion / Stock Purchase`<br>2. `Bulk Inward / Tag Batch`<br>3. `Dealer Order Booking`<br>4. `Dispatch Challan`<br>5. `Wholesale Tax Invoice`<br>6. `B2B Collection Receipt` | `Dr Purchase / Cr Vendor`<br>`Dr Finished Inventory`<br>`Order Reservation`<br>`Dr Transit Stock`<br>`Dr Dealer / Cr Sales`<br>`Dr Bank / Cr Dealer` | Purchase Note<br>Tag Batch Sheet<br>Order Confirmation<br>Dispatch Challan<br>GST Invoice<br>Payment Receipt |
| **Retail Jeweller** | 1. `Counter Estimate Slip`<br>2. `Retail Sales Invoice`<br>3. `Old Gold Exchange Buyback`<br>4. `Customer Advance Booking`<br>5. `Jewellery Repair Intake`<br>6. `Cash / UPI Receipt` | `Non-Posting`<br>`Dr Cash/Bank / Cr Sales`<br>`Dr Old Gold / Cr Customer`<br>`Dr Cash / Cr Customer Deposit`<br>`Dr Repair WIP`<br>`Dr Cash / Cr Customer` | Estimate Proforma<br>Retail Bill (A4/80mm)<br>Old Gold Voucher<br>Advance Receipt<br>Repair Job Slip<br>Receipt Voucher |

---

## 3. Custom Transaction Designer Integration

If a business requires a non-standard trade transaction:
1. Open **Settings → Transaction Designer (`/control/transactions`)**.
2. Define voucher name, code, prefix, and numbering sequence.
3. Configure line-item fields (Gross Wt, Touch %, Fine Gold, Making Charges, Taxes).
4. Declare ledger effects (Money, Metal, Stock, Party, WIP).
5. Bind to a document template and print profile.
6. Test in preview simulation and activate instantly.
