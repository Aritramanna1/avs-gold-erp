import { create } from "zustand";

export type DeploymentMode = "online";

export async function getDeploymentMode(): Promise<DeploymentMode> {
  return "online";
}

export async function setDeploymentMode(_mode: DeploymentMode): Promise<void> {
  useDeploymentMode.setState({ mode: "online", hydrated: true });
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
