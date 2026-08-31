/**
 * Ambient Capacitor shims for web typecheck when native packages are not installed.
 * Runtime on web never loads these modules — callers guard dynamically.
 */
declare module "@capacitor/core" {
  export const Capacitor: {
    isNativePlatform: () => boolean;
    getPlatform: () => string;
    convertFileSrc?: (path: string) => string;
  };
  export const Cap: { isNativePlatform: () => boolean };
  export function registerPlugin<T>(name: string, impl?: unknown): T;
}

declare module "@capacitor/app" {
  export interface AppState {
    isActive: boolean;
  }
  export const App: {
    addListener: (
      event: string,
      cb: (state: AppState) => void,
    ) => Promise<{ remove: () => void }>;
  };
}

declare module "@capacitor/preferences" {
  export const Preferences: {
    get: (opts: { key: string }) => Promise<{ value: string | null }>;
    set: (opts: { key: string; value: string }) => Promise<void>;
    remove: (opts: { key: string }) => Promise<void>;
  };
}

declare module "@capacitor/haptics" {
  export const Haptics: {
    impact: (opts: { style: string }) => Promise<void>;
    notification: (opts: { type: string }) => Promise<void>;
    vibrate: () => Promise<void>;
  };
  export enum ImpactStyle {
    Light = "LIGHT",
    Medium = "MEDIUM",
    Heavy = "HEAVY",
  }
  export enum NotificationType {
    Success = "SUCCESS",
    Warning = "WARNING",
    Error = "ERROR",
  }
}

declare module "@capacitor/share" {
  export const Share: {
    share: (opts: {
      title?: string;
      text?: string;
      url?: string;
      files?: string[];
      dialogTitle?: string;
    }) => Promise<{ activityType?: string } | void>;
  };
}

declare module "@capacitor/filesystem" {
  export enum Directory {
    Cache = "CACHE",
    Documents = "DOCUMENTS",
    Data = "DATA",
  }
  export const Filesystem: {
    writeFile: (opts: {
      path: string;
      data: string;
      directory: Directory;
      recursive?: boolean;
    }) => Promise<void>;
    appendFile: (opts: {
      path: string;
      data: string;
      directory: Directory;
    }) => Promise<void>;
    readFile: (opts: {
      path: string;
      directory: Directory;
    }) => Promise<{ data: string }>;
    getUri: (opts: {
      path: string;
      directory: Directory;
    }) => Promise<{ uri: string }>;
  };
}

declare module "pdfjs-dist" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(src: unknown): {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: {
          canvasContext: CanvasRenderingContext2D;
          canvas?: HTMLCanvasElement;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
    }>;
  };
}
