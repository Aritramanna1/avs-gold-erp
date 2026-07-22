# Workshop ERP web deployment

The application is a Vite React single-page application. Build it with Node.js 20+ and publish the contents of `dist/` to the hosting provider's document root.

## Build

```bash
npm ci
npm run build
```

The build output is `dist/`. It must contain `index.html`, `.htaccess`, `assets/`, and the public static assets.

## Hostinger or Apache hosting

Upload the contents of `dist/` directly into the domain document root, usually `public_html/`. Do not upload the repository root, `src/`, or the Electron output.

Keep the generated `dist/.htaccess` file. It provides the SPA fallback so client-side routes resolve to `index.html`.

Use these permissions:

- directories: `755`
- files: `644`

Do not upload the old root-level Hostinger deny-list configuration; it blocks `index.html` and JavaScript files and causes a 403 response.

## Environment

Set the required `VITE_*` values in the hosting provider's build environment or in a local `.env` copied from `.env.example`. Never commit a populated `.env`, service-role key, password, token, or private key.

## Verification

After deployment, verify:

1. `/` loads `index.html`.
2. A direct application route loads successfully after refresh.
3. JavaScript and CSS files return HTTP 200.
4. The browser console contains no missing-asset errors.
5. The published bundle contains no service-role key or private credential.
