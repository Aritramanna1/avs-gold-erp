# FINAL LOCALIZATION REPORT — V1 Freeze

**Date:** 2026-08-16  
**V1 languages:** English, Hindi, Marathi, Bengali

---

## Automated audit

| Check | Result |
|-------|--------|
| `qa/localization/i18n-audit.test.ts` | **PASS** — key parity structure |
| `npm run i18n:coverage` | See below |

## Coverage scan (`check-i18n-coverage.mjs`)

| Locale | Coverage | Missing keys |
|--------|----------|--------------|
| English (en) | baseline | — |
| Hindi (hi) | ~74% | 346 |
| Marathi (mr) | ~39% | 814 |
| Bengali (bn) | ~39% | 814 |

---

## Status interpretation

| Area | Status |
|------|--------|
| EN complete for core ERP flows | **VERIFIED_ON_STAGING** |
| HI core navigation + auth + errors | **READY_FOR_QA** |
| MR/BN full ERP parity | **READY_FOR_QA** with known gaps — non-critical paths may fall back to EN |
| Tour strings (4 langs) | **READY_FOR_QA** — dedicated `tour.ts` per locale |
| Public marketing site | **READY_FOR_QA** — primarily EN; CMS content PO-editable |
| Terminology aliases (tenant override) | **READY_FOR_QA** — per-tenant language aliases |

---

## QA guidance

- Test primary flows in **HI** (login, dashboard, party, gold issue/receive, billing)  
- Spot-check **MR** and **BN** on login + dashboard + one manufacturing screen  
- Report random English in translated workflows as **P2** unless in deferred module  

**Post-V1:** complete MR/BN key fill for 100% parity.
