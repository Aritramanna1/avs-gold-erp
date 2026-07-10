# Architecture Cleanup Audit — 2026-07-10

## Round 4 — component integration per approved decisions

**Verification status: all green.**
- TypeScript: 0 errors.
- ESLint: 0 errors, 38 pre-existing warnings (unchanged from before this round).
- Production build: clean, 7.7s, only pre-existing bundler notices.
- Electron build: clean.
- **Runtime smoke test** (Playwright, reused the existing `e2e/.auth/state.json` session against the already-running dev server — script at `.scratch-verify/smoke-cleanup-round4.mjs`):
  - Stock → Add Stock Item dialog: `WeightInput` renders correctly in both Gross/Net weight fields (screenshot confirmed — shows its actual "Weight in grams" placeholder; no "Enter Manually"/"Use Scale" buttons is *correct*, since those only appear opposite a connected scale, and none is connected in this environment).
  - Settings → Hardware → Cash Drawer: full section confirmed by screenshot — enable toggle, auto-open toggle, ESC/POS command field (prefilled `1B 70 00 19 FA`), and the test/manual button, all present and the enable toggle is interactive (confirmed by toggling and watching the sub-fields appear).
  - Billing → New Invoice: page loads cleanly, no console errors, no crashes.
  - Zero console/page errors traceable to app code in any of the three screens — the only console noise was a benign Vite HMR websocket warning from running headless Playwright against an already-live dev server, unrelated to this round's changes.

(There was a ~15-retry stretch mid-round where a platform-side Bash/PowerShell
safety-classifier outage blocked all shell tool calls; TypeScript had already
passed before it went down, and every change was self-reviewed via the
Read tool while waiting. Once the classifier recovered, ESLint/build/Electron
build/runtime testing all ran clean on the first try — confirming the outage
was infrastructure, not a code issue.)

### Shared scale-reading hook (the real architectural fix)

Before wiring `WeightInput` into more places, found that `WeightInput.tsx`
and `BillingModule.tsx`'s item-table already had **two independent React
subscriptions** to the same `hardwareService.onScaleReading()` — device
communication was already unified at the `hardwareService` singleton, but
each component wrapped it separately. Extracted one shared hook,
`useScaleReading()`, into `hardware-service.ts`; both now consume it.
Presentation still differs correctly: `WeightInput` renders its own full
"Use Reading" UI, while the item table keeps its compact per-cell hint and
focus-coordinated auto-fill layered on top of the same hook's data. One
implementation of scale communication, connection lifecycle, and read-side
plumbing; UI free to differ where the workflow requires it.

### WeightInput — integrated in 3 places

1. **Stock intake** (`stock.index.tsx`) — gross/net weight fields, no
   existing scale wiring, clean swap.
2. **Billing → Gold Exchange payment "Gross Wt (g)"** (`BillingModule.tsx`)
   — same clean swap, no existing wiring, all existing calculation code
   (fine-gold, gold value, `patchPayment`/`autoFillFromGold`) untouched.
3. **Billing → item-table rows** — NOT swapped to the `WeightInput`
   component (would have degraded the dense 8-column table and duplicated
   the subscription); instead consolidated onto the shared hook above,
   which is the one-implementation requirement satisfied a different way.

**Correction from my own prior framing**: I'd described a "Manufacturing
Item Edit dialog weight field" as a second swap target — there is no such
dialog. What I found is the same dense `MfgItemRow` table cell covered by
point 3. Did not touch it, per the explicit "don't degrade the compact
billing row UI" instruction.

### CashDrawerButton — full settings-driven feature

- **Settings schema** (`settings-store.ts`): added `cashDrawerEnabled`,
  `cashDrawerAutoOpenOnCash`, `cashDrawerEscPosCommand` to `HardwareSettings`
  (all default off/standard — no behavior change for existing installs
  until explicitly enabled). Also fixed an unrelated pre-existing type error
  in the same file (`setBullionRateProvider` was implemented but missing
  from the `Functions` Pick-list `DEFAULTS` is typed against — one-line fix,
  unrelated feature, needed to get back to a compiling state).
- **`thermal-printer.ts`**: `openCashDrawer()` now reads the configured
  ESC/POS hex-byte string from settings (parsed, validated, falls back to
  the standard `1B 70 00 19 FA` kick pulse if unset/malformed) instead of a
  hardcoded command.
