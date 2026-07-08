import { defineConfig } from "vite";
import path from "node:path";
import fs from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// Helper to locate boundaries and split buffers (for zero-dependency multipart parsing)
function splitBuffer(buf: Buffer, sep: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let index = 0;
  while (true) {
    const nextSep = buf.indexOf(sep, index);
    if (nextSep === -1) {
      if (index < buf.length) {
        parts.push(buf.subarray(index));
      }
      break;
    }
    parts.push(buf.subarray(index, nextSep));
    index = nextSep + sep.length;
  }
  return parts;
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    // Hostinger Local Upload Emulator Plugin
    {
      name: "hostinger-upload-emulator",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          if (urlObj.pathname === "/api/upload.php" && req.method === "POST") {
            try {
              const contentType = req.headers["content-type"] || "";
              const boundaryMatch = contentType.match(/boundary=(.+)/);
              if (!boundaryMatch) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({ status: "error", message: "Missing boundary parameter." }),
                );
                return;
              }

              const boundary = "--" + boundaryMatch[1];
              const chunks: Buffer[] = [];

              req.on("data", (chunk) => chunks.push(chunk));
              req.on("end", () => {
                const body = Buffer.concat(chunks);
                const parts = splitBuffer(body, Buffer.from(boundary));

                let module = "unknown";
                let recordId = "unknown";
                let fileBuffer: Buffer | null = null;
                let fileName = "";
                let mimeType = "";

                for (const part of parts) {
                  // Standard raw line ending is \r\n
                  const headerEndIndex = part.indexOf("\r\n\r\n");
                  if (headerEndIndex === -1) continue;

                  const headers = part.subarray(0, headerEndIndex).toString("utf-8");
                  const partContent = part.subarray(headerEndIndex + 4, part.length - 2); // Trim trailing \r\n

                  const dispositionMatch = headers.match(
                    /Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i,
                  );
                  if (!dispositionMatch) continue;

                  const name = dispositionMatch[1];
                  const rawFilename = dispositionMatch[2];

                  if (name === "module") {
                    module = partContent.toString("utf-8").trim();
                  } else if (name === "recordId") {
                    recordId = partContent
                      .toString("utf-8")
                      .trim()
                      .replace(/[^a-zA-Z0-9_-]/g, "");
                  } else if (name === "file") {
                    fileBuffer = partContent;
                    fileName = rawFilename || "file.bin";
                    const mimeMatch = headers.match(/Content-Type:\s*([^\s;]+)/i);
                    mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
                  }
                }

                if (!fileBuffer) {
                  res.writeHead(400, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ status: "error", message: "No file uploaded." }));
                  return;
                }

                // Security check on extension
                const ext = path.extname(fileName).toLowerCase().replace(/^\./, "");
                const allowedExts = ["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx"];
                if (!allowedExts.includes(ext)) {
                  res.writeHead(400, { "Content-Type": "application/json" });
                  res.end(
                    JSON.stringify({ status: "error", message: "Forbidden file extension." }),
                  );
                  return;
                }

                // Create folder paths mirroring Hostinger exactly
                const yearMonth = new Date().toISOString().slice(0, 7); // yyyy-mm
                const timestamp = Math.floor(Date.now() / 1000);
                const randomStr = Math.random().toString(36).substring(2, 6);
                const generatedName = `${recordId}-${timestamp}-${randomStr}.${ext}`;

                const relativeUploadPath = `uploads/${module}/${yearMonth}/${generatedName}`;
                const publicDirPath = path.resolve(
                  process.cwd(),
                  "public/uploads",
                  module,
                  yearMonth,
                );
                const fullSavePath = path.join(publicDirPath, generatedName);

                // Ensure local folder exists
                fs.mkdirSync(publicDirPath, { recursive: true });
                fs.writeFileSync(fullSavePath, fileBuffer);

                // Add empty index.php inside folders to match security rules
                try {
                  fs.writeFileSync(
                    path.join(path.dirname(publicDirPath), "index.php"),
                    "<?php // Silence is golden",
                  );
                  fs.writeFileSync(
                    path.join(publicDirPath, "index.php"),
                    "<?php // Silence is golden",
                  );
                } catch {
                  // Ignore minor FS errors for secondary logs
                }

                const protocol = req.headers["x-forwarded-proto"] || "http";
                const absoluteUrl = `${protocol}://${req.headers.host}/${relativeUploadPath}`;

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    status: "success",
                    file_path: relativeUploadPath,
                    file_url: absoluteUrl,
                    file_name: generatedName,
                    original_file_name: fileName,
                    mime_type: mimeType,
                    file_size: fileBuffer.length,
                  }),
                );
              });
            } catch (err: any) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "error", message: err.message }));
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: "wss",
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
          if (id.includes("xlsx")) return "vendor-xlsx";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom"))
            return "vendor-react";
        },
      },
    },
  },
});
