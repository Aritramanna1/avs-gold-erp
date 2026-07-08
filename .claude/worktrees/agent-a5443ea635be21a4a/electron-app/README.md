# MTJ ERP — Desktop (Electron)

Thin Electron shell around the online MTJ ERP web app. Same Supabase database
as the web version — no local data, no SQLite, no offline-only mode.

## Architecture

```
┌─────────────────────┐      HTTPS       ┌──────────────────────┐
│  MTJ ERP Desktop    │ ───────────────▶ │  Lovable-hosted ERP  │
│  (Electron shell)   │                  │  (TanStack Start)    │
└─────────────────────┘                  └──────────┬───────────┘
                                                    │
                                                    ▼
                                         ┌──────────────────────┐
                                         │  Supabase (Cloud)    │
                                         │  auth + tables + RLS │
                                         └──────────────────────┘
```

The renderer is a sandboxed Chromium window with `nodeIntegration: false` and
`contextIsolation: true`. No secrets are bundled with the desktop app — the
publishable Supabase key lives in the hosted web bundle, the service-role key
lives only on the server, and Electron never sees either.

## Install

```bash
cd electron-app
npm install
```

## Run locally (dev)

```bash
npm start
```

Override the URL (custom domain, staging, local preview) with an env var:

```bash
MTJ_ERP_URL=https://erp.maatara.example npm start
```

## Build Windows installer / portable

From Linux, macOS, or Windows (cross-compiles fine):

```bash
npm run package:win
```

Output: `release/MTJ ERP-win32-x64/MTJ ERP.exe`

Zip the folder and distribute. Shop staff double-click `MTJ ERP.exe` to run.

For a proper `.exe` installer (NSIS), wrap the packaged folder with
`electron-builder` on a Windows host; not needed for a single-shop pilot.

## Build Linux / macOS

```bash
npm run package:linux
npm run package:mac
```

## Icon

Drop a `icon.ico` (Windows) and `icon.png` (Linux/menu) in this folder before
packaging. Without them Electron uses its default icon.

## Troubleshooting

| Symptom                         | Fix                                                         |
| ------------------------------- | ----------------------------------------------------------- |
| Blank window                    | Check internet; verify `MTJ_ERP_URL` resolves in a browser. |
| "Connection lost" dialog        | Hosted ERP is down or DNS/firewall is blocking it.          |
| Login loops                     | Browser cookies cleared — sign in again.                    |
| Barcode scanner not registering | Click the input field first; wedge scanners need focus.     |
| Print dialog empty              | Use Ctrl+P from inside the ERP page, not the menu.          |
