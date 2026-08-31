# FINAL EVIDENCE REPORT — AVS ERP Master A–Z Implementation

**Date:** 2026-08-30 (A–Z closure continuation)  
**Verdict:** **NOT PASS** (honest) — CI green 155/155; typecheck pass; **dashboard + delayed orders side-by-side VERIFIED**; migrations/portals/KYC/print/customization open  
**Git SHA:** unavailable (workspace not a git repository from agent shell)  
**Build bundle:** `dist/assets/index-DQLF5gkH.js` (post-CI build)  
**Shop oracle (unchanged):** `production-dist-shop/index-CVsE73i6.js`

---

## 1. Implementation status by A–Z module (chain evidence)

See [`MASTER_GAP_REGISTER.md`](MASTER_GAP_REGISTER.md) and [`CHAIN_AUDIT_TEMPLATE.md`](CHAIN_AUDIT_TEMPLATE.md).

| Area | Status | Evidence |
|------|--------|----------|
| Phase 0 gap register + chain template | **DONE** | `MASTER_GAP_REGISTER.md`, `CHAIN_AUDIT_TEMPLATE.md` |
| Billing / quotation / estimate | **PARTIAL** | Routes + stores exist; golden path not E2E verified |
| Gold / vault / ledger | **PARTIAL** | Paginated RPC + timeout UX; COUNT migration authored |
| Print / PDF | **PARTIAL** | Print-engine canonical; report test hooks + ledgers-print-all fix |
| Document hosting | **PARTIAL** | 365d default, metadata, rate-limit migration **local only** |
| Portals / OAuth | **PARTIAL** | OAuth callback race fix; portal RLS not scale-tested |
| MTG / Meena | **BLOCKED** | [`MTG_UNDEFINED_RULES.md`](MTG_UNDEFINED_RULES.md) |
| Mobile 5-tab | **PARTIAL** | Routes exist; real-data chains open |
| Customization | **PARTIAL** | Hub prefs affect due dates / vault rules (unit test) |

**Forbidden claim avoided:** route existence ≠ VERIFIED.

---

## 2. Bugs fixed (with test/script ref)

| Defect | Fix | Verify |
|--------|-----|--------|
| Customization hub bare `customization_hub` id | `resolveAppSettingsReadId` in hydrate/save | `qa/unit/firm-scoped-boot.test.ts` |
| Gold calc rules bare id | `goldCalcRulesSettingsId()` firm-scoped | `qa/unit/firm-scoped-boot.test.ts` |
| Barcode config bare id | `barcodeConfigSettingsId()` firm-scoped | `qa/unit/firm-scoped-boot.test.ts` |
| Billing invoice page missing firm scope | `withFirmScope` on `fetchBillingInvoicePage` | `qa/unit/firm-scoped-boot.test.ts` |
| Item masters update/delete cross-tenant | `.eq("firm_id", firmId)` guards | `qa/unit/firm-scoped-boot.test.ts` |
| People page query missing firm scope | `fetchPeoplePage` + tab counts scoped | `qa/unit/people-query.test.ts` |
| Public trial signup re-exposed | `/trial/start` → `REQUEST_ACCESS_PATH` redirect | `qa/unit/invitation-only-signup.test.ts` |
| OAuth PKCE race on callback | `exchangeCodeForSession` + `onAuthStateChange` wait | `qa/unit/oauth-callback.test.ts` |
| Invite OAuth `code` collision | `stashInviteOAuthContext` + `invite` param | `qa/unit/oauth-callback.test.ts` |
| Login trial CTA | Request access links (native + web) | `qa/unit/invitation-only-signup.test.ts` |
| Delivery summary print root | `data-testid="report-print-source"` wrapper | `qa/unit/report-print-chains.test.ts` |
| day1 selfcheck wrong fine formula | `scripts/run-day1-selfchecks.mjs` aligned to `/999` | `npm run test:service` |
| Document hosting 7-day cap | `DEFAULT_DOCUMENT_HOSTING_DAYS = 365` + migration | `qa/unit/document-hosting.test.ts` |
| Document hosting plan gate | `canUseDocumentHosting()` + `business.document_hosting` on ₹30k/₹50k | `qa/unit/document-hosting.test.ts` |
| Sharing chain audit | deep-link fallback, RPC access, no renderer secrets | `qa/unit/sharing-chain.test.ts` |
| Skeleton UI Phase 8b | boot/dashboard/module/staged-load AVS tokens | `qa/unit/skeleton-ui.test.ts` |
| Blank KYC print fields | `print-engine/data-mapper.ts` Person fields | Manual / print unit branding |
| `doc.$token.tsx` TS broken | Snapshot helpers + route restore | `npm run typecheck` |
| Staging SoT badges visible | `SourceOfTruthBadge` gated prod | Visual / functional-audit |
| OAuth PKCE race | `auth.callback.tsx` waits for auth event | Code review; manual OAuth once |
| ledgers-print-all empty PDF | `data-testid="report-print-source"` | `qa/unit/report-print-chains.test.ts` |
| Report print pollution (loading/filters in PDF) | delivery-summary, ledgers, gold-loss print roots | `scripts/audit-report-print-sources.mjs` |
| Realtime no reconnect | `realtime-sync.ts` reconnect on CHANNEL_ERROR | Code review |
| gold_ledger silent timeout | `reports.gold-ledger.tsx` loadError banner | UX |
| Dead dual-currency calc | Removed `calculateDualCurrencyBilling` | `npm run qa:unit` |
| Skeleton UI outdated | Boot/dashboard/module/staged-load panels | Phase 8b files |
| Delayed orders under-count (118 vs 412) | Shop-aligned bucket fetch; no abort on buckets; orders cache 500; no store re-merge | Live browser `:3000/app` **412** = frozen **412**; `probe-dashboard-buckets.mjs` |
| Trial CTAs on marketing pages | `index.tsx`, `pricing.tsx`, `faq.tsx` → Request access | Signup policy preserved |
| Route drift (57→18) | Batch restore: portals, treasury, reports, workshop gold-book, stock detail | `npm run typecheck` 0 errors |
| Invite OAuth regression after restore | Re-wired `stashInviteOAuthContext` + `inviteAcceptPath` | `npm run qa:unit` 155/155 |
| Migration probe false negatives | Fixed RPC param signatures in verify scripts | `MIGRATION_QA_AUDIT.json` |

