-- Ornexa public website CMS, feature flags, blog, tutorials, releases, legal pages
-- Beta/staging public site — Platform Owner managed

-- ============================================================================
-- 1. Feature flags & global website config (platform_settings)
-- ============================================================================
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES
  ('website.feature_flags', '{
    "homepage": true,
    "features_page": true,
    "manufacturing_page": true,
    "wholesale_page": true,
    "retail_page": false,
    "pricing": true,
    "amc_display": true,
    "free_trial_cta": true,
    "request_demo": true,
    "contact": true,
    "tutorials": true,
    "blog": false,
    "whats_new": false,
    "downloads": false,
    "testimonials": true,
    "faq": true,
    "whatsapp_chat": true,
    "social_links": true,
    "branded_loader": true,
    "footer": true
  }'::jsonb, now()),
  ('website.contact', '{
    "sales_email": "sales@arivahly.in",
    "support_email": "support@arivahly.in",
    "phone": "",
    "address": "",
    "whatsapp_phone": "919876543210",
    "whatsapp_label": "Chat on WhatsApp",
    "whatsapp_message": "Hi, I am interested in Ornexa Jewellery ERP and would like more information."
  }'::jsonb, now()),
  ('website.social', '{
    "facebook": {"enabled": false, "url": ""},
    "instagram": {"enabled": false, "url": ""},
    "linkedin": {"enabled": false, "url": ""},
    "youtube": {"enabled": false, "url": ""},
    "whatsapp": {"enabled": true, "url": ""}
  }'::jsonb, now()),
  ('website.loader', '{"enabled": true, "max_ms": 4000}'::jsonb, now()),
  ('website.seo_default', '{
    "title": "Ornexa — Jewellery Ecosystem ERP",
    "description": "Manufacturing-first jewellery ERP with gold custody, karigar management, portals, and GST compliance.",
    "og_image_path": "/assets/ornexa-brand-master.png"
  }'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. Plan public visibility
-- ============================================================================
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS publicly_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_display_mode TEXT NOT NULL DEFAULT 'contact_sales'
    CHECK (pricing_display_mode IN ('show_price', 'contact_sales', 'hidden'));

