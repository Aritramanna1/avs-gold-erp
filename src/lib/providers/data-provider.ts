/**
 * Provider-neutral structured-data facade.
 *
 * UI, stores, and services import this module—not the Supabase integration.
 * Offline and Hybrid calls resolve to SQLite. Only synchronization internals
 * may request the raw Hybrid cloud client. Online resolves to the configured
 * managed data client.
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

/** Restricted to synchronization/migration infrastructure. */
export function getCloudDataClient(): ReturnType<typeof getRawSupabaseClient> {
  return getRawSupabaseClient();
}

export { isSupabaseConfigured, SUPABASE_RUNTIME_KEYS };
