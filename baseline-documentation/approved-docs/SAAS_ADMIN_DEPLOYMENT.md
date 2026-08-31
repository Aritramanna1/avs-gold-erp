# SaaS Admin Deployment

The SaaS control-plane migration is `supabase/migrations/20260730150000_saas_admin_control_plane.sql`.

From an authenticated deployment environment:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase migration list --linked
```

Before enabling the panel, create a dedicated `saas_admin` user and verify:

1. A normal company user receives RLS denial on `/saas-admin` and platform tables.
2. A firm owner can read only their subscription and feature rows.
3. A `saas_admin` can read tenant metadata but cannot read or mutate gold, financial, settlement, or audit business records through platform policies.
4. Support sessions require a reason and expire after the configured window.
5. Platform audit inserts contain the authenticated actor.

The current workspace cannot complete `db push` because the linked Supabase login role returns `Resource has been removed`; no Supabase database password or access token is present in local environment files.
