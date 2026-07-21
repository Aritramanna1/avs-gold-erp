import { ModuleComingSoon } from "@/components/ModuleComingSoon";

/** Compatibility wrapper for older routes; keeps one Coming Soon design language. */
export const ComingSoonPlaceholder = ({ moduleName }: { moduleName: string }) => (
  <ModuleComingSoon
    title={`${moduleName} (COMING SOON)`}
    message={`${moduleName} is planned for a future jewellery manufacturing ERP update.`}
  />
);
