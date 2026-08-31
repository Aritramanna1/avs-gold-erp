-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

create or replace function public.consolidate_duplicate_branches(p_firm_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid;
  v_group record;
  v_canonical text;
  v_dup text;
  v_archived int := 0;
begin
  v_firm := coalesce(p_firm_id, public.my_firm_id());

  for v_group in
    select firm_id, lower(trim(short_name)) as sn, array_agg(id order by
      case when id in ('MAIN', 'mtj-qa-a-main') then 0 else 1 end,
      created_at asc
    ) as ids
    from public.branches
    where (v_firm is null or firm_id = v_firm)
      and coalesce(active, true)
    group by firm_id, lower(trim(short_name))
    having count(*) > 1
  loop
    v_canonical := v_group.ids[1];
    for i in 2..array_length(v_group.ids, 1) loop
      v_dup := v_group.ids[i];
      update public.user_profiles set branch_id = v_canonical where branch_id = v_dup;
      update public.supplier_purchases set branch_id = v_canonical where branch_id = v_dup;
      update public.material_vault_movements set branch_id = v_canonical where branch_id = v_dup;
      update public.workshops set branch_id = v_canonical where branch_id = v_dup;
      update public.branches
        set active = false,
            name = name || ' (archived)',
            data = coalesce(data, '{}'::jsonb) || jsonb_build_object('archived_duplicate_of', v_canonical, 'archived_at', now())
        where id = v_dup;
      v_archived := v_archived + 1;
    end loop;
  end loop;

  return jsonb_build_object('archived', v_archived);
end;
$$;

revoke all on function public.consolidate_duplicate_branches(uuid) from public, anon;
grant execute on function public.consolidate_duplicate_branches(uuid) to authenticated;

select public.consolidate_duplicate_branches(null);
