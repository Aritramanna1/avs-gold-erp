# AVS ERP — Plan × Edition Entitlement Matrix

Additive commercial catalog for Platform Access. **Prices are never hardcoded** — amounts live in `platform_plans.price_minor` and are edited by Platform Owner.

## Commercial products (assignable)

| Code | Band | Business edition | Edition family | Seed `price_minor` |
|------|------|------------------|----------------|--------------------|
| `AVS_10K_RETAIL` | band_10k | retail | avs_standard | 0 (Owner sets) |
| `AVS_10K_MFG` | band_10k | manufacturing | avs_standard | 0 |
| `AVS_20K_RETAIL` | band_20k | retail | avs_standard | 0 |
| `AVS_20K_MFG` | band_20k | manufacturing | avs_standard | 0 |
| `AVS_30K_RETAIL` | band_30k | retail | avs_standard | 0 |
| `AVS_30K_MFG` | band_30k | manufacturing | avs_standard | 0 |
| `AVS_50K_FULL` | band_50k | full_erp | avs_standard | 0 |
| `AVS_MTG` | band_mtg | manufacturing | mtg | 0 |

## Feature matrix

Legend: **Y** = seeded enabled · **N** = seeded disabled · **OD** = OWNER DECISION (blank in product sheet — do not invent)

| Feature | 10K Retail | 10K Mfg | 20K Retail | 20K Mfg | 30K Retail | 30K Mfg | 50K Full | MTG |
|---------|------------|---------|------------|---------|------------|---------|----------|-----|
| client.web | Y | Y | Y | Y | Y | Y | Y | Y |
| billing | Y | Y | Y | Y | Y | Y | Y | Y |
| inventory | Y | Y | Y | Y | Y | Y | Y | Y |
| orders | Y | Y | Y | Y | Y | Y | Y | Y |
| catalog | Y | N | Y | Y | Y | Y | Y | N |
| barcode | Y | N | Y | Y | Y | Y | Y | N |
| gst | Y | N | Y | N | Y | Y | Y | N |
| manufacturing | N | Y | N | Y | Y | Y | Y | Y |
| job_work | N | Y | N | Y | Y | Y | Y | Y |
| bullion | N | Y | Y | Y | Y | Y | Y | Y |
| melt_account | N | Y | N | Y | N | Y | Y | Y |
| repairs | Y | Y | Y | Y | Y | Y | Y | Y |
| reports | Y | Y | Y | Y | Y | Y | Y | Y |
| analytics | N | N | N | N | Y | Y | Y | N |
| crm_communications | Y | Y | Y | Y | Y | Y | Y | Y |
| whatsapp | N | N | Y | Y | Y | Y | Y | Y |
| customer_portal | Y | N | Y | Y | Y | Y | Y | Y |
| karigar_portal | N | Y | N | Y | Y | Y | Y | Y |
| supplier_management | Y | Y | Y | Y | Y | Y | Y | N |
| attendance | N | N | N | Y | Y | Y | Y | Y |
| payroll / hr | OD | OD | OD | OD | OD | OD | Y* | OD |
| multi_branch | N | N | N | N | N | N | Y | N |
| hardware_integration | OD | OD | OD | OD | OD | OD | Y* | OD |
| export | N | N | N | N | Y | Y | Y | N |
| edition.mtg | N | N | N | N | N | N | N | Y |
| edition.retail | Y | N | Y | N | Y | N | N | N |
| edition.manufacturing | N | Y | N | Y | N | Y | N | Y |
| edition.full_erp | N | N | N | N | N | N | Y | N |

\* Full ERP seed includes core modules present in inventory; OD cells remain Owner-controlled via Platform Licensing toggles (`organization_features.source=manual`).

## Enforcement chain

```
Platform Owner assign plan
  → apply_plan_entitlements (plan_features → organization_features)
  → get_my_tenant_entitlements (tenant boot)
  → UI nav / MTG tiles / module_states sync
  → RouteAuthBoundary deep-link deny
  → RPC require_organization_feature / tenant_module_write_allowed
  → RLS policies on gated write tables
```

UI hide alone is **not** security. Denied modules must fail at Route → Action → RPC → RLS.

## MTG UI isolation

- `edition_family = mtg` (or `edition.mtg` feature) → `MtgShell` + `/mtg` home.
- Non-MTG firms keep `AppShell` / standard AVS navigation unchanged.

## Source of truth files

- Migration: `supabase/migrations/20260827020000_avs_plan_edition_catalog_mtg.sql`
- Enforcement expand: `supabase/migrations/20260827021000_entitlement_write_path_parity.sql`
- FE: `src/lib/tenant-entitlements.ts`, `src/lib/entitlement-route-map.ts`
