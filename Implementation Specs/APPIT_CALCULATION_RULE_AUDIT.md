# APPIT Jewel ERP — Calculation Rule Audit

**Date:** 2026-08-12

This document details the mathematical algorithms and business rules observed in APPIT transaction modules.

---

## 1. Gold Rate & Karat Conversion

Daily reference metal rates are set for **24K pure gold**. Other purities are computed using nominal Touch conversions or configured custom margins:

| Karat   | Nominal Purity | Mathematical Factor      | Example at 24K = ₹7,316/g |
| ------- | -------------- | ------------------------ | ------------------------- |
| **24K** | 99.9% (999)    | $1.000$                  | ₹7,316                    |
| **22K** | 91.6% (916)    | $22 / 24 \approx 0.9167$ | ₹6,704 (applies discount) |
| **18K** | 75.0% (750)    | $18 / 24 = 0.7500$       | ₹5,486                    |
| **14K** | 58.3% (583)    | $14 / 24 \approx 0.5833$ | ₹4,280                    |

### Calculation Formula:

$$\text{Nominal Rate} = \text{24K Rate} \times \left(\frac{\text{Karat}}{24}\right)$$
APPIT allows managers to override these conversions with **custom branch-wise daily rates** to cover local market adjustments or safety spreads.

---

## 2. Retail Sale Billing Math

When checking out finished jewellery tags, the taxable value aggregates multiple cost components:

### 2.1. Basic Gold Value:

$$\text{Gold Value} = \text{Net Weight (g)} \times \text{Daily Karat Rate per gram}$$
_Note: Net Weight = Gross Weight - Stone Weight._

### 2.2. Making (Labor) Charges:

Making charges can be configured in three ways:

1. **Per Gram**: $\text{Charges} = \text{Gross Weight} \times \text{Labor Rate/g}$
2. **Fixed/Lump Sum**: Set directly per design/item (e.g. ₹18,500 for a bridal set).
3. **Percentage of Gold Value**: $\text{Charges} = \text{Gold Value} \times \text{Making \%}$

### 2.3. Wastage Charges:

$$\text{Wastage Value} = \text{Net Weight} \times \text{Wastage \%} \times \text{Daily Gold Rate}$$
_Example: If net gold is 60g, wastage is 5%, gold rate is ₹6,704/g: Wastage Value = $60 \times 0.05 \times 6,704 = \text{₹20,112}$._

### 2.4. Taxable Value & GST:

$$\text{Taxable Value} = \text{Gold Value} + \text{Making Charges} + \text{Wastage Value} + \text{Stone Value} - \text{Discount}$$
$$\text{GST (3\%)} = \text{Taxable Value} \times 0.03$$
$$\text{Grand Total} = \text{Taxable Value} + \text{GST} - \text{Adjustments (Old Gold / Advances)}$$

---

## 3. Karigar Production & Wastage Settlement

At the time of Job Work Settlement, the system reconciles metal issued to the Karigar against finished ornament weight, scrap returned, and allowed wastage limits:

### Formula variables:

- $W_{issue}$ = Weight of gold issued to Karigar
- $W_{finished}$ = Weight of finished ornament received
- $W_{scrap}$ = Weight of scrap returned by Karigar
- $P_{allow}$ = Allowed wastage percentage configured for the Karigar/Item

### Reconciliations:

1. **Actual Metal Consumption**:
   $$W_{actual\_loss} = W_{issue} - (W_{finished} + W_{scrap})$$
2. **Allowed Wastage Weight Limit**:
   $$W_{allowed\_loss} = W_{finished} \times \left(\frac{P_{allow}}{100}\right)$$
3. **Metal Variance**:
   $$W_{variance} = W_{actual\_loss} - W_{allowed\_loss}$$

### Ledger Settlement Consequence:

- If $W_{variance} \le 0$: Karigar is within wastage limits. Karigar account is settled; labor charges are credited to their accounts.
- If $W_{variance} > 0$ (Excess Loss): The excess gold weight ($W_{variance}$) is debited to the Karigar's Metal account. The Karigar must pay back the gold weight or be charged the cash equivalent based on the live daily rate.
  $$\text{Karigar Cash Debit} = W_{variance} \times \text{Daily Gold Rate}$$
