# Target Reconciliation Risk Register

| Risk | Severity | Status | Safest action |
|---|---|---|---|
| Existing target schema conflicts with create migrations | P0 | Open | Produce canonical column/constraint diff |
| Target rows have no tenant identity model | P0 | Open | Map or quarantine before constraints/RLS |
| 85 target policies contain `true` predicates | P0 | Open | Replace only after identity foundation |
| Target has no storage buckets | P0 | Open | Create after metadata/path design |
| Native backup unavailable because Docker is absent | P0 | Open | Provide pg_dump-capable environment or management export |
| Target-only tables have unknown semantics | P1 | Open | Obtain owner/schema documentation |
| Gold semantics may differ | P0 | Open | Compare routines, data, and business rules |
| Legacy KYC ownership is unproven | P0 | Open | Keep old files quarantined; do not import |
