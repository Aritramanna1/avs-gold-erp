/**
 * Provider-neutral structured-data facade.
 *
 * UI, stores, and services import this module—not the Supabase integration.
 * All UI, stores, and services resolve to the configured Supabase data client.
 */
import {
  getRawSupabaseClient,
  getSupabaseClient,
  isSupabaseConfigured,
  SUPABASE_RUNTIME_KEYS,
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

/** Compatibility alias used by services that need the direct client. */
export function getCloudDataClient(): ReturnType<typeof getRawSupabaseClient> {
  return getRawSupabaseClient();
}

export { isSupabaseConfigured, SUPABASE_RUNTIME_KEYS };
