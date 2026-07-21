import { getDeploymentMode, type DeploymentMode } from "@/lib/deployment-mode";

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
  if (mode === "hybrid") {
    return {
      mode,
      database: { kind: "sqlite-supabase", localPrimary: true },
      storage,
      authentication: { kind: "local" },
      synchronization: { kind: "supabase-database", enabled: true },
    };
  }
  if (mode === "online") {
    return {
      mode,
      database: { kind: "managed", localPrimary: false },
      storage,
      authentication: { kind: "managed" },
      synchronization: { kind: "managed", enabled: false },
    };
  }
  return {
    mode: "offline",
    database: { kind: "sqlite", localPrimary: true },
    storage,
    authentication: { kind: "local" },
    synchronization: { kind: "disabled", enabled: false },
  };
}

export async function getRuntimeProviders(): Promise<RuntimeProviders> {
  return resolveRuntimeProviders((await getDeploymentMode()) ?? "offline");
}

export const LOCAL_ONLY_TABLES = new Set([
  "attachments",
  "file_attachments",
  "kyc_documents",
  "document_shares",
]);
