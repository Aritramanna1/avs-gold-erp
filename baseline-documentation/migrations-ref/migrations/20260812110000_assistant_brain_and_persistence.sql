-- AVS / ORNEXA ERP — Replaceable Assistant Brain & Conversation Persistence Migration
-- Creates assistant_conversations, assistant_messages, and ai_provider_configs with multi-tenant RLS.

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  provider TEXT NOT NULL DEFAULT 'cloudflare_ai_gateway', -- 'cloudflare_ai_gateway', 'openai', 'anthropic'
  model TEXT NOT NULL DEFAULT '@cf/meta/llama-3-8b-instruct',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user', -- 'system', 'user', 'assistant', 'tool'
  content TEXT NOT NULL,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  erp_card JSONB DEFAULT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'cloudflare_ai_gateway', 'openai', 'anthropic'
  model_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  max_monthly_tokens INT NOT NULL DEFAULT 500000,
  tokens_used_this_month INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_provider UNIQUE (tenant_id, provider)
);

-- Enable RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own conversations"
  ON public.assistant_conversations
  FOR ALL
  USING (
    user_id = auth.uid() AND tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view and insert messages in their conversations"
  ON public.assistant_messages
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can view provider configs"
  ON public.ai_provider_configs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );
