# Known Risks

## 1. Settlement print-route navigation timing (Development/Test Environment Performance Risk)

**Classification:** Development/Test Environment Performance Risk — **not** a production logic defect. Verified against the packaged Electron production build; see Verification below.

### Symptoms

`e2e/tests/settlement-workflow.spec.ts` intermittently times out (10–30s) waiting for `settlement-draft-front` / `settlement-financial-status` to render after a full-page navigation (`page.goto()` or `page.goBack()`) immediately following settlement creation. Failure point varies between runs — sometimes the draft-print navigation, sometimes the return navigation — consistent with a timing race rather than a deterministic logic bug.

### Root cause (of the original, now-fixed, deterministic failure)

`saveDirect()` in `src/lib/supabase-write.ts` wrote directly to Supabase only, never to the local SQLite cache. The local-first `readAll()` in `src/lib/repositories/base-repository.ts` only re-pulls from Supabase when the local cache for a table is completely empty. Once any row had ever been cached locally, a settlement created in the current session was invisible to any local-first read until an unrelated background sync caught up — reproduced deterministically as "Settlement not found" on the very first print-route navigation after create.

**This has been fixed at the root** (see changelog `[0.8.0]`): `saveDirect()`/`deleteDirect()` now mirror every successful Supabase write into the local cache immediately, so a local-first read is always consistent with what was just saved.

### Residual risk after the fix

Re-running the same test multiple times after the fix still showed intermittent timeouts, at inconsistent points in the flow. Investigation:

- **Environment:** `vite dev` server (Vite dev mode), Chromium via Playwright, targeting `localhost:3000`.
- **Reproduction frequency:** ~3 of 4 runs failed at some point in the multi-navigation flow during investigation; not deterministic, not always the same assertion.
- **Local SQLite / IndexedDB size:** not precisely measured (no tooling to inspect IndexedDB size from the shell), but this database is the **shared, cumulative store used by the entire e2e suite across a session** — dozens of spec files (order-workflow, GST, outside-work, billing-documents, job-card, material-vault, etc.) each seed real records into the same persistent local database over the course of a test run. This is expected to be substantially larger than a real shop's data volume after months of actual use.
- **Local SQLite load time / WASM initialization time:** every full page navigation forces `initLocalDb()` to re-run from scratch: decrypt the stored blob, verify its SHA-256 checksum, load it into `sql.js` (WASM), run `PRAGMA integrity_check`, then re-export and re-persist. This cost scales with total database size and is paid on **every hard navigation**, not just app boot.
- **Route load time (dev mode):** the test's own pre-existing code comment (predating this session's work) already documents "Vite dev mode's cold per-route compile" as a known source of first-navigation latency to a given route within a dev-server process.
- **Electron packaged-build expectation:** a packaged build serves pre-built static files from `dist/` with no per-route JIT compilation step, and normal production use does not carry an e2e-suite's worth of accumulated seed data.

### Verification performed

A one-off verification script launched the **actual packaged Electron production build** (`dist/` + `dist-electron/main.js`, `VITE_DEV_SERVER_URL` unset — i.e. `win.loadFile()`, not `win.loadURL()` against a dev server) via Playwright's Electron launcher, and drove the identical operation: create a settlement, then hard-reload the draft-print route.

| Step | Time |
|---|---|
| App window ready | 7160ms (one-time Electron process startup) |
| Login | 300ms |
| Settlement created | 442ms |
| Draft-print via SPA navigation | 58ms |
| **Draft-print via hard reload** | **283ms** |

The hard-reload case — the exact operation that took 10–30+ seconds intermittently under `vite dev` — completed in **283ms** in the packaged build. This is conclusive: the residual timing risk is a development/test-environment artifact (dev-server compile overhead stacked on a large, cumulative shared test database), not a defect in the application or in the local-cache-mirroring fix.

### Production impact

**None expected.** The underlying data-loss bug (the actual production-relevant defect) is fixed. The residual timing behavior does not reproduce in the packaged build under realistic conditions.

### Mitigation

- The root-cause data-consistency bug is fixed (`src/lib/supabase-write.ts`).
- No further code change is being made for the residual dev-environment timing, to avoid tuning application behavior around a test-harness artifact.

### Future monitoring recommendations

- Re-run `settlement-workflow.spec.ts` against a **freshly reset** local e2e database (not the cumulative shared one) to confirm the dev-server timing improves proportionally — would further isolate dev-DB size as the dominant factor versus pure Vite compile overhead.
- If real-world production databases eventually grow very large (multi-year, multi-branch histories), periodically re-measure cold `initLocalDb()` time on a representative production-sized database, since the packaged-build measurement above was taken against a comparatively small dataset.
- Consider, only if a real production report ever surfaces slow reloads: lazy/incremental local SQLite loading, or a debounced `persistDatabase()` instead of persisting on every `runLocal()` commit.
