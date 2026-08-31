-- Unified authorization context: one auth identity → many workspaces → one active context.

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_route_for_membership(m public.tenant_memberships)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF m IS NULL THEN RETURN '/'; END IF;
  IF m.membership_kind = 'internal' THEN RETURN '/'; END IF;
  CASE m.portal_type
    WHEN 'ceo' THEN RETURN '/dashboard/ceo';
    WHEN 'customer' THEN RETURN '/customer-portal';
    WHEN 'supplier' THEN RETURN '/supplier-portal';
    WHEN 'karigar' THEN RETURN '/karigar-portal';
    ELSE RETURN '/';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_type_for_membership(m public.tenant_memberships)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF m IS NULL THEN RETURN 'erp'; END IF;
  IF m.membership_kind = 'internal' THEN RETURN 'erp'; END IF;
  RETURN COALESCE(m.portal_type, 'erp');
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_default_workspace_route(
  p_auth_user_id UUID,
  p_preferred_org UUID DEFAULT NULL,
  p_preferred_portal TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_membership public.tenant_memberships;
BEGIN
  IF p_auth_user_id IS NULL THEN RETURN '/'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_auth_user_id
      AND ur.role::text IN ('saas_admin', 'SaaS Admin', 'platform_owner', 'Platform Owner')
  ) THEN
    RETURN '/platform';
  END IF;

  IF p_preferred_org IS NOT NULL THEN
    SELECT * INTO v_membership
    FROM public.tenant_memberships tm
    WHERE tm.auth_user_id = p_auth_user_id
      AND tm.organization_id = p_preferred_org
      AND tm.status = 'active'
      AND (
        p_preferred_portal IS NULL
        OR tm.portal_type = p_preferred_portal
        OR (p_preferred_portal = 'erp' AND tm.membership_kind = 'internal')
      )
    ORDER BY
      CASE
        WHEN p_preferred_portal IS NOT NULL AND tm.portal_type = p_preferred_portal THEN 0
        WHEN p_preferred_portal = 'erp' AND tm.membership_kind = 'internal' THEN 0
        ELSE 1
      END,
      tm.last_active_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      RETURN public.workspace_route_for_membership(v_membership);
    END IF;
  END IF;

  SELECT * INTO v_membership
  FROM public.tenant_memberships tm
  WHERE tm.auth_user_id = p_auth_user_id
    AND tm.status = 'active'
    AND tm.membership_kind = 'internal'
  ORDER BY tm.last_active_at DESC NULLS LAST, tm.joined_at DESC
  LIMIT 1;
  IF FOUND THEN RETURN '/'; END IF;

  SELECT * INTO v_membership
  FROM public.tenant_memberships tm
  WHERE tm.auth_user_id = p_auth_user_id
    AND tm.status = 'active'
    AND tm.portal_type = 'ceo'
  LIMIT 1;
  IF FOUND THEN RETURN '/dashboard/ceo'; END IF;

  SELECT * INTO v_membership
  FROM public.tenant_memberships tm
  WHERE tm.auth_user_id = p_auth_user_id
    AND tm.status = 'active'
    AND tm.membership_kind = 'portal'
  ORDER BY
    CASE tm.portal_type
      WHEN 'customer' THEN 1
      WHEN 'supplier' THEN 2
      WHEN 'karigar' THEN 3
      ELSE 9
    END,
    tm.last_active_at DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN RETURN public.workspace_route_for_membership(v_membership); END IF;

  RETURN '/';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_authorization_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_platform BOOLEAN := false;
  v_active_org UUID;
  v_active_portal TEXT;
  v_active_membership_id UUID;
  v_active_branch TEXT;
  v_pref_org UUID;
  v_pref_portal TEXT;
  v_workspaces JSONB;
  v_active JSONB;
  v_default_route TEXT;
  v_active_type TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  v_is_platform := public.is_saas_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text IN ('saas_admin', 'SaaS Admin', 'platform_owner', 'Platform Owner')
  );

  SELECT last_active_organization_id, last_active_portal_type
  INTO v_pref_org, v_pref_portal
  FROM public.user_preferences
  WHERE auth_user_id = v_uid;

  SELECT organization_id, portal_type, membership_id, branch_id
  INTO v_active_org, v_active_portal, v_active_membership_id, v_active_branch
  FROM public.identity_active_context
  WHERE auth_user_id = v_uid;

  IF v_is_platform AND v_active_org IS NULL AND v_active_portal IS NULL THEN
    v_active_type := 'platform';
  ELSIF v_active_portal IS NOT NULL THEN
    v_active_type := v_active_portal;
  ELSIF v_active_org IS NOT NULL THEN
    v_active_type := 'erp';
  ELSE
    v_active_type := NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(ws ORDER BY ws ->> 'organization_name', ws ->> 'workspace_type'), '[]'::jsonb)
  INTO v_workspaces
  FROM (
    SELECT jsonb_build_object(
      'workspace_key', tm.organization_id::text || ':' || public.workspace_type_for_membership(tm),
      'workspace_type', public.workspace_type_for_membership(tm),
      'organization_id', tm.organization_id,
      'organization_name', o.name,
      'membership_id', tm.id,
      'membership_kind', tm.membership_kind,
      'portal_type', tm.portal_type,
      'role', tm.role,
      'branch_ids', tm.branch_ids,
      'party_roles', COALESCE((
        SELECT jsonb_agg(DISTINCT pi.portal_type)
        FROM public.portal_identities pi
        WHERE pi.auth_user_id = v_uid
          AND pi.firm_id = tm.organization_id
          AND pi.status = 'active'
      ), '[]'::jsonb),
      'route', public.workspace_route_for_membership(tm),
      'is_active',
        tm.organization_id = v_active_org
        AND public.workspace_type_for_membership(tm) = COALESCE(v_active_type, public.workspace_type_for_membership(tm))
    ) AS ws
    FROM public.tenant_memberships tm
    JOIN public.organizations o ON o.id = tm.organization_id
    WHERE tm.auth_user_id = v_uid AND tm.status = 'active'
  ) sub;

  IF v_is_platform THEN
    v_workspaces := COALESCE(v_workspaces, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'workspace_key', 'platform:platform',
      'workspace_type', 'platform',
      'organization_id', NULL,
      'organization_name', 'Platform Owner',
      'membership_kind', 'platform',
      'portal_type', NULL,
      'role', 'saas_admin',
      'route', '/platform',
      'is_active', v_active_type = 'platform'
    ));
  END IF;

  SELECT jsonb_build_object(
    'workspace_key',
      CASE
        WHEN v_active_type = 'platform' THEN 'platform:platform'
        WHEN v_active_org IS NOT NULL THEN v_active_org::text || ':' || COALESCE(v_active_type, 'erp')
        ELSE NULL
      END,
    'workspace_type', COALESCE(v_active_type, 'erp'),
    'organization_id', v_active_org,
    'portal_type', v_active_portal,
    'membership_id', v_active_membership_id,
    'branch_id', v_active_branch
  ) INTO v_active;

  v_default_route := public.resolve_default_workspace_route(v_uid, v_pref_org, v_pref_portal);

  RETURN jsonb_build_object(
    'is_platform_owner', v_is_platform,
    'workspaces', COALESCE(v_workspaces, '[]'::jsonb),
    'active_workspace', v_active,
    'default_route', v_default_route,
    'auth_user_id', v_uid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_login_destination()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN public.resolve_default_workspace_route(
    auth.uid(),
    (SELECT last_active_organization_id FROM public.user_preferences WHERE auth_user_id = auth.uid()),
    (SELECT last_active_portal_type FROM public.user_preferences WHERE auth_user_id = auth.uid())
  );
END;
$$;

DELETE FROM public.tenant_memberships tm
WHERE tm.membership_kind = 'portal'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = tm.auth_user_id
      AND ur.role::text IN ('saas_admin', 'SaaS Admin', 'platform_owner', 'Platform Owner')
  );

CREATE OR REPLACE FUNCTION public.set_platform_workspace()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'Platform admin role required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.identity_active_context WHERE auth_user_id = auth.uid();

  INSERT INTO public.user_preferences (auth_user_id, last_active_organization_id, last_active_portal_type, updated_at)
  VALUES (auth.uid(), NULL, NULL, now())
  ON CONFLICT (auth_user_id) DO UPDATE SET
    last_active_organization_id = NULL,
    last_active_portal_type = NULL,
    updated_at = now();

  RETURN jsonb_build_object('workspace_type', 'platform', 'route', '/platform');
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_platform_workspace() TO authenticated;

REVOKE ALL ON FUNCTION public.get_authorization_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_default_workspace_route(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_route_for_membership(public.tenant_memberships) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_type_for_membership(public.tenant_memberships) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_authorization_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_default_workspace_route(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_route_for_membership(public.tenant_memberships) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_type_for_membership(public.tenant_memberships) TO authenticated;

COMMIT;
