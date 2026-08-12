# Ornexa Requirement Updates from APPIT Research
**Date:** 2026-08-12  

Based on the functional reverse-audit of **Appitsoft Jewel ERP**, this document proposes specific requirement updates for **Ornexa (AVS Gold ERP)**.

---

## Proposed Requirement Updates

### 1. Multi-Branch Daily Metal Rates Override
* **Requirement**: Extend the daily rates configuration to allow managers to specify different gold/silver rates per branch (e.g. Hyderabad vs. Jubilee Hills).
* **Benefit**: Allows branches to operate on regional rate variations and manage localized spreads.
* **Proposed Implementation**:
  - Add a `branchRates` field inside `settings-store.ts` mapping:
    $$\text{branchId} \rightarrow \text{metalType} \rightarrow \text{ratePaise}$$
  - Update the billing system to fetch rates from `branchRates[currentBranch]` before falling back to the global rate.

### 2. Old Gold Melt Appraisal Calculator
* **Requirement**: Add appraisal valuation rules on the Old Gold Purchase intake screen.
* **Benefit**: Safeguards the business against appraiser valuation errors and automates dirt/loss deductions.
* **Proposed Implementation**:
  - Add input fields for: **Dirt/Melting Loss (g)** and **Appraised Touch (%)**.
  - Formula to compute Net Pure Weight:
    $$\text{Net Pure Wt} = (\text{Gross Wt} - \text{Melting Loss}) \times \text{Appraised Touch \%}$$
  - Deduct configured buying markdown percentage (e.g. 1.5% off live 24K rate) to derive total valuation:
    $$\text{Total Valuation} = \text{Net Pure Wt} \times (\text{Live 24K Gold Rate} \times (1 - \text{Markdown \%}))$$

### 3. Refinery Batch Tracking
* **Requirement**: Create a new workflow submodule under **Inventory** to track raw scrap shipments to refineries and return of 24K pure bars.
* **Benefit**: Replaces generic ledger manual entries with strict refinery batch custody tracking.
* **Proposed Implementation**:
  - Screen tracking refinery batches with: **Batch No**, **Shipment Date**, **Gross Scrap Weight**, **Assayed Pure gold weight expected**, **Refined weight returned**, **Refining charges (cash)**, **Melting loss weight**.
  - Reconcile actual return against expected return, posting differences to a scrap loss ledger.
