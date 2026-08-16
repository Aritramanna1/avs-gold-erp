/**
 * Shows a subtle STAGING badge when the build targets a non-production environment.
 * Controlled by VITE_APP_ENV=staging|test (never set on production builds).
 */
export function StagingEnvironmentBadge() {
  const env =
    typeof import.meta.env !== "undefined"
      ? (import.meta.env.VITE_APP_ENV as string | undefined)
      : undefined;

  if (!env || env === "production") return null;

  const label = env.toUpperCase();
  return (
    <div
      data-testid="staging-environment-badge"
      className="fixed top-0 left-1/2 -translate-x-1/2 z-[150] pointer-events-none print:hidden"
      aria-label={`${label} environment`}
    >
      <span className="inline-block rounded-b-md bg-amber-500/90 px-3 py-0.5 text-[10px] font-bold tracking-widest text-black shadow">
        {label}
      </span>
    </div>
  );
}