-- ============================================================================
-- 3. CMS page content
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.public_website_pages (
  page_key TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.public_website_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_website_pages_admin ON public.public_website_pages;
CREATE POLICY public_website_pages_admin ON public.public_website_pages
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS public_website_pages_anon_read ON public.public_website_pages;
CREATE POLICY public_website_pages_anon_read ON public.public_website_pages
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- ============================================================================
-- 4. Blog
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.public_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  cover_image_path TEXT,
  author_name TEXT,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_public_blog_status ON public.public_blog_posts (status, published_at DESC);

ALTER TABLE public.public_blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_blog_posts_admin ON public.public_blog_posts;
CREATE POLICY public_blog_posts_admin ON public.public_blog_posts
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS public_blog_posts_anon_read ON public.public_blog_posts;
CREATE POLICY public_blog_posts_anon_read ON public.public_blog_posts
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

-- ============================================================================
-- 5. Public tutorials
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.public_website_tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'getting_started',
  thumbnail_path TEXT,
  video_url TEXT,
  video_provider TEXT CHECK (video_provider IS NULL OR video_provider IN ('youtube', 'vimeo', 'embed', 'none')),
  body_md TEXT,
  erp_module TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_website_tutorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_website_tutorials_admin ON public.public_website_tutorials;
CREATE POLICY public_website_tutorials_admin ON public.public_website_tutorials
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS public_website_tutorials_anon_read ON public.public_website_tutorials;
CREATE POLICY public_website_tutorials_anon_read ON public.public_website_tutorials
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- ============================================================================
-- 6. What's New / release notes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.public_release_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL DEFAULT 'ORNEXA',
  version TEXT NOT NULL,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  release_type TEXT NOT NULL DEFAULT 'minor'
    CHECK (release_type IN ('major', 'minor', 'patch', 'beta')),
  headline TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  fixes JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  known_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_label TEXT,
  cta_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_release_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_release_notes_admin ON public.public_release_notes;
CREATE POLICY public_release_notes_admin ON public.public_release_notes
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS public_release_notes_anon_read ON public.public_release_notes;
CREATE POLICY public_release_notes_anon_read ON public.public_release_notes
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- ============================================================================
-- 7. Legal pages (CMS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.public_legal_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_published BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_legal_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_legal_pages_admin ON public.public_legal_pages;
CREATE POLICY public_legal_pages_admin ON public.public_legal_pages
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS public_legal_pages_anon_read ON public.public_legal_pages;
CREATE POLICY public_legal_pages_anon_read ON public.public_legal_pages
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- ============================================================================
-- 8. Website media registry (R2 paths)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.public_website_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT,
  slot_key TEXT NOT NULL DEFAULT 'default',
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_website_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_website_media_admin ON public.public_website_media;
CREATE POLICY public_website_media_admin ON public.public_website_media
  FOR ALL TO authenticated
  USING (public.is_saas_admin())
  WITH CHECK (public.is_saas_admin());

DROP POLICY IF EXISTS public_website_media_anon_read ON public.public_website_media;
CREATE POLICY public_website_media_anon_read ON public.public_website_media
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- ============================================================================
-- 9. RPC: public website bundle (anon-safe)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_public_website_bundle()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flags JSONB;
  v_contact JSONB;
  v_social JSONB;
  v_loader JSONB;
  v_seo JSONB;
BEGIN
  SELECT value INTO v_flags FROM platform_settings WHERE key = 'website.feature_flags';
  SELECT value INTO v_contact FROM platform_settings WHERE key = 'website.contact';
  SELECT value INTO v_social FROM platform_settings WHERE key = 'website.social';
  SELECT value INTO v_loader FROM platform_settings WHERE key = 'website.loader';
  SELECT value INTO v_seo FROM platform_settings WHERE key = 'website.seo_default';

  RETURN jsonb_build_object(
    'feature_flags', COALESCE(v_flags, '{}'::jsonb),
    'contact', COALESCE(v_contact, '{}'::jsonb),
    'social', COALESCE(v_social, '{}'::jsonb),
    'loader', COALESCE(v_loader, '{}'::jsonb),
    'seo_default', COALESCE(v_seo, '{}'::jsonb),
    'pages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'page_key', page_key,
        'title', title,
        'sections', sections,
        'seo', seo
      ) ORDER BY page_key)
      FROM public_website_pages WHERE is_published = true
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_website_bundle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_website_bundle() TO anon, authenticated;

-- ============================================================================
-- 10. RPC: public pricing plans
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_public_pricing_plans()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'description', p.description,
    'billing_cycle', p.billing_cycle,
    'price_minor', p.price_minor,
    'pricing_display_mode', p.pricing_display_mode,
    'feature_limits', p.feature_limits,
    'commercial_config', p.commercial_config,
    'branch_limit', p.branch_limit,
    'user_limit', p.user_limit
  ) ORDER BY p.price_minor NULLS LAST, p.name), '[]'::jsonb)
  FROM platform_plans p
  WHERE p.is_active = true
    AND p.publicly_visible = true
    AND p.pricing_display_mode <> 'hidden'
    AND p.code <> 'trial-14d';
$$;

REVOKE ALL ON FUNCTION public.get_public_pricing_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pricing_plans() TO anon, authenticated;

