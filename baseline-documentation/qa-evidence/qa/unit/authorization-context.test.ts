import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "@/lib/identity/authorization-types";
import { canAccessPath, pickDefaultRoute } from "@/lib/identity/route-access";

function ctx(
  partial: Partial<AuthorizationContext> & Pick<AuthorizationContext, "workspaces">,
): AuthorizationContext {
  return {
    is_platform_owner: false,
    active_workspace: {
      workspace_key: partial.workspaces[0]?.workspace_key ?? null,
      workspace_type: partial.workspaces[0]?.workspace_type ?? "erp",
      organization_id: partial.workspaces[0]?.organization_id ?? null,
    },
    default_route: "/app",
    auth_user_id: "test-user",
    ...partial,
  };
}

describe("authorization route access", () => {
  it("platform owner active on platform can access /platform", () => {
    const c = ctx({
      is_platform_owner: true,
      workspaces: [
        {
          workspace_key: "platform:platform",
          workspace_type: "platform",
          organization_id: null,
          organization_name: "Platform Owner",
          route: "/platform",
          is_active: true,
        },
      ],
      active_workspace: {
        workspace_key: "platform:platform",
        workspace_type: "platform",
        organization_id: null,
      },
      default_route: "/platform",
    });
    expect(canAccessPath(c, "/platform")).toBe(true);
    expect(canAccessPath(c, "/app")).toBe(false);
    expect(canAccessPath(c, "/customer-portal")).toBe(false);
  });

  it("customer portal user cannot access /platform", () => {
    const c = ctx({
      workspaces: [
        {
          workspace_key: "org-1:customer",
          workspace_type: "customer",
          organization_id: "org-1",
          organization_name: "Aritra Jewellers",
          route: "/customer-portal",
          is_active: true,
        },
      ],
      active_workspace: {
        workspace_key: "org-1:customer",
        workspace_type: "customer",
        organization_id: "org-1",
      },
      default_route: "/customer-portal",
    });
    expect(canAccessPath(c, "/customer-portal")).toBe(true);
    expect(canAccessPath(c, "/platform")).toBe(false);
    expect(canAccessPath(c, "/karigar-portal")).toBe(false);
  });

  it("dual customer+supplier workspaces require active context", () => {
    const workspaces = [
      {
        workspace_key: "org-1:customer",
        workspace_type: "customer" as const,
        organization_id: "org-1",
        organization_name: "Aritra Jewellers",
        route: "/customer-portal",
        is_active: true,
      },
      {
        workspace_key: "org-1:supplier",
        workspace_type: "supplier" as const,
        organization_id: "org-1",
        organization_name: "Aritra Jewellers",
        route: "/supplier-portal",
        is_active: false,
      },
    ];
    const customerCtx = ctx({
      workspaces,
      active_workspace: {
        workspace_key: "org-1:customer",
        workspace_type: "customer",
        organization_id: "org-1",
      },
    });
    expect(canAccessPath(customerCtx, "/customer-portal")).toBe(true);
    expect(canAccessPath(customerCtx, "/supplier-portal")).toBe(false);
  });

  it("platform owner default route is /platform when only platform workspace", () => {
    const c = ctx({
      is_platform_owner: true,
      workspaces: [
        {
          workspace_key: "platform:platform",
          workspace_type: "platform",
          organization_id: null,
          organization_name: "Platform Owner",
          route: "/platform",
          is_active: true,
        },
      ],
      default_route: "/platform",
    });
    expect(pickDefaultRoute(c)).toBe("/platform");
  });

  it("erp staff can access operational routes", () => {
    const c = ctx({
      workspaces: [
        {
          workspace_key: "org-1:erp",
          workspace_type: "erp",
          organization_id: "org-1",
          organization_name: "Factory",
          route: "/app",
          is_active: true,
          role: "Administrator",
        },
      ],
      active_workspace: {
        workspace_key: "org-1:erp",
        workspace_type: "erp",
        organization_id: "org-1",
      },
    });
    expect(canAccessPath(c, "/app")).toBe(true);
    expect(canAccessPath(c, "/orders")).toBe(true);
    expect(canAccessPath(c, "/platform")).toBe(false);
  });
});