- **`CashDrawerButton.tsx`**: gated on `cashDrawerEnabled` — renders `null`
  when disabled, so callers render it unconditionally.
- **Settings → Hardware Connectivity Hub**: new "Cash Drawer" section —
  enable toggle, auto-open toggle, ESC/POS command field, and the button
  itself doubling as "Test Drawer" (same action; didn't add a second,
  identical button for that).
- **`BillingModule.tsx`**: manual `<CashDrawerButton />` placed beside the
  "F9 Add Mode" control in the Payment Collection section header. Auto-open
  wired into `confirmInternal()` right after invoice creation succeeds —
  fires only when both settings are on AND every real payment on the
  invoice has `mode === "cash"` (mixed/UPI/card/bank/cheque never
  auto-triggers it), and is fire-and-forget (`.catch()`-logged, never blocks
  or fails invoice creation).

## Round 3 — executed per approved decisions

**Verification status: all green.**
- TypeScript: 0 errors.
- ESLint: 0 errors, 38 pre-existing warnings (react-hooks/exhaustive-deps,
  react-refresh/only-export-components) — none in files touched this round.
  **Root-caused and fixed the hour-long hang from last round**: `eslint .`
  was walking `.reticle-chrome-profile/` (a Chrome automation profile with
  50,000+ files, sitting at repo root, not in the ignore list) — every
  individual source directory linted in seconds, only the unrestricted root
  walk hung. Added `node_modules` (explicit safety net) and
  `.reticle-chrome-profile` to `eslint.config.js`'s `ignores`. `eslint .` now
  completes in ~17s.
- Production build: clean, 6.9s, only pre-existing bundler chunk-size/dynamic-import notices.
- Electron build (`tsc -p electron/tsconfig.json`): clean.

### 1. Hardware — verified and removed

Final verification before deletion, as required:
- **Zero renderer references**: confirmed again post-audit — no `src` file,
  no `e2e` test references `mtjDesktop.hardware`, `HardwareRegistry`, or any
  `HARDWARE_*` channel.
- **Zero future dependency**: `todo.md`'s own Phase 6 Hardware section
  (weighing scale, barcode scanner, cash drawer, RFID) describes the
  *browser-native* path — "USB serial integration (RS-232)", "USB HID
  (keyboard wedge already works)", ESC/POS via the printer connection — the
  same architecture `hardware-service.ts` already implements. Nothing on the
  roadmap points at the Electron IPC bridge.

**Removed**: `electron/hardware/` (registry, types, mock-driver) entirely;
`HARDWARE_LIST_DEVICES/CONNECT/DISCONNECT/SEND_COMMAND/EVENT` from
`ipc-channels.ts`; the corresponding `ipcMain.handle`/`registerDevHardware()`
wiring from `main.ts`; the `hardware` namespace from `preload.ts`'s exposed
API. Verified clean with `tsc --noEmit` and `build:electron` after.

**Not removed, still pending your call** (flagged last round, not part of
this approval): the `app.*`/`dialog.*`/`notify.*`/`window.*` IPC namespaces
are also unused (no custom titlebar, nothing calls `app.getVersion` etc.) —
same "built, never consumed" shape as the hardware bridge, but you only
approved the hardware one this round.

### 2. Deep Link — marked dormant

Added explicit `DORMANT` comments at all three touch points
(`DEEP_LINK_PROTOCOL` declaration, `handleDeepLink()` in `main.ts`, and the
`deepLink` export in `preload.ts`) explaining why it's inert today and
exactly how to reactivate it (add a `mtjDesktop.deepLink.onLink()` listener
in the renderer) if a future feature needs it. No behavior changed — the
protocol is still registered, still a harmless no-op.

### 3. Upload APIs — consolidated to one canonical endpoint

**Canonical: `public/api/hostinger-upload.php`** — chosen because it's the
only one whose deploy path matches what the app itself tells shop owners to
use (Settings → Firm Profile placeholder: `https://yourdomain.com/api/hostinger-upload.php`).

Before consolidating, caught a real bug the merge would otherwise have
shipped: the strongest validation (module allow-list + MIME cross-check)
came from `/api/upload.php`, but its allow-list didn't include `"invoices"`
— the exact module string `document-pdf-service.ts` passes for every live
invoice-PDF upload. Adopting that allow-list unmodified would have made the
canonical endpoint 400 on the one confirmed-live call site. Added
`"invoices"` to the list before finalizing.

