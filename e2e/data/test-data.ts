/** Central test data / fixtures for the MTJ ERP E2E suite. */

/** Reads a required E2E env var, or throws a clear, actionable error. */
export function requireEnv(name: "E2E_EMAIL" | "E2E_PASSWORD"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.e2e.example to .env.e2e and set ${name} to a dedicated test account ` +
        `(never the production/demo project) before running authenticated E2E tests.`,
    );
  }
  return value;
}

export function uniqueSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function testWorker() {
  const suffix = uniqueSuffix();
  return {
    fullName: `E2E Worker ${suffix}`,
    phone: `9${String(Math.floor(100000000 + Math.random() * 899999999)).slice(0, 9)}`,
    workType: "Hand-making",
  };
}

export function testCustomer() {
  const suffix = uniqueSuffix();
  return {
    fullName: `E2E Customer ${suffix}`,
    phone: `8${String(Math.floor(100000000 + Math.random() * 899999999)).slice(0, 9)}`,
  };
}

export const INVALID_LOGIN = {
  email: "not-a-real-account@example.com",
  password: "wrong-password-123",
};
