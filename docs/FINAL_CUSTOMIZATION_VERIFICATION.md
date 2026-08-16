# FINAL CUSTOMIZATION VERIFICATION — Ornexa V1

**Date:** 2026-08-16  
**Master:** [UNIVERSAL_CUSTOMIZATION_MASTER.md](./UNIVERSAL_CUSTOMIZATION_MASTER.md)

---

## Runtime consumption matrix

| Category | Designer / settings UI | Runtime consumer | Status |
|----------|------------------------|------------------|--------|
| Terminology / aliases | Settings + `BusinessLanguageAliases` | assistant, labels, i18n resolver | **READY_FOR_QA** |
| Dropdowns / masters | CustomizationHub | forms, dropdown_masters | **READY_FOR_QA** |
| Custom fields / forms | CustomEntitiesDesigner | declarative-rules-runtime | **READY_FOR_QA** |
| Books / ledgers | CustomBooksDesigner | ledger routes | **READY_FOR_QA** |
| Calculations / formulas | formula engine config | billing, payroll, wastage | **READY_FOR_QA** |
| Rules / approvals | CustomRuleEngineDesigner | receive-work, workflows | **READY_FOR_QA** |
| Transactions engine | UniversalTransactionEngineDesigner | transaction-hub | **READY_FOR_QA** |
| Documents / print | DocumentTemplateDesigner, PrintProfileDesigner | print engine | **READY_FOR_QA** |
| Manufacturing processes | customization hub | workshop modules | **READY_FOR_QA** |
| Portal presentation | portal settings | portal shells | **READY_FOR_QA** |
| Notification rules | comm preferences | channel-router | **READY_FOR_QA** |

---

## Settings vs Customization separation

| SETTINGS (`/settings`) | CUSTOMIZATION (`/control/customization`) |
|------------------------|------------------------------------------|
| Account, firm, users, branches | Terminology, masters, forms |
| Sessions / security | Books, calculations, workflows |
| Communications connection status | Documents, print profiles, portals |
| Hardware, backup, subscription | Deep links via `CustomizationDeepLink` |

**Status:** **READY_FOR_QA** — no duplicate authoritative config for same behavior.

---

## QA test (mandatory)

1. Change a terminology alias → verify label updates in ERP module without reload bug  
2. Change wastage rule → new receive uses new %  
3. Change print profile → PDF reflects change  
4. Disable a dropdown option → form no longer offers it  

Saving without consumption = **FAILED** (none known open for V1 scope).
