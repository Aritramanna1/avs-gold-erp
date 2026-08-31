/**
 * Functional route/module audit: editable src vs shop CVsE73i6 assets.
 * Outputs _reconstruction/functional-audit.json
 */
import fs from "fs";
import path from "path";

const SHOP_DIR = "production-dist-shop/assets";
const SHOP_INDEX = path.join(SHOP_DIR, "index-CVsE73i6.js");
const EXTRACT = "C:/Users/aritr/Downloads/Jewellery/AVS-FULL-SOURCE-EXTRACT/01-online-avs-ornexa";

function walkRoutes(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkRoutes(p, acc);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".gen.ts")) acc.push(p);
  }
  return acc;
}

function routePathFromFile(rel) {
  let s = rel.replace(/^src[/\\]routes[/\\]/, "").replace(/\.tsx?$/, "");
  if (s === "index") return "/";
  s = s.replace(/\./g, "/").replace(/\$/g, ":");
  if (s.endsWith("/index")) s = s.slice(0, -6) || "/";
  return "/" + s.replace(/\\/g, "/");
}

function stripHash(name) {
  const m = name.match(/^(.*)-([A-Za-z0-9_-]{6,14})\.js$/);
  return m ? m[1] : name.replace(/\.js$/, "");
}

function shopHas(needle) {
  if (shopIndex.includes(needle)) return { index: true, chunks: [] };
  const chunks = [];
  for (const f of shopAssets) {
    const t = fs.readFileSync(path.join(SHOP_DIR, f), "utf8");
    if (t.includes(needle)) chunks.push(f);
  }
  return { index: false, chunks: chunks.slice(0, 5) };
}

const shopAssets = fs.readdirSync(SHOP_DIR).filter((f) => f.endsWith(".js"));
const shopIndex = fs.readFileSync(SHOP_INDEX, "utf8");
const shopBasenames = new Set(shopAssets.map(stripHash));

const routeFiles = walkRoutes("src/routes");
const srcRoutes = routeFiles.map((f) => ({
  file: f.replace(/\\/g, "/"),
  path: routePathFromFile(f.replace(/\\/g, "/")),
}));

// Modules owner asked about
const MODULES = [
  { id: "home", needles: ["/app", "OperationalHomeLinks", "get_home_dashboard_summary"] },
  { id: "master_group", needles: ["Master", "Group", "catalog.masters", "/catalog/masters", "item_masters"] },
  { id: "folders", needles: ["folder", "Folder", "attachments"] },
  { id: "stamps", needles: ["stamp", "Stamp", "filings-slip"] },
  { id: "staging_warning", needles: ["staging", "warning", "SourceOfTruthBadge", "partial failure"] },
  { id: "crm", needles: ["/crm", "crm-leads", "leads"] },
  { id: "assistant", needles: ["/assistant", "assistant-tts", "Ornexa Assistant"] },
  { id: "ceo", needles: ["CEO (View Only)", "CEO"] },
  { id: "boolean", needles: ["boolean", "Boolean"] },
  { id: "schemes", needles: ["/scheme", "scheme-store", "scheme.accounts"] },
  { id: "dice", needles: ["dice", "Dice", "/dice"] },
  { id: "wipe", needles: ["wipeout", "wipe", "Wipe", "utilities.wipeout"] },
  { id: "manufacturing", needles: ["/manufacturing", "manufacturing_bill", "ManufacturingModule"] },
  { id: "outstanding", needles: ["outstanding", "Outstanding", "get_billing_outstanding_summary"] },
  { id: "outside_work", needles: ["outside-work", "outside_work", "Outside Work", "jangad"] },
  { id: "mtg", needles: ["/mtg", "mtg.index"] },
  { id: "workflows", needles: ["/workflows", "workflows"] },
  { id: "utilities", needles: ["/utilities", "utilities.index"] },
  { id: "erp_audit", needles: ["erp-audit", "run-audit"] },
  { id: "data_loader", needles: ["pullPeople", "pullBackground", "STARTUP_LEDGER_CACHE_LIMIT"] },
];

