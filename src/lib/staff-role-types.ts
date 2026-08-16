import type { AppRole } from "@/lib/rbac";

export type StaffRoleTemplate = {
  id: string;
  label: string;
  department?: string;
  appRoles: AppRole[];
};

export const DEFAULT_STAFF_ROLE_TEMPLATES: StaffRoleTemplate[] = [
  {
    id: "super_owner",
    label: "Super Owner",
    department: "Management",
    appRoles: ["owner", "manager"],
  },
  {
    id: "administrator",
    label: "Administrator",
    department: "Administration",
    appRoles: ["owner", "manager"],
  },
  { id: "ceo", label: "CEO (View Only)", department: "Management", appRoles: ["viewer"] },
  {
    id: "branch_manager",
    label: "Branch Manager",
    department: "Management",
    appRoles: ["manager"],
  },
  {
    id: "workshop_manager",
    label: "Workshop Manager",
    department: "Manufacturing / Workshop",
    appRoles: ["workshop", "vault"],
  },
  {
    id: "retail_staff",
    label: "Retail Staff",
    department: "Retail Counter",
    appRoles: ["billing"],
  },
  {
    id: "manufacturing_staff",
    label: "Manufacturing Staff",
    department: "Manufacturing / Workshop",
    appRoles: ["workshop"],
  },
  {
    id: "accountant",
    label: "Accountant",
    department: "Accounts & Finance",
    appRoles: ["accountant", "billing"],
  },
  {
    id: "sales_executive",
    label: "Sales Executive",
    department: "Retail Counter",
    appRoles: ["billing"],
  },
  {
    id: "crm_executive",
    label: "CRM Executive",
    department: "CRM & Communications",
    appRoles: ["billing", "manager"],
  },
];
