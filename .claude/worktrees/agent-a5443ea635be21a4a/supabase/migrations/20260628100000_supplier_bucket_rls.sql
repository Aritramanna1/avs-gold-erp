-- Migration: add_supplier_bucket_and_rls.sql
-- Create private supplier-documents bucket if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'supplier-documents') THEN
    PERFORM supabase.storage.create_bucket('supplier-documents', jsonb_build_object('public', false));
  END IF;
END $$;

-- RLS function to enforce role and branch isolation on storage objects
CREATE OR REPLACE FUNCTION public.check_storage_access(bucket_name text, object_path text)
RETURNS boolean AS $$
DECLARE
  user_role text := auth.jwt() ->> 'role';
  user_branch text := auth.jwt() ->> 'branch_id';
BEGIN
  IF user_role = 'super_owner' THEN
    RETURN true; -- full access
  END IF;
  IF user_role = 'ceo' THEN
    RETURN true; -- view‑only for all buckets
  END IF;
  IF user_role = 'branch_manager' OR user_role = 'staff' THEN
    RETURN object_path LIKE user_branch || '/%';
  END IF;
  IF user_role = 'workshop_user' THEN
    RETURN bucket_name = 'repair-attachments' AND object_path LIKE user_branch || '/%';
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply RLS policy to each relevant bucket
DO $$
DECLARE
  b record;
BEGIN
  FOR b IN SELECT name FROM storage.buckets WHERE name IN (
    'firm-assets','catalog-designs','customer-documents','worker-kyc','supplier-documents','order-attachments','repair-attachments','expense-receipts'
  )
  LOOP
    EXECUTE format(
      'CREATE POLICY %I_storage_rls ON storage.objects USING (public.check_storage_access(''%s'', path));',
      b.name, b.name);
  END LOOP;
END $$;

-- Grant authenticated users permission to use storage objects
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
