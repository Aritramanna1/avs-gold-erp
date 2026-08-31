# APPIT Jewel ERP — Business Workflow Map

**Date:** 2026-08-12

This document maps the flow of physical gold and money through the systems during core transactions.

---

## 1. Manufacturing Lifecycle & Karigar Gold Flow

The lifecycle of workshop production tracks raw metal to finished, tagged jewellery:

```mermaid
sequenceDiagram
    participant Vault as Main Vault
    participant Karigar as Karigar Ledger
    participant Bench as Workshop Bench
    participant QC as QC / Hallmark
    participant Inv as Tagged Inventory

    Vault->>Karigar: Issue raw gold shot/alloy (e.g. 100g at 22K)
    Note over Karigar: Karigar account debited +100g 22K gold
    Karigar->>Bench: Design, melt, shape, polish
    Note over Bench: Karigar bench holds custody
    Bench->>QC: Submit finished ornament (e.g., 90g) + Scrap (e.g. 7g)
    QC->>QC: Check purity (XRF) and weight
    alt QC Pass
        QC->>Inv: HUID stamped and tag printed (+90g)
        QC->>Karigar: Credit Karigar account: Finished (90g) + Scrap (7g)
        Note over Karigar: Balance remaining = 3g (Wastage)
        Karigar->>Vault: Settle allowed wastage vs actual wastage
    else QC Fail
        QC->>Bench: Send back for remake/rework
    end
```

### Metal Balancing Rules:

- **Karigar Ledger**: Maintained in pure gold equivalent (or specific Karat weights).
- **Metal Settlement**: If actual wastage exceed allowable limit (e.g. 2%), Karigar is debited with the cash equivalent of the excess gold weight, or must pay back in pure gold.

---

## 2. Retail Sale & Financial Accounting Flow

Traces how customer payments, live gold rates, and finished inventory reconcile during check-out:

```mermaid
flowchart TD
    Scan[Scan Barcode Tag] --> Fetch[Fetch Item Details: Gross/Net Wt, Stones]
    Fetch --> Rate[Get live daily gold rate]
    Rate --> Calculate[Compute Gold Value + Stones + Making Charges]
    Calculate --> Tax[Add 3% GST]
    Tax --> Pay[Select Payment Mode: Cash, Card, UPI, Advance]
    Pay --> Print[Generate Invoice & Print HUID Barcode]
    Print --> Ledger[Double-Entry Posting]

    subgraph Ledger Posting
        Dr_Cash[Debit Cash/Bank Ledger]
        Cr_Sales[Credit Sales Revenue]
        Cr_GST[Credit GST Liability Ledger]
        Dr_Cost[Debit Cost of Goods Sold]
        Cr_Stock[Credit Asset Inventory]
    end

    Pay --> Dr_Cash
    Calculate --> Cr_Sales
    Tax --> Cr_GST
    Scan --> Cr_Stock
```

---

## 3. Old Gold Exchange & Refinery Flow

Tracks old gold ornaments purchased from retail customers, melted, refined, and rolled back into the raw vault:

```mermaid
flowchart LR
    Customer[Customer brings old jewellery] --> Appraisal[Melt test & Purity touch check]
    Appraisal --> Settle_Cust[Credit Customer Ledger / Settle against New Purchase]
    Appraisal --> Melt_Vault[Post Old Gold to Melting Vault]
    Melt_Vault --> Refinery[Send batch to external refinery]
    Refinery --> Recovery[Receive refined 24K pure bar]
    Recovery --> Settle_Refinery[Settle refinery melting loss & charges]
    Settle_Refinery --> Raw_Vault[Credit Raw Gold 24K Vault]
```

### Material Accounting:

1. **Old Gold Intake**: Added as `Old Gold Scrap` asset at cost price (live rate - appraiser discount).
2. **Refinery Shipment**: Transferred to WIP - Refinery (reduces Scrap inventory, debits Refinery asset account).
3. **Refinery Return**: Credits Refinery asset account with refined weight, debits Main Vault (24K Gold Bar), records refining charges as expense, melting loss as scrap loss.
