-- Reconciled from production (project dqgrrafuoxaorvyrcuuh) on 2026-08-11 — this migration was applied directly to Supabase and had no local file until now.

-- Additive compatibility for the target project, which still exposes the older global sequence routine. The sequence key is tenant-namespaced from auth.uid() and never trusts a firm id supplied by the browser.
create or replace function public.next_document_number(
  p_key text,
  p_prefix text,
  p_pad_length integer default 4
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm text;
  v_type text;
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  select coalesce(firm_id::text, 'platform') into v_firm
  from public.user_profiles
  where auth_id = auth.uid()
  limit 1;
  if v_firm is null then
    raise exception 'tenant profile required';
  end if;
  v_type := v_firm || ':' || left(coalesce(p_key, ''), 180);
  insert into public.document_sequences(type, prefix, last_value)
  values (v_type, p_prefix, 1)
  on conflict (type, prefix) do update
    set last_value = public.document_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;
  return coalesce(p_prefix, '') || lpad(v_next::text, greatest(1, least(p_pad_length, 12)), '0');
end;
$$;
revoke all on function public.next_document_number(text, text, integer) from public;
grant execute on function public.next_document_number(text, text, integer) to authenticated;
