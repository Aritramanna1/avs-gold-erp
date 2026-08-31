# Target Migration History Strategy

Do not run `migration repair` now. Target history is empty while target schema is partially populated. Marking repository migrations applied would create false equivalence.

After reconciliation succeeds, add one named target-baseline reconciliation migration, verify its objects and data effects, then record only the historical effects proven equivalent. Unmatched historical migrations remain documented as reconciled-by-baseline, not blindly marked applied.
