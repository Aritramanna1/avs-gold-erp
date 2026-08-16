#!/bin/sh
# Canonical pre-commit checks — install: cp scripts/pre-commit-check.sh .git/hooks/pre-commit
set -euo pipefail
export CI=1
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "[pre-commit] lint..."
npm run lint
echo "[pre-commit] typecheck..."
npm run typecheck
echo "[pre-commit] protect-sidebar-from-imports..."
node scripts/protect-sidebar-from-imports.cjs
echo "[pre-commit] day1 calculation selfchecks..."
node scripts/run-day1-selfchecks.mjs

STAGED="$(git diff --cached --name-only --diff-filter=ACM)"
if echo "$STAGED" | grep -qE '^(src/lib/(workers-store|billing-store|metal-conversion|metal-composition-engine|worker-gold-book|gold-settlement|license-store|customer-account-ledger)|src/routes/(billing|login|workshop|conversion)|e2e/)'; then
  if [ "${SKIP_PRECOMMIT_E2E:-}" = "1" ]; then
    echo "[pre-commit] SKIP_PRECOMMIT_E2E=1 — scoped e2e skipped"
  else
    BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
    case "$BASE_URL" in
      *maatarajewellers.shop*|*maatarajewellers.in*)
        echo "[pre-commit] ERROR: E2E_BASE_URL points at production ($BASE_URL)."
        echo "[pre-commit] Set E2E_BASE_URL to staging/test or SKIP_PRECOMMIT_E2E=1 for this commit."
        exit 1
        ;;
    esac
    SCOPED_SPECS=""
    for f in e2e/tests/metal-conversion.spec.ts e2e/tests/licensing.spec.ts; do
      if [ -f "$f" ]; then SCOPED_SPECS="$SCOPED_SPECS $f"; fi
    done
    if [ -n "$SCOPED_SPECS" ]; then
      echo "[pre-commit] scoped e2e against $BASE_URL ($SCOPED_SPECS)..."
      npm run test:e2e -- $SCOPED_SPECS
    fi
  fi
fi

echo "[pre-commit] OK"
