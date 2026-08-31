# ORNEXA — SUPABASE EGRESS & REQUEST-EFFICIENCY ENGINEERING RULES
**Mandatory permanent rules for all AVS ERP / Ornexa implementation**
*Status: REQUIRED — not optional optimization*
*Last Updated: 2026-08-30*

These rules are binding on every agent, PR, and release. They supplement
`DATABASE_AND_SUPABASE_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, and
`SESSION_AND_SECURITY_MASTER.md`.

---

## Rule 1 — ONE LOGIN = ONE CONTROLLED BOOT

A single login must never trigger multiple full synchronization paths.

- `switchBusiness()` and `switchWorkspace()` must call **`startCloudSync(true)` only** — never `pullAll()` + `startCloudSync()` in sequence.
- `AuthGate` is the canonical session bootstrap entry; `TOKEN_REFRESHED` and `USER_UPDATED` must not re-run full boot.
- Duplicate boot/sync execution anywhere is a **P0 defect**.

**Implementation anchors:** `src/components/auth-gate.tsx`, `src/lib/data-loader.ts`, `src/lib/identity/tenant-context-store.ts`, `src/lib/identity/authorization-context-store.ts`.

---

## Rule 2 — DEDUPLICATE AUTH + SUBSCRIPTION

Membership loading and subscription resolution happen **once per boot/session** unless an intentional refresh is required.

- `SubscriptionGate` bootstrap resolves subscription once; interval recheck only after bootstrap.
- `restoreLastOrSelect()` must not re-fetch memberships when already loaded.
- Do not allow duplicate `getUser()`, subscription RPC, membership fetch, or tenant-context reload during the same boot.
- Use in-flight deduplication (`resolveInFlight`, fetch throttle in-flight map) where applicable.

**Implementation anchors:** `src/components/subscription-gate.tsx`, `src/lib/identity/tenant-context-store.ts`, `src/lib/identity/subscription-access-service.ts`, `src/lib/supabase-fetch-throttle.ts`.

---

## Rule 3 — NEVER FETCH SECRETS AT BOOT

SMTP secrets and other sensitive provider configuration must **NOT** be fetched during normal application startup.

- Load secret presence/configuration only when the authorized Settings flow requires it.
- Boot may set `smtpPasswordConfigured: false` and verify lazily on Settings open.

**Implementation anchors:** `src/lib/data-loader.ts` (`pullBranchSettings`), `src/routes/settings.branch-settings.tsx`, `src/lib/security/provider-secret-status.ts`.

---

## Rule 4 — AUTH REQUEST OPTIMIZATION

- Use local **`getSession()`** where local session state is sufficient.
- Use network **`getUser()`** only where server-side identity validation is actually required.
- Do not create Auth refresh/session loops from multiple `onAuthStateChange` handlers re-running boot.

**Implementation anchors:** `src/lib/data-loader.ts` (`pullAppSettings`), `src/components/auth-gate.tsx`, `src/lib/auth/identity-providers.ts`.

---

## Rule 5 — REALTIME BOOT ORDER

Realtime must **NOT** start while initial/background synchronization is still pulling the same tables.

- Start Realtime subscriptions **after** background boot pull completes.
- Apply boot grace period (`setRealtimeBootGrace`) to ignore postgres_changes echo pulls during hydration.
- Use reconnect backoff and debounced re-pulls; never subscribe to tables the route does not need.

**Implementation anchors:** `src/lib/realtime-sync.ts`, `src/lib/data-loader.ts`.

---

## Rule 6 — R2 / STORAGE

- Continue using the existing **R2 file-delivery path** for application attachments and firm assets.
- Do **not** assume Supabase Dashboard “Storage” counts are application file traffic.
- Investigate remaining Storage API events from Supabase Logs before changing architecture.
- Do not introduce parallel Supabase Storage upload stacks.

**Implementation anchors:** `src/lib/supabase-storage.ts`, `src/lib/storage.ts`.

---

## Rule 7 — SUPABASE WARNINGS / ERRORS

Previously observed Postgres warnings and errors must be investigated from **actual Supabase Logs / query evidence**.

- Do not guess causes.
- Do not suppress messages without fixing root cause.
- Document findings in `_reconstruction/SUPABASE_EGRESS_INVESTIGATION_REPORT.md`.

---

## Rule 8 — BOOT EGRESS MONITORING

Maintain deterministic client-side instrumentation:

| Surface | Location |
|---------|----------|
| Monitor | `src/lib/monitoring/supabase-egress-monitor.ts` |
| Throttle + dedupe | `src/lib/supabase-fetch-throttle.ts` |
| Dev prod quarantine | `src/lib/supabase-egress-guard.ts`, `scripts/dev-egress-guard.mjs` |

**Per login, record without secrets:**

- REST/API request count
- Auth request count
- Realtime connection/subscription events
- Storage requests
- deduplicated / blocked requests
- response bytes (estimated from response bodies)

**Browser snapshot:**

```javascript
window.__ORNEXA_EGRESS__.snapshot()
window.__ORNEXA_EGRESS__.loginSummary()
```

Login boot measurement starts on `SIGNED_IN` / `INITIAL_SESSION` and completes when `markInitialLoadDone()` fires.

---

## Rule 9 — HARD BEFORE/AFTER ACCEPTANCE

Do **NOT** accept qualitative claims (“roughly half”, “seems lower”).

For each optimization wave, record **one controlled login before** and **one controlled login after**:

| Metric | Required |
|--------|----------|
| REST/API requests per login | Yes |
| Auth calls per login | Yes |
| Realtime events per login | Yes |
| Approximate response bytes per login | Yes |
| CPU / dashboard egress observation | Where available |

Use `_reconstruction/EGRESS_BEFORE_AFTER.md` template. Production measurement requires owner-approved session only — no Playwright storms.

---

## Rule 10 — PRODUCTION SAFETY

Do **not** run Playwright, load testing, stress testing, or uncontrolled QA traffic against the production Supabase project (`dqgrrafuoxaorvyrcuuh`).

- High-volume testing uses an **isolated QA Supabase environment**.
- Local dev against production requires explicit `VITE_ENABLE_DEV_SUPABASE=1` and owner awareness.

---

## Rule 11 — PERFORMANCE MUST NOT BREAK FUNCTIONALITY

Do not reduce legitimate ERP functionality to lower egress.

The following must remain correct after every optimization:

- Customer / karigar / party data
- Stock, billing, gold/vault, ledgers, reports
- Portals, documents, authentication, RLS, calculations

---

## Rule 12 — FINAL ACCEPTANCE GATE

Egress/performance work is **complete** only when all are true:

1. Duplicate boot paths removed (verified in code + per-login snapshot)
2. Auth/session loops eliminated
3. Realtime boot overlap controlled
4. Oversized/unbounded reads corrected
5. Expensive COUNT/retry paths controlled
6. Supabase warnings/errors investigated with log evidence
7. Measured per-login request volume documented
8. Before/after evidence exists in `_reconstruction/EGRESS_BEFORE_AFTER.md`
9. Production dashboard egress observed stable over 48h idle + normal use

**Do not upgrade Supabase compute or migrate infrastructure** as the first response to application-generated traffic. First prove the workload is optimized.

---

## Related documents

- `_reconstruction/SUPABASE_EGRESS_INVESTIGATION_REPORT.md`
- `_reconstruction/EGRESS_BEFORE_AFTER.md`
- `docs/IMPLEMENTATION_MATRIX.md` (Stream — Performance / Data plane)
- `docs/MASTER/ORNEXA_DECISION_LOG.md` (append decision entries for material changes)
