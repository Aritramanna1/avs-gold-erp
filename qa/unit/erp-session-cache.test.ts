import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "@/lib/identity/authorization-types";
import { preferJewellerAuthorization } from "@/lib/offline/erp-session-cache";

describe("preferJewellerAuthorization", () => {
  it("preserves platform owner context with ERP membership", () => {
    const ctx: AuthorizationContext = {
      is_platform_owner: true,
      auth_user_id: "u1",
      default_route: "/platform",
      workspaces: [
        {
          workspace_key: "platform:platform",
          workspace_type: "platform",
          organization_id: null,
          organization_name: "Platform Owner",
          route: "/platform",
          is_active: true,
        },
        {
          workspace_key: "org-1:erp",
          workspace_type: "erp",
          organization_id: "org-1",
          organization_name: "Factory",
          route: "/app",
          is_active: false,
        },
      ],
      active_workspace: {
        workspace_key: "platform:platform",
        workspace_type: "platform",
        organization_id: null,
      },
    };
    const out = preferJewellerAuthorization(ctx);
    expect(out.is_platform_owner).toBe(true);
    expect(out.workspaces.some((w) => w.workspace_type === "platform")).toBe(true);
    expect(out.active_workspace?.workspace_type).toBe("platform");
  });

  it("preserves karigar portal-only context", () => {
    const ctx: AuthorizationContext = {
      is_platform_owner: false,
      auth_user_id: "u2",
      default_route: "/karigar-portal",
      workspaces: [
        {
          workspace_key: "org-1:karigar",
          workspace_type: "karigar",
          organization_id: "org-1",
          organization_name: "Workshop",
          route: "/karigar-portal",
          is_active: true,
        },
      ],
      active_workspace: {
        workspace_key: "org-1:karigar",
        workspace_type: "karigar",
        organization_id: "org-1",
      },
    };
    const out = preferJewellerAuthorization(ctx);
    expect(out.active_workspace?.workspace_type).toBe("karigar");
    expect(out.workspaces).toHaveLength(1);
  });
});
