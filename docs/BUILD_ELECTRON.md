# MTJ ERP — Electron Desktop Build

The Electron shell is a thin browser window that loads the deployed MTJ ERP
web URL. It bundles NO database, NO secret keys, and NO local copy of the
data. Web and desktop share the SAME online Supabase database
(`kjfjsfhftytezsjyegmb`).

## 1. Point the shell at your deployed web URL

Two options:

a) Env var at launch / package time:

```
set MTJ_ERP_URL=https://erp.maatara.example
```

b) Edit `electron-app/main.cjs` and replace the `DEFAULT_URL` fallback with
your deployed URL (the `process.env.MTJ_ERP_URL` override still works).

## 2. Install dependencies (one-time)

```
cd electron-app
npm install
```

This downloads Electron + `@electron/packager` (~150 MB).

## 3. Build per platform

```
cd electron-app

# Windows .exe folder (zip the output to ship)
npm run package:win

# macOS app bundle
npm run package:mac

# Linux
npm run package:linux
```

Output: `electron-app/release/MTJ ERP-<platform>-x64/`.

Zip for distribution:

```
cd electron-app/release
zip -r ../../mtj-erp-desktop-win.zip "MTJ ERP-win32-x64"
```

## 4. Verify no secrets leaked

```
rg SUPABASE_SERVICE_ROLE_KEY electron-app/release/   # must return nothing
rg sb_secret_ electron-app/release/                  # must return nothing
```

The publishable key is fine to ship — it is, by design, public and RLS
controls every access.

## 5. Source zip (for backup / handover)

```
cd electron-app
zip -r ../mtj-erp-desktop-source.zip . -x "node_modules/*" -x "release/*"
```

## Notes

- Auto-update is intentionally NOT enabled. To update the desktop client,
  re-deploy the web app — the shell just reloads the new HTML on launch.
- Keyboard-wedge barcode scanners work without configuration.
- Printing works via the OS print dialog (Ctrl/Cmd + P inside the ERP).
