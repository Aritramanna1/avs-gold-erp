import { createFileRoute } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { ATTENDANCE_COMING_SOON_MESSAGE, ATTENDANCE_COMING_SOON_DETAIL } from "@/lib/pilot-config";

// Workshop V1.1 scope: Attendance & Payroll (daily tracking, salary rules,
// settlement, loans, wastage) isn't part of the first production release —
// see src/lib/pilot-config.ts. The nested /attendance/* routes
// (attendance.index.tsx, attendance.print.$kind.$id.tsx) stay in the
// repository untouched and will render again once this layout route
// returns <Outlet /> instead.
export const Route = createFileRoute("/attendance")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Attendance · AVS Gold ERP" }] }),
  component: () => (
    <ModuleComingSoon
      title={ATTENDANCE_COMING_SOON_MESSAGE}
      message={ATTENDANCE_COMING_SOON_DETAIL}
    />
  ),
});
