-- Migration: 20260628120000_crm_core.sql
-- Description: Core tables for MTJ ERP CRM Module (Leads, Tasks/Meetings, Interaction Timeline)

-- 1. LEADS & OPPORTUNITIES (Sales Pipeline)
CREATE TABLE IF NOT EXISTS public.crm_leads_opportunities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  person_id           TEXT REFERENCES public.people(id) ON DELETE CASCADE, -- Link to customer/prospect
  lead_name           TEXT NOT NULL, -- e.g., "Rahul Sharma Wedding Order"
  stage               TEXT NOT NULL CHECK (stage IN ('lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  estimated_value_paise BIGINT NOT NULL DEFAULT 0,
  target_gold_mg      BIGINT NOT NULL DEFAULT 0,
  assigned_staff_email TEXT,
  follow_up_date      DATE,
  last_contacted_at   TIMESTAMPTZ,
  remarks             TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and create branch-scoped policies
ALTER TABLE public.crm_leads_opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_leads_branch_isolation" ON public.crm_leads_opportunities;
CREATE POLICY "crm_leads_branch_isolation" ON public.crm_leads_opportunities
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_crm_leads_branch ON public.crm_leads_opportunities(branch_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_person ON public.crm_leads_opportunities(person_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads_opportunities(stage);

-- 2. TASKS & MEETINGS
CREATE TABLE IF NOT EXISTS public.crm_tasks_meetings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  person_id           TEXT REFERENCES public.people(id) ON DELETE CASCADE,
  opportunity_id      UUID REFERENCES public.crm_leads_opportunities(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('task', 'meeting', 'follow_up')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'cancelled')),
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date            TIMESTAMPTZ NOT NULL,
  assigned_staff_email TEXT,
  description         TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_tasks_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_tasks_branch_isolation" ON public.crm_tasks_meetings;
CREATE POLICY "crm_tasks_branch_isolation" ON public.crm_tasks_meetings
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_crm_tasks_branch ON public.crm_tasks_meetings(branch_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_person ON public.crm_tasks_meetings(person_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks_meetings(due_date);

-- 3. CRM INTERACTIONS (Manual Timeline logging)
CREATE TABLE IF NOT EXISTS public.crm_interactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  person_id           TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  opportunity_id      UUID REFERENCES public.crm_leads_opportunities(id) ON DELETE SET NULL,
  type                TEXT NOT NULL CHECK (type IN ('note', 'call', 'meeting', 'whatsapp', 'email', 'sms', 'comment', 'system_event')),
  title               TEXT NOT NULL,
  body                TEXT,
  staff_email         TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_interactions_branch_isolation" ON public.crm_interactions;
CREATE POLICY "crm_interactions_branch_isolation" ON public.crm_interactions
  FOR ALL TO authenticated USING (
    branch_id = ANY(public.get_user_branch_ids()) OR public.is_global_user()
  );

CREATE INDEX IF NOT EXISTS idx_crm_interact_branch ON public.crm_interactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_crm_interact_person ON public.crm_interactions(person_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks_meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interactions TO authenticated;
