# Target RLS Policy Diff

Old project: 210 public policies; the authoritative target currently has 90 public policies. The target has 85 literal-`true` predicates, including authenticated and anon hybrid-runtime policies on core tables. The earlier 210-policy/one-literal-true observation came from accidentally querying the old project while the CLI link had drifted. It is not target evidence.

No target RLS corrective migration is currently safe to apply because organizations, user profiles, branch membership, and target data ownership must be reconciled first.

Required corrective order: create identity helpers and profile mappings, profile existing rows or quarantine them, then replace permissive policies table-by-table with tested firm/branch predicates. Do not use a global policy rewrite before data ownership is mapped.

Authenticated RLS tests remain incomplete because controlled target sessions have not yet been created and validated.
