# AVS ERP Product Edition & Pricing — Planning Reference

**Source:** `AVS_ERP_PRODUCT_EDITION_PLANNING.docx` (owner, 2026-08-27)  
**Status:** **PLANNING ONLY** — not approved for code/entitlement implementation  
**Imported:** 2026-08-30 (agent session)

---

## Hard rules (from owner document)

1. **Do NOT** change ERP code, database, migrations, UI, or permissions based on this document alone.
2. **Do NOT** delete features or create subscription locks until owners approve a **later implementation plan**.
3. **Do NOT** invent features that do not exist in the product.
4. **Do NOT** treat agent recommendations as final decisions — mark **OWNER DECISION** where unsure.
5. Simplified edition ≠ different accounting law. Prefer simpler UI / fewer modules / fewer options.
6. Underlying platform stays **one data plane** (Supabase, `gold_ledger` + universal ledger).

---

## Commercial shapes under evaluation

| Working label | Price (working) | Hypothesis |
|---------------|-----------------|------------|
| **Edition 1** | ₹10,000 / year | SIMPLE / FAST / ESSENTIAL — still genuinely useful |
| **Edition 2** | ₹30,000 / year | MORE CONTROL / AUTOMATION / BUSINESS FEATURES |
| **Edition 3** | ₹50,000 / year | COMPLETE ERP — manufacturing depth, portals, advanced accounting/CRM/AI |

**Not separate editions in this exercise:** ₹20K, ₹40K.

**Existing Ornexa ladder** (`docs/SAAS_ENTITLEMENT_AND_BILLING.md`): BASIC / GROWTH / PROFESSIONAL / SCALE / MAX — **reference only**. Owners must decide convergence with ₹10K / ₹30K / ₹50K.

---

## Implementation impact for engineering (current master plan)

| Action | Allowed now? |
|--------|----------------|
| Fix broken chains (billing, print, data-loader, etc.) | **Yes** — master A–Z plan |
| Wire real entitlements for **already-approved** features in `saas-entitlements.ts` | **Yes** — where spec exists |
| Hide/delete modules per Edition 1 matrix | **No** — until owner approves implementation plan |
| New subscription locks from this DOCX | **No** |
| Document edition recommendations in gap register | **Yes** |

---

## Edition 1 agent recommendations (INCLUDE unless OWNER marked)

Core ops: sales billing, estimates, purchases, stock register/entry, rates, purity masters, people, treasury vouchers, expenses, core reports, print/export, dashboard, transaction hub, settings (brand/GST), users/RBAC, license, help, notifications.

**Typically EXCLUDE from E1 (agent rec):** manufacturing depth, portals, CRM, advanced recon, customization hub, UTE, CEO dashboard, comm automation, AI assistant, refinery, ITC-04, multi-branch, attendance/payroll.

**Typically ADD-ON:** WhatsApp, email, SMS, Tally export, hardware devices, communication analytics.

**OWNER DECISION** rows left blank in source — many features marked OWNER for E1 include/exclude.

---

## Retail vs manufacturing (classification)

- **Constitution:** manufacturing ERP; retail-only must not be forced through full karigar/WIP; manufacturing must not lose depth because retail SKU is simpler.
- Use **module flags / business.mode entitlements** (when approved) — not separate databases.

---

## Relation to MTG

MTG remains a **separate isolated layer** per master plan (`/mtg`, Manubook toggle). This edition document does **not** replace MTG requirements checklist. Do not merge MTG rules into generic edition matrix without owner sign-off.

---

## Owner approval block (from source)

Prepared by / Reviewed by / Owner decision: APPROVED AS PLANNING BASE | REVISE | REJECT — **pending handwritten completion in DOCX**.

---

## Next step (owner)

1. Print feature matrix (sections 4–5 of DOCX).  
2. Mark REQUIRED / NOT REQUIRED / edition / add-on per feature.  
3. Approve separate **entitlement implementation plan** before agents gate UI or RLS by ₹10K/₹30K/₹50K.
