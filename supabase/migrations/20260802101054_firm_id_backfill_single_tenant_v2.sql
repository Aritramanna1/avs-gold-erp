-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

do $$
declare
  v_org uuid;
  v_count int;
  t text;
  tables text[] := array[
    'gold_ledger','invoices','orders','people','payments','inventory','job_cards',
    'gold_settlements','metal_conversions','customer_gold_deposits','material_vault_movements',
    'manufacturing_bills','melt_jobs','repairs','app_settings','worker_transactions'
  ];
begin
  select count(*), (array_agg(id order by created_at nulls last))[1]
  into v_count, v_org
  from public.organizations;
  if v_count <> 1 or v_org is null then
    raise notice 'firm_id backfill skipped: % organizations (need exactly 1)', v_count;
    return;
  end if;

  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'firm_id'
    ) then
      continue;
    end if;
    execute format(
      'update public.%I set firm_id = $1 where firm_id is null',
      t
    ) using v_org;
  end loop;

  update public.user_profiles set firm_id = v_org where firm_id is null;
  update public.branches set firm_id = v_org where firm_id is null;
end;
$$;
