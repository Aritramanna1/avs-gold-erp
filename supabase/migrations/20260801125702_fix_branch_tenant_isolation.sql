-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select to authenticated
  using (
    public.has_role(auth.uid(), 'saas_admin'::public.app_role)
    or (
      public.my_firm_id() is not null
      and firm_id = public.my_firm_id()
    )
    or (
      id in (
        select up.branch_id
        from public.user_profiles up
        where up.auth_id = auth.uid()
          and up.active
          and up.status = 'active'
          and up.branch_id is not null
      )
    )
  );

drop policy if exists workshops_select on public.workshops;
create policy workshops_select on public.workshops for select to authenticated
  using (
    public.has_role(auth.uid(), 'saas_admin'::public.app_role)
    or (
      public.my_firm_id() is not null
      and firm_id = public.my_firm_id()
    )
  );

update public.branches b
set firm_id = up.firm_id
from public.user_profiles up
where b.firm_id is null
  and up.branch_id = b.id
  and up.firm_id is not null;
