-- Additive: align commercial seed prices to Owner-approved edition planning docx.
-- Docx ladder: Edition 1 ≈ ₹10,000/yr · Edition 2 ≈ ₹30,000/yr · Edition 3 ≈ ₹50,000/yr
-- Docx: ₹20K / ₹40K are NOT separate editions — keep AVS_20K_* rows (hide≠delete) but
-- mark inactive for new assignments; Platform Owner may still edit price_minor.
-- Does NOT rewrite gold/ULE/calc engines. Prices remain Owner-editable after seed.

BEGIN;

-- Ensure optional visibility column exists (additive)
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS is_assignable boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.platform_plans.is_assignable IS
  'When false, plan is retained for history but hidden from new Platform assignments (docx SoT).';

-- Docx Edition 1 / 2 / 3 annual seeds (paise). Owner may change later via Platform UI.
UPDATE public.platform_plans
SET
  price_minor = 1000000, -- ₹10,000
  billing_cycle = coalesce(billing_cycle, 'yearly'),
  is_assignable = true,
  updated_at = now()
WHERE code IN ('AVS_10K_RETAIL', 'AVS_10K_MFG');

UPDATE public.platform_plans
SET
  price_minor = 3000000, -- ₹30,000
  billing_cycle = coalesce(billing_cycle, 'yearly'),
  is_assignable = true,
  updated_at = now()
WHERE code IN ('AVS_30K_RETAIL', 'AVS_30K_MFG');

UPDATE public.platform_plans
SET
  price_minor = 5000000, -- ₹50,000
  billing_cycle = coalesce(billing_cycle, 'yearly'),
  is_assignable = true,
  updated_at = now()
WHERE code = 'AVS_50K_FULL';

-- MTJ/MTG workshop edition — price Owner-set; default seed 0 (not inventing a docx price)
UPDATE public.platform_plans
SET
  is_assignable = true,
  updated_at = now()
WHERE code = 'AVS_MTG';

-- Soft-hide 20K band from new assignments (rows retained)
UPDATE public.platform_plans
SET
  is_assignable = false,
  description = coalesce(description, '') ||
    CASE
      WHEN description ILIKE '%docx%' THEN ''
      ELSE ' [Not a separate edition per AVS_ERP_PRODUCT_EDITION_PLANNING.docx — retained for history.]'
    END,
  updated_at = now()
WHERE code IN ('AVS_20K_RETAIL', 'AVS_20K_MFG');

COMMIT;
