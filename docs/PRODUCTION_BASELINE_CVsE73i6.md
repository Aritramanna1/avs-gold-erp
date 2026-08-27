# Production baseline — index-CVsE73i6.js (FROZEN)

**Status:** Immutable implementation baseline. Do not overwrite. Do not mix with other versions.

## Equation

```
BASELINE
  = index-CVsE73i6.js
  = git 8dc1c438214a5e3192e15dc95b7708de24ca6baf
  = refs: production-baseline-cvse73i6 / backup/production-baseline-cvse73i6
  = dist_go_20260826_190800.zip
```

Live at freeze: `https://maatarajewellers.shop`

## Hashes (verified at freeze)

| Artifact | SHA-256 |
|----------|---------|
| `index-CVsE73i6.js` | `DDE3DCBECA50D0EE30882C0B98B25D8E95E8B1429319EFBD31720C61518D08D8` |
| `dist_go_20260826_190800.zip` | `D221ECCB7DAFB3309209094632BBD143EF28A747159693DC8F9B0E51ECF018AA` |

## Roles

| Role | Location |
|------|----------|
| BASELINE | `AVS_PRODUCTION_BASELINE_CVsE73i6/` (frozen) |
| DEVELOPMENT | `main` |
| IMPLEMENTATION | based **only** on this baseline |
| BUILD | from `main` |
| DEPLOY | resulting build from `main` |

## Isolated freeze package

In-repo (local + partial git track): `AVS_PRODUCTION_BASELINE_CVsE73i6/`

Contains:

- exact `index-CVsE73i6.js` + recovery zip + dist extract
- corresponding source (`git archive` of `8dc1c43`)
- approved documentation
- configuration snapshots
- migration references
- print/customization references
- MTJ/Offline ERP reference documentation
- QA evidence snapshot
- `BASELINE_MANIFEST.json` / `FROZEN.lock`

## Immutable backup (host, outside working tree)

- Folder: `C:\avs-test-install\AVS_PRODUCTION_BASELINE_CVsE73i6_IMMUTABLE_BACKUP`
- Zip: `C:\avs-test-install\AVS_PRODUCTION_BASELINE_CVsE73i6_IMMUTABLE_BACKUP_20260827.zip`

Never delete. Never overwrite. Restore from backup only if the freeze folder is damaged.

## Approved docs on `main`

- Full baseline docs mirror: `docs/baseline-cvse73i6/`
- Product MASTER copies: `docs/MASTER/`
- This file: `docs/PRODUCTION_BASELINE_CVsE73i6.md`

## Verification gate (before feature work)

1. `git merge-base --is-ancestor 8dc1c43 HEAD` → must succeed on `main`
2. Do not implement from any other branch tip or older/newer experimental build
3. Inspect other branches separately; do not merge them into the freeze folder
4. Keep `dist_go_20260826_190800.zip` forever

## Hard locks

- **fineGoldMg:** `round(grossMg × purityPermille / 999)`. Default selected purity **995**. Never change divisor to 995.
- Hide ≠ delete. No second ERP/shell/WebView/parallel gold/ULE/print engines.
- Deploy only after Owner approve + `[release-approved]`.
- Offline WinForms (`03-offline-winforms-erp`) = behaviour reference only.
