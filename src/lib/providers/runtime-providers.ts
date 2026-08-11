import { type DeploymentMode } from "@/lib/deployment-mode";

export interface DatabaseProvider {
  kind: "sqlite" | "sqlite-supabase" | "managed";
  localPrimary: boolean;
}

export interface StorageProvider {
  kind: "local-filesystem";
  synchronizesFiles: false;
}

export interface AuthenticationProvider {
  kind: "local" | "managed";
}

export interface SynchronizationProvider {
  kind: "disabled" | "supabase-database" | "managed";
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
  const storage: StorageProvider = { kind: "local-filesystem", synchronizesFiles: false };
  return {
    mode,
    database: { kind: "managed", localPrimary: false },
    storage,
    authentication: { kind: "managed" },
    synchronization: { kind: "managed", enabled: false },
  };
}

export async function getRuntimeProviders(): Promise<RuntimeProviders> {
  return resolveRuntimeProviders("online");
}

export const LOCAL_ONLY_TABLES = new Set([
  "attachments",
  "file_attachments",
  "kyc_documents",
  "document_shares",
]);
