/**
 * AVS ERP — Capacitor Core Web/Browser Shim
 * Resolves @capacitor/core imports during Vite bundling without external native dependencies.
 */

export class WebPlugin {
  protected listeners: Record<string, Function[]> = {};

  addListener(eventName: string, listenerFunc: Function) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listenerFunc);
    return Promise.resolve({
      remove: () => {
        this.listeners[eventName] = (this.listeners[eventName] || []).filter(
          (fn) => fn !== listenerFunc
        );
        return Promise.resolve();
      },
    });
  }

  removeAllListeners() {
    this.listeners = {};
    return Promise.resolve();
  }

  notifyListeners(eventName: string, data: any) {
    const handlers = this.listeners[eventName];
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }
}

export enum ExceptionCode {
  PluginMethodNotFound = "UNIMPLEMENTED",
  Unavailable = "UNAVAILABLE",
}

export class CapacitorException extends Error {
  code?: string;
  data?: any;
  constructor(message?: string, code?: string, data?: any) {
    super(message);
    this.name = "CapacitorException";
    this.code = code;
    this.data = data;
  }
}

export function buildRequestInit(options: any, extra?: any): RequestInit {
  return {
    method: options?.method || "GET",
    headers: options?.headers || {},
    body: options?.data,
    ...extra,
  };
}

export const Capacitor = {
  isNativePlatform: (): boolean => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() === true;
  },
  getPlatform: (): string => {
    if (typeof window === "undefined") return "web";
    return (window as any).Capacitor?.getPlatform?.() || "web";
  },
  convertFileSrc: (filePath: string): string => filePath,
};

export const Cap = Capacitor;

export function registerPlugin<T>(name: string, options?: { web?: () => T }): T {
  if (typeof window !== "undefined" && (window as any).Capacitor?.registerPlugin) {
    return (window as any).Capacitor.registerPlugin(name, options);
  }
  if (options?.web) {
    try {
      return options.web();
    } catch {
      // fallback
    }
  }
  return new (class extends WebPlugin {})() as unknown as T;
}
