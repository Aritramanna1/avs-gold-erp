-- Target-project storage foundation.
-- Legacy objects are intentionally not imported until ownership is proven.
-- New objects must use firms/{firm_id}/branches/{branch_id}/... paths.

CREATE TABLE IF NOT EXISTS public.storage_file_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id text REFERENCES public.branches(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  bucket_id text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','customer')),
  archived_at timestamptz,
  UNIQUE (bucket_id, storage_path)
);

ALTER TABLE public.storage_file_metadata ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_file_metadata FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.storage_file_metadata TO authenticated;

DROP POLICY IF EXISTS storage_file_metadata_select ON public.storage_file_metadata;
DROP POLICY IF EXISTS storage_file_metadata_insert ON public.storage_file_metadata;
DROP POLICY IF EXISTS storage_file_metadata_update ON public.storage_file_metadata;

CREATE POLICY storage_file_metadata_select ON public.storage_file_metadata
  FOR SELECT TO authenticated
  USING (
    firm_id = public.my_firm_id()
    AND (branch_id IS NULL OR branch_id = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1))
  );
CREATE POLICY storage_file_metadata_insert ON public.storage_file_metadata
  FOR INSERT TO authenticated
  WITH CHECK (
    firm_id = public.my_firm_id()
    AND uploaded_by = auth.uid()
    AND (branch_id IS NULL OR branch_id = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1))
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  );
CREATE POLICY storage_file_metadata_update ON public.storage_file_metadata
  FOR UPDATE TO authenticated
  USING (firm_id = public.my_firm_id() AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role))
  WITH CHECK (firm_id = public.my_firm_id() AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role));

-- Remove every legacy permissive storage policy. The target is empty, so this
-- cannot strand imported data; legacy source objects are not being imported.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY storage_objects_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    split_part(name, '/', 1) = 'firms'
    AND CASE WHEN split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(name, '/', 2)::uuid ELSE NULL END = public.my_firm_id()
    AND split_part(name, '/', 3) = 'branches'
    AND split_part(name, '/', 4) = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY storage_objects_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    split_part(name, '/', 1) = 'firms'
    AND CASE WHEN split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(name, '/', 2)::uuid ELSE NULL END = public.my_firm_id()
    AND split_part(name, '/', 3) = 'branches'
    AND split_part(name, '/', 4) = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1)
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  );

CREATE POLICY storage_objects_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    split_part(name, '/', 1) = 'firms'
    AND CASE WHEN split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(name, '/', 2)::uuid ELSE NULL END = public.my_firm_id()
    AND split_part(name, '/', 3) = 'branches'
    AND split_part(name, '/', 4) = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1)
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  )
  WITH CHECK (
    split_part(name, '/', 1) = 'firms'
    AND CASE WHEN split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(name, '/', 2)::uuid ELSE NULL END = public.my_firm_id()
    AND split_part(name, '/', 3) = 'branches'
    AND split_part(name, '/', 4) = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1)
    AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  );

CREATE POLICY storage_objects_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    split_part(name, '/', 1) = 'firms'
    AND CASE WHEN split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(name, '/', 2)::uuid ELSE NULL END = public.my_firm_id()
    AND split_part(name, '/', 3) = 'branches'
    AND split_part(name, '/', 4) = (SELECT up.branch_id FROM public.user_profiles up WHERE up.auth_id = auth.uid() LIMIT 1)
    AND public.is_admin(auth.uid())
  );
