# APPIT Jewel ERP — Configuration Capability Matrix

**Date:** 2026-08-12

This document outlines the business settings that can be customized in the system without code changes.

---

## 1. Core Configurable Settings

| Setting Area                     | Configurations Available                                                                                               | Scope                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Company Profile**              | Company name, logo, address, registered GSTIN/PAN details, local currency symbols.                                     | Global                 |
| **Branch Master**                | Branch Name, Branch code (e.g. `JUB` for Jubilee Hills), address, active employee list, branch rate sheets.            | Branch-specific        |
| **Auto-Numbering Prefix**        | Configuration of transaction voucher prefixes and serial ranges (e.g. `INV-{YYYY}-{SERIAL}`, `JC-{YYYY}-{SERIAL}`).    | Global                 |
| **Workflow Approval Thresholds** | Financial limits for voucher validation. If a voucher exceeds the limit, it must be approved by a specific role.       | Role-specific / Global |
| **Making Charge Pricing Master** | Custom configurations for default labor basis (fixed, per gram, or item percentage) mapped against product categories. | Global                 |
| **Daily Metal Rates Settings**   | Automatic live feed fetch switch, manual rate override permissions, branch variance margins.                           | Branch/Global          |
| **QC Checklist Master**          | Custom parameters/steps for workshop QC inspections (e.g. XRF check, stone seating, weight deviation tolerance).       | Global                 |

---

## 2. Advanced Workflow Customizations

### 2.1. Approval Flows

- **Limit Check**: Voucher submissions (Sales orders, goods receipt invoices, cash payments) checking against user approval limits.
- **Approval Roles**: Tiers can be configured where:
  - If payment amount > ₹25,000 $\rightarrow$ Sales Manager approval required.
  - If payment amount > ₹2,50,000 $\rightarrow$ Branch Manager/Owner approval required.

### 2.2. Metal Alert Rules

- **Reorder Thresholds**: Configure notification levels when vaults of specific metals (e.g. 22K raw gold) fall below safety thresholds (e.g. 500g).
- **Karigar Limits**: Maximum fine gold weight allowable on a Karigar's bench (e.g. 200g). If exceeded, material issues are blocked until previous settlements are processed.