Rewrote `public/api/hostinger-upload.php` to combine: its own correct
deploy path, `/api/upload.php`'s module allow-list (+ `invoices`) and MIME
cross-check (the strongest validation of the three), and a response shape
with `"success": true/false` — the field `hostinger-client.ts` actually
checks (the old `/api/hostinger-upload.php` omitted it, which would have
made the client treat every successful upload as a failure). Updated
`hostinger-client.ts`'s header comment to point at the canonical file.

**Deleted** (after confirming zero references anywhere in `src`/docs):
root `/hostinger-upload.php`, `/public/api/upload.php`.

**Caveat**: no PHP interpreter is available in this environment, so this
was verified by careful code review (matching the client's exact response
contract, checking every real call site's `module` value against the new
allow-list), not by executing the script. Recommend a manual test upload
against your real Hostinger deployment before relying on it in production.

### 4. Components

- **`AttachmentUploader.tsx`**: deleted after reconfirming zero references.
- **`data-table-virtual.tsx`**: header comment updated to mark it archived
  for future performance work, with the reasoning (73 routes use plain
  `<table>`, needs someone to pick the actually-large lists, not a blanket
  swap).
- **`WeightInput.tsx` / `CashDrawerButton.tsx`**: not yet integrated — see
  the open question below. Both touch live billing/checkout or item-intake
  forms, and I don't want to guess which specific screen(s) in a
  production financial workflow without your input.

### 5. `example-api`

**Blocked — need your input.** My Supabase MCP connection only has access
to project `zbfbnwgbqydttsuuhmxn` (currently INACTIVE). This app's `.env`
points to a different project (`kjfjsfhftytezsjyegmb`), which I have no
access to from this session. Can't confirm deployment status. Please check
your Supabase dashboard (Edge Functions tab) for project `kjfjsfhftytezsjyegmb`
directly, or grant this session access to that project, and I'll finish the
verification and remove it if confirmed unused.


Read-only sweep for duplicated implementations, unfinished modules, legacy
code, inconsistent workflows, and competing architectures. No architectural
code deleted — only the pre-approved zero-risk cleanup below has been
applied. Everything else is reported for a decision.

---

## Verification status

- **TypeScript** (`tsc --noEmit`): clean, 0 errors, after the low-risk deletions below.
- **ESLint**: still running in the background — unusually slow on this
  machine (confirmed via CPU time it's actively working, not hung; ~485
  files including several 1000+ line ones, plus a format-check pass per
  file). Will report the result as soon as it returns.
- **Production build / Electron build**: queued behind ESLint to avoid CPU
  contention between two heavy Node processes; will run immediately after.

## Applied — low-risk cleanup (approved)

Zero references anywhere in `src`, confirmed by import-graph search before
deletion:
- Deleted `src/lib/image-compress.ts`, `src/lib/image-optimisation.ts` (superseded by `image-compression.ts`).
- Deleted `src/lib/query-cache.ts` (in-memory TTL cache, never imported).
- Deleted `src/hooks/useAuth.ts` and the unused `useAuthCheck()`/`AuthState` in `src/lib/supabase.ts` — both were unused reimplementations of session-check logic; the live implementation is `src/components/auth-gate.tsx`.
- Fixed the stale "not wired anywhere" comment in `src/lib/sync-engine.ts` (it is wired — `__root.tsx` bootstrap + `base-repository.ts`).

---

## HIGH PRIORITY

### 1. Hardware Architecture — two implementations, one is scaffold-only

**Canonical: browser-native WebSerial/WebUSB (`src/lib/hardware-service.ts` + `src/lib/thermal-printer.ts`).** Fully implemented and live:
- Barcode scanner: HID keyboard-wedge emulation listener, real and working.
- Weighing scale: `navigator.serial`, real connect/read/parse loop for
  common scale protocols (`ST,GS,+0012.350g` format family), with a manual
  fallback when unsupported.
- Printing: WebUSB thermal printer service with browser-print and PDF
  fallbacks.
- Consumed by the actual "Hardware Management" page
  (`src/routes/hardware/index.tsx`) and `WeightInput.tsx`/barcode components.
  Zero references to `mtjDesktop` anywhere in this code.

