# Target Dependency Graph

```text
extensions/enums
  -> organizations
  -> branches
  -> user_profiles + user_roles + branch membership
  -> tenant helper functions (my_firm_id/has_role/is_admin)
  -> SaaS plans/subscriptions/features/audit
  -> masters and compatibility columns
  -> people/KYC/attachments
  -> orders/workshop/manufacturing
  -> gold ledger/inventory/finance
  -> storage metadata and private buckets
  -> RLS policy replacement
  -> onboard_tenant()
  -> authenticated verification
```

No stage may replace policies before the tenant helper and ownership stages are complete.
