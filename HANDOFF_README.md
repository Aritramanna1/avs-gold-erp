# AVS ERP — Complete Handoff Package

**Prepared:** 2026-08-28  
**No git** — standalone folder for another developer.

## What is included (everything)

| Area | Location |
|------|----------|
| **Latest application source** | `src/`, `package.json`, `vite.config.ts`, etc. |
| **All documentation** | `docs/` (including `docs/MASTER/`), root `*.md` files |
| **Baseline reference docs** | `baseline-documentation/` (approved-docs, config, migrations-ref, QA, print refs) |
| **Supabase migrations** | `supabase/migrations/` |
| **Cloudflare workers** | `workers/storage-proxy/` |
| **Live shop production build** | `production-dist-shop/` (`index-CVsE73i6.js`, 801 files) |
| **Recovery zip** | `dist_go_20260826_190800.zip`, `index-CVsE73i6.js` (root copies) |
| **Scripts** | `scripts/` (build, deploy, QA) |
| **E2E / QA** | `e2e/`, `qa/` |
| **Public assets & config bundles** | `public/` |

## Recent development included

- Aurum multi-surface (marketing / ERP / portal)
- PrintEngine slips + QR → `/verify`
- Portal login pages + redirect fix
- Item masters, MTG shell, edition ladder
- Purity `/999`, default 995
- Triple-dist build scripts

## Mobile / APK

There are **no APK files** in this repo. Mobile is **responsive web** (`src/routes/mobile.*`). No Android/iOS/Capacitor project folders.

## Quick start

```bash
npm install
npm run dev
```

Preview exact live shop UI:

```bash
npm run preview:shop
```

## Rules

- **Do not deploy to `maatarajewellers.shop`** without owner approval (frozen on `index-CVsE73i6.js`).
- Copy `.env.example` → `.env.local` and add Supabase keys locally (not included).

## Live shop reference

- URL: https://maatarajewellers.shop
- Bundle: `index-CVsE73i6.js`
