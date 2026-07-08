-- Migration: Create public.file_attachments table and set up RLS matching existing security standards
-- Created at 2026-06-21

CREATE TABLE IF NOT EXISTS public.file_attachments (
  id TEXT PRIMARY KEY,
  storage_provider TEXT NOT NULL DEFAULT 'hostinger',
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  related_module TEXT NOT NULL, -- 'firm-logos', 'catalog', 'order-attachments', 'repair-photos', etc.
  related_table TEXT NOT NULL,
  related_record_id TEXT NOT NULL,
  branch_id TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

-- Apply standard RLS policies
DROP POLICY IF EXISTS "Allow authenticated read on file_attachments" ON public.file_attachments;
CREATE POLICY "Allow authenticated read on file_attachments" 
ON public.file_attachments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated insert on file_attachments" ON public.file_attachments;
CREATE POLICY "Allow authenticated insert on file_attachments" 
ON public.file_attachments FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

DROP POLICY IF EXISTS "Allow authenticated update on file_attachments" ON public.file_attachments;
CREATE POLICY "Allow authenticated update on file_attachments" 
ON public.file_attachments FOR UPDATE TO authenticated USING (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
) WITH CHECK (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

DROP POLICY IF EXISTS "Allow authenticated delete on file_attachments" ON public.file_attachments;
CREATE POLICY "Allow authenticated delete on file_attachments" 
ON public.file_attachments FOR DELETE TO authenticated USING (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

-- Enable SELECT/INSERT/UPDATE/DELETE grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_attachments TO authenticated;
GRANT ALL ON public.file_attachments TO service_role;
