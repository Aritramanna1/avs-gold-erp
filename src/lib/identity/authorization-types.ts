export type WorkspaceType = "platform" | "erp" | "ceo" | "customer" | "supplier" | "karigar";

export type AuthorizedWorkspace = {
  workspace_key: string;
  workspace_type: WorkspaceType;
  organization_id: string | null;
  organization_name: string;
  membership_id?: string | null;
  membership_kind?: string | null;
  portal_type?: string | null;
  role?: string | null;
  branch_ids?: string[] | null;
  party_roles?: string[];
  route: string;
  is_active?: boolean;
};

export type ActiveWorkspace = {
  workspace_key: string | null;
  workspace_type: WorkspaceType;
  organization_id: string | null;
  portal_type?: string | null;
  membership_id?: string | null;
  branch_id?: string | null;
};

export type AuthorizationContext = {
  is_platform_owner: boolean;
  workspaces: AuthorizedWorkspace[];
  active_workspace: ActiveWorkspace;
  default_route: string;
  auth_user_id: string;
};
