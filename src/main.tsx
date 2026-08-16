import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "./styles.css";
import { router } from "./router";
import { AppErrorBoundary } from "./components/app-error-boundary";
import { BrandRuntime } from "./components/brand-runtime";
import { installGlobalRendererErrorHandlers, reportUnexpectedError } from "./lib/error-handling";
import { initStartupMetrics } from "./lib/performance/startup-metrics";

installGlobalRendererErrorHandlers();
initStartupMetrics();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
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
