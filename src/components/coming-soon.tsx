import { ModuleComingSoon } from "@/components/ModuleComingSoon";

/** Compatibility wrapper for older deferred routes; keeps one release-gate notice style. */
export const ComingSoonPlaceholder = ({ moduleName }: { moduleName: string }) => (
  <ModuleComingSoon
    title={`${moduleName} Not Enabled`}
    message={`${moduleName} is outside the currently enabled jewellery manufacturing ERP scope.`}
  />
);