const moduleAudit = MODULES.map((m) => {
  const srcHits = m.needles.filter((n) =>
    routeFiles.some((f) => fs.readFileSync(f, "utf8").includes(n)) ||
    (fs.existsSync("src/lib") && walkRoutes("src/lib").some((lf) => {
      try { return fs.readFileSync(lf, "utf8").includes(n); } catch { return false; }
    })),
  );
  const shopHits = m.needles.map((n) => ({ needle: n, ...shopHas(n) }));
  const inShop = shopHits.some((h) => h.index || h.chunks.length);
  const srcRoute = srcRoutes.filter((r) => m.needles.some((n) => r.path.includes(n.replace(/^\//, "")) || r.file.includes(n)));
  return { id: m.id, inShop, srcHits, shopHits, srcRoutes: srcRoute.map((r) => r.path) };
});

// Src routes whose basename chunk not in shop (possible invented)
const srcOnlySuspect = [];
const shopMissingBaseline = [];
for (const r of srcRoutes) {
  const base = path.basename(r.file, path.extname(r.file)).replace(/\$/g, "._");
  const alt = base.replace(/\./g, ".");
  const found =
    shopBasenames.has(base) ||
    shopBasenames.has(alt) ||
    shopIndex.includes(r.path) ||
    [...shopBasenames].some((b) => b.startsWith(base.split(".")[0]));
  if (!found && !["__root", "mtg", "mtg.index", "catalog.masters"].includes(path.basename(r.file, ".tsx"))) {
    srcOnlySuspect.push(r);
  }
}

// Shop route-like chunks not represented in src filenames
const srcBasenames = new Set(routeFiles.map((f) => path.basename(f, path.extname(f)).replace(/\$/g, "._")));
const shopRouteGaps = [];
for (const b of [...shopBasenames].sort()) {
  if (!/^[a-z]/.test(b)) continue;
  if (b.includes(".") || b === "index" || b === "app" || b === "login") {
    const norm = b.replace(/\._/g, ".$").replace(/\$/g, ".");
    const srcMatch = [...srcBasenames].some(
      (s) => s === b || s.replace(/\$/g, "._") === b || s.replace(/\./g, ".") === norm,
    );
    if (!srcMatch && !/^(arrow-|chevron-|vendor-|createLucide|useRouter|useStore|ClientOnly|not-found|rolldown|react|dist|esm|es2015|middleware|matchContext|pdf\.worker|purify|bwip|JsBarcode)/.test(b)) {
      shopRouteGaps.push(b);
    }
  }
}

// Extract-only routes
let extractOnly = [];
if (fs.existsSync(path.join(EXTRACT, "src/routes"))) {
  const extRoutes = walkRoutes(path.join(EXTRACT, "src/routes")).map((f) =>
    path.basename(f, path.extname(f)),
  );
  const srcNames = routeFiles.map((f) => path.basename(f, path.extname(f)));
  extractOnly = extRoutes.filter((n) => !srcNames.includes(n));
}

const report = {
  generatedAt: new Date().toISOString(),
  shopUniqueChunks: shopBasenames.size,
  srcRouteCount: srcRoutes.length,
  moduleAudit,
  srcOnlySuspect: srcOnlySuspect.slice(0, 40).map((r) => ({ path: r.path, file: r.file })),
  srcOnlySuspectCount: srcOnlySuspect.length,
  shopRouteGaps: shopRouteGaps.slice(0, 60),
  shopRouteGapsCount: shopRouteGaps.length,
  extractOnlyRoutes: extractOnly,
  mtgInShop: shopHas("/mtg"),
  catalogMastersInShop: shopHas("catalog.masters"),
};

fs.writeFileSync("_reconstruction/functional-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  srcRoutes: srcRoutes.length,
  srcOnlySuspect: srcOnlySuspect.length,
  shopRouteGaps: shopRouteGaps.length,
  extractOnly: extractOnly.length,
  modules: moduleAudit.map((m) => ({ id: m.id, inShop: m.inShop, srcRoutes: m.srcRoutes })),
}, null, 2));
