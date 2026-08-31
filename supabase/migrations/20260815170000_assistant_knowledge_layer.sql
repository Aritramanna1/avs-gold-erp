-- Ornexa Assistant Knowledge & Language Understanding Layer
-- Master refs: ASSISTANT_MASTER.md, AI_RUNTIME_ARCHITECTURE.md, JEWELLERY_TERMINOLOGY_MASTER.md

-- 1. Curated knowledge articles (system + tenant extensions)
CREATE TABLE IF NOT EXISTS public.assistant_knowledge_articles (
  id TEXT PRIMARY KEY,
  firm_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  knowledge_tier TEXT NOT NULL DEFAULT 'industry'
    CHECK (knowledge_tier IN ('product', 'industry', 'india', 'tenant', 'faq')),
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en-IN',
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_doc TEXT,
  related_route TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(topic, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_firm
  ON public.assistant_knowledge_articles (firm_id)
  WHERE firm_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_tier
  ON public.assistant_knowledge_articles (knowledge_tier);

CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_search
  ON public.assistant_knowledge_articles USING GIN (search_vector);

-- 2. Tenant-configurable language aliases (Customization → Business Language)
CREATE TABLE IF NOT EXISTS public.assistant_language_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  alias_text TEXT NOT NULL,
  canonical_text TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'terminology'
    CHECK (alias_type IN ('terminology', 'typo', 'hinglish', 'abbreviation', 'party_nickname')),
  language TEXT NOT NULL DEFAULT 'en-IN',
  context_hint TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assistant_alias_firm UNIQUE (firm_id, alias_text, alias_type)
);

CREATE INDEX IF NOT EXISTS idx_assistant_aliases_firm
  ON public.assistant_language_aliases (firm_id);

-- 3. Intent normalization audit trail (debugging / compliance)
CREATE TABLE IF NOT EXISTS public.assistant_intent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID DEFAULT auth.uid(),
  raw_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  detected_language TEXT,
  resolved_intent TEXT,
  resolved_tool TEXT,
  entity_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  knowledge_hits JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_language_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_intent_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assistant_knowledge_articles'
      AND policyname = 'assistant_knowledge_read'
  ) THEN
    CREATE POLICY assistant_knowledge_read ON public.assistant_knowledge_articles
      FOR SELECT USING (
        is_system = true
        OR firm_id IS NULL
        OR firm_id = public.my_firm_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assistant_knowledge_articles'
      AND policyname = 'assistant_knowledge_tenant_write'
  ) THEN
    CREATE POLICY assistant_knowledge_tenant_write ON public.assistant_knowledge_articles
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assistant_language_aliases'
      AND policyname = 'assistant_aliases_firm'
  ) THEN
    CREATE POLICY assistant_aliases_firm ON public.assistant_language_aliases
      FOR ALL USING (firm_id = public.my_firm_id())
      WITH CHECK (firm_id = public.my_firm_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assistant_intent_audit'
      AND policyname = 'assistant_intent_audit_firm'
  ) THEN
    CREATE POLICY assistant_intent_audit_firm ON public.assistant_intent_audit
      FOR INSERT WITH CHECK (firm_id = public.my_firm_id());

    CREATE POLICY assistant_intent_audit_read ON public.assistant_intent_audit
      FOR SELECT USING (firm_id = public.my_firm_id());
  END IF;
END $$;
