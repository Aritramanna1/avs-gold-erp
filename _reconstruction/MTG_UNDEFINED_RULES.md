# MTG undefined rules register

**Status:** BLOCKED — do not implement NN202000 / Meena business logic without owner spec  
**Date:** 2026-08-30

## Isolation (implemented)

| Item | Status | Evidence |
|------|--------|----------|
| `/mtg` route gated | WORKS | `src/routes/mtg.tsx` — `hasOrganizationFeature("business.mtg_shell")` |
| Manubook OFF by default | WORKS | `firm.manubookEnabled === true` required for Manubook nav link |
| Gold + cash separate UI copy | PARTIAL | MTG shell header only; not separate ledger rules |
| Normal AVS ERP unaffected | WORKS | Redirect to `/app` without entitlement |

## Undefined (OWNER BLOCKED)

- Meena book calculation rules (NN202000)
- MTG-specific fine/purity defaults vs tenant config
- MTG karigar settlement vs standard worker gold book
- MTG document numbering / print layouts
- MTG portal surfaces (if any)

## Agent rule

Do **not** globalize MTG rules into `gold.ts`, billing, or vault. Document gaps here; implement only after authoritative spec in `docs/MASTER/`.
