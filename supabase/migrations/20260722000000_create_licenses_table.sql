CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  company_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  edition text NOT NULL,
  seats integer NOT NULL DEFAULT 1,
  expiry_date timestamptz,
  payload text NOT NULL,
  signature text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view, insert, and update licenses
CREATE POLICY "Allow authenticated full access to licenses"
ON public.licenses
AS PERMISSIVE
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
