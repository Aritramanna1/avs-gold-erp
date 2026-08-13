/**
 * Provider-neutral structured-data facade.
 *
 * UI, stores, and services import this module, not the Supabase integration.
 * Supabase is the single production data plane. The raw client is reserved for
 * low-level platform services that need direct Supabase access.
 */
import {
  getRawSupabaseClient,
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../integrations/supabase/client";

type DataClient = ReturnType<typeof getSupabaseClient>;

export const dataProvider = new Proxy({} as DataClient, {
  get(_target, property) {
    const client = getSupabaseClient();
    return Reflect.get(client, property, client);
  },
});

/** Compatibility alias for existing dynamic imports during provider migration. */
export { dataProvider as supabase };

/** Restricted to low-level platform infrastructure. */
export function getCloudDataClient(): ReturnType<typeof getRawSupabaseClient> {
  return getRawSupabaseClient();
}

export { isSupabaseConfigured };
