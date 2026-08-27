# MTJ Phase C/D verification — Offline reference → AVS engines

Foundation: `8dc1c43` / live `index-CVsE73i6.js`  
Calc: production `fineGoldMg` remains `gross × purity / 999` (unchanged).

## Phase C — Masters / mfg / print

| Offline reference | AVS surface (reuse) | Status |
|-------------------|---------------------|--------|
| Item / Item_Type / design | Catalog `itemType` + stock item fields (`item_group` in schema) | Wired in existing catalog/stock — no second master DB |
| Minimum stock | Stock location + inventory alerts (existing) | Preserve; no parallel stock engine |
| Issue / Receive (Dhadi_jn) | `/workshop/gold-book` ISSUE/RECEIVE tiles + material book | MTG deep-links `?entry=given\|return` |
| Melt / Polish | `/melt`, `/workshop/polishing` | MTG tiles; existing engines |
| Karigar / Jangad | People karigars + gold book + outside work | Existing |
| Settlement | `/settlement` | Existing |
| Print (Crystal) | Universal Print Engine `printDocument` / PrintToolbar / PDF separate | Do not fork Crystal |

Material payable: config via `maTaraWorkshopPolicy.materialPayableByCategoryKey` (default PAYABLE).

## Phase D — Preserve-path

| Area | Evidence | Status |
|------|----------|--------|
| CRM / people | Existing people + communications modules; entitlement-gated | Preserve |
| QR | Existing public verification routes (no rewrite this wave) | Preserve |
| AI | Existing assistant; does not call fineGoldMg as authority | Preserve |
| Portals | `get_my_portal_context` feature gate (live migration) | Preserve |
| Platform Access | FE route deny + live RLS/RPC | Restored on foundation |
| Perf | No feature stripping | No Lighthouse fake wins |

## Config bundles

| Bundle | Path |
|--------|------|
| MTJ Default | `/config-bundles/mtj-default.v1.json` |
| Retail | `/config-bundles/retail-oriented.v1.json` |
| Manufacturing | `/config-bundles/manufacturing-oriented.v1.json` |

Import/Export: Customization Hub → Advanced. MTJ firms auto-merge Default once (`ensureMtjDefaultBundleAppliedOnce`).

## Deploy gate

Hostinger remains **`index-CVsE73i6.js`** until Owner explicitly approves a new deploy.