**Scaffold-only: Electron IPC hardware bridge** (`electron/hardware/{registry.ts,types.ts,drivers/mock-driver.ts}` + 5 of the 14 IPC channels: `HARDWARE_LIST_DEVICES/CONNECT/DISCONNECT/SEND_COMMAND/EVENT`). Its own header
comment is explicit: *"The concrete drivers for real hardware... are NOT
implemented here — they cannot be honestly validated without the physical
devices... Each real driver should be added, one at a time, against real
hardware."* `main.ts` only ever registers `MockDriver` instances. **No
renderer code calls any of this — zero references to `mtjDesktop.hardware.*`
anywhere in `src`.**

**Recommendation: browser-native is canonical; do not migrate toward
Electron IPC.** Reasoning, not just "it's what's used today":
- Electron's renderer is Chromium — WebSerial/WebUSB work natively in the
  Electron window exactly as they do in a browser tab. There is no technical
  need for a main-process IPC bridge to reach USB/serial devices here.
- This app ships to **two targets** (Electron desktop + web, per
  `docs/DEPLOY_CLOUDFLARE_PAGES.md`/`DEPLOY_WEB.md`). The browser-API path is
  the *only* one that works unmodified on both — an IPC-based path would
  still need this exact WebSerial fallback for the web build, so building it
  out would mean maintaining two parallel hardware layers permanently, not
  replacing one.
- The scaffold's own comment states real drivers require physical hardware
  to honestly validate — that's a standing blocker, not a to-do with a
  deadline.

**Action, not yet taken (needs your approval — architectural):** delete
`electron/hardware/` entirely and remove `HARDWARE_LIST_DEVICES`,
`HARDWARE_CONNECT`, `HARDWARE_DISCONNECT`, `HARDWARE_SEND_COMMAND`,
`HARDWARE_EVENT` from `ipc-channels.ts`/`main.ts`/`preload.ts`'s `hardware`
namespace. Zero renderer callers confirmed. I did not do this yet since it's
a whole subsystem removal — say the word and I'll do it with full
verification after.

**Related, smaller finding:** the `app.*`, `dialog.*`, `notify.*`, `window.*`
IPC namespaces (9 more of the 14 channels) are also unused — `main.ts` has no
`frame: false`, so there's no custom titlebar consuming
`window.minimize/maximizeToggle/close`, and nothing calls
`app.getVersion/relaunch`, `dialog.openFile/saveFile`, or `notify.show`.
Only `print.listPrinters`/`print.printHtml` are actually called from `src`.
Folding this into the same cleanup pass makes sense since it's the same kind
of "built, exposed, never consumed" IPC surface — flagging for the same
approval rather than acting alone.

### 2. Deep Link — not broken, not critical: it's disconnected infrastructure for a feature that doesn't exist

Traced end-to-end. Two *unrelated* things share the name "deep link" in this
codebase — worth being precise about which one you meant:

- **"WhatsApp deep-link"** (`wa-link.ts`, `waMobileUrl()`) — `wa.me/` URLs
  that open WhatsApp with a pre-filled message. Fully wired, used across
  billing/orders/repair detail pages and communications campaigns. Not
  related to Electron at all. **Working as intended, no action needed.**
- **The Electron custom-protocol handler** (`avsgolderp://`,
  `app.setAsDefaultProtocolClient`, `handleDeepLink()` in `main.ts`) — this
  is what I originally flagged as a risk. Investigated fully:
  - `main.ts` registers the protocol, handles `open-url` and
    `second-instance`, and on any `avsgolderp://...` link sends a
    `webContents.send("deep-link", url)` event into the renderer.
  - **Nothing in `src` ever listens for it.** `grep` for `"deep-link"` and
    `"avsgolderp"` across all of `src` returns zero renderer-side consumers.
  - Checked whether invitation-accept needs it (this was my original
    concern): it doesn't. `src/routes/invite.accept.tsx` and the
    `invite-accept` edge function both use a plain HTTPS route with query
    params (`/invite/accept?email=...&code=...`) plus a manually-entered
    6-digit code — no custom protocol involved anywhere in that flow.

