/**
 * Public self-signup is disabled. New ERP accounts require an authorized invitation
 * issued by AVS / platform owner / tenant admin (staff or portal invite flows).
 */
export const PUBLIC_SELF_SIGNUP_DISABLED = true;

export const PUBLIC_SIGNUP_DISABLED_MESSAGE =
  "AVS ERP access is invitation-only. Ask your jeweller or AVS to send you a secure invitation link, or request access from our team.";

export const REQUEST_ACCESS_PATH = "/request-access" as const;

/** Legacy trial URL — redirects to request-access; never provisions tenants. */
export const LEGACY_TRIAL_PATH = "/trial/start" as const;
