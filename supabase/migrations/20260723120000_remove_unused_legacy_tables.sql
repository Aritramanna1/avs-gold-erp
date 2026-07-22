-- Workshop Edition cleanup.
-- The schema backup was committed before this migration. These tables had no
-- runtime repository/service references in the Workshop application and are
-- retained only by legacy generated types or earlier architecture iterations.
-- This migration intentionally does not remove any active Workshop tables.

DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.gold_issue_register CASCADE;
DROP TABLE IF EXISTS public.gold_receive_register CASCADE;
DROP TABLE IF EXISTS public.kyc_documents CASCADE;
DROP TABLE IF EXISTS public.job_process_steps CASCADE;
