# APPIT vs. Ornexa — Gap Analysis Matrix
**Date:** 2026-08-12  

This matrix details the feature parity between the **APPIT Jewel ERP** trial system and the **Ornexa (AVS Gold ERP)** platform.

---

## 1. Feature Comparison Matrix

| Functional Area | APPIT Jewel ERP Feature | Ornexa Status | Verdict / Actions Needed |
|-----------------|-------------------------|---------------|--------------------------|
| **POS Checkout** | Barcode scan, custom items, live rate fetch | **ORNEXA EXISTS** | Fully implemented in POS billing screens. |
| **Metal Inventory**| Vault raw gold/silver, branch stock registers | **ORNEXA EXISTS** | Implemented inside `ledger-store.ts` and vaults. |
| **Calculations** | Flat making charges, per-gram labor, wastage value | **ORNEXA BETTER** | Ornexa supports dual weight metrics (Gross vs Net vs Fine) and multiple labor basis configurations. |
| **Karigar Ledger** | Single currency gold ledger tracking | **ORNEXA BETTER** | Ornexa implements **Dual-Currency Ledgers** tracking cash and gold side-by-side. |
| **Credit Limits** | Warning only on outstanding metal | **ORNEXA BETTER** | Ornexa blocks material issues that exceed configured Karigar credit limits. |
| **Branch Rates** | Separate selling rate per branch | **ORNEXA PARTIAL** | Ornexa supports daily metal rate master, but needs a multi-branch rate-cut configuration matrix. |
| **Worker Portal** | Administrative view only (no self-service) | **ORNEXA BETTER** | Ornexa implements a **dedicated Karigar OTP-login portal** for workers to track jobs. |
| **Refinery Work** | Scrap melt issues and returns | **ORNEXA PARTIAL** | Metal transfer is supported, but refining batch tracking screens are missing. |
| **AI Intelligence**| Chatbot querying dashboard stats | **ORNEXA PARTIAL** | Ornexa features the Local Assistant Brain, but needs custom integration with the main dashboard. |

---

## 2. Identified Gaps (Ornexa Action Items)

1. **Multi-Branch Daily Rates**:
   - **Gap**: Ornexa currently sets daily gold rates globally inside `settings-store.ts`.
   - **Resolution**: Expand the daily rates store to support branch-specific overrides, mimicking APPIT's branch-wise rates configuration.
2. **Old Gold Melt Appraisal Rules**:
   - **Gap**: Ornexa has basic old gold intake forms, but does not feature automatic appraisal markdowns or melt-loss adjustments.
   - **Resolution**: Integrate the old gold valuation formulas (melting loss subtraction + touch % multiplication + live rate appraiser markdown) inside the invoice calculations.
3. **Refinement Batches**:
   - **Gap**: Raw scrap refining transfers are recorded as generic ledger offsets.
   - **Resolution**: Create a dedicated screen for Refinery Batches tracking outward scrap and refined gold return.
