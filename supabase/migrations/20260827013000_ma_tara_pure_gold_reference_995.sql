-- Additive only: seed firm pure-gold reference default = 995 (owner-locked).
-- Does NOT rewrite gold_ledger, fineMg on posted documents, or other settings keys.
-- Does NOT invent payout % or non-payable material lists.
--
-- maTaraWorkshopPolicy.pureGoldReferencePermille = 995 when missing.
-- materialPayableByCategoryKey defaults to {} (all materials PAYABLE by omission).

BEGIN;

UPDATE public.app_settings AS a
SET
  data = jsonb_set(
    COALESCE(a.data, '{}'::jsonb),
    '{maTaraWorkshopPolicy}',
    (
      COALESCE(a.data -> 'maTaraWorkshopPolicy', '{}'::jsonb)
      || jsonb_build_object('pureGoldReferencePermille', 995)
    )
    || CASE
      WHEN COALESCE(a.data -> 'maTaraWorkshopPolicy' -> 'materialPayableByCategoryKey', 'null'::jsonb)
        = 'null'::jsonb
      THEN jsonb_build_object('materialPayableByCategoryKey', '{}'::jsonb)
      ELSE '{}'::jsonb
    END,
    true
  ),
  updated_at = now()
WHERE a.scope = 'firm'
  AND a.id !~ ':'
  AND a.data ? 'goldRatePerGramPaise'
  AND (
    a.data -> 'maTaraWorkshopPolicy' IS NULL
    OR a.data -> 'maTaraWorkshopPolicy' ->> 'pureGoldReferencePermille' IS NULL
    OR a.data -> 'maTaraWorkshopPolicy' -> 'materialPayableByCategoryKey' IS NULL
  );

COMMIT;
