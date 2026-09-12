import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "./styles.css";
import { router } from "./router";
import { AppErrorBoundary } from "./components/app-error-boundary";
import { BrandRuntime } from "./components/brand-runtime";
import { installGlobalRendererErrorHandlers, reportUnexpectedError } from "./lib/error-handling";
import { initStartupMetrics } from "./lib/performance/startup-metrics";
import { installPushMessageListener } from "./lib/deep-link";

installGlobalRendererErrorHandlers();
initStartupMetrics();
installPushMessageListener();

// Auto-reload when dynamic chunk hashes change after a new build/deployment
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const reloadKey = `mtj_preload_reload_${window.location.pathname}`;
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 10000) {
      sessionStorage.setItem(reloadKey, String(now));
      window.location.reload();
    }
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.update().catch(() => undefined);
      })
      .catch(() => undefined);
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  reportUnexpectedError(new Error("Root element #root not found"), "renderer.bootstrap");
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrandRuntime />
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </StrictMode>,
);
