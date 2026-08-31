-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Atomic gold ledger posting for conversion, deposit, and workshop flows.
-- Client posts multiple entries in one transaction; vault balance validated server-side.

create or replace function public.post_gold_ledger_entries(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_firm uuid;
  v_entry jsonb;
  v_vault_delta bigint;
  v_vault_before bigint;
  v_id text;
  v_ts timestamptz;
  v_result jsonb := '[]'::jsonb;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'p_entries must be a non-empty JSON array' using errcode = '22023';
  end if;

  v_firm := public.my_firm_id();
  if v_firm is null and not public.has_role(auth.uid(), 'saas_admin'::public.app_role) then
    raise exception 'firm context required for gold ledger posting' using errcode = '42501';
  end if;

  -- Sum vault deltas in this batch
  v_vault_delta := 0;
  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_vault_delta := v_vault_delta + coalesce((v_entry->'deltas'->>'vault')::bigint, 0);
  end loop;

  if v_vault_delta < 0 then
    select coalesce(sum((bucket_deltas->>'vault')::bigint), 0)
    into v_vault_before
    from public.gold_ledger
    where firm_id = v_firm or (firm_id is null and v_firm is null);

    if v_vault_before + v_vault_delta < 0 then
      raise exception 'Gold Vault balance cannot become negative' using errcode = '23514';
    end if;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_id := coalesce(v_entry->>'id', gen_random_uuid()::text);
    v_ts := coalesce(
      to_timestamp((v_entry->>'createdAt')::double precision / 1000.0),
      now()
    );

    insert into public.gold_ledger (
      id, ts, movement, net_fine_mg, bucket_deltas, reference, note, data, firm_id
    ) values (
      v_id,
      v_ts,
      v_entry->>'type',
      (v_entry->>'netFineMg')::bigint,
      v_entry->'deltas',
      nullif(v_entry->>'reference', ''),
      nullif(v_entry->>'notes', ''),
      v_entry,
      v_firm
    )
    on conflict (id) do update set
      ts = excluded.ts,
      movement = excluded.movement,
      net_fine_mg = excluded.net_fine_mg,
      bucket_deltas = excluded.bucket_deltas,
      reference = excluded.reference,
      note = excluded.note,
      data = excluded.data,
      firm_id = excluded.firm_id;

    v_result := v_result || jsonb_build_array(v_entry || jsonb_build_object('id', v_id));
  end loop;

  return v_result;
end;
$$;

revoke all on function public.post_gold_ledger_entries(jsonb) from public, anon;
grant execute on function public.post_gold_ledger_entries(jsonb) to authenticated;