---

## 3. Modules VERIFIED vs PARTIAL vs BLOCKED

- **VERIFIED (deterministic only):** calc unit tests, print CSS rules, document retention constants, report print testid presence, customization due-date wiring, RLS isolation probe (QA Supabase)
- **PARTIAL:** Most operational modules (see gap register)
- **BLOCKED:** Meena/NN202000, edition entitlement locks (owner DOCX), prod Playwright parity

---

## 4. Calculation verification

| Command | Result |
|---------|--------|
| `npm run qa:gold` | PASS (15 tests) |
| `npm run qa:unit` | PASS (**155/155** tests, 33 files) |
| `scripts/probe-dashboard-buckets.mjs` | **412 delayed / 414 open** on QA |
| `scripts/probe-delayed-orders.mjs` | **412 delayed** on QA REST |
| `scripts/audit-migrations-qa.mjs` | `item_groups` **missing**; core RPCs applied |
| `scripts/verify-dashboard-live.mjs` | PASS (12/12) |
| `scripts/audit-backend-integrity-traces.mjs` | 3 WORKS / 1 PARTIAL (static source audit) |

Removed duplicate `calculateDualCurrencyBilling`; billing authority remains `gold.ts` → `billing-store` + `tax-profiles`.

---

## 5. Supabase / data verification

| Item | Status |
|------|--------|
| Boot session cache + fetch throttle | Shipped in client |
| `firm_id` tenant pulls | Restored (prior session) |
| gold_ledger perf migration | File: `20260830120000_gold_ledger_page_perf.sql` — **apply pending** |
| Document hosting + rate limits migration | File: `20260830160000_document_hosting_retention_and_rate_limits.sql` — **apply pending** |
| Migration history drift | **BLOCKED** `supabase db push` |
| Prod load/stress | **NOT RUN** (moratorium) |

---

## 6. Performance findings

- Dev console: `get_my_memberships` timeouts observed under load (Supabase latency)
- Realtime reconnect added to avoid stale channel after errors
- No compute-tier upgrade recommended; root fixes = pagination, dedup, indexed COUNT

---

## 7. Print/PDF verification matrix

| Doc class | Print hook | PDF | Status |
|-----------|------------|-----|--------|
| Invoice / estimate | print-engine | pdf generator | PARTIAL |
| KYC worker | print-engine mapper | PARTIAL content |
| Gold ledger report | triggerPrint + print-source | PARTIAL |
| 5 P0 reports | testid audit | `qa/unit/report-print-chains.test.ts` PASS |
| ledgers-print-all | print-source **fixed** | PARTIAL |

