#!/usr/bin/env node
/** Writes public/sitemap.xml from VITE_PUBLIC_APP_URL or default beta domain. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const base = (process.env.VITE_PUBLIC_APP_URL || "https://maatarajewellers.shop").replace(
  /\/$/,
  "",
);

const paths = [
  "/",
  "/features",
  "/pricing",
  "/contact",
  "/faq",
  "/tutorials",
  "/downloads",
  "/whats-new",
  "/blog",
  "/trial/start",
  "/login",
  "/solutions/manufacturing",
  "/solutions/wholesale",
  "/legal/privacy",
  "/legal/terms",
  "/legal/refund",
];

const today = new Date().toISOString().slice(0, 10);
const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (p) => `  <url>
    <loc>${base}${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p === "/" ? "1.0" : "0.7"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const outPublic = path.join(root, "public", "sitemap.xml");
const outDist = path.join(root, "dist", "sitemap.xml");
fs.writeFileSync(outPublic, body);
if (fs.existsSync(path.join(root, "dist"))) {
  fs.writeFileSync(outDist, body);
}
console.log(`sitemap.xml → ${base} (${paths.length} URLs)`);
