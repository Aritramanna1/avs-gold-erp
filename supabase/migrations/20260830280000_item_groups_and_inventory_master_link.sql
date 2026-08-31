-- Item Groups master + inventory ↔ item_masters authority link
-- Forward-safe, RLS-aware (ITEM_AND_MATERIAL_MASTER.md §2.1)

CREATE TABLE IF NOT EXISTS public.item_groups (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  firm_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_code text NOT NULL,
  group_name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_groups_firm_code_unique UNIQUE (firm_id, group_code)
);

CREATE INDEX IF NOT EXISTS idx_item_groups_firm ON public.item_groups (firm_id);
CREATE INDEX IF NOT EXISTS idx_item_groups_firm_active ON public.item_groups (firm_id, is_active);

ALTER TABLE public.item_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_groups_tenant_select ON public.item_groups;
CREATE POLICY item_groups_tenant_select ON public.item_groups
  FOR SELECT TO authenticated
  USING (
    public.is_saas_admin()
    OR firm_id = public.my_firm_id()
    OR (firm_id IS NULL AND public.my_firm_id() IS NULL)
  );

DROP POLICY IF EXISTS item_groups_tenant_write ON public.item_groups;
CREATE POLICY item_groups_tenant_write ON public.item_groups
  FOR ALL TO authenticated
  USING (
    public.is_saas_admin()
    OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role())
  )
  WITH CHECK (
    public.is_saas_admin()
    OR (firm_id = public.my_firm_id() AND NOT public.is_customer_role())
  );

DROP TRIGGER IF EXISTS trg_item_groups_uat ON public.item_groups;
CREATE TRIGGER trg_item_groups_uat
  BEFORE UPDATE ON public.item_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.item_masters
  ADD COLUMN IF NOT EXISTS item_group_id text REFERENCES public.item_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_item_masters_group_id
  ON public.item_masters (item_group_id)
  WHERE item_group_id IS NOT NULL;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS item_master_id text REFERENCES public.item_masters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_item_master_id
  ON public.inventory (item_master_id)
  WHERE item_master_id IS NOT NULL;
