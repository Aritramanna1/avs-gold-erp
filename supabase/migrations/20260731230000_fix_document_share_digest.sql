-- Forward fix for deployments where the original share resolver predates pgcrypto.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.resolve_document_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_share public.document_shares;
  v_hash text;
begin
  if p_token is null or length(p_token) < 48 then return null; end if;
  v_hash := encode(extensions.digest(p_token::bytea, 'sha256'::text), 'hex');
  select * into v_share
  from public.document_shares
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now()
    and (max_views is null or view_count < max_views)
  for update;
  if not found then return null; end if;
  update public.document_shares
  set view_count = view_count + 1, last_accessed_at = now()
  where id = v_share.id;
  return jsonb_build_object(
    'id', v_share.id, 'document_type', v_share.document_type,
    'document_id', v_share.document_id, 'firm_snapshot', v_share.firm_snapshot,
    'document_snapshot', v_share.document_snapshot, 'expires_at', v_share.expires_at,
    'created_at', v_share.created_at, 'branch_id', v_share.branch_id
  );
end;
$$;

revoke all on function public.resolve_document_share(text) from public, authenticated;
grant execute on function public.resolve_document_share(text) to anon;