---

## 8. Report verification sample

Deterministic selector audit (no Playwright):

- delivery-summary, gold-loss, ledgers, ledgers-print-all, gold-ledger → `report-print-source`
- gst-returns → `report-export-gstr3b`
- tally-export → `report-export-tally-xml`

---

## 9. Customization APPLY→VERIFY

- `qa/unit/customization-apply.test.ts` — `payment.defaultDueDays` → `resolveInvoiceDueAt`; `requireVaultStockLine` toggle
- Full 11-category document delta tests: **NOT DONE**

---

## 10. Security / RLS / API abuse protection

| Item | Status |
|------|--------|
| RLS isolation test | PASS (`qa/database/rls-isolation.test.ts`) |
| `check_api_rate_limit()` + `api_rate_limits` table | Migration authored; **apply pending** |
| `resolve_document_share` rate limit | In migration |
| Cross-tenant portal denial at scale | **BLOCKED** (no isolated QA scale env) |

---

## 11. Document hosting

- Default retention 365 days in app + migration default
- `party_id`, `form_metadata`, `retention_expires_at`, `share_status`
- Public access via RPC only (no raw storage URLs in portal)
- Plan-gated entitlements: **PARTIAL** (not fully wired to saas-entitlements)

---

## 12. Sharing / provider chain

See [`SHARING_CHAIN_AUDIT.md`](SHARING_CHAIN_AUDIT.md) — PARTIAL; WhatsApp-heavy UI; secrets not in renderer.

---

## 13. Portal wiring

Routes exist (customer/karigar/supplier); OTP/KYC upload chain **NOT PASS**; OAuth portal return path improved.

---

## 14. Skeleton / loading UI

Updated: `app-boot-skeleton.tsx`, `HomeDashboardSkeleton.tsx`, `module-skeleton.tsx`, `staged-load-panel.tsx` — AVS tokens, layout-matched boot shell.

---

## 15. Mobile

5-tab routes exist; real-data verification **NOT PASS**.

---

## 16. MTG

Gated `/mtg`; Manubook OFF default; undefined rules documented — [`MTG_UNDEFINED_RULES.md`](MTG_UNDEFINED_RULES.md).

---

## 17. Jwelly preference mapping

Reference: `docs/JWELLY_TO_ORNEXA_GAP_MATRIX.md` — mapped during Phase 6 audit; not fully applied to runtime.

---

## 18. Backend integrity traces (A–D)

Static source audit: [`BACKEND_INTEGRITY_TRACES.json`](BACKEND_INTEGRITY_TRACES.json)

| Trace | Static audit | Live QA |
|-------|--------------|---------|
| A Customer commercial chain | **WORKS** (7/7 links) | Dashboard + customers RPC verified |
| B Item/stock chain | **WORKS** (6/6 links) | Stock count=21 on QA firm |
| C Gold chain | **WORKS** (6/6 links) | Vault gold 226,824g on dashboard RPC |
| D Portal chain | **PARTIAL** (migration apply pending) | RLS probe PASS; OTP/KYC chain open |

Live dashboard evidence: [`DASHBOARD_LIVE_VERIFICATION.json`](DASHBOARD_LIVE_VERIFICATION.json)

---

## 19. Tests executed

```
npm run ci                          → PASS (typecheck, lint:ci, security:scan, validate:migrations, test:service, qa:gold, build)
npm run qa:unit                     → 155 passed (33 files)
npm run test:service                → day1 selfchecks OK
validate:migrations                 → 192 files OK
scripts/verify-dashboard-live.mjs   → 12/12 PASS
scripts/verify-dashboard-wiring.mjs → 6/6 PASS
scripts/audit-backend-integrity-traces.mjs → 3 WORKS / 1 PARTIAL
```

**No Playwright.** **No prod load tests.**

---

## 20. Known blockers

| Blocker | Module |
|---------|--------|
| Meena / NN202000 spec missing | MTG, Meena book |
| Migration apply / history drift | DB hosting, rate limits, gold_ledger perf |
| Prod E2E moratorium | All live chain traces |
| Owner prod metrics baseline | Performance sign-off |
| Edition DOCX not approved for locks | Entitlements |
| Git unavailable in workspace | SHA tracking |

---

## Completion statement

This session delivered **evidence-backed partial progress** across Phases 0–10 artifacts and deterministic CI green. The system is **not** production-ready and **not** A–Z parity PASS until P0 chains are verified on approved QA Supabase with migrations applied and traces A–D executed with real data.
