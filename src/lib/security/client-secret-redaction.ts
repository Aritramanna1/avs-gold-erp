/**
 * Client-side secret redaction — credentials must never hydrate into browser state
 * or persist back to app_settings / branch_settings JSON blobs.
 */

const SECRET_SETTING_KEYS = new Set([
  "access_token",
  "api_key",
  "password",
  "webhook_verify_token",
  "webhook_secret",
  "auth_token",
  "account_sid",
  "token",
]);

const WA_SECRET_FIELDS = [
  "accessToken",
  "webhookVerifyToken",
  "webhookSecret",
  "access_token",
  "webhook_verify_token",
  "webhook_secret",
] as const;

export function redactProviderSettings(
  settings: Record<string, string> | undefined,
): Record<string, string> {
  if (!settings) return {};
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !SECRET_SETTING_KEYS.has(key)),
  );
}

export function redactWaConfig<T extends Record<string, unknown>>(config: T): T {
  const next = { ...config };
  for (const field of WA_SECRET_FIELDS) {
    if (field in next) next[field as keyof T] = "" as T[keyof T];
  }
  return next;
}

export function redactSmtpSettings<T extends { passKey?: string; apiKey?: string }>(
  smtp: T | undefined,
): T | undefined {
  if (!smtp) return smtp;
  return { ...smtp, passKey: "", apiKey: "" };
}

export function redactBullionRateProvider<T extends { httpProvider?: { apiKey?: string } }>(
  config: T,
): T {
  if (!config?.httpProvider) return config;
  return {
    ...config,
    httpProvider: {
      ...config.httpProvider,
      apiKey: "",
    },
  };
}

export function redactBranchSettingsPatch<T extends { smtpPassword?: string }>(
  patch: T,
): Omit<T, "smtpPassword"> & { smtpPasswordConfigured?: boolean } {
  const { smtpPassword, ...rest } = patch;
  if (smtpPassword && smtpPassword.trim()) {
    return { ...rest, smtpPasswordConfigured: true };
  }
  return rest;
}
