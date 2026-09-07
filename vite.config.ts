import { defineConfig, type ServerOptions } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const hmrConfig: ServerOptions["hmr"] =
  process.env.VITE_HMR_PROTOCOL || process.env.VITE_HMR_CLIENT_PORT
    ? {
        protocol: process.env.VITE_HMR_PROTOCOL as "ws" | "wss" | undefined,
        clientPort: process.env.VITE_HMR_CLIENT_PORT
          ? Number(process.env.VITE_HMR_CLIENT_PORT)
          : undefined,
      }
    : undefined;

export default defineConfig({
  // Absolute base. "./" (relative) was required for Electron's file://
  // protocol — now removed — but breaks every deep link on the web: from
  // a nested route like /invite/accept, a relative "./assets/x.js" resolves
  // to /invite/assets/x.js, which 404s into the SPA fallback (index.html),
  // so the browser gets HTML where it expected a JS module and the whole
  // app fails to boot. Confirmed via Playwright against the live deploy.
  base: "/",
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@capacitor/core": path.resolve(__dirname, "./src/lib/native/capacitor-core-shim.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: hmrConfig,
    watch: {
      ignored: ["**/.agents/**", "**/electron-app/**", "**/dist/**", "**/coverage/**"],
    },
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("exceljs")) return "vendor-exceljs";
          if (id.includes("jspdf")) return "vendor-jspdf";
          if (id.includes("html2canvas")) return "vendor-html2canvas";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom"))
            return "vendor-react";
        },
      },
    },
  },
});
