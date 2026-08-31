# Baseline alignment rule (Owner 2026-08-29)

## Truth vs workspace

| Role | Location | Rule |
|------|----------|------|
| **Authoritative baseline** | `production-dist-shop/`, `index-CVsE73i6.js`, `dist_go_20260826_190800.zip`, `BASELINE_MANIFEST.json`, `baseline-documentation/` | **Read-only reference.** Never edit to “fix” source. Keep untouched as evidence. |
| **Editable workspace (“Full Source Code”)** | this handoff’s `src/` (+ app config / `supabase/` here) | Implementation workspace only. **Must not** treat its existing code, UI, business logic, DB assumptions, routes, or behaviour as truth. Align/modify it **to** the recovered baseline. |

There is **no** separate folder literally named `Full Source Code` in this install.
That phrase means: **editable implementation workspace = `src/` in this package**.

External trees (e.g. Downloads `AVS-FULL-SOURCE-EXTRACT`) may supply **candidate** modules
only after they are checked against shop chunks. They are **not** the foundation.
Do **not** copy another ERP into this tree. Do **not** create a separate workspace.

## Process

```
RECOVERED CVsE73i6/MTJ BASELINE = TRUTH
        ↓
“Full Source Code” (this src/) = EDITABLE WORKSPACE
        ↓
ALIGN/MODIFY IT TO THE BASELINE
        ↓
VERIFY FULL-STACK PARITY
        ↓
ONLY THEN IMPLEMENT APPROVED NEW REQUIREMENTS
```

1. Recovered CVsE73i6/MTJ deployment = truth.
2. Modify `src/` until full-stack behaviour matches recovery (FE + BE integration + DB/RPC + auth/RLS + calculations + ledger/gold + documents + routing + portals + errors).
3. Verify: align → build → functional parity (not “UI looks similar”).
4. Only then implement approved new requirements on top.
5. ₹10K / ₹20K / MTJ new work is **forbidden** until full-stack parity is verified.

## Baseline equation

- Git: `8dc1c438214a5e3192e15dc95b7708de24ca6baf`
- Artifact: `index-CVsE73i6.js` SHA256 `DDE3DCBECA50D0EE30882C0B98B25D8E95E8B1429319EFBD31720C61518D08D8`
