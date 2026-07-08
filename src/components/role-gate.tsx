import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useCan, type Action } from "@/lib/rbac";

/**
 * Page-level guard. Renders children only if the current user can perform `action`.
 * While roles load, shows a small placeholder; once loaded and denied, shows a
 * friendly "No access" panel. Anon users are already blocked by <AuthGate>.
 */
export function RequireAction({
  action,
  children,
  label,
}: {
  action: Action;
  children: ReactNode;
  label?: string;
}) {
  const { can, ready, roles } = useCan();
  if (!ready) {
    return (
      <div className="p-8 text-sm text-muted-foreground text-center">Checking permissions…</div>
    );
  }
  if (!can(action)) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-xl text-gold">No access</h2>
        <p className="text-sm text-muted-foreground">
          Your role{roles.length ? ` (${roles.join(", ")})` : ""} cannot access{" "}
          <span className="text-foreground">{label ?? action}</span>. Ask the owner to grant the
          required role.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
