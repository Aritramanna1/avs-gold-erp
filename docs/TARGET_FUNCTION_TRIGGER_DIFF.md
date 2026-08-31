# Target Function and Trigger Diff

Old project exposes 25 public routines, including `my_firm_id`, `has_role`, `is_admin`, `is_saas_admin`, `onboard_tenant`, `execute_gold_transaction`, audit helpers, numbering helpers, and subscription feature helpers. Target exposes only 3: `generate_sequential_number`, `rls_auto_enable`, and `set_updated_at`.

Classification: 22 routines are `MISSING_IN_TARGET`; shared numbering/trigger functions are `SEMANTIC_CONFLICT` until their definitions and dependent columns are compared. Onboarding, SaaS, audit, tenant, and gold transaction routines must be installed only after their prerequisite tables exist.
