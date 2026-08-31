-- Client code defaults selectedBranchId to a placeholder ("MAIN") that
-- predates real branch provisioning and is never an actual row in
-- public.branches (real ids look like "br_xxxxxxxxxxxx"). That placeholder
-- then flows into every branch_id-FK'd table's insert and trips the FK
-- constraint (e.g. attachments_branch_id_fkey, central_parties_default_branch_id_fkey).
-- Root-cause fix: before insert, if branch_id/default_branch_id doesn't
-- match a real branches row, null it out instead of failing the insert —
-- same pattern as 20260813061000's firm_id default, applied once across
-- every affected table instead of validating branch selection at every
-- call site.

CREATE OR REPLACE FUNCTION public.null_invalid_branch_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches WHERE id = NEW.branch_id
  ) THEN
    NEW.branch_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.null_invalid_default_branch_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.default_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches WHERE id = NEW.default_branch_id
  ) THEN
    NEW.default_branch_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  -- comm_provider_secrets.branch_id is NOT NULL — excluded; an invalid
  -- branch_id there must fail loudly rather than silently drop the secret's
  -- branch scope.
  tables text[] := ARRAY[
    'workshops','comm_provider_settings','user_profiles','storage_file_metadata','invitations',
    'platform_service_requests','platform_support_tickets','attachments',
    'specialist_work_variances','specialist_payment_clearances','metal_conversions',
    'workshop_process_transactions','customer_gold_deposits','central_activity_events',
    'central_message_threads'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_null_invalid_branch_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_null_invalid_branch_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.null_invalid_branch_id()',
      t
    );
  END LOOP;

  IF to_regclass('public.central_parties') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_null_invalid_default_branch_id ON public.central_parties';
    EXECUTE 'CREATE TRIGGER trg_null_invalid_default_branch_id BEFORE INSERT OR UPDATE ON public.central_parties FOR EACH ROW EXECUTE FUNCTION public.null_invalid_default_branch_id()';
  END IF;
END $$;
