# Strix — Ornexa AI Pentest Layer

**TEST/STAGING ONLY.** Production domains are blocked by `qa/scripts/staging-guard.mjs`.

## Install

```bash
pip install strix-agent
export STRIX_LLM=openai/gpt-5.4    # or another Strix-recommended frontier model
export LLM_API_KEY=your-provider-key
```

## Configure accounts

```bash
cp qa/security/strix/accounts.example.env qa/security/strix/accounts.env
# Fill Tenant A/B QA users (never commit accounts.env)
```

## Run

```bash
npm run qa:security:strix        # quick ($3 budget default)
npm run qa:security:strix:deep   # pre-release deep scan
```

## Outputs

- `qa/reports-output/strix/<run>/` — SARIF, markdown report, logs (secrets redacted on ingest)
- `qa/reports-output/defects/DEFECTS.json` — merged findings, `REVIEW_REQUIRED` status
- `strix_runs/` — local Strix cache (gitignored)

## Rules

1. **Human review required** before any fix — Strix does not auto-remediate.
2. **No third-party exploitation** (Razorpay live, Meta, Gmail).
3. **No DoS/load flooding** — use k6 for controlled performance tests separately.
4. **Tenant B required** for cross-tenant isolation proofs.
