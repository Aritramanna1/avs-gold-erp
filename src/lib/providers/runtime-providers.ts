import { type DeploymentMode } from "@/lib/deployment-mode";

export interface DatabaseProvider {
  kind: "managed";
  localPrimary: boolean;
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
  enabled: boolean;
}

export interface RuntimeProviders {
  mode: DeploymentMode;
  database: DatabaseProvider;
  storage: StorageProvider;
  authentication: AuthenticationProvider;
  synchronization: SynchronizationProvider;
}

export function resolveRuntimeProviders(mode: DeploymentMode): RuntimeProviders {
  return {
    mode,
    database: { kind: "managed", localPrimary: false },
    storage: { kind: "supabase-storage", synchronizesFiles: true },
    authentication: { kind: "managed" },
    synchronization: { kind: "managed", enabled: false },
  };
}

export async function getRuntimeProviders(): Promise<RuntimeProviders> {
  return resolveRuntimeProviders("online");
}

export const LOCAL_ONLY_TABLES = new Set<string>();
