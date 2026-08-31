# Hostinger + Performance Deployment Checklist

Production architecture: **Hostinger Business/Web App** (static SPA + CDN) + **Supabase** (Auth/Postgres/RLS/Storage/RPC).

## Hostinger hPanel verification

| Item | Setting |
|------|---------|
| Build output | Upload `dist/` contents to `public_html` |
| SPA routing | `public/.htaccess` included (RewriteRule → `index.html`) |
| HTML cache | `index.html` → `Cache-Control: no-store` |
| Asset cache | Fingerprinted `.js/.css/.woff2` → `max-age=31536000, immutable` |
| WASM | `AddType application/wasm .wasm` |
| SSL | Force HTTPS via Hostinger managed SSL |
| CDN | Enable Hostinger CDN for static assets |
| Node | Not required for production SPA (build locally/CI, deploy static) |
| Env vars | Set at **build time** in CI: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

## GitHub / Jenkins deploy

- `npm run typecheck && npm run build`
- Deploy `dist/` only — never commit `.env` with secrets
- `scripts/perf-baseline.mjs` — record bundle sizes per release

## Runtime performance (client)

- Supabase Auth: `localStorage` persisted session + `autoRefreshToken`
- App shell renders before full data pull; background `pullBackground()` hydrates modules
- Service worker (`public/sw.js`): static shell only — **no API/business data cache**
- Dev metrics: `window` console `[perf]` lines when `import.meta.env.DEV`

## Security

- No custom login cookies; no service-role key in browser
- Sensitive Supabase responses are never CDN-cached
- Settings → Security Center → Revoke other sessions / Sign out everywhere
