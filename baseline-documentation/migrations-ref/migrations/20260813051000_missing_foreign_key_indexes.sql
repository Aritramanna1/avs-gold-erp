-- Add covering indexes for public foreign keys that do not already have one.
--
-- Supabase performance advisor flags unindexed foreign keys because deletes,
-- updates, joins, and RLS predicates can become expensive as tenant data grows.
-- This migration is additive only: it does not change data, RLS, constraints,
-- or business behavior.

do $$
declare
  fk record;
  v_index_name text;
  v_columns_sql text;
begin
  for fk in
    with fk_cols as (
      select
        con.oid as constraint_oid,
        con.conname,
        n.nspname as schema_name,
        rel.relname as table_name,
        con.conrelid,
        con.conkey,
        array_agg(att.attname order by ord.ordinality) as column_names
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      join unnest(con.conkey) with ordinality as ord(attnum, ordinality) on true
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = ord.attnum
      where con.contype = 'f'
        and n.nspname = 'public'
      group by con.oid, con.conname, n.nspname, rel.relname, con.conrelid, con.conkey
    )
    select *
    from fk_cols f
    where not exists (
      select 1
      from pg_index i
      where i.indrelid = f.conrelid
        and i.indisvalid
        and (
          select array_agg(k order by ord)
          from unnest(i.indkey::int2[]) with ordinality as x(k, ord)
          where ord <= cardinality(f.conkey)
        ) = f.conkey
    )
    order by f.table_name, f.conname
  loop
    v_index_name := left(
      'idx_fk_' || fk.table_name || '_' || array_to_string(fk.column_names, '_') ||
      '_' || substr(md5(fk.table_name || ':' || fk.conname || ':' || array_to_string(fk.column_names, ',')), 1, 8),
      63
    );

    select string_agg(format('%I', c), ', ')
      into v_columns_sql
    from unnest(fk.column_names) as c;

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      v_index_name,
      fk.schema_name,
      fk.table_name,
      v_columns_sql
    );
  end loop;
end $$;
