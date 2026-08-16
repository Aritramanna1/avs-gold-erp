-- Extend public website bundle with download centre config (anon-safe read via RPC).

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
  v_downloads JSONB;
BEGIN
  SELECT value INTO v_flags FROM platform_settings WHERE key = 'website.feature_flags';
  SELECT value INTO v_contact FROM platform_settings WHERE key = 'website.contact';
  SELECT value INTO v_social FROM platform_settings WHERE key = 'website.social';
  SELECT value INTO v_loader FROM platform_settings WHERE key = 'website.loader';
  SELECT value INTO v_seo FROM platform_settings WHERE key = 'website.seo_default';
  SELECT value INTO v_downloads FROM platform_settings WHERE key = 'website.downloads';

  RETURN jsonb_build_object(
    'feature_flags', COALESCE(v_flags, '{}'::jsonb),
    'contact', COALESCE(v_contact, '{}'::jsonb),
    'social', COALESCE(v_social, '{}'::jsonb),
    'loader', COALESCE(v_loader, '{}'::jsonb),
    'seo_default', COALESCE(v_seo, '{}'::jsonb),
    'downloads', COALESCE(v_downloads, '{"enabled":false,"items":[]}'::jsonb),
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
