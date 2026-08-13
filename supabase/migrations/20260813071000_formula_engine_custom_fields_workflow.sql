-- Ornexa ERP — Formula Engine, Custom Fields & Workflow Configuration Tables (Sections 63-64, 69)
-- Creates no-code transaction definitions, formula engine, custom fields, and workflow steps.
-- All tables are firm-scoped with RLS for multi-tenant isolation.

-- ============================================================
-- A. Formula Definitions (Section 63)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.formula_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  formula_code TEXT NOT NULL,
  formula_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'making_charge',     -- 'making_charge', 'wastage', 'labour', 'stone_charge', 'polish', 'hallmark', 'discount', 'gst', 'custom'
  description TEXT,
  expression TEXT NOT NULL,                           -- formula expression e.g. "{net_wt} * {rate_per_gram} + {stone_charge}"
  input_variables JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name, type, label, default_value}]
  output_unit TEXT NOT NULL DEFAULT 'paise',          -- 'paise', 'mg', 'grams', 'pieces', 'percentage'
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_formula_code_firm UNIQUE (firm_id, formula_code)
);

-- ============================================================
-- B. Formula Rule Sets (Section 63)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.formula_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_set_name TEXT NOT NULL,
  description TEXT,
  applies_to TEXT NOT NULL DEFAULT 'all',             -- 'all', 'branch', 'customer_group', 'product_category', 'specific_party'
  applies_to_id TEXT,                                 -- specific branch_id, party_id, category
  priority INT NOT NULL DEFAULT 100,                  -- lower = higher priority
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,      -- conditional logic: {if: {field: "karat", op: "eq", value: 22}, then: use_formula_x}
  formula_id UUID REFERENCES public.formula_definitions(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- C. Custom Field Definitions (Section 64)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,                          -- 'order', 'job_card', 'invoice', 'party', 'stock_item', 'settlement', 'universal_transaction'
  field_code TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'number', 'decimal', 'date', 'datetime', 'boolean', 'select', 'multi_select', 'file', 'textarea', 'phone', 'email', 'url')),
  options JSONB,                                      -- for select/multi_select: [{value, label}]
  default_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_searchable BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  section_label TEXT,                                 -- group fields into sections
  help_text TEXT,
  validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb, -- {min, max, pattern, etc.}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_custom_field_entity_firm UNIQUE (firm_id, entity_type, field_code)
);

-- ============================================================
-- D. Custom Field Values (Section 64)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_value TEXT,
  field_value_json JSONB,                             -- for complex types (multi_select, file)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_custom_field_value UNIQUE (field_definition_id, entity_type, entity_id)
);

-- ============================================================
-- E. Workflow Step Definitions (Section 69)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflow_step_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_code TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,                          -- 'order', 'job_card', 'invoice', 'settlement', 'repair'
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,           -- [{step_order, step_name, required_role, auto_advance, conditions, actions}]
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_code_firm UNIQUE (firm_id, workflow_code)
);

-- ============================================================
-- F. Workflow Step Instances (Section 69)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflow_step_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_definition_id UUID NOT NULL REFERENCES public.workflow_step_definitions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  current_step_order INT NOT NULL DEFAULT 0,
  current_step_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled', 'on_hold')),
  step_history JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{step_order, step_name, entered_at, completed_at, completed_by, notes}]
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_formula_definitions_firm ON public.formula_definitions(firm_id);
CREATE INDEX IF NOT EXISTS idx_formula_rule_sets_firm ON public.formula_rule_sets(firm_id, applies_to);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_firm ON public.custom_field_definitions(firm_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON public.custom_field_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON public.custom_field_values(field_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_defs_firm ON public.workflow_step_definitions(firm_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_workflow_step_instances_entity ON public.workflow_step_instances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_instances_status ON public.workflow_step_instances(status);

-- ============================================================
-- RLS Policies — firm-scoped isolation
-- ============================================================
ALTER TABLE public.formula_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formula_definitions_firm_isolation" ON public.formula_definitions
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "formula_rule_sets_firm_isolation" ON public.formula_rule_sets
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "custom_field_definitions_firm_isolation" ON public.custom_field_definitions
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "custom_field_values_firm_isolation" ON public.custom_field_values
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "workflow_step_definitions_firm_isolation" ON public.workflow_step_definitions
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
CREATE POLICY "workflow_step_instances_firm_isolation" ON public.workflow_step_instances
  FOR ALL USING (firm_id = public.my_firm_id()) WITH CHECK (firm_id = public.my_firm_id());