**Classification: not Critical.** Nothing currently depends on this working.
If a real `avsgolderp://` link were ever opened, the app would just focus
its window and silently drop the event — a no-op, not a crash or data-loss
path. It reads as scaffolding for a feature (e.g. "open a specific record
from an external notification") that was set up at the OS-registration level
but never given a renderer listener or a use case.

**Recommendation:** low-priority cleanup, not urgent. Either (a) delete the
protocol registration + `handleDeepLink`/`open-url`/`second-instance` deep-link
branch since nothing uses it, or (b) if you do have a near-term plan for it
(e.g., "open order from WhatsApp notification"), keep it and I'll wire up the
renderer listener as a real feature. Your call — I won't touch it either way
without direction since removing OS protocol registration is the kind of
thing worth confirming.

### 3. Upload APIs — three PHP endpoints, evidence points to a real deployed-response mismatch

All three do the same job (receive a file, validate, store under
`uploads/{module}/{yyyy-mm}/`, return a URL) but differ in every dimension:

| | `/hostinger-upload.php` (root) | `/public/api/hostinger-upload.php` | `/public/api/upload.php` |
|---|---|---|---|
| CORS | Hardcoded to `maatarajewellers.shop` origins only | Placeholder `localhost:3000` only (template, needs editing per-deploy) | `Access-Control-Allow-Origin: *` (any origin) |
| Allowed extensions | jpg/jpeg/png/webp/pdf/doc/docx/xls/xlsx/txt/csv | jpg/jpeg/png/webp/pdf/doc/docx | jpg/jpeg/png/webp/pdf/doc/docx (+ MIME cross-check against extension) |
| Module allow-list | None — any `module` string accepted | None | Explicit 10-item allow-list (`firm-logos`, `catalog`, etc.) — rejects anything else |
| MIME sniffing | Blocks `text/html`/`application/x-php` in content | None | Full allow-list of MIME types, cross-checked against extension |
| **Response shape (success)** | `{"success": true, "file_url", "file_path", ...}` | `{'file_url', 'file_path', ...}` — **no `success`/`status` field** | `{"status": "success", "file_url", ...}` |

**The client code that actually calls this (`src/lib/hostinger-client.ts` →
`uploadToHostingerServer()`, wired live through `document-pdf-service.ts` →
`comm/service.ts` for emailing/WhatsApp-ing generated invoice PDFs) checks
`json.success` as a boolean.**

That means:
- Only the **root `/hostinger-upload.php`** actually satisfies the client's
  response contract.
- The other two would make the client treat every successful upload as a
  failure (`json.success` is `undefined` → falsy → throws "Hostinger upload
  error: Unknown error"), even though the file was written to disk
  correctly.

But the root file isn't the one hinted at by the app itself — Settings →
Firm Profile's placeholder text literally says
`https://yourdomain.com/api/hostinger-upload.php`, i.e. it's telling shop
owners to deploy the **`/api/`-prefixed** one, whose response shape is
broken against the client. The root file (hardcoded to one specific domain,
not templated for other deployments) looks like the original,
single-tenant version; `/public/api/hostinger-upload.php` looks like a
later, genericized rewrite for any shop's domain — that rewrite dropped the
`success` field along the way. `/public/api/upload.php` is a third,
independently-written variant with the strongest validation (explicit
module allow-list + full MIME cross-check) but a different response
contract again (`status` string, not `success` boolean).

**Recommendation:** Take `/public/api/upload.php`'s validation rigor
(module allow-list + MIME cross-check) as the base — it's the most secure —
but fix its response shape to add `"success": true/false` (or, simpler,
change `hostinger-client.ts` to check `status === "success"` instead of
`success`, which would make it compatible with two of the three files
immediately with a one-line client change). Either way: **pick one file,
make its path/response shape match what Settings actually tells shop owners
to deploy, delete the other two.** I have not touched any of the three or
the client — this needs your call on which direction (fix the client, or
fix the PHP) since I can't verify what's actually deployed on any live
Hostinger account from the repo alone.

---

## MEDIUM PRIORITY

### 4. Production-ready but unused components — classified

All four are complete, working, from the same `v0.8.0` sprint, zero
importers anywhere in `src`/`e2e`/`electron`.

| Component | What it does | Classification | Reason |
|---|---|---|---|
| **`WeightInput.tsx`** | Reusable weight-entry field: live reading from `hardwareService` scale connection, with a manual-entry fallback | **Integrate** | Real, working feature with no redundant equivalent. Billing/stock/manufacturing forms that need a gross-weight field currently use plain `<Input>` — this is strictly better and already built. Lowest-risk of the four to wire in. |
| **`CashDrawerButton.tsx`** | Triggers `thermalPrinterService.openCashDrawer()` (ESC/POS kick pulse via receipt printer) | **Integrate** | `openCashDrawer()` has *no other caller in the codebase* — there's currently no UI path to open the cash drawer at all. This isn't redundant scaffolding, it's a genuine missing control on the billing/checkout screen. |
| **`data-table-virtual.tsx`** | `@tanstack/react-virtual`-backed table, drop-in replacement for plain HTML tables | **Archive (don't wire in speculatively)** | 73 route files render plain `<table>` today; virtualizing all of them is a real, scoped performance project, not a quick integration — needs someone to identify which specific lists are actually large enough to need it (stock, ledger, orders are candidates; most aren't). Keep the file (it's correct, tested-shape code), don't delete it, but don't wire it in opportunistically either — that's a deliberate follow-up task, not cleanup. |
| **`AttachmentUploader.tsx`** | Generic file/photo uploader hitting the Hostinger PHP endpoint (`fileUpload.ts`) | **Delete** | Redundant, not missing. `attachments-section.tsx` + `attachment-placeholder-modal.tsx` + `attachments-store.ts` is the live, fully-wired attachment system (17 importers, Supabase-storage backed) already covering every record type that needs file attachments. This component duplicates that capability via a different (and per finding #3, partially broken) storage path. Its only sibling dependency, `fileUpload.ts`, is still used by one route (`people.print.$id.tsx`, read-only `listAttachments()` call) — so delete the component, keep `fileUpload.ts` until that one remaining read-path is confirmed/migrated separately. |

Not deleting any of these without your go-ahead since they're feature-level,
not dead-code-level — but `AttachmentUploader.tsx` is the one candidate here
that's genuinely safe to remove now (superseded, not missing).

### 5. `example-api` Edge Function

- **Referenced anywhere?** No. Zero `functions.invoke("example-api")` or
  path references anywhere in `src`.
- **Purely boilerplate?** Yes — its content is the generic
  `@supabase/server` SDK template (`withSupabase({ auth: "user" }, ...)`),
  the kind scaffolded by `supabase functions new`. No business logic.
- **Is it deployed?** Can't tell from the repo — edge functions deploy
  independently via `supabase functions deploy`, and deployment state isn't
  tracked in this checkout. I don't have Supabase project access in this
  session to check `list_edge_functions` against the live project.

**Recommendation:** almost certainly safe to delete from the repo (it's
template code, not a real feature), but per your rule, confirm-before-
touching deployed infrastructure — if you can confirm via the Supabase
dashboard (or grant me project access) that it's either never deployed or
safe to un-deploy, I'll remove the function directory in the same pass as
the other approved deletions.

---

## Continued repository audit (started, not exhaustive — see notes)

- **Unused stores/lib files**: same technique as the first pass (batch
  import-graph diff) applied across all of `src/lib` top-level, `src/hooks`,
  `src/contexts`, and `src/components/{files,forms,hardware,layout,
  reference-notes,security}` — already covered in the completed cleanup
  above and the four components in §4. No further orphans found in these
  directories beyond what's already listed.
- **Unused DB tables**: attempted via grepping `CREATE TABLE` across the 29
  migration files, but the extraction was unreliable (only matched 5 of what
  should be 30+ tables — migrations alter/rename tables across files, so a
  static grep can't safely say a table is "unused" without false positives).
  **Not reporting a conclusion here** — this needs either Supabase's
  `list_tables`/`get_advisors` against the live schema, or a proper SQL
  parse of the migration history, not a text grep. Flagging as unfinished
  rather than guessing on a database-schema-impact question.
- **Unused routes**: not yet swept. TanStack Router auto-registers every
  file under `src/routes`, so "unused" here means "unreachable via any
  in-app `<Link>`/`navigate`" — a UX dead-end, not a build error. With 100+
  route files this needs the same batch technique used for components;
  didn't get to it this pass.
- **Dead assets**: `src/assets` and `public/` are small (14 files total),
  spot-checked — all look like standard PWA/favicon/manifest assets, no
  obvious orphans. Not exhaustively cross-referenced against `index.html`/
  `site.webmanifest`.
- **Duplicate APIs / legacy workflows / incomplete migrations** beyond
  what's in §1–5: the print-engine template migration reported earlier
  (Phase 0, in progress, not yet touching any route) is the only other one
  found. No additional competing-architecture clusters turned up in this
  pass beyond hardware and upload APIs.

Say which of these to pick up next, or say "continue" and I'll work through
unused routes next (same batch method, moderate effort) since it's the
highest-value remaining item.
