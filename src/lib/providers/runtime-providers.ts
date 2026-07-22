export interface DatabaseProvider {
  kind: "managed";
  localPrimary: false;
}
export interface StorageProvider {
  kind: "supabase-storage";
  synchronizesFiles: true;
}
export interface AuthenticationProvider {
  kind: "managed";
}
export interface SynchronizationProvider {
  kind: "managed";
  enabled: false;
}
export interface RuntimeProviders {
  mode: "online";
  database: DatabaseProvider;
  storage: StorageProvider;
  authentication: AuthenticationProvider;
  synchronization: SynchronizationProvider;
}
export function resolveRuntimeProviders(_mode?: string): RuntimeProviders {
  return {
    mode: "online",
    database: { kind: "managed", localPrimary: false },
    storage: { kind: "supabase-storage", synchronizesFiles: true },
    authentication: { kind: "managed" },
    synchronization: { kind: "managed", enabled: false },
  };
}
export async function getRuntimeProviders(): Promise<RuntimeProviders> {
  return resolveRuntimeProviders();
}
export const LOCAL_ONLY_TABLES = new Set<string>();