-- ============================================================================
-- 11. RPC: submit website lead (contact/demo/sales)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_website_lead(
  p_company_name TEXT,
  p_contact_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_product_id TEXT DEFAULT 'ORNEXA',
  p_interest TEXT DEFAULT 'general',
  p_message TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'website_contact',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_contact_email IS NULL OR length(trim(p_contact_email)) < 5 THEN
    RAISE EXCEPTION 'Valid email is required';
  END IF;
  IF p_company_name IS NULL OR length(trim(p_company_name)) < 2 THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  INSERT INTO platform_commercial_leads (
    company_name, contact_name, contact_email, contact_phone,
    product_id, lead_stage, source, notes, metadata
  ) VALUES (
    trim(p_company_name),
    COALESCE(NULLIF(trim(p_contact_name), ''), 'Website Lead'),
    lower(trim(p_contact_email)),
    NULLIF(trim(p_contact_phone), ''),
    COALESCE(NULLIF(trim(p_product_id), ''), 'ORNEXA'),
    CASE WHEN p_source = 'public_trial' THEN 'new_trial' ELSE 'contact_pending' END,
    COALESCE(NULLIF(trim(p_source), ''), 'website_contact'),
    NULLIF(trim(p_message), ''),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'city', NULLIF(trim(p_city), ''),
      'interest', NULLIF(trim(p_interest), '')
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_website_lead(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_website_lead(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO anon, authenticated;

-- ============================================================================
-- 12. Seed default homepage sections (CMS-editable)
-- ============================================================================
INSERT INTO public.public_website_pages (page_key, title, sections, seo)
VALUES
  ('home', 'Ornexa — Jewellery Ecosystem', '[
    {"id":"hero","type":"hero","heading":"Jewellery manufacturing ERP with gold custody you can audit","subheading":"Job cards, karigar issue and return, vault balances, GST documents, and customer portals — one Supabase-backed system for web, desktop, and mobile.","primary_cta":{"label":"Start 14-Day Free Trial","href":"/trial/start"},"secondary_cta":{"label":"Book a Demo","href":"/contact?intent=demo"}},
    {"id":"pillars","type":"pillars","items":[
      {"title":"Gold you can trace","body":"Integer milligram accounting, vault-led balances, and job-level custody."},
      {"title":"Factory operations","body":"Melting, bench WIP, outside work, QC, hallmark, and scrap recovery."},
      {"title":"One platform","body":"Parties, billing, print and export, WhatsApp and email, optional portals."}
    ]},
    {"id":"capabilities","type":"feature_grid","heading":"Built for jewellery manufacturing","items":[
      {"title":"Gold Vault","body":"Authoritative fine metal ledger — no shadow balances."},
      {"title":"Job Cards","body":"Karigar custody from issue through receive and settlement."},
      {"title":"Print Engine","body":"Invoices, job cards, and slips with your real stamp assets."},
      {"title":"Party 360","body":"Customers, karigars, suppliers in one directory."},
      {"title":"Portals","body":"Customer, karigar, and supplier workspaces when licensed."},
      {"title":"Assistant","body":"Operational help with credit-gated AI tools."}
    ]}
  ]'::jsonb, '{"title":"Ornexa — Jewellery Ecosystem ERP","description":"Manufacturing-first jewellery ERP with gold traceability, karigar management, and GST compliance."}'::jsonb),
  ('features', 'Features', '[]'::jsonb, '{}'::jsonb),
  ('manufacturing', 'Manufacturing', '[]'::jsonb, '{}'::jsonb),
  ('wholesale', 'Wholesale', '[]'::jsonb, '{}'::jsonb),
  ('faq', 'FAQ', '[]'::jsonb, '{}'::jsonb)
ON CONFLICT (page_key) DO NOTHING;

INSERT INTO public.public_legal_pages (slug, title, body_md, version)
VALUES
  ('privacy', 'Privacy Policy', 'Privacy policy content is managed by Platform Owner.', '1.0'),
  ('terms', 'Terms of Service', 'Terms of service content is managed by Platform Owner.', '1.0'),
  ('refund', 'Refund & Cancellation Policy', 'Refund policy content is managed by Platform Owner.', '1.0'),
  ('cookies', 'Cookie Policy', 'Cookie policy content is managed by Platform Owner.', '1.0')
ON CONFLICT (slug) DO NOTHING;

GRANT SELECT ON public.public_website_pages TO anon, authenticated;
GRANT SELECT ON public.public_blog_posts TO anon, authenticated;
GRANT SELECT ON public.public_website_tutorials TO anon, authenticated;
GRANT SELECT ON public.public_release_notes TO anon, authenticated;
GRANT SELECT ON public.public_legal_pages TO anon, authenticated;
GRANT SELECT ON public.public_website_media TO anon, authenticated;
