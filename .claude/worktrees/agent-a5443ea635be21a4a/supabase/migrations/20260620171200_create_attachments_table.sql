-- Migration: Create public.attachments table and set up RLS matching existing security standards

CREATE TABLE IF NOT EXISTS public.attachments (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  linked_table TEXT NOT NULL,
  linked_id TEXT NOT NULL,
  file_name TEXT,
  storage_path TEXT,
  mime_type TEXT,
  size_bytes INT,
  data JSONB NOT NULL DEFAULT '{}',
  firm_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on public.attachments table
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Apply production-grade RLS policies
CREATE POLICY "Allow authenticated read on attachments" 
ON public.attachments 
FOR SELECT 
TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated insert on attachments" 
ON public.attachments 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

CREATE POLICY "Allow authenticated update on attachments" 
ON public.attachments 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

CREATE POLICY "Allow authenticated delete on attachments" 
ON public.attachments 
FOR DELETE 
TO authenticated 
USING (
  auth.uid() IS NOT NULL 
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);
