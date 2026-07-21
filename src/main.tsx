import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "./styles.css";
import { router } from "./router";
import { AppErrorBoundary } from "./components/app-error-boundary";
import { BrandRuntime } from "./components/brand-runtime";
import { installGlobalRendererErrorHandlers, reportUnexpectedError } from "./lib/error-handling";

installGlobalRendererErrorHandlers();

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
