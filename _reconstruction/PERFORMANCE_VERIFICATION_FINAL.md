# Performance Verification Final

**Date:** 2026-08-30T12:42:44.354Z  
**Project:** https://dqgrrafuoxaorvyrcuuh.supabase.co  
**Result:** 35/35 checks PASS

## Before / After (documented)

| Metric | Before (aggressive throttle) | After (current) |
|--------|------------------------------|-------------------|
| PROD REST cap | 10 req / 10s | 80 req / 10s (120 boot) |
| PROD min gap | 400ms between requests | 0ms |
| pullCritical timeout | 28s (regression) | 45s staged-load |
| Critical catalog pulls | sequential | parallel after app_settings |
| Boot duplicate | pullAll + startCloudSync | startCloudSync only |
| TOKEN_REFRESHED | re-boot (storm) | skipped |

## Measured (this run)

| Metric | Value |
|--------|-------|
| Login (ERP owner) | 708 ms |
| Boot chain (simulated critical + dashboard) | 787 ms |
| Total REST/RPC probes | 26 |
| Duplicate request keys | 8 |
| Module probes | see JSON |

## Subscription gate

- [x] rpc_with_active_firm: status=200 access=granted valid=true
- [x] membership_evidence_active_or_trial: subscription_status=active
- [x] membership_fallback_would_grant: RPC failure path has membership evidence for grant
- [x] bogus_org_not_auto_granted: access=denied valid=false
- [x] is_platform_owner: is_platform_owner=true
- [x] platform_route: default_route=/platform

## Architecture audit

- [x] prod_throttle_not_aggressive: PROD: 80 req/10s, 0ms gap; DEV: 10/400 retained
- [x] prod_boot_throttle_relaxed: PROD boot: 120 req/10s, 0ms gap
- [x] inflight_dedupe_present: GET dedupe via in-flight map + pull-dedupe.ts
- [x] no_duplicate_pullAll_boot: tenant-context uses startCloudSync only (no pullAll call)
- [x] token_refresh_skips_boot: TOKEN_REFRESHED does not re-run bootstrap
- [x] pullCritical_45s_budget: pullCritical uses 45s staged-load fail threshold
- [x] critical_pulls_parallel_after_settings: branches/branch_settings/dropdown_masters parallel after app_settings
- [x] subscription_gate_passes_org_id: resolveSubscriptionAccess receives activeOrganizationId
- [x] subscription_membership_fallback: RPC failure falls back to membership subscription_status
- [x] platform_owner_gate_bypass: Platform owners bypass SubscriptionRequired screen

## Failures

_None — all required checks passed._

## PostgreSQL errors (24h)

_skipped_
