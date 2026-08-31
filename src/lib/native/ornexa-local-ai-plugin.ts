/**
 * Capacitor OrnexaLocalAi — Qwen3 on-device inference bridge.
 * Web: unavailable (browser runtime is a separate WASM/WebGPU engine).
 * Native: RAM/ABI probe now; llama.cpp/ONNX session when a licensed pack is installed.
 */
import { registerPlugin } from "@capacitor/core";

export interface LocalAiCapabilities {
  ramMb: number;
  availRamMb: number;
  abi: string;
  engineAvailable: boolean;
  onnxAvailable: boolean;
  family: string;
  message: string;
}

export interface OrnexaLocalAiPlugin {
  getCapabilities(): Promise<LocalAiCapabilities>;
  loadModel(options: { path: string; modelId: string; family?: string }): Promise<{
    ok: boolean;
    error?: string;
  }>;
  unloadModel(): Promise<void>;
  runFunctionCall(options: {
    prompt: string;
    toolsJson: string;
    systemPrompt?: string;
  }): Promise<{ ok: boolean; json?: string; error?: string; latencyMs?: number }>;
  explainFacts(options: {
    userText: string;
    authorizedFacts: string;
  }): Promise<{ ok: boolean; text?: string; error?: string }>;
}

export const ORNEXA_LOCAL_AI_PLUGIN_ID = "OrnexaLocalAi";

export const OrnexaLocalAi = registerPlugin<OrnexaLocalAiPlugin>(ORNEXA_LOCAL_AI_PLUGIN_ID, {
  web: () => ({
    async getCapabilities() {
      return {
        ramMb: 0,
        availRamMb: 0,
        abi: "web",
        engineAvailable: false,
        onnxAvailable: false,
        family: "qwen3",
        message: "Native Qwen3 engine is Android/iOS only. Web uses the browser WASM/WebGPU runtime.",
      };
    },
    async loadModel() {
      return { ok: false, error: "Native plugin is not available in the browser." };
    },
    async unloadModel() {
      return;
    },
    async runFunctionCall() {
      return { ok: false, error: "Native inference is not available in the browser." };
    },
    async explainFacts() {
      return { ok: false, error: "Native inference is not available in the browser." };
    },
  }),
});
