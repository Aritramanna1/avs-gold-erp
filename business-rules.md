# MTJ ERP — Jewellery Business Rules

This document specifies the rigorous mathematical equations, operational workflows, and domain business rules that govern all jewellery transactions in MTJ ERP.

---

## 1. Billing Formulas & Mathematics

The central pricing formula for retail jewellery sales is defined as:

$$\text{Line Total} = (\text{Net Weight (g)} \times \text{Gold Rate per Gram}) + \text{Making Charges} + \text{Stone Charges} - \text{Discount}$$

### Formula Definitions

- **Gold Rate per Gram**: Selected based on the purity category (e.g., 22K/916 gold uses a percentage of the 24K pure gold reference rate).
- **Making Charges**: Computed in two modes depending on the ornament style:
  - **Per Gram**: $\text{Net Weight (g)} \times \text{Making Rate per Gram}$.
  - **Fixed**: A single flat fee (e.g., ₹500 per ring).
- **Tax Calculations (GST)**: In India, retail jewellery transactions are subject to a **3% Goods and Services Tax (GST)** applied on the grand total after applying discounts and subtracting gold exchanges.
  - $\text{CGST} = 1.5\%$
  - $\text{SGST} = 1.5\%$
  - $\text{IGST} = 3.0\%$ (applicable on inter-state sales)

---

## 2. Gold Exchange (Old Gold Buyback)

Customers often trade-in old gold ornaments during checkout. The value of this old gold is deducted directly from the active invoice.

- **Old Gold Value Formula**:
  $$\text{Value} = \text{Gross Weight (g)} \times \left( \frac{\text{Purity \%}}{100} \right) \times \text{Active Gold Buyback Rate}$$
- **Gold Purity Categories**:
  - `91.6%` (22K)
  - `75.0%` (18K)
  - `100.0%` (24K pure reference)
- **Gold Inventory Movement**: Received old gold is directed into the physical vault's raw scrap bucket. It cannot be sold directly until refined and remanufactured.

---

## 3. Advance Payments (Vouchers)

Customers booking custom-made ornaments pay earnest money deposits in advance.

- **Two-Mode Booking**:
  - **Cash Advance**: Customer deposits a specific monetary amount (e.g., ₹20,000). The deposit is locked and acts as store credit deductible on final invoice checkout.
  - **Gold Booking**: The customer locks in a physical gold weight (e.g., 5.000 g). The cash value is calculated based on the gold rate active on the day of booking, shielding the customer from market price fluctuations.

---

## 4. Workshop & Karigar Management

External artisans (Karigars) manufacture custom jewellery.

- **The Cycle of Gold**:
  1. **Issue Gold**: Fine gold weight (e.g., 10.000 g pure gold wire) is issued to a Karigar. This represents a gold debit liability for the Karigar.
  2. **Manufacture**: Karigar constructs the ornament.
  3. **Return Gold**: Karigar delivers the finished ornament.
  4. **Filing Wastage (Ghat)**: A standardized wastage allowance is calculated:
     $$\text{Wastage} = \text{Finished Weight} \times \text{Agreed Wastage \%}$$
  5. **Settlement**: The Karigar's ledger balance is adjusted:
     $$\text{New Outstanding Balance} = \text{Issued Weight} - (\text{Finished Weight} + \text{Wastage})$$

---

## 5. Inventory & Barcoding Rules

- **Unique Serialization**: Every stock ornament received from a workshop or wholesale merchant is issued a unique barcode.
- **Weight Fields**:
  - **Gross Weight**: Absolute scale weight including gold, gemstones, and lacquer.
  - **Net Weight**: Calculated gold weight (Gross Weight minus Stone/Gemstone Weight). Making charges are calculated only on the net weight.

---

## 6. Customer Management (CRM)

- **Quick Lookup**: Customers are searched dynamically using their unique phone number.
- **Credit Ledger**: Customers can buy on credit (Outstanding / Due Payment).
- **Overdraft Limits**: System flags warnings if a customer's outstanding balance exceeds pre-authorized limits during a sale.

---

## 7. Reports & Taxation

- **Daily Close Statement**: Summarizes cash drawer holdings, bank deposits, credit transactions, gold transactions, and sales invoices. Must balance to zero variance at the end of every business day.
- **GST Returns (GSTR-1)**: Generates precise taxable turnover reports separating CGST, SGST, and IGST for state tax filing compliance.

---

## 8. Role-Based Permissions

To prevent inventory theft and price manipulation, access is partitioned:

- **Cashier**: Can perform sales, process old gold, and print invoices. Cannot override reference gold rates or edit historic invoice values.
- **Manager**: Can approve customized customer discounts and adjust inventory stock.
- **Administrator**: Full system access, audit logs, and master configuration management.
