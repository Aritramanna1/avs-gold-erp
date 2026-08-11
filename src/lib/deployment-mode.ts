import { create } from "zustand";

export type DeploymentMode = "offline" | "hybrid" | "online";

export async function getDeploymentMode(): Promise<DeploymentMode> {
  return "online";
}

export async function setDeploymentMode(mode: DeploymentMode): Promise<void> {
  useDeploymentMode.setState({ mode, hydrated: true });
}

interface DeploymentModeState {
  mode: DeploymentMode;
  hydrated: boolean;
}

export const useDeploymentMode = create<DeploymentModeState>()(() => ({
  mode: "online",
  hydrated: true,
}));

export async function hydrateDeploymentMode(): Promise<void> {
  useDeploymentMode.setState({ mode: "online", hydrated: true });
}

export function isOfflineMode(): boolean {
  return false;
}

export function isLocalFirstMode(): boolean {
  return false;
}

export function isHybridMode(): boolean {
  return false;
}
